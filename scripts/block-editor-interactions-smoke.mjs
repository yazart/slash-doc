/* global document, window, MouseEvent, KeyboardEvent, DragEvent, DataTransfer, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict';

export async function smokeBlockEditorInteractions(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const original = await editor.save();
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await editor.render({
      blocks: [
        { id: 'one', type: 'paragraph', data: { text: 'One' } },
        { id: 'two', type: 'paragraph', data: { text: 'Two' } },
        { id: 'three', type: 'paragraph', data: { text: 'Three' } },
      ],
    });
    const insertionSpaces = editor.querySelectorAll('.slash-block-insertion-space');
    check(
      insertionSpaces.length === 3 && [...insertionSpaces].every((space) => space.textContent === ''),
      'Empty insertion space after each block',
    );
    check(getComputedStyle(editor.views[0].holder).borderTopWidth === '0px', 'Blocks have no border');
    check(
      getComputedStyle(editor.views[0].holder.querySelector('.slash-block-handle')).borderTopWidth === '0px',
      'Drag handles have no border',
    );
    insertionSpaces[0].click();
    check(
      editor.views[1].output.type === 'paragraph' &&
        editor.views[2].output.id === 'two' &&
        document.activeElement === editor.views[1].content.firstElementChild,
      'Clicking insertion space creates and focuses paragraph at correct boundary',
    );
    editor.api.blocks.delete(1);
    const paragraph = editor.views[0].content.firstElementChild;
    paragraph.focus();
    const shortcut = new KeyboardEvent('keydown', {
      code: 'KeyI',
      key: 'i',
      ctrlKey: true,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    paragraph.dispatchEvent(shortcut);
    check(shortcut.defaultPrevented && document.querySelector('.slash-block-menu'), 'Ctrl+I opens insertion menu');
    const items = [...document.querySelectorAll('.slash-block-menu [data-block-type]')];
    check(
      items.every((item) => item.querySelector('.slash-block-menu-icon svg')),
      'Every block menu item has icon',
    );
    check(!items.some((item) => item.dataset.blockType === 'header'), 'Text and heading have a single menu item');
    document.querySelector('.slash-block-menu [data-block-type="codeBlock"]').click();
    check(editor.views[1].output.type === 'codeBlock', 'Shortcut inserts after current block');
    editor.api.blocks.delete(1);
    editor.openInsertMenu(0);
    document.querySelector('.slash-block-menu [data-block-type="confluenceTable"]').click();
    await tick();
    const newTable = (await editor.save()).blocks[1];
    const tableRoot = editor.views[1].content.querySelector('slash-tool-surface').shadowRoot;
    check(
      JSON.stringify(newTable.data.rows) ===
        JSON.stringify([
          ['', ''],
          ['', ''],
        ]) &&
        tableRoot.querySelectorAll('tbody > tr').length === 2 &&
        tableRoot.querySelectorAll('.ct-cell').length === 4,
      'Creating a table from the block menu renders and saves a 2 by 2 grid',
    );
    editor.api.blocks.delete(1);
    editor.api.blocks.insert('paragraph', { text: 'Converted' }, undefined, 1, false);
    editor.views[1].holder
      .querySelector('.slash-block-handle')
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    document.querySelector('.slash-block-menu [data-block-type="confluenceTable"]').click();
    await tick();
    check(
      JSON.stringify((await editor.save()).blocks[1].data.rows) ===
        JSON.stringify([
          ['Converted', ''],
          ['', ''],
        ]),
      'Converting text creates a 2 by 2 table and retains content in its first cell',
    );
    editor.api.blocks.delete(1);
    const redactor = editor.querySelector('.codex-editor__redactor');
    redactor.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientY: editor.views.at(-1).holder.getBoundingClientRect().bottom + 20,
      }),
    );
    check(
      editor.views.length === 4 && editor.views.at(-1).output.type === 'paragraph',
      'Blank click creates paragraph',
    );
    editor.api.blocks.delete(3);
    const handle = editor.views[0].holder.querySelector('.slash-block-handle');
    handle.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 150, clientY: 150 }),
    );
    document.querySelector('.slash-block-menu [data-block-type="quote"]').click();
    await tick();
    const converted = (await editor.save()).blocks[0];
    check(
      converted.id === 'one' &&
        converted.type === 'quote' &&
        converted.data.text === 'One' &&
        editor.querySelector('.ce-quote[contenteditable="true"]'),
      'Context menu changes type without losing identity or text',
    );
    editor.views[0].holder
      .querySelector('.slash-block-handle')
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    document.querySelector('.slash-block-menu [data-block-type="paragraph"]').click();
    await tick();

    const style = editor.views[0].holder.querySelector('[aria-label="Стиль текста"]');
    style.value = '3';
    style.dispatchEvent(new window.Event('change', { bubbles: true }));
    const heading = (await editor.save()).blocks[0];
    check(
      heading.type === 'paragraph' &&
        heading.data.level === 3 &&
        editor.views[0].content.querySelector('h3').textContent === 'One',
      'Text style changes to H3 without changing block type',
    );
    style.value = '0';
    style.dispatchEvent(new window.Event('change', { bubbles: true }));
    check(
      !(await editor.save()).blocks[0].data.level && editor.views[0].content.querySelector('.ce-paragraph'),
      'Text style returns to paragraph',
    );

    const editable = editor.views[1].content.firstElementChild;
    editor.api.caret.setToBlock(1, 'start', 1);
    const move = (target, key, modifiers = { ctrlKey: true }) => {
      const event = new KeyboardEvent('keydown', {
        key,
        ...modifiers,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      check(event.defaultPrevented, 'Movement shortcut consumed');
    };
    const order = () => editor.views.map((view) => view.output.id).join(',');
    move(editable, 'ArrowUp');
    check(
      order() === 'two,one,three' &&
        document.activeElement === editable &&
        window.getSelection().anchorOffset === 1 &&
        editor.currentIndex === 0,
      'Ctrl+Up moves focused block and preserves caret',
    );
    move(editable, 'ArrowUp');
    check(order() === 'two,one,three', 'Movement at top is a no-op');
    move(editable, 'ArrowDown');
    check(order() === 'one,two,three' && document.activeElement === editable, 'Ctrl+Down moves focused block back');
    editor.selectBlock('one');
    editor.selectBlock('two', false, true);
    move(editor, 'ArrowDown');
    check(order() === 'three,one,two' && editor.selected.size === 2, 'Shortcut moves selected group in order');
    move(editor, 'ArrowUp');
    check(order() === 'one,two,three' && editor.selected.size === 2, 'Group moves back without losing selection');
    editor.clearSelection();

    const source = editor.views[0].holder;
    const target = editor.views[2].holder;
    const transfer = new DataTransfer();
    let dragImage;
    transfer.setDragImage = (element) => {
      dragImage = element;
    };
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    check(dragImage === source && dragImage.querySelector('.ce-paragraph'), 'Drag image is the whole block');
    await tick();
    check(source.classList.contains('slash-block-dragging'), 'Whole source block is visibly moving');
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: rect.bottom - 1 }),
    );
    check(target.classList.contains('slash-block-drop-after'), 'Drop position is visible');
    target.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientY: rect.bottom - 1 }),
    );
    check(
      (await editor.save()).blocks.map((block) => block.id).join(',') === 'two,three,one',
      'Drag moves entire block after target',
    );
    check(!editor.querySelector('.slash-block-dragging, .slash-block-drop-after'), 'Drag styling clears on drop');
    await editor.render({
      blocks: [
        {
          id: 'legacy-heading',
          type: 'header',
          data: { text: '<b>Legacy</b>', level: 4 },
          tunes: { alignment: 'center' },
        },
      ],
    });
    const legacy = (await editor.save()).blocks[0];
    check(
      legacy.id === 'legacy-heading' &&
        legacy.type === 'paragraph' &&
        legacy.data.level === 4 &&
        legacy.data.text.includes('Legacy') &&
        legacy.tunes.alignment === 'center' &&
        editor.querySelector('h4'),
      'Legacy heading migrates to text preserving level, ID and tunes',
    );
    await editor.api.readOnly.toggle(true);
    const readOnlyMove = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(readOnlyMove);
    check(
      !readOnlyMove.defaultPrevented && !editor.querySelector('[contenteditable="true"], [aria-label="Стиль текста"]'),
      'Read-only text has no style editing or movement',
    );
    await editor.api.readOnly.toggle(false);
    await editor.render(original);

    const savedBodyStyle = document.body.getAttribute('style');
    const palette = (dark) => {
      for (const [key, value] of Object.entries({
        'editor-background': dark ? '#181818' : '#ffffff',
        'editorWidget-background': dark ? '#252526' : '#f6f6f8',
        'editor-foreground': dark ? '#eeeeee' : '#333238',
        'panel-border': dark ? '#555555' : '#dcdcde',
        descriptionForeground: dark ? '#bbbbbb' : '#626168',
        'list-hoverBackground': dark ? '#303030' : '#ececef',
        'input-background': dark ? '#303030' : '#ffffff',
      }))
        document.body.style.setProperty(`--vscode-${key}`, value);
    };
    palette(false);
    editor.api.blocks.insert(
      'mermaid',
      {
        code: 'flowchart TD\n A[Start] --> B[End]',
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#000"/></svg>',
      },
      undefined,
      editor.views.length,
      false,
      false,
      'diagram',
    );
    const diagram = editor.views.find((view) => view.output.id === 'diagram');
    const colors = () => {
      const root = diagram.content.querySelector('slash-tool-surface').shadowRoot;
      const rect = root.querySelector('.node rect');
      const label = root.querySelector('.node .nodeLabel, .node .label, .node text');
      check(rect && label, 'Mermaid renders real node shapes and labels');
      return {
        fill: getComputedStyle(rect).fill,
        color: getComputedStyle(label).color,
        text: getComputedStyle(label).fill,
      };
    };
    await diagram.tool.renderForSave();
    const light = colors();
    check(light.fill === 'rgb(246, 246, 248)', `Light node fill follows body tokens: ${light.fill}`);
    check(light.color === 'rgb(51, 50, 56)' || light.text === 'rgb(51, 50, 56)', 'Light text follows theme');
    palette(true);
    // Theme mutations must update the preview even when the diagram source is unchanged.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await diagram.tool.renderForSave();
    const dark = colors();
    check(dark.fill === 'rgb(37, 37, 38)', `Dark node fill follows theme: ${dark.fill}`);
    check(dark.color === 'rgb(238, 238, 238)' || dark.text === 'rgb(238, 238, 238)', 'Dark text follows theme');
    check(
      (await editor.save()).blocks.find((block) => block.id === 'diagram').data.svg.includes('#252526'),
      'Saved SVG uses current theme',
    );
    if (savedBodyStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style', savedBodyStyle);
    await editor.render(original);
    return true;
  });
  assert.equal(result, true);
  console.log(
    'Editor interactions smoke passed: whole-block drag, insertion boundaries/shortcut/whitespace, conversion and live Mermaid themes.',
  );
}
