/* global document, window, requestAnimationFrame */
import assert from 'node:assert/strict';

export async function smokeMkDocsGrid(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const original = await editor.save();
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const ordered = () =>
      Array.from(document.querySelectorAll('.slash-block-menu [data-block-type]'), (item) => item.dataset.blockType);
    const checkOrder = (types) => {
      check(
        types.slice(0, 5).join(',') === 'paragraph,quote,list,confluenceTable,image',
        'Simple blocks start the menu',
      );
      check(types.slice(-2).join(',') === 'bpmnPreview,bpmnModeler', 'BPMN tools finish the menu');
      check(
        types.indexOf('mkdocsGrid') < types.indexOf('codeBlock') &&
          types.indexOf('mkdocsAdmonition') < types.indexOf('apiEndpoint'),
        'MkDocs blocks precede specialized tools',
      );
      check(types.indexOf('gridCustomFixture') < types.indexOf('bpmnPreview'), 'Custom blocks precede BPMN tools');
    };
    editor.config.tools.gridCustomFixture = class {
      static get toolbox() {
        return { title: 'Custom grid fixture' };
      }
      render() {
        return document.createElement('div');
      }
      save() {
        return {};
      }
    };
    try {
      editor.openInsertMenu();
      checkOrder(ordered());
      document.querySelector('.slash-block-menu [data-block-type="mkdocsGrid"]').click();
      await tick();
      const created = (await editor.save()).blocks.find((block) => block.type === 'mkdocsGrid');
      check(created.data.cards && created.data.items.length === 2, 'Insertion creates a two-card grid');
      await editor.render({
        blocks: [
          { id: 'text', type: 'paragraph', data: { text: '<b>Retained</b>' } },
          {
            id: 'grid',
            type: 'mkdocsGrid',
            data: {
              cards: true,
              items: [
                { id: 'one', content: '## First\n\n---\n\n[Link](https://example.com)' },
                { id: 'two', content: '<ul><li>Second</li></ul>' },
              ],
            },
          },
        ],
      });
      const view = () => editor.views.find((view) => view.output.id === 'grid');
      const header = () => view().holder.querySelector('.slash-block-controls');
      const shadow = () => view().content.querySelector('slash-tool-surface').shadowRoot;
      check(
        shadow().querySelector('h2').textContent === 'First' &&
          shadow().querySelector('hr') &&
          shadow().querySelector('a').href === 'https://example.com/',
        'Grid renders headings, separators and links',
      );
      check(!shadow().querySelector('button, select, input'), 'Grid body contains only content');
      const grid = shadow().querySelector('.mkdocs-grid');
      grid.style.width = '700px';
      await tick();
      let cards = [...grid.children];
      check(
        cards[0].getBoundingClientRect().top === cards[1].getBoundingClientRect().top,
        'Wide grid lays out cards side by side',
      );
      grid.style.width = '250px';
      await tick();
      check(cards[1].getBoundingClientRect().top > cards[0].getBoundingClientRect().bottom, 'Narrow grid stacks cards');
      check(cards[0].getBoundingClientRect().width <= 250, 'Cards do not overflow narrow grid');
      grid.style.width = '';
      const content = cards[1].querySelector('.mkdocs-content');
      content.focus();
      content.innerHTML = '<p><b>Edited</b></p><ol><li>List</li></ol><a href="slash-doc://page/details">Details</a>';
      content.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      check(header().querySelector('[aria-label="Элемент сетки"]').value === 'two', 'Focused card becomes active');
      header().querySelector('[title="Добавить элемент сетки"]').click();
      check(view().tool.save().items.length === 3, 'Header adds an editable card');
      header().querySelector('[title="Удалить элемент сетки"]').click();
      check(view().tool.save().items.length === 2, 'Header deletes the selected card');
      header().querySelector('input[type="checkbox"]').click();
      check(
        !shadow().querySelector('.mkdocs-grid--cards') && !view().tool.save().cards,
        'Header switches to generic grid',
      );
      const saved = await editor.save();
      check(
        saved.blocks[1].data.items[1].content.includes('<p><b>Edited</b></p>') &&
          saved.blocks[1].data.items[1].content.includes('slash-doc://page/details'),
        'Grid saves block formatting, list and internal link',
      );
      await editor.render(saved);
      check(
        !view().tool.save().cards && shadow().querySelector('ol li').textContent === 'List',
        'Grid survives save and reload',
      );
      editor.views[0].holder.querySelector('.slash-block-title').click();
      checkOrder(ordered());
      document.querySelector('.slash-block-menu [data-block-type="mkdocsGrid"]').click();
      await tick();
      check(
        editor.views[0].tool.save().items[0].content === '<b>Retained</b>',
        'Type conversion to grid keeps source content',
      );
      editor.views[0].holder.querySelector('.slash-block-title').click();
      document.querySelector('.slash-block-menu [data-block-type="paragraph"]').click();
      await tick();
      check(
        (await editor.save()).blocks[0].data.text === '<b>Retained</b>',
        'Type conversion from grid restores rich text',
      );
      // Copy/paste retains the whole grid and gives its block a new identity.
      const write = window.__SLASH_DOC_WRITE_CLIPBOARD__;
      let clipboard;
      window.__SLASH_DOC_WRITE_CLIPBOARD__ = (text) => {
        clipboard = text;
      };
      try {
        editor.selectBlock('grid');
        await editor.copySelection();
      } finally {
        window.__SLASH_DOC_WRITE_CLIPBOARD__ = write;
      }
      const group = JSON.parse(clipboard.split('\n').slice(1).join('\n')).blocks;
      check(group[0].type === 'mkdocsGrid' && group[0].data.items.length === 2, 'Grid participates in block clipboard');
      await editor.api.readOnly.toggle(true);
      check(
        !editor.querySelector('.slash-block-controls') && !shadow().querySelector('[contenteditable="true"]'),
        'Read-only grid hides controls and disables editing',
      );
      return true;
    } finally {
      delete editor.config.tools.gridCustomFixture;
      editor.config.readOnly = false;
      await editor.render(original);
    }
  });
  assert.equal(result, true);
  console.log(
    'MkDocs grid smoke passed: sorted menus, insertion/conversion, cards/generic layouts, responsive sizing, rich content, controls, clipboard, persistence and read-only.',
  );
}
