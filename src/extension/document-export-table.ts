import { getTableRows } from './document-export-common';
import { escapeHtml } from './utils';

export function exportTableToHtml(type: string, data: Record<string, unknown>): string {
  const rows = getTableRows(data);
  const headerRow = type === 'table' ? data.withHeadings === true : data.headerRow === true;
  const headerColumn = type === 'confluenceTable' && data.headerColumn === true;
  const columnWidths = Array.isArray(data.columnWidths) ? data.columnWidths : [];
  const rowHeights = Array.isArray(data.rowHeights) ? data.rowHeights : [];
  const table = `<table>${rows
    .map((row, rowIndex) => {
      const rowHeight =
        typeof rowHeights[rowIndex] === 'number' && rowHeights[rowIndex] > 0
          ? ` style="height:${rowHeights[rowIndex]}px"`
          : '';
      return `<tr${rowHeight}>${row
        .map((cell, columnIndex) => {
          const tag = (headerRow && rowIndex === 0) || (headerColumn && columnIndex === 0) ? 'th' : 'td';
          const width =
            typeof columnWidths[columnIndex] === 'number' && columnWidths[columnIndex] > 0
              ? ` style="width:${columnWidths[columnIndex]}px"`
              : '';
          return `<${tag}${width}>${escapeHtml(String(cell ?? ''))}</${tag}>`;
        })
        .join('')}</tr>`;
    })
    .join('')}</table>`;

  return type === 'confluenceTable'
    ? `<div class="slash-confluence-table-scroll" role="region" aria-label="Таблица с прокруткой" tabindex="0">${table}</div>`
    : table;
}
