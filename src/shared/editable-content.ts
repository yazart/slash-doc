import { renderSafeMarkdown } from './markdown';
import { sanitizeTableCellHtml } from './table-cell-html';

/** Legacy MkDocs content is Markdown; newly edited content is restricted rich HTML. */
export function renderEditableContent(value: string, preserveBlocks = false): string {
  return sanitizeTableCellHtml(
    isRichContent(value) ? value : renderSafeMarkdown(value, preserveBlocks),
    preserveBlocks,
  );
}
export function isRichContent(value: string): boolean {
  return /<\/?(?:p|div|h[1-6]|hr|br|a|strong|b|em|i|u|mark|code|span|ul|ol|li|pre|blockquote)\b[^>]*>/i.test(value);
}
