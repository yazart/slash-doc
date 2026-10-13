/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';

export async function smokeCellSelectionColors(frame, page) {
  const original = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const saved = await editor.save();
    await editor.render({
      blocks: [
        {
          type: 'confluenceTable',
          data: {
            headerRow: true,
            rowHeights: [90, 110, 36],
            columnWidths: [140, 200, 120],
            rows: [
              ['', '', ''],
              ['', '', ''],
              ['', '', ''],
            ],
          },
        },
      ],
    });
    editor.scrollIntoView({ block: 'start' });
    return saved;
  });
  try {
    const offset = await page.evaluate(() => {
      const rect = document
        .querySelector('#slash-doc-gitlab')
        .shadowRoot.querySelector('iframe')
        .getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    });
    const points = await frame.evaluate(() => {
      const root = document.querySelector('slash-tool-surface').shadowRoot;
      return ['[data-row="0"][data-column="0"]', '[data-row="1"][data-column="1"]'].map((selector) => {
        const rect = root.querySelector(`.ct-cell${selector}`).parentElement.getBoundingClientRect();
        return { x: rect.left + 4, y: rect.bottom - 12 };
      });
    });
    await page.mouse.move(offset.x + points[0].x, offset.y + points[0].y);
    await page.mouse.down();
    await page.mouse.move(offset.x + points[1].x, offset.y + points[1].y, { steps: 8 });
    await page.mouse.up();
    await frame.waitForFunction(() => {
      const root = document.querySelector('slash-tool-surface').shadowRoot;
      return (
        root.querySelectorAll('.ct-cell.range-selected').length === 4 &&
        root.querySelector('.slash-text-inline-toolbar').hidden
      );
    });
    const geometry = await frame.evaluate(() => {
      const root = document.querySelector('slash-tool-surface').shadowRoot;
      return [...root.querySelectorAll('.ct-cell.range-selected')].map((editable) => {
        const cell = editable.parentElement;
        const overlay = getComputedStyle(cell, '::after');
        return {
          tag: cell.tagName,
          fullHeight: cell.getBoundingClientRect().height,
          contentHeight: editable.getBoundingClientRect().height,
          overlayWidth: parseFloat(overlay.width),
          overlayHeight: parseFloat(overlay.height),
          width: cell.clientWidth,
          height: cell.clientHeight,
          pointerEvents: overlay.pointerEvents,
          textBackground: getComputedStyle(editable).backgroundColor,
        };
      });
    });
    assert.deepEqual(
      geometry.map(({ tag }) => tag),
      ['TH', 'TH', 'TD', 'TD'],
    );
    for (const cell of geometry) {
      assert.ok(cell.fullHeight - cell.contentHeight > 30, 'Fixture includes blank area below contenteditable');
      assert.ok(
        Math.abs(cell.overlayWidth - cell.width) <= 1 && Math.abs(cell.overlayHeight - cell.height) <= 1,
        'Selection overlay covers the full cell width and height',
      );
      assert.equal(cell.pointerEvents, 'none', 'Overlay allows selection, editing and resize events');
      assert.equal(cell.textBackground, 'rgba(0, 0, 0, 0)', 'Contenteditable has no separate selection background');
    }
    const colors = await frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      const input = editor.views[0].holder.querySelector('.ct-header-controls [aria-label="Фон ячеек"]');
      if (input.disabled) throw new Error('Group fill disabled after pointer selection');
      input.value = '#c4b5fd';
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
      return (await editor.save()).blocks[0].data.cellBackgrounds;
    });
    assert.deepEqual(colors, [
      ['#c4b5fd', '#c4b5fd', ''],
      ['#c4b5fd', '#c4b5fd', ''],
      ['', '', ''],
    ]);
    const resize = await frame.evaluate(() => {
      const root = document.querySelector('slash-tool-surface').shadowRoot;
      const handle = root.querySelectorAll('.ct-row-resize')[1].getBoundingClientRect();
      return { x: handle.left + handle.width / 2, y: handle.top + handle.height / 2 };
    });
    await page.mouse.move(offset.x + resize.x, offset.y + resize.y);
    await page.mouse.down();
    await page.mouse.move(offset.x + resize.x, offset.y + resize.y + 25, { steps: 6 });
    await page.mouse.up();
    const height = await frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      return (await editor.save()).blocks[0].data.rowHeights[1];
    });
    assert.ok(height >= 130, 'Full-cell interaction keeps row resize working');
  } finally {
    await frame.evaluate((saved) => document.querySelector('slash-doc-editor').render(saved), original);
  }
  console.log(
    'Cell selection colors smoke passed: full-cell selection in header/body blank areas, overlay geometry, group fill and resize.',
  );
}
