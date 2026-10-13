import type { BlockEditorElement } from './block-editor-element';
import { findClipboardImages, isolateEditorEvent } from './editor-event-isolation';
import { toolSettings } from './block-editor-view';

/** Runs before rich text routing so copied screenshots do not become inline markup. */
export function pasteClipboardImages(editor: BlockEditorElement, event: ClipboardEvent): boolean {
  if (editor.readOnly || event.defaultPrevented) return false;
  const settings = toolSettings(editor.config.tools ?? {}, 'image');
  const files = findClipboardImages(event.clipboardData);
  if (!settings || settings.class.isInline || !files.length) return false;
  isolateEditorEvent(event);
  const selected = editor.views.filter((view) => editor.selected.has(view.output.id!));
  const source = editor.views.find((view) => event.composedPath().includes(view.holder));
  let anchor = selected.at(-1) ?? source ?? editor.views[editor.currentIndex];
  void (async () => {
    for (const file of files) {
      try {
        const upload = settings.config?.uploader?.uploadByFile;
        const result = upload
          ? await settings.config!.uploader.uploadByFile(file)
          : { success: 1, file: { url: await readImageDataUrl(file) } };
        if (result?.success !== 1 || typeof result.file?.url !== 'string' || !result.file.url)
          throw new Error('Не удалось загрузить изображение из буфера обмена.');
        // Do not put an asynchronous paste into another page or a deleted source block.
        if (!editor.isConnected || editor.readOnly || (anchor && !editor.views.includes(anchor))) return;
        const index = anchor ? editor.indexOf(anchor.output.id!) + 1 : editor.views.length;
        anchor = editor.insert({ type: 'image', data: { file: result.file, caption: '' } }, index);
      } catch (error) {
        editor.api.notifier.show({
          message: error instanceof Error ? error.message : 'Не удалось вставить изображение из буфера обмена.',
        });
      }
    }
  })();
  return true;
}

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(new Error('Не удалось прочитать изображение из буфера обмена.')));
    reader.readAsDataURL(file);
  });
}
