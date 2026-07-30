import { isolateEditorEvent } from './editor-event-isolation';

export type TaskTableDragKind = 'card' | 'column';

export function beginTaskTableDrag(event: DragEvent, kind: TaskTableDragKind, id: string): void {
  event.stopPropagation();
  event.dataTransfer?.setData(`application/x-slash-doc-task-${kind}`, id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

export function consumeTaskTableDragEvent(event: DragEvent): void {
  isolateEditorEvent(event);
}

export function finishTaskTableDrag(event: DragEvent): void {
  event.stopPropagation();
}
