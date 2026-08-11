import { isNodeInsideSelector } from './shadow-dom';

type SelectableShadowRoot = ShadowRoot & { getSelection?: () => Selection | null };
let lastEditorRange: Range | undefined;

export function readActiveEditorRange(event?: Event): Range | undefined {
  const eventEditable = event?.composedPath().find(isEditableElement);
  const active = findDeepActiveElement();
  const editable = eventEditable ?? (active && isEditableElement(active) ? active : undefined);
  const current = readEditorRange(editable ? selectionForNode(editable) : undefined);
  if (current) {
    lastEditorRange = current.cloneRange();
    return current;
  }
  if (lastEditorRange?.commonAncestorContainer.isConnected) return lastEditorRange.cloneRange();
  const fallback = readEditorRange(window.getSelection());
  if (fallback) lastEditorRange = fallback.cloneRange();
  return fallback;
}

export function selectionForNode(node: Node): Selection | null {
  const root = node.getRootNode();
  if (root instanceof ShadowRoot) return (root as SelectableShadowRoot).getSelection?.() ?? window.getSelection();
  return node.ownerDocument?.getSelection() ?? window.getSelection();
}

export function selectRangeForNode(node: Node, range: Range): void {
  const selection = selectionForNode(node);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function findDeepActiveElement(): Element | undefined {
  let active = document.activeElement ?? undefined;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function readEditorRange(selection: Selection | null | undefined): Range | undefined {
  if (!selection?.rangeCount) return undefined;
  const range = selection.getRangeAt(0);
  return isNodeInsideSelector(range.commonAncestorContainer, '#editor [contenteditable="true"]') ? range : undefined;
}

function isEditableElement(target: EventTarget): target is HTMLElement {
  return target instanceof HTMLElement && target.isContentEditable;
}
