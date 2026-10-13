import { sanitizeTableCellHtml } from '../shared/table-cell-html';
import type { ConfluenceTableData } from './confluence-table-data';
import type { TextInlineToolbar } from './confluence-table-inline-toolbar';
import { paintTableRow } from './confluence-table-background';
import { isPointerOverTableText } from './confluence-table-interactions';

type TableRenderContext = {
  wrapper?: HTMLElement;
  data: ConfluenceTableData;
  selectedRow: number;
  selectedColumn: number;
  inlineToolbar: TextInlineToolbar;
  selectCell(row: number, column: number, editor: HTMLElement, paste?: (text: string, html: string) => void): void;
  pasteIntoCell(editor: HTMLElement, text: string, html: string, row: number, column: number): void;
  startCellSelection(event: PointerEvent, row: number, column: number): void;
  consumeSuppressedClick(): boolean;
  changed(): void;
  openContextMenu(x: number, y: number): void;
  resizeColumn(event: PointerEvent, column: number): void;
  resizeRow(event: PointerEvent, row: number): void;
};

export function renderConfluenceTable(context: TableRenderContext): void {
  const {
    wrapper,
    data,
    selectedRow,
    selectedColumn,
    inlineToolbar,
    selectCell,
    pasteIntoCell,
    startCellSelection,
    consumeSuppressedClick,
    changed,
    openContextMenu,
    resizeColumn,
    resizeRow,
  } = context;
  inlineToolbar.close();
  if (window.__SLASH_DOC_TABLE_PASTE_TARGET__?.owner === wrapper) {
    delete window.__SLASH_DOC_TABLE_PASTE_TARGET__;
  }
  const body = wrapper?.querySelector<HTMLTableSectionElement>('.ct-table tbody');
  const columns = wrapper?.querySelector<HTMLTableColElement>('.ct-table colgroup');
  if (!body || !columns) return;
  body.replaceChildren();
  columns.replaceChildren();
  const columnCount = data.rows[0]?.length ?? 1;
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const column = document.createElement('col');
    const width = data.columnWidths[columnIndex] ?? 0;
    if (width > 0) column.style.width = `${width}px`;
    columns.append(column);
  }
  data.rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    const rowHeight = data.rowHeights[rowIndex] ?? 0;
    if (rowHeight > 0) tr.style.height = `${rowHeight}px`;
    row.forEach((value, columnIndex) => {
      const isHeader = (data.headerRow && rowIndex === 0) || (data.headerColumn && columnIndex === 0);
      const cell = document.createElement(isHeader ? 'th' : 'td');
      const editor = document.createElement('div');
      editor.className = 'ct-cell';
      editor.contentEditable = 'true';
      editor.tabIndex = 0;
      editor.spellcheck = true;
      editor.innerHTML = sanitizeTableCellHtml(value);
      const fixedWidth = data.columnWidths[columnIndex] ?? 0;
      if (fixedWidth > 0) {
        editor.style.width = `${fixedWidth}px`;
        editor.style.whiteSpace = 'pre-wrap';
        editor.style.overflowWrap = 'anywhere';
      }
      editor.dataset.row = String(rowIndex);
      editor.dataset.column = String(columnIndex);
      const paste = (text: string, html: string) => {
        pasteIntoCell(editor, text, html, rowIndex, columnIndex);
      };
      (editor as HTMLElement & { __slashDocPasteTable?: (text: string, html: string) => void }).__slashDocPasteTable =
        paste;
      if (rowIndex === selectedRow && columnIndex === selectedColumn) editor.classList.add('selected');
      cell.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !editor.isContentEditable) return;
        event.stopPropagation();
        editor.focus();
        selectCell(rowIndex, columnIndex, editor, paste);
        if (!isPointerOverTableText(editor, event)) {
          if (!editor.contains(event.target as Node)) event.preventDefault();
          startCellSelection(event, rowIndex, columnIndex);
        }
      });
      editor.addEventListener('focus', () => selectCell(rowIndex, columnIndex, editor, paste));
      inlineToolbar.bindCell(editor);
      cell.addEventListener('mouseup', () => inlineToolbar.captureSelection(editor));
      cell.addEventListener('click', (event) => {
        event.stopPropagation();
        if (
          !editor.isContentEditable ||
          (event.target instanceof HTMLElement && event.target.closest('.ct-column-resize, .ct-row-resize'))
        )
          return;
        if (consumeSuppressedClick()) return;
        selectCell(rowIndex, columnIndex, editor, paste);
      });
      editor.addEventListener('input', () => {
        data.rows[rowIndex][columnIndex] = sanitizeTableCellHtml(editor.innerHTML);
        changed();
      });
      cell.addEventListener('contextmenu', (event) => {
        if (!editor.isContentEditable) return;
        event.preventDefault();
        selectCell(rowIndex, columnIndex, editor);
        openContextMenu(event.clientX, event.clientY);
      });
      cell.append(editor);
      if (rowIndex === 0) {
        const resize = document.createElement('span');
        resize.className = 'ct-column-resize';
        resize.addEventListener('pointerdown', (event) => resizeColumn(event, columnIndex));
        cell.append(resize);
      }
      if (columnIndex === 0) {
        const resize = document.createElement('span');
        resize.className = 'ct-row-resize';
        resize.addEventListener('pointerdown', (event) => resizeRow(event, rowIndex));
        cell.append(resize);
      }
      tr.append(cell);
    });
    paintTableRow(tr, data.rowBackgrounds[rowIndex], data.cellBackgrounds[rowIndex]);
    body.append(tr);
  });
}
