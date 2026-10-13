/* global document, window, MouseEvent, PointerEvent, requestAnimationFrame */
import assert from 'node:assert/strict';

export async function smokeInlineToolbarSelection(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const original = await editor.save();
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const select = async (target, start, end) => {
      target.focus();
      const range = document.createRange();
      range.setStart(target.firstChild, start);
      range.setEnd(target.firstChild, end);
      const selection = target.getRootNode().getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      await tick();
    };
    const palette = async (target, toolbar, title, value) => {
      const input = toolbar.querySelector(`[aria-label="${title}"]`);
      check(!toolbar.hidden && !input.disabled, `${title} is enabled for selected text`);
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
      input.focus();
      // Native color dialogs can remove DOM ranges and leave the page without a focused control.
      const selection = target.getRootNode().getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      input.blur();
      await tick();
      check(
        !toolbar.hidden && !input.disabled,
        `${title} retains toolbar and saved selection during native picker blur`,
      );
      input.value = value;
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
      await tick();
      check(!toolbar.hidden, `${title} keeps toolbar after applying color`);
      check(selection.toString() === 'Alpha', `${title} restores the original text selection`);
    };
    try {
      await editor.render({
        blocks: [
          { id: 'palette-text', type: 'paragraph', data: { text: 'Alpha Beta' } },
          { id: 'palette-table', type: 'confluenceTable', data: { rows: [['Table Alpha Beta', 'Untouched']] } },
        ],
      });
      const text = editor.views[0].content.firstElementChild;
      const root = editor.views[1].content.querySelector('slash-tool-surface').shadowRoot;
      const cell = root.querySelector('.ct-cell');
      const cases = [
        { target: text, toolbar: document.querySelector('body > .slash-text-inline-toolbar'), start: 0, end: 5 },
        { target: cell, toolbar: root.querySelector('.slash-text-inline-toolbar'), start: 6, end: 11 },
      ];
      for (const { target, toolbar, start, end } of cases) {
        await select(target, start, end);
        await palette(target, toolbar, 'Цвет текста', '#112233');
        await palette(target, toolbar, 'Фон выделения', '#fef08a');
        check(
          target.querySelector('[data-slash-text-color]').textContent === 'Alpha' &&
            target.querySelector('[data-slash-text-background]').textContent === 'Alpha',
          'Colors affect only the original selected substring',
        );
        const selection = target.getRootNode().getSelection?.() ?? window.getSelection();
        const retained = selection.getRangeAt(0).cloneRange();
        editor.views[0].holder.querySelector('.slash-block-handle').focus();
        selection.removeAllRanges();
        selection.addRange(retained);
        await tick();
        check(!toolbar.hidden, 'Losing focus does not close toolbar while text selection remains');
        selection.removeAllRanges();
        await tick();
        check(toolbar.hidden, 'Clearing selection closes toolbar without stale cached ranges reopening it');
      }
      const saved = await editor.save();
      check(
        saved.blocks[0].data.text.includes('#112233') &&
          saved.blocks[0].data.text.includes('#fef08a') &&
          saved.blocks[1].data.rows[0][0].includes('#112233') &&
          saved.blocks[1].data.rows[0][0].includes('#fef08a') &&
          saved.blocks[1].data.rows[0][1] === 'Untouched',
        'Paragraph/table colors persist without changing other cells',
      );
      return true;
    } finally {
      await editor.render(original);
    }
  });
  assert.equal(result, true);
  console.log(
    'Inline selection smoke passed: picker focus/blur, preserved substring, consecutive colors, focus-independent visibility and selection reset.',
  );
}
