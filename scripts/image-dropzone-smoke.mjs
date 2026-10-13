/* global document, window, DataTransfer, DragEvent, requestAnimationFrame */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1sAAAAASUVORK5CYII=';

export async function smokeImageDropzone(frame, page) {
  const directory = await mkdtemp(join(tmpdir(), 'slash-doc-image-'));
  const imagePath = join(directory, 'replacement.png');
  await writeFile(imagePath, Buffer.from(png, 'base64'));
  await frame.evaluate(async () => {
    const editor = document.querySelector('slash-doc-editor');
    window.imageDropzoneSmoke = {
      original: await editor.save(),
      uploader: editor.config.tools.image.config.uploader,
    };
  });
  try {
    const result = await frame.evaluate(async (png) => {
      const editor = document.querySelector('slash-doc-editor');
      const settings = editor.config.tools.image.config;
      const fixture = { blocks: [{ id: 'image', type: 'image', data: { caption: '<b>Подпись</b>' } }] };
      const check = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const until = async (condition) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          if (condition()) return;
          await tick();
        }
        throw new Error('Image upload did not complete');
      };
      const bytes = Uint8Array.from(window.atob(png), (character) => character.charCodeAt(0));
      const imageFile = new File([bytes], 'dropped.png', { type: 'image/png' });
      const drop = (file) => {
        const zone = document.querySelector('.image-tool__dropzone');
        const transfer = new DataTransfer();
        transfer.items.add(file);
        const send = (type) => {
          const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer });
          zone.dispatchEvent(event);
          return event;
        };
        check(send('dragenter').defaultPrevented, 'File drag enters dropzone without browser navigation');
        check(zone.classList.contains('image-tool__dropzone--active'), 'Dropzone highlights during file drag');
        check(send('dragover').defaultPrevented, 'File drag accepts copy');
        check(send('drop').defaultPrevented, 'File drop is consumed');
        check(!zone.classList.contains('image-tool__dropzone--active'), 'Drop highlight clears');
      };
      await editor.render(fixture);
      const figure = document.querySelector('figure.image-tool');
      check(
        figure.children.length === 2 && !figure.querySelector('input, label, button'),
        'Image body contains only image/dropzone and caption',
      );
      const style = window.getComputedStyle(figure);
      check(style.margin === '0px' && style.padding === '0px', 'Figure has no margin or padding');
      check(window.getComputedStyle(figure.querySelector('img')).display === 'none', 'Empty image is hidden');
      check(
        document.querySelector('.image-tool__header-controls button[title="Заменить изображение"]') &&
          document.querySelectorAll('.image-tool__header-controls input[type="checkbox"]').length === 3 &&
          document.querySelector('.image-tool__header-controls input[type="file"]').hidden,
        'Replace button, hidden picker and settings are in header',
      );
      let uploads = 0;
      settings.uploader = {
        async uploadByFile(file) {
          uploads += 1;
          return { success: 1, file: { url: `data:image/png;base64,${png}`, name: file.name } };
        },
      };
      // Re-render because tools receive a shallow copy of their configuration.
      await editor.render(fixture);
      drop(imageFile);
      await until(() => document.querySelector('img.image-tool__image').naturalWidth === 1);
      const saved = await editor.save();
      check(
        uploads === 1 &&
          saved.blocks[0].data.file.name === 'dropped.png' &&
          saved.blocks[0].data.caption === '<b>Подпись</b>',
        'Drop uploads once and preserves caption',
      );
      check(document.querySelector('.image-tool__placeholder').hidden, 'Uploaded image replaces drop placeholder');
      for (const checkbox of document.querySelectorAll('.image-tool__header-controls input[type="checkbox"]')) {
        checkbox.click();
      }
      const tuned = await editor.save();
      check(
        tuned.blocks[0].data.withBorder && tuned.blocks[0].data.withBackground && tuned.blocks[0].data.stretched,
        'Header settings update image data',
      );
      await editor.render(tuned);
      check(document.querySelector('figure').classList.contains('image-tool--stretched'), 'Settings survive reload');
      drop(new File(['plain text'], 'text.txt', { type: 'text/plain' }));
      check(uploads === 1 && document.querySelector('img').naturalWidth === 1, 'Non-image drop keeps current image');
      settings.uploader = {
        async uploadByFile() {
          throw new Error('Image replacement failed');
        },
      };
      await editor.render(tuned);
      drop(imageFile);
      await until(() => editor.status.textContent === 'Image replacement failed');
      check((await editor.save()).blocks[0].data.file.name === 'dropped.png', 'Failed replacement retains old image');
      let resolveUpload;
      settings.uploader = {
        uploadByFile: () =>
          new Promise((resolve) => {
            resolveUpload = resolve;
          }),
      };
      await editor.render(fixture);
      drop(imageFile);
      await editor.render(fixture);
      resolveUpload({ success: 1, file: { url: `data:image/png;base64,${png}` } });
      await tick();
      check(!(await editor.save()).blocks[0].data.file, 'Pending upload cannot modify a newly loaded document');
      await editor.api.readOnly.toggle(true);
      check(
        !document.querySelector('.image-tool__dropzone, .image-tool__header-controls'),
        'Read-only image has no upload controls',
      );
      await editor.api.readOnly.toggle(false);
      settings.uploader = window.imageDropzoneSmoke.uploader;
      await editor.render(fixture);
      return { passed: true };
    }, png);
    assert.equal(result.passed, true);
    for (const selector of [
      '.image-tool__dropzone',
      '.image-tool__header-controls button[title="Заменить изображение"]',
    ]) {
      const chooserPromise = page.waitForFileChooser();
      await (await frame.$(selector)).click();
      const chooser = await chooserPromise;
      await chooser.accept([imagePath]);
      await frame.waitForFunction(() => document.querySelector('img.image-tool__image')?.naturalWidth === 1);
      assert.equal(
        await frame.evaluate(
          async () => (await document.querySelector('slash-doc-editor').save()).blocks[0].data.file.url,
        ),
        `data:image/png;base64,${png}`,
      );
    }
    console.log(
      'Image dropzone smoke passed: drop, header settings, native file dialogs, persistence and upload failures.',
    );
  } finally {
    await frame.evaluate(async () => {
      const editor = document.querySelector('slash-doc-editor');
      editor.config.tools.image.config.uploader = window.imageDropzoneSmoke.uploader;
      editor.config.readOnly = false;
      await editor.render(window.imageDropzoneSmoke.original);
      delete window.imageDropzoneSmoke;
    });
    await rm(directory, { recursive: true, force: true });
  }
}
