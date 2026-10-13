import { selectRangeForNode } from './editor-selection';

/** Lists stay inside the active contenteditable, including table cells and MkDocs bodies. */
export function toggleRichTextList(cell: HTMLElement, range: Range, ordered: boolean): Range {
  const tag = ordered ? 'ol' : 'ul';
  const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  const existing = start?.closest<HTMLElement>('ol, ul');
  if (existing && cell.contains(existing) && existing.contains(range.endContainer)) {
    if (existing.tagName.toLowerCase() !== tag) {
      const replacement = document.createElement(tag);
      replacement.append(...Array.from(existing.childNodes));
      existing.replaceWith(replacement);
      range.selectNodeContents(replacement);
    } else {
      const fragment = document.createDocumentFragment();
      for (const item of Array.from(existing.children)) {
        const line = document.createElement('div');
        line.append(...Array.from(item.childNodes));
        fragment.append(line);
      }
      existing.replaceWith(fragment);
      range.selectNodeContents(cell);
    }
  } else {
    const selected = range.extractContents();
    const list = document.createElement(tag);
    let item = document.createElement('li');
    for (const node of Array.from(selected.childNodes)) {
      if (node instanceof HTMLElement && node.matches('br, div, p, li')) {
        if (item.childNodes.length) {
          list.append(item);
          item = document.createElement('li');
        }
        if (node.tagName !== 'BR') {
          item.append(...Array.from(node.childNodes));
          list.append(item);
          item = document.createElement('li');
        }
      } else item.append(node);
    }
    if (item.childNodes.length || !list.children.length) list.append(item);
    range.insertNode(list);
    range.selectNodeContents(list);
  }
  selectRangeForNode(cell, range);
  cell.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  return range;
}
