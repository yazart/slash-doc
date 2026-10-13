import { sanitizeTableCellHtml } from '../shared/table-cell-html';
import { selectionForNode } from './editor-selection';

export function insertRichText(target: HTMLElement, text: string, html = ''): void {
  const fragment = document.createDocumentFragment();
  if (html) {
    const container = document.createElement('div');
    const pasted = new DOMParser().parseFromString(html, 'text/html');
    container.innerHTML = sanitizeTableCellHtml(pasted.body.innerHTML, target.dataset.slashRichBlocks === 'true');
    fragment.append(...Array.from(container.childNodes));
  } else {
    text
      .replaceAll('\r\n', '\n')
      .replaceAll('\r', '\n')
      .split('\n')
      .forEach((line, index) => {
        if (index) fragment.append(document.createElement('br'));
        fragment.append(document.createTextNode(line));
      });
  }
  target.focus();
  const selection = selectionForNode(target);
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!range || !target.contains(range.commonAncestorContainer)) target.append(fragment);
  else {
    range.deleteContents();
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) range.setStartAfter(last);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  target.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}
