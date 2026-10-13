/* global document, window, MouseEvent, ClipboardEvent, DataTransfer, KeyboardEvent, requestAnimationFrame, getComputedStyle */
import assert from 'node:assert/strict';

export async function smokeBlockEditor(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const original = await editor.save();
    check(!editor.querySelector('.slash-editor-toolbar'), 'Top editor toolbar is removed');
    for (const button of editor.querySelectorAll('.slash-block-controls .slash-block-icon-button')) {
      const svg = button.querySelector('svg');
      check(
        svg && getComputedStyle(svg).width === '16px' && getComputedStyle(svg).height === '16px',
        'SVG icons fit inside padded block buttons',
      );
      check(getComputedStyle(button).borderWidth === '0px', 'Block buttons have no border');
      check(
        button.getBoundingClientRect().width === 24 && button.getBoundingClientRect().height === 24,
        'Chrome extension block buttons are exactly 24 by 24 pixels',
      );
      check(getComputedStyle(button).padding === '4px', 'Block button padding is 4px');
    }
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    check(editor.api.blocks.getBlocksCount() === 3, 'Compatible blocks API');
    editor.api.blocks.move(0, 1);
    check((await editor.save()).blocks[0].id === 'table', 'Block move');
    await editor.render(original);

    await editor.render({ blocks: [{ id: 'typing', type: 'paragraph', data: { text: 'AlphaBeta' } }] });
    const paragraph = editor.querySelector('.ce-paragraph');
    paragraph.focus();
    const caret = document.createRange();
    caret.setStart(paragraph.firstChild, 5);
    caret.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(caret);
    paragraph.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    check(
      (await editor.save()).blocks.map((block) => block.data.text).join('|') === 'Alpha|Beta',
      'Enter splits paragraph at caret',
    );
    editor.api.caret.setToBlock(1, 'start');
    editor.views[1].content.firstElementChild.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
    );
    check(
      (await editor.save()).blocks[0].data.text === 'AlphaBeta' && editor.currentIndex === 0,
      'Backspace merges and preserves active block',
    );
    await editor.render(original);

    let destroyed = 0;
    editor.config.tools.asyncFixture = class {
      constructor({ data, block, api }) {
        this.data = data;
        this.block = block;
        check(api.blocks.getBlocksCount() >= 0, 'Addon API');
      }
      render() {
        const root = document.createElement('div');
        root.textContent = this.data.value;
        return root;
      }
      async save() {
        await Promise.resolve();
        return { ...this.data, saved: true };
      }
      destroy() {
        destroyed++;
      }
    };
    await editor.render({
      version: 'legacy',
      blocks: [
        { id: 'a', type: 'paragraph', data: { text: 'Alpha' } },
        { id: 'b', type: 'confluenceTable', data: { rows: [['First', 'Second']] } },
        { id: 'c', type: 'mkdocsAdmonition', data: { title: 'Note', content: '**Old Markdown**' } },
        { id: 'd', type: 'mkdocsTabs', data: { tabs: [{ id: 'tab-1', title: 'Tab', content: 'Body' }] } },
        { id: 'e', type: 'mkdocsDetails', data: { summary: 'Details', content: 'Body' } },
        { id: 'f', type: 'mkdocsChecklist', data: { items: [{ id: 'item-1', text: 'Item', level: 0 }] } },
        { id: 'g', type: 'asyncFixture', data: { value: 'Async' }, tunes: { alignment: 'center' } },
        { id: 'unknown', type: 'disabledAddon', data: { opaque: { value: 42 } } },
      ],
    });
    const first = editor.views[0].holder.querySelector('.slash-block-handle');
    const third = editor.views[2].holder.querySelector('.slash-block-handle');
    first.click();
    third.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    check(editor.selected.size === 3, 'Shift range selection');
    const clipboard = new DataTransfer();
    editor.dispatchEvent(
      new ClipboardEvent('copy', { bubbles: true, composed: true, cancelable: true, clipboardData: clipboard }),
    );
    check(clipboard.getData('text/plain').startsWith('SLASH-DOC-BLOCKS/1\n'), 'Native clipboard envelope');
    editor.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, composed: true, cancelable: true, clipboardData: clipboard }),
    );
    const pasted = (await editor.save()).blocks.slice(3, 6);
    check(
      pasted.map((block) => block.type).join(',') === 'paragraph,confluenceTable,mkdocsAdmonition',
      'Clipboard order',
    );
    check(new Set((await editor.save()).blocks.map((block) => block.id)).size === 11, 'Paste generates unique IDs');
    check(editor.selected.size === 3, 'Pasted group stays selected');
    editor.deleteSelected();
    check(editor.views.length === 8, 'Delete selected group');
    editor.selectBlock('a');
    editor.selectBlock('g', false, true);
    check(editor.selected.size === 2, 'Additive selection');
    let hostClipboard;
    const write = window.__SLASH_DOC_WRITE_CLIPBOARD__;
    window.__SLASH_DOC_WRITE_CLIPBOARD__ = (text) => {
      hostClipboard = text;
    };
    await editor.copySelection();
    const copied = JSON.parse(hostClipboard.split('\n').slice(1).join('\n')).blocks;
    check(
      copied[1].data.saved === true && copied[1].tunes.alignment === 'center',
      'Async addon copy includes latest data and tunes',
    );
    window.__SLASH_DOC_WRITE_CLIPBOARD__ = write;
    editor.clearSelection();
    const textClipboard = new ClipboardEvent('copy', {
      bubbles: true,
      composed: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });
    editor.views[0].content.querySelector('.ce-paragraph').dispatchEvent(textClipboard);
    check(!textClipboard.defaultPrevented, 'Text copy remains native');

    const cell = editor.views
      .find((view) => view.output.id === 'b')
      .content.querySelector('slash-tool-surface')
      .shadowRoot.querySelector('.ct-cell');
    check(editor.api.blocks.getBlockByElement(cell).id === 'b', 'Block lookup across Shadow DOM');
    cell.focus();
    const select = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = element.getRootNode().getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    };
    select(cell);
    await tick();
    const tableToolbar = cell.getRootNode().querySelector('.slash-text-inline-toolbar');
    check(!tableToolbar.hidden, 'Table selection toolbar');
    tableToolbar.querySelector('[aria-label="Маркированный список"]').click();
    check(cell.querySelector('ul > li'), 'List created inside table cell');
    select(cell.querySelector('li'));
    await tick();
    tableToolbar.querySelector('[aria-label="Внешняя ссылка"]').click();
    tableToolbar.querySelector('[aria-label="Внешний адрес"]').value = 'https://example.com/nested';
    tableToolbar.querySelector('[aria-label="Сохранить ссылку"]').click();
    const tableData = (await editor.save()).blocks.find((block) => block.id === 'b').data;
    check(
      tableData.rows[0][0].includes('<ul>') && tableData.rows[0][0].includes('https://example.com/nested'),
      'Cell saves nested list and link',
    );
    const richClipboard = new DataTransfer();
    richClipboard.setData('text/html', '<ol><li><a href="https://example.org">Pasted</a></li></ol>');
    richClipboard.setData('text/plain', 'Pasted');
    cell.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, composed: true, cancelable: true, clipboardData: richClipboard }),
    );
    check(cell.innerHTML.includes('<ol>') && cell.innerHTML.includes('https://example.org'), 'Rich cell paste');

    const blockOrder = editor.views.map((view) => view.output.id).join(',');
    const tableIndex = editor.indexOf('b');
    cell.focus();
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = new KeyboardEvent('keydown', {
        key,
        ctrlKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      cell.dispatchEvent(event);
      check(
        event.defaultPrevented && cell.getRootNode().activeElement === cell,
        'Shadow DOM movement preserves cell focus',
      );
      check(editor.indexOf('b') === tableIndex + (key === 'ArrowUp' ? -1 : 0), 'Shortcut moves table from its cell');
    }
    check(editor.views.map((view) => view.output.id).join(',') === blockOrder, 'Shadow DOM movement restores order');

    const note = editor.views
      .find((view) => view.output.id === 'c')
      .content.querySelector('slash-tool-surface').shadowRoot;
    check(!note.querySelector('textarea'), 'MkDocs has no Markdown textarea');
    const noteBody = note.querySelector('.mkdocs-content');
    check(
      noteBody.contentEditable === 'true' && noteBody.querySelector('strong'),
      'Legacy Markdown is editable rich content',
    );
    noteBody.focus();
    select(noteBody);
    await tick();
    const richToolbar = document.querySelector('body > .slash-text-inline-toolbar');
    check(!richToolbar.hidden, 'MkDocs selection toolbar binds shadow roots');
    richToolbar.querySelector('[aria-label="Нумерованный список"]').click();
    check(
      (await editor.save()).blocks.find((block) => block.id === 'c').data.content.includes('<ol>'),
      'MkDocs saves lists',
    );
    for (const id of ['d', 'e', 'f']) {
      const surface = editor.views
        .find((view) => view.output.id === id)
        .content.querySelector('slash-tool-surface').shadowRoot;
      check(
        surface.querySelector('.mkdocs-content[contenteditable="true"]') && !surface.querySelector('textarea'),
        `MkDocs ${id} contenteditable`,
      );
    }
    const unknown = (await editor.save()).blocks.find((block) => block.id === 'unknown');
    check(unknown.data.opaque.value === 42, 'Unknown addon data preserved');

    await editor.api.readOnly.toggle(true);
    for (const view of editor.views) {
      check(!view.holder.querySelector('.slash-block-controls'), 'Read-only block controls');
      const roots = [
        view.content,
        ...Array.from(view.content.querySelectorAll('*'))
          .map((element) => element.shadowRoot)
          .filter(Boolean),
      ];
      for (const root of roots) check(!root.querySelector('[contenteditable="true"]'), 'Read-only rich content');
    }
    check(editor.api.readOnly.isEnabled, 'Read-only API');
    await editor.api.readOnly.toggle(false);
    check(destroyed >= 2, 'Addon destroy lifecycle on render');
    await editor.render(original);
    return { passed: true };
  });
  assert.equal(result.passed, true);
  console.log(
    'Block editor smoke passed: API, lifecycle, group clipboard, async addons, rich cells, MkDocs and read-only.',
  );
}
