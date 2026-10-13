import type { BlockEditorElement } from './block-editor-element';

export function installBlockInsertion(editor: BlockEditorElement): () => void {
  const keydown = (event: KeyboardEvent) => {
    const insert =
      ((event.ctrlKey || event.metaKey) && (event.code === 'KeyI' || ['i', 'ш'].includes(event.key.toLowerCase()))) ||
      (event.key === 'Insert' && !event.ctrlKey && !event.metaKey);
    if (!insert || event.shiftKey || event.altKey || event.isComposing || editor.readOnly) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editor.openInsertMenu();
  };
  const click = (event: MouseEvent) => {
    if (editor.readOnly || event.button !== 0 || event.defaultPrevented) return;
    const target = event.target;
    const parent = editor.parentElement;
    const redactor = editor.querySelector('.codex-editor__redactor');
    const view = editor.views.find(
      (item) => item.holder === target || item.holder.querySelector('.slash-block-insertion-space') === target,
    );
    // Only editor whitespace creates paragraphs; blank widget canvases keep their own interactions.
    if (target !== editor && target !== parent && target !== redactor && !view) return;
    event.preventDefault();
    const index = editor.views.findIndex((item) => event.clientY < item.holder.getBoundingClientRect().top);
    editor.api.blocks.insert(
      'paragraph',
      { text: '' },
      undefined,
      view ? editor.indexOf(view.output.id!) + 1 : index < 0 ? editor.views.length : index,
      true,
    );
  };
  editor.addEventListener('keydown', keydown, true);
  const parent = editor.parentElement;
  (parent ?? editor).addEventListener('click', click as EventListener);
  return () => {
    editor.removeEventListener('keydown', keydown, true);
    (parent ?? editor).removeEventListener('click', click as EventListener);
  };
}
