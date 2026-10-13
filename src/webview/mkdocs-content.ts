import { renderEditableContent } from '../shared/editable-content';
import { sanitizeTableCellHtml } from '../shared/table-cell-html';

export function createMkDocsContent(
  value: string,
  label: string,
  onChange: (html: string) => void,
  readOnly = false,
  preserveBlocks = false,
): HTMLDivElement {
  const content = document.createElement('div');
  content.className = 'mkdocs-content';
  content.contentEditable = String(!readOnly);
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-multiline', 'true');
  content.setAttribute('aria-label', label);
  content.dataset.placeholder = label;
  content.innerHTML = renderEditableContent(value, preserveBlocks);
  if (preserveBlocks) content.dataset.slashRichBlocks = 'true';
  content.addEventListener('input', () => onChange(sanitizeTableCellHtml(content.innerHTML, preserveBlocks)));
  return content;
}
