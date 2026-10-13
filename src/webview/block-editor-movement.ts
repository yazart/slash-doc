import type { BlockEditorElement } from './block-editor-element';
import { selectionForNode } from './editor-selection';

export function handleBlockMovement(editor: BlockEditorElement, event: KeyboardEvent): void {
  if (
    editor.readOnly ||
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.shiftKey ||
    !(event.ctrlKey || event.metaKey) ||
    !['ArrowUp', 'ArrowDown'].includes(event.key)
  )
    return;
  const direction = event.key === 'ArrowUp' ? -1 : 1;
  const source = editor.views.find((view) => event.composedPath().includes(view.holder));
  const active = event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement);
  const selection = active ? selectionForNode(active) : null;
  const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined;
  // Retain the actual endpoints: live Range boundaries can change when DOM nodes move.
  const caret = range && {
    start: range.startContainer,
    startOffset: range.startOffset,
    end: range.endContainer,
    endOffset: range.endOffset,
  };
  const moving = editor.selected.size
    ? editor.views.filter((view) => editor.selected.has(view.output.id!))
    : [source ?? editor.views[editor.currentIndex]].filter((view) => !!view);
  if (!moving.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (
    moving.some(
      (view) =>
        editor.indexOf(view.output.id!) + direction < 0 ||
        editor.indexOf(view.output.id!) + direction >= editor.views.length,
    )
  )
    return;
  const currentId = editor.views[editor.currentIndex]?.output.id;
  for (const view of direction < 0 ? moving : [...moving].reverse()) {
    const index = editor.indexOf(view.output.id!);
    editor.move(index + direction, index);
  }
  if (currentId) editor.currentIndex = editor.indexOf(currentId);
  if (active?.isConnected) active.focus({ preventScroll: true });
  if (caret && range && selection && caret.start.isConnected && caret.end.isConnected) {
    range.setStart(caret.start, caret.startOffset);
    range.setEnd(caret.end, caret.endOffset);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  moving[direction < 0 ? 0 : moving.length - 1].holder.scrollIntoView({ block: 'nearest' });
}
