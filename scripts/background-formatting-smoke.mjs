/* global document, window, MouseEvent, requestAnimationFrame, getComputedStyle */
import assert from 'node:assert/strict';

export async function smokeBackgroundFormatting(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const original = await editor.save();
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const select = async (cell, collapsed = false) => {
      cell.focus();
      const range = document.createRange();
      range.selectNodeContents(cell);
      range.collapse(collapsed ? true : false);
      if (!collapsed) range.selectNodeContents(cell);
      const selection = cell.getRootNode().getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      await tick();
    };
    const color = (toolbar, title, value) => {
      const input = toolbar.querySelector(`[aria-label="${title}"]`);
      check(input && !input.disabled, `${title} is enabled`);
      input.value = value;
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    };
    const tableSurface = () => editor.views[1].content.querySelector('slash-tool-surface').shadowRoot;
    const cell = (row, column = 0) =>
      tableSurface().querySelector(`.ct-cell[data-row="${row}"][data-column="${column}"]`);
    const tableData = async () => (await editor.save()).blocks[1].data;
    const header = () => editor.views[1].holder.querySelector('.ct-header-controls');
    try {
      await editor.render({
        blocks: [
          {
            id: 'background-text',
            type: 'paragraph',
            data: { text: '<a href="https://example.com"><b>Alpha</b></a> Beta' },
          },
          {
            id: 'background-table',
            type: 'confluenceTable',
            data: {
              headerRow: true,
              rowBackgrounds: ['#fef08a', '#22c55e', ''],
              rows: [
                ['Heading', 'Value'],
                ['Body', 'Second'],
                ['', ''],
              ],
            },
          },
          {
            id: 'background-note',
            type: 'mkdocsDetails',
            data: { summary: 'Note', content: '<strong>Inside</strong>' },
          },
        ],
      });
      await tick();
      const paragraph = editor.views[0].content.firstElementChild;
      const bold = paragraph.querySelector('b');
      paragraph.focus();
      const range = document.createRange();
      range.selectNodeContents(bold);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await tick();
      const textToolbar = document.querySelector('body > .slash-text-inline-toolbar');
      color(textToolbar, 'Цвет текста', '#112233');
      color(textToolbar, 'Фон выделения', '#fef08a');
      check(
        paragraph.textContent === 'Alpha Beta' && paragraph.querySelector('b a, a b'),
        'Background keeps formatting and link',
      );
      check(
        getComputedStyle(paragraph.querySelector('[data-slash-text-background]')).backgroundColor ===
          'rgb(254, 240, 138)',
        'Text background is visible',
      );
      let saved = await editor.save();
      check(
        saved.blocks[0].data.text.includes('data-slash-text-background="#fef08a"') &&
          saved.blocks[0].data.text.includes('data-slash-text-color="#112233"'),
        'Text background and foreground save independently',
      );
      await editor.render(saved);
      await tick();
      const restored = editor.views[0].content.firstElementChild;
      await select(restored.querySelector('[data-slash-text-background]'));
      textToolbar.querySelector('[aria-label="Убрать фон выделения"]').click();
      saved = await editor.save();
      check(
        !saved.blocks[0].data.text.includes('data-slash-text-background') &&
          saved.blocks[0].data.text.includes('#112233') &&
          restored.querySelector('a b'),
        'Clear background retains foreground, link and bold',
      );

      await select(cell(1), true);
      let toolbar = tableSurface().querySelector('.slash-text-inline-toolbar');
      check(
        toolbar.hidden && !header().querySelector('[aria-label="Фон ячеек"]').disabled,
        'Cell fill is in the header while inline toolbar is hidden without text selection',
      );
      check(!toolbar.querySelector('[aria-label="Фон строки"]'), 'Row fill control is removed');
      check(!toolbar.querySelector('[aria-label="Фон ячеек"]'), 'Cell fill is removed from inline toolbar');
      color(header(), 'Фон ячеек', '#06b6d4');
      check(
        getComputedStyle(cell(1).parentElement).backgroundColor === 'rgb(6, 182, 212)' &&
          getComputedStyle(cell(1, 1).parentElement).backgroundColor === 'rgb(34, 197, 94)',
        'Only current cell receives fill, retaining legacy row color on its neighbor',
      );
      header().querySelector('[aria-label="Убрать фон ячеек"]').click();
      check(
        getComputedStyle(cell(1).parentElement).backgroundColor === 'rgb(34, 197, 94)',
        'Reset restores inherited legacy row color',
      );
      await select(cell(0), true);
      color(header(), 'Фон ячеек', '#06b6d4');
      check(
        getComputedStyle(cell(0).parentElement).backgroundColor === 'rgb(6, 182, 212)' &&
          getComputedStyle(cell(0, 1).parentElement).backgroundColor === 'rgb(254, 240, 138)',
        'Header fill affects only the selected header cell',
      );
      await select(cell(1));
      color(toolbar, 'Фон выделения', '#c4b5fd');
      check(
        (await tableData()).rows[1][0].includes('data-slash-text-background="#c4b5fd"'),
        'Cell text background is independent of row fill',
      );

      saved = await editor.save();
      await editor.render(saved);
      await select(cell(2), true);
      toolbar = tableSurface().querySelector('.slash-text-inline-toolbar');
      check(
        cell(0).closest('tr').style.backgroundColor === 'rgb(254, 240, 138)' &&
          cell(1).closest('tr').style.backgroundColor === 'rgb(34, 197, 94)',
        'Row backgrounds survive rerender',
      );
      cell(1).classList.add('range-selected');
      cell(2, 1).classList.add('range-selected');
      check(
        /(?:\/|,)\s*0\.1\)/.test(getComputedStyle(cell(1).parentElement, '::after').backgroundColor) &&
          getComputedStyle(cell(1)).color === getComputedStyle(cell(1).parentElement).color &&
          getComputedStyle(cell(1)).opacity === '1',
        'Range background has alpha 0.1 while text remains fully opaque and inherits its color',
      );
      color(header(), 'Фон ячеек', '#fecaca');
      check(
        JSON.stringify((await tableData()).cellBackgrounds) ===
          JSON.stringify([
            ['#06b6d4', ''],
            ['#fecaca', ''],
            ['', '#fecaca'],
          ]),
        'Cell fill affects only selected cells',
      );
      check(
        getComputedStyle(cell(1).parentElement).backgroundColor === 'rgb(254, 202, 202)' &&
          getComputedStyle(cell(1, 1).parentElement).backgroundColor === 'rgb(34, 197, 94)',
        'Cell fill overrides row fill',
      );
      check(
        (await tableData()).rowBackgrounds.join(',') === '#fef08a,#22c55e,',
        'Applying fill to a group leaves legacy row backgrounds unchanged',
      );
      saved = await editor.save();
      await editor.render(saved);
      await select(cell(2, 1), true);
      toolbar = tableSurface().querySelector('.slash-text-inline-toolbar');
      check(
        getComputedStyle(cell(2, 1).parentElement).backgroundColor === 'rgb(254, 202, 202)',
        'Empty cell fill survives rerender',
      );
      header().querySelector('[aria-label="Убрать фон ячеек"]').click();
      check(
        (await tableData()).cellBackgrounds[2][1] === '' &&
          getComputedStyle(cell(2, 1).parentElement).backgroundColor === 'rgba(0, 0, 0, 0)',
        'Reset empty cell fill returns transparent background',
      );
      await select(cell(1), true);
      header().querySelector('[aria-label="Убрать фон ячеек"]').click();
      check(
        (await tableData()).cellBackgrounds[1][0] === '' &&
          getComputedStyle(cell(1).parentElement).backgroundColor === 'rgb(34, 197, 94)' &&
          (await tableData()).rows[1][0].includes('#c4b5fd'),
        'Reset cell fill retains legacy row and text backgrounds',
      );

      const note = editor.views[2].content
        .querySelector('slash-tool-surface')
        .shadowRoot.querySelector('.mkdocs-content');
      await select(note);
      color(textToolbar, 'Фон выделения', '#fecaca');
      check(
        (await editor.save()).blocks[2].data.content.includes('data-slash-text-background="#fecaca"'),
        'MkDocs shadow content saves selection background',
      );
      check(toolbar.hidden, 'Table toolbar hides when focus moves to a different block');
      await select(cell(1));
      check(!toolbar.hidden, 'Returning to a cell restores its toolbar');
      const picker = toolbar.querySelector('[aria-label="Цвет текста"]');
      picker.focus();
      await tick();
      check(
        !toolbar.hidden && tableSurface().activeElement === picker,
        'Focusing the table color picker keeps the toolbar visible',
      );
      await select(cell(1));
      toolbar.querySelector('[aria-label="Внешняя ссылка"]').click();
      await tick();
      check(
        !toolbar.hidden && tableSurface().activeElement === toolbar.querySelector('[aria-label="Внешний адрес"]'),
        'Focusing the table link editor keeps the toolbar visible',
      );
      editor.views[0].content.firstElementChild.focus();
      await tick();
      check(
        toolbar.hidden && toolbar.querySelector('.slash-text-inline-link-panel').hidden,
        'Leaving the table closes toolbar and link editor',
      );
      await select(cell(1));
      cell(1).dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      editor.views[0].content.firstElementChild.focus();
      await tick();
      check(toolbar.hidden, 'A queued selection capture cannot reopen toolbar after focus leaves');
      editor.api.blocks.insert('confluenceTable', {}, undefined, 3, true);
      const secondSurface = editor.views[3].content.querySelector('slash-tool-surface').shadowRoot;
      await select(secondSurface.querySelector('.ct-cell'), true);
      const secondToolbar = secondSurface.querySelector('.slash-text-inline-toolbar');
      check(toolbar.hidden && secondToolbar.hidden, 'Empty table cells do not show an inline toolbar');
      editor.api.blocks.delete(3);
      await editor.api.readOnly.toggle(true);
      const readOnlyCell = cell(0);
      readOnlyCell.focus();
      await tick();
      check(
        !readOnlyCell.isContentEditable &&
          !header() &&
          tableSurface().querySelector('[aria-label="Цвет текста"]').disabled,
        'Read-only table has no header actions and cannot change formatting',
      );
    } finally {
      editor.config.readOnly = false;
      await editor.render(original);
    }
    return true;
  });
  assert.equal(result, true);
  console.log(
    'Background smoke passed: text/cell fills, groups, 0.1-alpha selection, resets, legacy rows, persistence and read-only.',
  );
}
