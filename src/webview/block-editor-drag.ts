import type { BlockEditorElement } from './block-editor-element';
import type { BlockView } from './block-editor-view';

export const BLOCK_MOVE_MIME = 'application/x-slash-doc-move';

/** Move a selection to a boundary in the original ordering, preserving its relative order. */
export function reorderBlockIds(order: string[], selected: string[], boundary: number): string[] {
  const moving = new Set(selected);
  const before = order.slice(0, boundary).filter((id) => !moving.has(id));
  const after = order.slice(boundary).filter((id) => !moving.has(id));
  return [...before, ...order.filter((id) => moving.has(id)), ...after];
}

export function installBlockDrag(editor: BlockEditorElement): () => void {
  let dragged: string[] = [];
  let boundary = -1;
  const viewFor = (event: Event) => editor.views.find((view) => event.composedPath().includes(view.holder));
  const reset = () => {
    editor.views.forEach((view) =>
      view.holder.classList.remove('slash-block-dragging', 'slash-block-drop-before', 'slash-block-drop-after'),
    );
    dragged = [];
    boundary = -1;
  };
  const pointerdown = (event: PointerEvent) => {
    const view = viewFor(event);
    if (!view || editor.readOnly) return;
    // Editing text and using a widget must retain their native pointer interactions.
    view.holder.draggable = !event
      .composedPath()
      .some(
        (node) =>
          node instanceof HTMLElement &&
          (node === view.content ||
            node.isContentEditable ||
            node.matches('input, textarea, select, a, button:not(.slash-block-handle), .slash-block-insertion-space')),
      );
  };
  const start = (event: DragEvent) => {
    const view = viewFor(event);
    if (!view || editor.readOnly || !view.holder.draggable || !event.dataTransfer) return;
    if (
      event.target !== view.holder &&
      !(event.target instanceof HTMLElement && event.target.matches('.slash-block-handle'))
    )
      return;
    dragged = editor.selected.has(view.output.id!)
      ? editor.views.filter((item) => editor.selected.has(item.output.id!)).map((item) => item.output.id!)
      : [view.output.id!];
    event.dataTransfer.setData(BLOCK_MOVE_MIME, JSON.stringify(dragged));
    event.dataTransfer.effectAllowed = 'move';
    const rect = view.holder.getBoundingClientRect();
    // The actual block includes rendered Shadow DOM widgets, which cloneNode would omit.
    event.dataTransfer.setDragImage(
      view.holder,
      Math.max(0, event.clientX - rect.left),
      Math.max(0, event.clientY - rect.top),
    );
    requestAnimationFrame(() => {
      if (dragged.length)
        editor.views
          .filter((item) => dragged.includes(item.output.id!))
          .forEach((item) => item.holder.classList.add('slash-block-dragging'));
    });
    editor.closeBlockMenu();
    event.stopPropagation();
  };
  const over = (event: DragEvent) => {
    if (editor.readOnly || !dragged.length || !event.dataTransfer?.types.includes(BLOCK_MOVE_MIME)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    editor.views.forEach((view) => view.holder.classList.remove('slash-block-drop-before', 'slash-block-drop-after'));
    const view = viewFor(event);
    if (view) {
      const rect = view.holder.getBoundingClientRect();
      const after = event.clientY >= rect.top + rect.height / 2;
      boundary = editor.indexOf(view.output.id!) + Number(after);
      view.holder.classList.add(after ? 'slash-block-drop-after' : 'slash-block-drop-before');
    } else {
      boundary = editor.views.findIndex((item) => event.clientY < item.holder.getBoundingClientRect().top);
      if (boundary < 0) boundary = editor.views.length;
      const target = editor.views[boundary] ?? editor.views.at(-1);
      target?.holder.classList.add(
        boundary === editor.views.length ? 'slash-block-drop-after' : 'slash-block-drop-before',
      );
    }
  };
  const drop = (event: DragEvent) => {
    if (!dragged.length || boundary < 0 || editor.readOnly || !event.dataTransfer?.types.includes(BLOCK_MOVE_MIME))
      return;
    event.preventDefault();
    event.stopPropagation();
    const previous = [...editor.views];
    const order = reorderBlockIds(
      previous.map((view) => view.output.id!),
      dragged,
      boundary,
    );
    editor.views = order.map((id) => previous.find((view) => view.output.id === id)!);
    editor.syncOrder();
    editor.currentIndex = editor.indexOf(dragged[0]);
    for (const id of dragged) {
      const view = editor.views.find((item) => item.output.id === id) as BlockView;
      view.tool?.moved?.(
        new CustomEvent('moved', { detail: { fromIndex: previous.indexOf(view), toIndex: editor.indexOf(id) } }),
      );
    }
    reset();
    editor.changed(undefined, 'block-moved');
  };
  editor.addEventListener('pointerdown', pointerdown, true);
  editor.addEventListener('dragstart', start);
  editor.addEventListener('dragover', over, true);
  editor.addEventListener('drop', drop, true);
  editor.addEventListener('dragend', reset);
  return () => {
    reset();
    editor.removeEventListener('pointerdown', pointerdown, true);
    editor.removeEventListener('dragstart', start);
    editor.removeEventListener('dragover', over, true);
    editor.removeEventListener('drop', drop, true);
    editor.removeEventListener('dragend', reset);
  };
}
