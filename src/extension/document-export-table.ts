import { sanitizeTableCellHtml } from '../shared/table-cell-html';
import { getTableRows } from './document-export-common';
import { escapeHtml } from './utils';
import { normalizeHexColor } from '../shared/inline-colors';

export function exportTableToHtml(type: string, data: Record<string, unknown>): string {
  const rows = getTableRows(data);
  const headerRow = type === 'table' ? data.withHeadings === true : data.headerRow === true;
  const headerColumn = type === 'confluenceTable' && data.headerColumn === true;
  const columnWidths = Array.isArray(data.columnWidths) ? data.columnWidths : [];
  const rowHeights = Array.isArray(data.rowHeights) ? data.rowHeights : [];
  const rowBackgrounds = Array.isArray(data.rowBackgrounds) ? data.rowBackgrounds : [];
  const cellBackgrounds = Array.isArray(data.cellBackgrounds) ? data.cellBackgrounds : [];
  const table = `<table>${rows
    .map((row, rowIndex) => {
      const background = normalizeHexColor(rowBackgrounds[rowIndex]);
      const rowStyle = [
        typeof rowHeights[rowIndex] === 'number' && rowHeights[rowIndex] > 0 ? `height:${rowHeights[rowIndex]}px` : '',
        background ? `background-color:${background}` : '',
      ]
        .filter(Boolean)
        .join(';');
      return `<tr${rowStyle ? ` style="${rowStyle}"` : ''}>${row
        .map((cell, columnIndex) => {
          const tag = (headerRow && rowIndex === 0) || (headerColumn && columnIndex === 0) ? 'th' : 'td';
          const cellBackground = normalizeHexColor(
            Array.isArray(cellBackgrounds[rowIndex]) ? cellBackgrounds[rowIndex][columnIndex] : undefined,
          );
          const style = [
            typeof columnWidths[columnIndex] === 'number' && columnWidths[columnIndex] > 0
              ? `width:${columnWidths[columnIndex]}px`
              : '',
            cellBackground || background ? `background-color:${cellBackground || background}` : '',
          ]
            .filter(Boolean)
            .join(';');
          const content =
            type === 'confluenceTable' ? sanitizeTableCellHtml(String(cell ?? '')) : escapeHtml(String(cell ?? ''));
          return `<${tag}${style ? ` style="${style}"` : ''}${cellBackground ? ` data-slash-cell-background="${cellBackground}"` : ''}>${content}</${tag}>`;
        })
        .join('')}</tr>`;
    })
    .join('')}</table>`;

  return type === 'confluenceTable'
    ? `<div class="slash-confluence-table-scroll" role="region" aria-label="Таблица с прокруткой" tabindex="0">${table}</div>`
    : table;
}
