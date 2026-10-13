/* global document, window, DataTransfer, ClipboardEvent, KeyboardEvent, requestAnimationFrame */
import assert from 'node:assert/strict';

export async function smokeBlockEditorImages(frame) {
  const result = await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    const original = await editor.save();
    const imageSettings = editor.config.tools.image;
    const originalUploader = imageSettings.config.uploader;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const until = async (condition) => {
      for (let attempt = 0; attempt < 100; attempt++) {
        if (condition()) return;
        await tick();
      }
      throw new Error('Image paste did not complete');
    };
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=';
    const bytes = Uint8Array.from(window.atob(png), (character) => character.charCodeAt(0));
    const paste = (target, count = 1) => {
      const clipboard = new DataTransfer();
      for (let index = 0; index < count; index++)
        clipboard.items.add(new File([bytes], `pasted-${index}.png`, { type: 'image/png' }));
      clipboard.setData('text/html', '<img src="https://example.invalid/copied.png"><b>Duplicate text</b>');
      clipboard.setData('text/plain', 'Duplicate text');
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        composed: true,
        cancelable: true,
        clipboardData: clipboard,
      });
      target.dispatchEvent(event);
      return event;
    };
    const key = (target) => {
      const event = new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        ctrlKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      check(!event.defaultPrevented, 'Ctrl+V retains native clipboard image delivery');
    };
    const fixture = {
      blocks: [
        { id: 'text', type: 'paragraph', data: { text: '<b>Before</b>' } },
        { id: 'table', type: 'confluenceTable', data: { rows: [['Cell']] } },
        { id: 'tail', type: 'paragraph', data: { text: 'After' } },
      ],
    };
    try {
      await editor.render(fixture);
      const text = editor.views[0].content.firstElementChild;
      editor.api.caret.setToBlock(0, 'end');
      key(text);
      check(paste(text).defaultPrevented, 'Image paste consumes image and accompanying HTML/text');
      await until(() => editor.views.length === 4);
      const inserted = (await editor.save()).blocks[1];
      check(
        inserted.type === 'image' && inserted.data.file.url === `data:image/png;base64,${png}`,
        'Image block saves embedded clipboard bytes',
      );
      check(
        editor.views[2].output.id === 'table' && text.innerHTML === '<b>Before</b>' && !text.querySelector('img'),
        'Image inserts after current block without duplicating markup',
      );
      const image = editor.views[1].content.querySelector('img');
      await until(() => image.complete && image.naturalWidth === 1);
      const saved = await editor.save();
      await editor.render(saved);
      check(
        (await editor.save()).blocks[1].data.file.url === inserted.data.file.url,
        'Pasted image survives document reload',
      );

      await editor.render(fixture);
      const cell = editor.views[1].content.querySelector('slash-tool-surface').shadowRoot.querySelector('.ct-cell');
      cell.focus();
      key(cell);
      check(paste(cell).defaultPrevented, 'Image paste is consumed inside shadow table cell');
      await until(() => editor.views.length === 4);
      check(
        editor.views[2].output.type === 'image' && editor.views[3].output.id === 'tail' && cell.textContent === 'Cell',
        'Cell image paste creates block after table',
      );

      await editor.render(fixture);
      editor.selectBlock('text');
      editor.selectBlock('table', false, true);
      key(editor);
      const uploads = [];
      imageSettings.config.uploader = {
        async uploadByFile(file) {
          uploads.push(file.name);
          return { success: 1, file: { url: `data:image/png;base64,${png}`, name: file.name } };
        },
      };
      paste(editor, 2);
      await until(() => editor.views.length === 5);
      const group = (await editor.save()).blocks;
      check(
        group.map((block) => block.type).join(',') === 'paragraph,confluenceTable,image,image,paragraph',
        'Multiple images insert after selected group',
      );
      check(
        group[2].data.file.name === 'pasted-0.png' &&
          group[3].data.file.name === 'pasted-1.png' &&
          uploads.length === 2,
        'Images use configured uploader once and keep clipboard order',
      );

      await editor.render(fixture);
      imageSettings.config.uploader = {
        async uploadByFile() {
          throw new Error('Upload failed');
        },
      };
      paste(editor.views[0].content.firstElementChild);
      await until(() => editor.status.textContent === 'Upload failed');
      check(editor.views.length === 3, 'Failed upload leaves document intact without empty image blocks');

      let resolveUpload;
      imageSettings.config.uploader = {
        uploadByFile: () =>
          new Promise((resolve) => {
            resolveUpload = resolve;
          }),
      };
      paste(editor.views[0].content.firstElementChild);
      await editor.render(fixture);
      resolveUpload({ success: 1, file: { url: `data:image/png;base64,${png}` } });
      await tick();
      check(editor.views.length === 3, 'Pending paste cannot insert into another document');

      imageSettings.config.uploader = originalUploader;
      await editor.api.readOnly.toggle(true);
      check(
        !paste(editor).defaultPrevented && editor.views.length === 3,
        'Read-only editor does not accept pasted images',
      );
      await editor.api.readOnly.toggle(false);
      delete editor.config.tools.image;
      paste(editor);
      await tick();
      check(editor.views.length === 3, 'Disabled image addon does not create unavailable blocks');
    } finally {
      editor.config.tools.image = imageSettings;
      imageSettings.config.uploader = originalUploader;
      editor.config.readOnly = false;
      await editor.render(original);
    }
    return { passed: true };
  });
  assert.equal(result.passed, true);
  console.log('Image clipboard smoke passed: text/cell/group paste, upload, persistence, failures and read-only.');
}
