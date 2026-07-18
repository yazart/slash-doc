import type { ConfluenceTableData } from './confluence-table-data';

export function startTableCellSelection(
  event: PointerEvent,
  wrapper: HTMLElement | undefined,
  anchorRow: number,
  anchorColumn: number,
  onFinished: () => void,
): void {
  const startX = event.clientX;
  const startY = event.clientY;
  const pointerId = event.pointerId;
  let dragging = false;
  const move = (current: PointerEvent) => {
    if (current.pointerId !== pointerId) return;
    if (!dragging && Math.hypot(current.clientX - startX, current.clientY - startY) < 4) return;
    dragging = true;
    current.preventDefault();
    wrapper?.classList.add('selecting');
    window.getSelection()?.removeAllRanges();
    const target = findTableCellAtPoint(wrapper, current.clientX, current.clientY);
    if (target)
      highlightTableCellRange(
        wrapper,
        anchorRow,
        anchorColumn,
        Number(target.dataset.row),
        Number(target.dataset.column),
      );
  };
  const finish = (current: PointerEvent) => {
    if (current.pointerId !== pointerId) return;
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', finish, true);
    document.removeEventListener('pointercancel', finish, true);
    wrapper?.classList.remove('selecting');
    if (dragging) {
      current.preventDefault();
      window.getSelection()?.removeAllRanges();
      onFinished();
    }
  };
  document.addEventListener('pointermove', move, { capture: true, passive: false });
  document.addEventListener('pointerup', finish, true);
  document.addEventListener('pointercancel', finish, true);
}

export function clearTableCellRange(wrapper: HTMLElement | undefined): void {
  wrapper?.querySelectorAll('.ct-cell.range-selected').forEach((item) => item.classList.remove('range-selected'));
}

export function getSelectedTableCellData(
  wrapper: HTMLElement | undefined,
  data: ConfluenceTableData,
): string[][] | undefined {
  const selected = Array.from(wrapper?.querySelectorAll<HTMLElement>('.ct-cell.range-selected') ?? []);
  if (selected.length === 0) return undefined;
  const rows = selected.map((cell) => Number(cell.dataset.row)).filter(Number.isInteger);
  const columns = selected.map((cell) => Number(cell.dataset.column)).filter(Number.isInteger);
  if (rows.length === 0 || columns.length === 0) return undefined;
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);
  return data.rows.slice(minRow, maxRow + 1).map((row) => row.slice(minColumn, maxColumn + 1));
}

export function openTableContextMenu(
  wrapper: HTMLElement | undefined,
  x: number,
  y: number,
  headerRow: boolean,
  headerColumn: boolean,
): void {
  const menu = wrapper?.querySelector<HTMLElement>('.ct-menu');
  if (!menu) return;
  menu.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 230)}px`;
  menu.querySelector('[data-action="header-row"]')?.classList.toggle('active', headerRow);
  menu.querySelector('[data-action="header-column"]')?.classList.toggle('active', headerColumn);
  menu.classList.add('open');
  setTimeout(
    () =>
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (!menu.contains(event.target as Node | null)) menu.classList.remove('open');
        },
        { once: true },
      ),
    0,
  );
}

export function trackTableResize(
  event: PointerEvent,
  update: (event: PointerEvent) => void,
  onFinish: () => void,
): void {
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  const move = (current: PointerEvent) => update(current);
  const finish = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', finish);
    target.removeEventListener('pointercancel', finish);
    onFinish();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', finish);
  target.addEventListener('pointercancel', finish);
}

export function insertTableData(
  data: ConfluenceTableData,
  pasted: string[][],
  startRow: number,
  startColumn: number,
): void {
  const requiredRows = startRow + pasted.length;
  const requiredColumns = startColumn + Math.max(...pasted.map((row) => row.length));
  const currentColumns = data.rows[0]?.length ?? 1;
  while (data.rows.length < requiredRows) {
    data.rows.push(Array.from({ length: Math.max(currentColumns, requiredColumns) }, () => ''));
    data.rowHeights.push(0);
  }
  for (const row of data.rows) while (row.length < requiredColumns) row.push('');
  while (data.columnWidths.length < requiredColumns) data.columnWidths.push(0);
  pasted.forEach((row, rowOffset) =>
    row.forEach((value, columnOffset) => {
      data.rows[startRow + rowOffset][startColumn + columnOffset] = value;
    }),
  );
}

function findTableCellAtPoint(wrapper: HTMLElement | undefined, x: number, y: number): HTMLElement | undefined {
  const hit = document.elementFromPoint(x, y) as HTMLElement | null;
  const editor =
    hit?.closest<HTMLElement>('.ct-cell') ??
    hit?.closest<HTMLTableCellElement>('td, th')?.querySelector<HTMLElement>('.ct-cell');
  return editor && wrapper?.contains(editor) ? editor : undefined;
}

function highlightTableCellRange(
  wrapper: HTMLElement | undefined,
  anchorRow: number,
  anchorColumn: number,
  endRow: number,
  endColumn: number,
): void {
  const minRow = Math.min(anchorRow, endRow);
  const maxRow = Math.max(anchorRow, endRow);
  const minColumn = Math.min(anchorColumn, endColumn);
  const maxColumn = Math.max(anchorColumn, endColumn);
  wrapper?.querySelectorAll<HTMLElement>('.ct-cell').forEach((cell) => {
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    cell.classList.toggle(
      'range-selected',
      row >= minRow && row <= maxRow && column >= minColumn && column <= maxColumn,
    );
  });
}
