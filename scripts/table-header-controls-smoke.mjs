/* global document, window, MouseEvent, PointerEvent, requestAnimationFrame */
import assert from 'node:assert/strict';

export async function smokeTableHeaderControls(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const original = await editor.save();
    const originalRead = window.__SLASH_DOC_READ_CLIPBOARD__;
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const root = () => editor.views[0].content.querySelector('slash-tool-surface').shadowRoot;
    const header = () => editor.views[0].holder.querySelector('.ct-header-controls');
    const cell = (row = 0, column = 0) => root().querySelector(`.ct-cell[data-row="${row}"][data-column="${column}"]`);
    const data = async () => (await editor.save()).blocks[0].data;
    const click = async (title) => {
      const control = header().querySelector(`[aria-label="${title}"]`);
      check(control && !control.disabled, `${title} is available in block header`);
      const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
      control.dispatchEvent(event);
      check(event.defaultPrevented, `${title} preserves table selection on pointerdown`);
      control.click();
      await tick();
    };
    try {
      await editor.render({
        blocks: [
          {
            id: 'table-header',
            type: 'confluenceTable',
            data: {
              rows: [
                ['A', 'B'],
                ['C', 'D'],
              ],
            },
          },
        ],
      });
      cell(1, 1).focus();
      const range = document.createRange();
      range.selectNodeContents(cell(1, 1));
      range.collapse(false);
      root().getSelection().removeAllRanges();
      root().getSelection().addRange(range);
      cell(1, 1).dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      await tick();
      check(root().querySelector('.slash-text-inline-toolbar').hidden, 'Caret alone does not show inline toolbar');
      await click('Добавить строку');
      check(
        (await data()).rows.length === 3 && (await data()).rows[2].join('') === '',
        'Row is added after current row',
      );
      await click('Удалить строку');
      check(
        JSON.stringify((await data()).rows) ===
          JSON.stringify([
            ['A', 'B'],
            ['C', 'D'],
          ]),
        'Only newly selected row is removed',
      );
      await click('Добавить столбец');
      check(
        (await data()).rows.every((row) => row.length === 3 && row[2] === ''),
        'Column is added after current column',
      );
      await click('Удалить столбец');
      check(
        JSON.stringify((await data()).rows) ===
          JSON.stringify([
            ['A', 'B'],
            ['C', 'D'],
          ]),
        'Only newly selected column is removed',
      );
      let reads = 0;
      window.__SLASH_DOC_READ_CLIPBOARD__ = async () => {
        reads++;
        return 'P\tQ\nR\tS';
      };
      await click('Вставить из буфера');
      check(
        reads === 1 &&
          JSON.stringify((await data()).rows) ===
            JSON.stringify([
              ['A', 'B', ''],
              ['C', 'P', 'Q'],
              ['', 'R', 'S'],
            ]),
        'Header paste inserts clipboard rectangle at the current cell and expands the table',
      );
      check(root().activeElement === cell(1, 1), 'Header actions retain table focus');
      check(root().querySelector('.slash-text-inline-toolbar').hidden, 'Range paste does not open text toolbar');
      const textRange = document.createRange();
      textRange.selectNodeContents(cell(1, 1));
      root().getSelection().removeAllRanges();
      root().getSelection().addRange(textRange);
      cell(1, 1).dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      await tick();
      const inline = root().querySelector('.slash-text-inline-toolbar');
      check(
        !inline.hidden && !inline.querySelector('[aria-label="Фон ячеек"], [aria-label="Фон строки"]'),
        'Inline toolbar appears only for selected text and contains no cell/row fill controls',
      );
      root().getSelection().collapseToEnd();
      await tick();
      check(inline.hidden, 'Collapsing text selection hides inline toolbar');
      await editor.api.readOnly.toggle(true);
      check(!header(), 'Read-only table has no header controls');
      return true;
    } finally {
      window.__SLASH_DOC_READ_CLIPBOARD__ = originalRead;
      editor.config.readOnly = false;
      await editor.render(original);
    }
  });
  assert.equal(result, true);
  console.log(
    'Table header smoke passed: row/column actions, selection preservation, clipboard rectangle/focus, text-only inline visibility and read-only.',
  );
}
