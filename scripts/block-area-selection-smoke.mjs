/* global document, window */
import assert from 'node:assert/strict';

export async function smokeBlockAreaSelection(frame, page) {
  const original = await frame.evaluate(async () => document.querySelector('slash-doc-editor').save());
  const viewport = page.viewport();
  await page.setViewport({ width: 1200, height: 1000 });
  const fixture = {
    blocks: [
      { id: 'area-a', type: 'paragraph', data: { text: 'First selectable text' } },
      {
        id: 'area-b',
        type: 'confluenceTable',
        data: {
          rows: [
            ['', ''],
            ['', ''],
          ],
        },
      },
      { id: 'area-c', type: 'quote', data: { text: 'Third block' } },
      { id: 'area-d', type: 'paragraph', data: { text: 'Last block' } },
    ],
  };
  const selected = () => frame.evaluate(() => [...document.querySelector('slash-doc-editor').selected]);
  const offset = async () =>
    page.evaluate(() => {
      const rect = document
        .querySelector('#slash-doc-gitlab')
        .shadowRoot.querySelector('iframe')
        .getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    });
  const points = async (from, to, reverse = false) =>
    frame.evaluate(
      ({ from, to, reverse }) => {
        const editor = document.querySelector('slash-doc-editor');
        const bounds = editor.getBoundingClientRect();
        const first = editor.views[from].holder.getBoundingClientRect();
        const last = editor.views[to].content.getBoundingClientRect();
        return reverse
          ? [
              { x: bounds.right + 12, y: last.bottom + 10 },
              { x: bounds.right - 30, y: first.top + 10 },
            ]
          : [
              { x: bounds.left - 12, y: first.top - 4 },
              { x: bounds.left + 30, y: last.bottom - 2 },
            ];
      },
      { from, to, reverse },
    );
  const drag = async (ends, release = true) => {
    const origin = await offset();
    await page.mouse.move(origin.x + ends[0].x, origin.y + ends[0].y);
    await page.mouse.down();
    await page.mouse.move(origin.x + ends[1].x, origin.y + ends[1].y, { steps: 12 });
    if (release) await page.mouse.up();
  };
  let parentStyle;
  try {
    await frame.evaluate((data) => document.querySelector('slash-doc-editor').render(data), fixture);
    const saved = await frame.evaluate(async () => document.querySelector('slash-doc-editor').save());
    await drag(await points(1, 2), false);
    assert.deepEqual(await selected(), ['area-b', 'area-c'], 'Marquee intersects table and quote');
    assert.equal(await frame.evaluate(() => Boolean(document.querySelector('.slash-block-selection-area'))), true);
    await page.mouse.up();
    assert.equal(await frame.evaluate(() => Boolean(document.querySelector('.slash-block-selection-area'))), false);
    assert.deepEqual(
      await frame.evaluate(async () => document.querySelector('slash-doc-editor').save()),
      saved,
      'Selection and mouseup leave document unchanged',
    );
    const copied = await frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      const write = window.__SLASH_DOC_WRITE_CLIPBOARD__;
      let payload;
      window.__SLASH_DOC_WRITE_CLIPBOARD__ = (text) => {
        payload = text;
      };
      try {
        await editor.copySelection();
      } finally {
        window.__SLASH_DOC_WRITE_CLIPBOARD__ = write;
      }
      return JSON.parse(payload.split('\n').slice(1).join('\n')).blocks.map((block) => block.id);
    });
    assert.deepEqual(copied, ['area-b', 'area-c'], 'Marquee group copies in document order');
    await page.keyboard.down('Control');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.up('Control');
    assert.deepEqual(
      await frame.evaluate(() => document.querySelector('slash-doc-editor').views.map((view) => view.output.id)),
      ['area-a', 'area-d', 'area-b', 'area-c'],
      'Marquee group moves with native shortcut',
    );

    await frame.evaluate((data) => document.querySelector('slash-doc-editor').render(data), fixture);
    await drag(await points(1, 2, true));
    assert.deepEqual(await selected(), ['area-b', 'area-c'], 'Reverse rectangle selects the same group');
    for (const modifier of ['Control', 'Meta', 'Shift']) {
      await frame.evaluate(() => document.querySelector('slash-doc-editor').selectBlock('area-a'));
      await page.keyboard.down(modifier);
      await drag(await points(2, 2));
      await page.keyboard.up(modifier);
      assert.deepEqual(await selected(), ['area-a', 'area-c'], `${modifier} extends selection`);
    }
    await drag(await points(1, 2), false);
    await page.keyboard.press('Escape');
    assert.deepEqual(await selected(), ['area-a', 'area-c'], 'Escape restores previous selection');
    await page.mouse.up();
    assert.equal(
      await frame.evaluate(() => document.querySelector('slash-doc-editor').views.length),
      4,
      'Mouseup after Escape creates no paragraph',
    );

    // Starting in an insertion strip must preserve simple clicks and support drags.
    const strip = await frame.evaluate(() => {
      const rect = document.querySelector('.slash-block-insertion-space').getBoundingClientRect();
      return { x: rect.left + 20, y: rect.top + rect.height / 2 };
    });
    const ends = await points(1, 2);
    await drag([strip, ends[1]]);
    assert.deepEqual(await selected(), ['area-b', 'area-c']);
    assert.equal(await frame.evaluate(() => document.querySelector('slash-doc-editor').views.length), 4);
    const origin = await offset();
    await page.mouse.click(origin.x + strip.x, origin.y + strip.y);
    assert.equal(
      await frame.evaluate(() => document.querySelector('slash-doc-editor').views.length),
      5,
      'Simple whitespace click still inserts text',
    );

    await frame.evaluate((data) => document.querySelector('slash-doc-editor').render(data), fixture);
    const text = await frame.evaluate(() => {
      const node = document.querySelector('.ce-paragraph').firstChild;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return [
        { x: rect.left + 1, y: rect.top + rect.height / 2 },
        { x: rect.right - 1, y: rect.top + rect.height / 2 },
      ];
    });
    await drag(text);
    assert.equal((await selected()).length, 0, 'Text drag does not select blocks');
    assert.ok(
      await frame.evaluate(() => window.getSelection().toString().includes('selectable')),
      'Native text selection',
    );

    parentStyle = await frame.evaluate(() => {
      const parent = document.querySelector('slash-doc-editor').parentElement;
      const style = parent.getAttribute('style');
      parent.style.height = '380px';
      parent.style.overflowY = 'auto';
      return style;
    });
    const long = {
      blocks: Array.from({ length: 18 }, (_, i) => ({
        id: `scroll-${i}`,
        type: 'paragraph',
        data: { text: `Block ${i}` },
      })),
    };
    await frame.evaluate((data) => document.querySelector('slash-doc-editor').render(data), long);
    const scrollPoints = await frame.evaluate(() => {
      const editor = document.querySelector('slash-doc-editor');
      editor.parentElement.scrollTop = 0;
      const parent = editor.parentElement.getBoundingClientRect();
      const block = editor.views[0].holder.getBoundingClientRect();
      return [
        { x: block.left - 12, y: block.top - 4 },
        { x: block.left + 20, y: parent.bottom - 4 },
      ];
    });
    await drag(scrollPoints, false);
    await frame.waitForFunction(() => document.querySelector('slash-doc-editor').parentElement.scrollTop > 120);
    await page.mouse.up();
    assert.ok((await selected()).length > 4, 'Auto-scroll extends group beyond initial viewport');
    assert.equal(await frame.evaluate(() => document.querySelector('slash-doc-editor').views.length), 18);
  } finally {
    await page.mouse.up();
    await frame.evaluate(
      async ({ original, parentStyle }) => {
        const editor = document.querySelector('slash-doc-editor');
        if (parentStyle !== undefined) {
          if (parentStyle === null) editor.parentElement.removeAttribute('style');
          else editor.parentElement.setAttribute('style', parentStyle);
        }
        await editor.render(original);
      },
      { original, parentStyle },
    );
    await page.setViewport(viewport);
  }
  console.log(
    'Block area selection smoke passed: native marquee, reverse/additive selection, cancellation, copy/move, text, insertion and auto-scroll.',
  );
}
