/* global document, window, KeyboardEvent */
import assert from 'node:assert/strict';

export async function smokeNestedListBackspace(frame, page) {
  const original = await frame.evaluate(() => document.querySelector('slash-doc-editor').save());
  const item = (content, items = []) => ({ content, items });
  const render = async (items) =>
    frame.evaluate(async (items) => {
      const editor = document.querySelector('slash-doc-editor');
      await editor.render({
        blocks: [
          { id: 'before-list', type: 'paragraph', data: { text: 'Before' } },
          { id: 'list', type: 'list', data: { style: 'unordered', items }, tunes: { alignment: 'left' } },
          { id: 'after-list', type: 'paragraph', data: { text: 'After' } },
        ],
      });
    }, items);
  const focus = async (index, atEnd = false) =>
    frame.evaluate(
      (index, atEnd) => {
        const editor = document.querySelector('slash-doc-editor');
        const content = editor.views[1].content.querySelectorAll('.cdx-list__item')[index];
        content.focus();
        const range = document.createRange();
        range.selectNodeContents(content);
        range.collapse(!atEnd);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      },
      index,
      atEnd,
    );
  const snapshot = async () =>
    frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      const selection = window.getSelection();
      const prefix = document.createRange();
      let caretOffset = selection.anchorOffset;
      if (document.activeElement?.contains(selection.anchorNode)) {
        prefix.selectNodeContents(document.activeElement);
        prefix.setEnd(selection.anchorNode, selection.anchorOffset);
        caretOffset = prefix.toString().length;
      }
      return {
        blocks: (await editor.save()).blocks,
        focus: document.activeElement?.textContent,
        caretOffset,
      };
    });
  const backspace = async (index, atEnd = false) => {
    await focus(index, atEnd);
    await page.keyboard.press('Backspace');
    return snapshot();
  };
  const unchangedBlocks = (state) =>
    assert.deepEqual(
      state.blocks.map((block) => block.id),
      ['before-list', 'list', 'after-list'],
    );
  try {
    await render([item('Alpha'), item('<br>'), item('Beta')]);
    let state = await backspace(1);
    assert.deepEqual(state.blocks[1].data.items, [item('Alpha'), item('Beta')]);
    unchangedBlocks(state);
    assert.equal(state.focus, 'Alpha');
    assert.equal(state.caretOffset, 5);
    await frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      await editor.render(await editor.save());
    });
    assert.deepEqual((await snapshot()).blocks[1].data.items, [item('Alpha'), item('Beta')]);

    await render([item(''), item('Beta')]);
    state = await backspace(0);
    assert.deepEqual(state.blocks[1].data.items, [item('Beta')]);
    assert.equal(state.focus, 'Beta');
    assert.equal(state.caretOffset, 0);
    await page.keyboard.type('Z');
    assert.equal((await snapshot()).blocks[1].data.items[0].content, 'ZBeta');

    await render([item('Parent', [item('Child'), item('&nbsp;<br>')]), item('Next')]);
    state = await backspace(2);
    assert.deepEqual(state.blocks[1].data.items, [item('Parent', [item('Child')]), item('Next')]);
    assert.equal(state.focus, 'Child');
    assert.equal(state.caretOffset, 5);
    unchangedBlocks(state);

    await render([item('Parent', [item('')]), item('Next')]);
    state = await backspace(1);
    assert.deepEqual(state.blocks[1].data.items, [item('Parent'), item('Next')]);
    assert.equal(state.focus, 'Parent');
    assert.equal(await frame.$eval('.cdx-list', (root) => root.querySelectorAll('ul, ol').length), 0);

    await render([item('Previous'), item('', [item('Child', [item('Grandchild')]), item('Sibling')]), item('Next')]);
    state = await backspace(1);
    assert.deepEqual(state.blocks[1].data.items, [
      item('Previous'),
      item('Child', [item('Grandchild')]),
      item('Sibling'),
      item('Next'),
    ]);
    assert.equal(state.focus, 'Child');
    assert.equal(state.caretOffset, 0);
    unchangedBlocks(state);

    await render([item('Alpha'), item('')]);
    state = await backspace(1);
    assert.deepEqual(state.blocks[1].data.items, [item('Alpha')]);
    unchangedBlocks(state);
    await page.keyboard.press('Backspace');
    assert.deepEqual((await snapshot()).blocks[1].data.items, [item('Alph')]);

    await render([item('')]);
    await backspace(0);
    await frame.waitForFunction(() => document.querySelector('slash-doc-editor').views[1].output.type === 'paragraph');
    state = await snapshot();
    unchangedBlocks(state);
    assert.equal(state.blocks[1].type, 'paragraph');
    assert.equal(state.blocks[1].data.text, '');
    assert.deepEqual(state.blocks[1].tunes, { alignment: 'left' });
    assert.equal(await frame.evaluate(() => document.activeElement.matches('.ce-paragraph')), true);

    await render([item('')]);
    await focus(0);
    assert.equal(
      await frame.evaluate(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Backspace',
          bubbles: true,
          cancelable: true,
          isComposing: true,
        });
        document.activeElement.dispatchEvent(event);
        return event.defaultPrevented;
      }),
      false,
    );
    assert.deepEqual((await snapshot()).blocks[1].data.items, [item('')]);

    await frame.evaluate(() => document.querySelector('slash-doc-editor').api.readOnly.toggle(true));
    assert.equal(
      await frame.evaluate(() => {
        const content = document.querySelector('.cdx-list__item');
        const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        content.dispatchEvent(event);
        return event.defaultPrevented;
      }),
      false,
    );
    assert.deepEqual((await snapshot()).blocks[1].data.items, [item('')]);
  } finally {
    await frame.evaluate(async (original) => {
      const editor = document.querySelector('slash-doc-editor');
      editor.config.readOnly = false;
      await editor.render(original);
    }, original);
  }
  console.log(
    'Nested list Backspace smoke passed: native keys, empty rows, nested children, caret, persistence, last-item conversion and read-only.',
  );
}
