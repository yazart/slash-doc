import { selectionForNode } from './editor-selection';

/** Delete only the empty row; promote its children instead of discarding their contents. */
export function handleEmptyListBackspace(
  root: HTMLElement | undefined,
  event: KeyboardEvent,
  exitList: () => void,
): boolean {
  if (
    !root ||
    event.defaultPrevented ||
    event.key !== 'Backspace' ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return false;
  const content = event
    .composedPath()
    .find((node): node is HTMLElement => node instanceof HTMLElement && node.matches('.cdx-list__item'));
  if (!content?.isContentEditable || !root.contains(content)) return false;
  if ((content.textContent ?? '').replaceAll(/[\s\u200B-\u200D\uFEFF]/g, '')) return false;
  const selection = selectionForNode(content);
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!range?.collapsed || !content.contains(range.commonAncestorContainer)) return false;
  const item = content.parentElement;
  const list = item?.parentElement;
  if (!item?.matches('li.slash-nested-list-item') || !list?.matches('ol, ul')) return false;

  event.preventDefault();
  event.stopImmediatePropagation();
  const contents = Array.from(root.querySelectorAll<HTMLElement>('.cdx-list__item'));
  const index = contents.indexOf(content);
  const previous = contents[index - 1];
  const next = contents[index + 1];
  const children = Array.from(item.querySelector(':scope > ol, :scope > ul')?.children ?? []);
  children.forEach((child) => item.before(child));
  item.remove();
  if (list !== root && !list.children.length) list.remove();
  if (!root.children.length) {
    exitList();
    return true;
  }
  const target = children.length ? next : (previous ?? next);
  if (target?.isConnected) {
    target.focus();
    const caret = document.createRange();
    caret.selectNodeContents(target);
    caret.collapse(target !== previous);
    const targetSelection = selectionForNode(target);
    targetSelection?.removeAllRanges();
    targetSelection?.addRange(caret);
  }
  root.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  return true;
}
