/* global document, window, MouseEvent, requestAnimationFrame, getComputedStyle */
import assert from 'node:assert/strict';

export async function smokeInlineColors(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const original = await editor.save();
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    editor.config.tools.inlineColorFixture = class {
      constructor({ data }) {
        this.data = data;
      }
      render() {
        this.root = document.createElement('div');
        if (this.data.mode !== 'shadow') {
          this.editable = document.createElement('div');
          this.editable.innerHTML = this.data.text;
          if (this.data.mode === 'empty') this.editable.setAttribute('contenteditable', '');
          this.root.append(this.editable);
        }
        return this.root;
      }
      save() {
        return { ...this.data, text: this.editable?.innerHTML ?? this.root.shadowRoot.firstElementChild.innerHTML };
      }
    };
    const apply = async (current, label) => {
      current.focus();
      const range = document.createRange();
      range.selectNodeContents(current);
      const selection = current.getRootNode().getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      current.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
      await tick();
      const toolbar = document.querySelector('body > .slash-text-inline-toolbar');
      check(!toolbar.hidden, `${label}: inline toolbar is visible`);
      for (const [title, value] of [
        ['Цвет текста', '#112233'],
        ['Фон выделения', '#fef08a'],
      ]) {
        const input = toolbar.querySelector(`[aria-label="${title}"]`);
        check(!input.disabled, `${label}: ${title} is enabled`);
        input.value = value;
        input.dispatchEvent(new window.Event('change', { bubbles: true }));
      }
      check(
        getComputedStyle(current.querySelector('[data-slash-text-color]')).color === 'rgb(17, 34, 51)' &&
          getComputedStyle(current.querySelector('[data-slash-text-background]')).backgroundColor ===
            'rgb(254, 240, 138)',
        `${label}: foreground and background are visible`,
      );
    };
    try {
      await editor.render({
        blocks: [
          { id: 'heading-colors', type: 'paragraph', data: { text: 'Heading', level: 2 } },
          { id: 'quote-colors', type: 'quote', data: { text: 'Quote' } },
          { id: 'custom-empty', type: 'inlineColorFixture', data: { mode: 'empty', text: 'Custom' } },
          { id: 'custom-attribute', type: 'inlineColorFixture', data: { mode: 'attribute', text: 'Attribute' } },
          { id: 'custom-shadow', type: 'inlineColorFixture', data: { mode: 'shadow', text: 'Shadow' } },
        ],
      });
      await tick();
      await apply(editor.views[0].content.querySelector('[contenteditable="true"]'), 'Heading');
      await apply(editor.views[1].content.querySelector('[contenteditable="true"]'), 'Quote');
      await apply(editor.views[2].content.querySelector('[contenteditable=""]'), 'Custom empty attribute');
      const late = editor.views[3].content.firstElementChild.firstElementChild;
      late.contentEditable = 'true';
      await tick();
      await apply(late, 'Dynamic contenteditable attribute');
      const shadow = editor.views[4].content.firstElementChild.attachShadow({ mode: 'open' });
      const editable = document.createElement('div');
      editable.contentEditable = 'true';
      editable.textContent = 'Shadow';
      shadow.append(editable);
      await apply(editable, 'Dynamically attached Shadow DOM');
      const saved = await editor.save();
      check(
        saved.blocks.every(
          ({ data }) =>
            data.text.includes('data-slash-text-color="#112233"') &&
            data.text.includes('data-slash-text-background="#fef08a"'),
        ),
        'All rich inline contexts persist both colors',
      );
      return true;
    } finally {
      await editor.render(original);
      delete editor.config.tools.inlineColorFixture;
    }
  });
  assert.equal(result, true);
  console.log(
    'Inline colors smoke passed: heading, quote, custom contenteditable, dynamic attributes and late Shadow DOM.',
  );
}
