/* global document, window, KeyboardEvent */
import assert from 'node:assert/strict';

export async function smokeTableClipboard(frame, page) {
  const original = await frame.evaluate(() => document.querySelector('slash-doc-editor').save());
  const protocol = await page.target().createCDPSession();
  await protocol.send('Browser.grantPermissions', {
    origin: new URL(frame.url()).origin,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  const shortcut = async (key, modifier = 'Meta') => {
    await page.keyboard.down(modifier);
    await page.keyboard.press(key);
    await page.keyboard.up(modifier);
  };
  const focus = async (row = 0, column = 0, offset) =>
    frame.evaluate(
      ({ row, column, offset }) => {
        const root = document.querySelector('slash-tool-surface').shadowRoot;
        const cell = root.querySelector(`.ct-cell[data-row="${row}"][data-column="${column}"]`);
        cell.focus();
        const range = document.createRange();
        range.selectNodeContents(cell);
        if (offset === undefined) range.collapse(false);
        else {
          range.setStart(cell.firstChild, offset);
          range.collapse(true);
        }
        const selection = root.getSelection?.() ?? window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      },
      { row, column, offset },
    );
  const rows = () =>
    frame.evaluate(async () => (await document.querySelector('slash-doc-editor').save()).blocks[1].data.rows);
  const write = (text) => frame.evaluate((text) => navigator.clipboard.writeText(text), text);
  try {
    await frame.evaluate(async () => {
      await document.querySelector('slash-doc-editor').render({
        blocks: [
          { type: 'paragraph', data: { text: 'Outside' } },
          {
            type: 'confluenceTable',
            data: {
              rows: [
                ['Base', 'Keep'],
                ['Other', 'End'],
              ],
            },
          },
        ],
      });
    });
    await focus();
    await write(' Native');
    await shortcut('KeyV');
    await frame.waitForFunction(
      () =>
        document.querySelector('slash-tool-surface').shadowRoot.querySelector('.ct-cell').textContent === 'Base Native',
      { timeout: 3000 },
    );
    assert.equal((await rows())[0][1], 'Keep', 'Native paste changes only the current cell');

    await write('A\tB\nC\tD');
    await shortcut('KeyV');
    await frame.waitForFunction(
      () => document.querySelector('slash-tool-surface').shadowRoot.querySelector('.ct-cell').textContent === 'A',
      { timeout: 3000 },
    );
    assert.deepEqual(
      await rows(),
      [
        ['A', 'B'],
        ['C', 'D'],
      ],
      'Native clipboard rectangle fills table cells',
    );
    assert.equal(
      await frame.evaluate(() =>
        document.querySelector('slash-tool-surface').shadowRoot.activeElement?.classList.contains('ct-cell'),
      ),
      true,
      'Table paste retains editable cell focus',
    );

    for (const modifier of ['Control', 'Meta']) {
      await focus(1, 1);
      await shortcut('KeyA', modifier);
      const selection = await frame.evaluate(() => {
        const root = document.querySelector('slash-tool-surface').shadowRoot;
        const range = (root.getSelection?.() ?? window.getSelection()).getRangeAt(0);
        return { text: range.toString(), local: root.activeElement.contains(range.commonAncestorContainer) };
      });
      assert.deepEqual(selection, { text: 'D', local: true }, `${modifier}+A selects only active cell text`);
    }
    await write('Replaced');
    await shortcut('KeyV', 'Control');
    await frame.waitForFunction(
      () =>
        document.querySelector('slash-tool-surface').shadowRoot.querySelector('[data-row="1"][data-column="1"]')
          .textContent === 'Replaced',
      { timeout: 3000 },
    );
    assert.deepEqual(
      await rows(),
      [
        ['A', 'B'],
        ['C', 'Replaced'],
      ],
      'Ctrl+V replaces only selected cell text',
    );

    await focus(0, 1);
    await shortcut('KeyA');
    await frame.evaluate(() =>
      navigator.clipboard.write([
        new window.ClipboardItem({
          'text/plain': new window.Blob(['Rich'], { type: 'text/plain' }),
          'text/html': new window.Blob(['<b>Rich</b>'], { type: 'text/html' }),
        }),
      ]),
    );
    await protocol.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      code: 'KeyV',
      key: 'v',
      modifiers: 4,
      windowsVirtualKeyCode: 86,
      commands: ['paste'],
    });
    await protocol.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      code: 'KeyV',
      key: 'v',
      modifiers: 4,
      windowsVirtualKeyCode: 86,
    });
    await frame.waitForFunction(
      () =>
        document.querySelector('slash-tool-surface').shadowRoot.querySelector('[data-row="0"][data-column="1"] b')
          ?.textContent === 'Rich',
      { timeout: 3000 },
    );
    assert.equal(
      (await rows())[0][1],
      '<b>Rich</b>',
      'Native rich paste preserves HTML without duplicate text fallback',
    );
    const cancellation = await frame.evaluate(async () => {
      const root = document.querySelector('slash-tool-surface').shadowRoot;
      const cell = root.activeElement;
      const originalRead = window.__SLASH_DOC_READ_CLIPBOARD__;
      const before = cell.innerHTML;
      let resolveRead;
      let started;
      const reading = new Promise((resolve) => {
        started = resolve;
      });
      window.__SLASH_DOC_READ_CLIPBOARD__ = () =>
        new Promise((resolve) => {
          resolveRead = resolve;
          started();
        });
      try {
        cell.dispatchEvent(
          new KeyboardEvent('keydown', {
            code: 'KeyV',
            key: 'v',
            ctrlKey: true,
            bubbles: true,
            composed: true,
            cancelable: true,
          }),
        );
        await reading;
        cell.dispatchEvent(
          new KeyboardEvent('keydown', {
            code: 'ArrowLeft',
            key: 'ArrowLeft',
            bubbles: true,
            composed: true,
            cancelable: true,
          }),
        );
        resolveRead('Stale clipboard');
        await new Promise((resolve) => setTimeout(resolve, 0));
        return cell.innerHTML === before;
      } finally {
        window.__SLASH_DOC_READ_CLIPBOARD__ = originalRead;
      }
    });
    assert.equal(cancellation, true, 'Moving the caret cancels delayed paste so it cannot replace a newer selection');
  } finally {
    await frame.evaluate((data) => document.querySelector('slash-doc-editor').render(data), original);
    await protocol.detach();
  }
  console.log(
    'Table clipboard smoke passed: Ctrl/Cmd+A, Ctrl/Cmd+V replacement, host fallback, native rich paste without duplicates, rectangle paste and retained focus.',
  );
}
