import type { BlockEditorElement } from './block-editor-element';
import { selectionForNode } from './editor-selection';

export function handleBlockKeydown(editor: BlockEditorElement, event: KeyboardEvent): void {
  if (editor.readOnly || event.defaultPrevented || event.isComposing) return;
  if (editor.selected.size) {
    if (event.key === 'Escape') {
      editor.clearSelection();
      event.preventDefault();
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      editor.deleteSelected();
    }
    if (event.shiftKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      const index = editor.currentIndex + (event.key === 'ArrowUp' ? -1 : 1);
      const next = editor.views[index];
      if (next) {
        event.preventDefault();
        editor.selectBlock(next.output.id!, true);
      }
    }
    return;
  }
  const text = event
    .composedPath()
    .find(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && node.matches('.ce-paragraph, .ce-header, .ce-quote'),
    );
  if (!text) return;
  const selection = selectionForNode(text);
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!range || !text.contains(range.commonAncestorContainer)) return;
  if (event.key === 'Enter' && !event.shiftKey && !range.startContainer.parentElement?.closest('li')) {
    event.preventDefault();
    range.deleteContents();
    const tail = document.createRange();
    tail.selectNodeContents(text);
    tail.setStart(range.startContainer, range.startOffset);
    const fragment = document.createElement('div');
    fragment.append(tail.extractContents());
    editor.api.blocks.insert('paragraph', { text: fragment.innerHTML }, undefined, editor.currentIndex + 1, true);
    editor.changed();
  }
  if (event.key === 'Backspace' && range.collapsed && editor.currentIndex > 0) {
    const before = range.cloneRange();
    before.selectNodeContents(text);
    before.setEnd(range.startContainer, range.startOffset);
    if (before.toString().length) return;
    const previous = editor.views[editor.currentIndex - 1];
    const previousText = previous.content.querySelector<HTMLElement>('.ce-paragraph, .ce-header, .ce-quote');
    if (!previousText) return;
    event.preventDefault();
    const index = editor.currentIndex;
    editor.api.caret.setToBlock(index - 1, 'end');
    previousText.insertAdjacentHTML('beforeend', text.innerHTML);
    editor.deleteBlock(index, false);
    editor.currentIndex = index - 1;
    editor.changed(previous);
  }
}
