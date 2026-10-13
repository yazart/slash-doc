import type { BlockEditorElement } from './block-editor-element';
import { BLOCK_CLIPBOARD_MIME, decodeBlockClipboard, encodeBlockClipboard } from './block-clipboard';
import { snapshotBlock } from './block-editor-view';
import { pasteClipboardImages } from './block-editor-image-paste';

export function installBlockClipboard(editor: BlockEditorElement): () => void {
  const contains = (event: Event) => event.composedPath().includes(editor);
  const consume = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const copy = (event: ClipboardEvent) => {
    if (!contains(event) || !editor.selected.size) return;
    const blocks = editor.views.filter((view) => editor.selected.has(view.output.id!)).map(snapshotBlock);
    const text = encodeBlockClipboard(blocks);
    if (!event.clipboardData) return;
    event.clipboardData.setData(BLOCK_CLIPBOARD_MIME, text);
    event.clipboardData.setData('text/plain', text);
    consume(event);
    if (event.type === 'cut' && !editor.readOnly) editor.deleteSelected();
  };
  const paste = (event: ClipboardEvent) => {
    if (!contains(event) || editor.readOnly || event.defaultPrevented) return;
    if (isTextControl(event)) {
      pasteClipboardImages(editor, event);
      return;
    }
    const text = event.clipboardData?.getData(BLOCK_CLIPBOARD_MIME) || event.clipboardData?.getData('text/plain') || '';
    const blocks = decodeBlockClipboard(text);
    if (blocks) {
      consume(event);
      editor.pasteBlocks(blocks);
    } else pasteClipboardImages(editor, event);
  };
  const keydown = (event: KeyboardEvent) => {
    if (!contains(event) || !editor.selected.size || isTextControl(event)) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      if (event.code === 'KeyA') {
        consume(event);
        editor.views.forEach((view) => editor.selected.add(view.output.id!));
        editor.refreshSelection();
      }
      if (event.code === 'KeyC' || event.code === 'KeyX') {
        consume(event);
        void editor.copySelection(event.code === 'KeyX');
      }
    }
  };
  window.addEventListener('copy', copy, true);
  window.addEventListener('cut', copy, true);
  window.addEventListener('paste', paste, true);
  window.addEventListener('keydown', keydown, true);
  return () => {
    window.removeEventListener('copy', copy, true);
    window.removeEventListener('cut', copy, true);
    window.removeEventListener('paste', paste, true);
    window.removeEventListener('keydown', keydown, true);
  };
}
function isTextControl(event: Event): boolean {
  return event
    .composedPath()
    .some(
      (target) =>
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement,
    );
}
