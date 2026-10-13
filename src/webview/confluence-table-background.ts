import { normalizeHexColor } from '../shared/inline-colors';
import type { ConfluenceTableData } from './confluence-table-data';

export function paintTableRow(row: HTMLElement, color: string, cellColors: string[] = []): void {
  row.style.backgroundColor = color;
  for (const [index, cell] of Array.from(row.children).entries()) {
    if (cell instanceof HTMLElement && cell.matches('td, th')) cell.style.backgroundColor = cellColors[index] || color;
  }
}

export function setTableCellBackground(
  wrapper: HTMLElement | undefined,
  data: ConfluenceTableData,
  current: HTMLElement,
  value: string,
): boolean {
  if (!wrapper?.contains(current) || !current.isConnected || !current.isContentEditable) return false;
  const color = normalizeHexColor(value);
  if (value && !color) return false;
  const selection = Array.from(wrapper.querySelectorAll<HTMLElement>('.ct-cell.range-selected'));
  const rows = new Set<number>();
  for (const cell of selection.length ? selection : [current]) {
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    if (!Number.isInteger(row) || !Number.isInteger(column) || data.rows[row]?.[column] === undefined) continue;
    data.cellBackgrounds[row][column] = color;
    rows.add(row);
  }
  const elements = wrapper.querySelectorAll<HTMLTableRowElement>('.ct-table tbody > tr');
  for (const row of rows)
    if (elements[row]) paintTableRow(elements[row], data.rowBackgrounds[row], data.cellBackgrounds[row]);
  return rows.size > 0;
}
