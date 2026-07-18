import { LUCIDE_ICONS } from './lucide-icons';
import { CONFLUENCE_TABLE_TEMPLATE } from './confluence-table-template';
import {
  clearTableCellRange,
  getSelectedTableCellData,
  insertTableData,
  openTableContextMenu,
  startTableCellSelection,
  trackTableResize,
} from './confluence-table-interactions';
import {
  escapeClipboardHtml,
  insertTextAtSelection,
  normalizeTable,
  readClipboardTable,
  serializeClipboardText,
  type ConfluenceTableData,
  type ToolArgs,
} from './confluence-table-data';

export type { ConfluenceTableData } from './confluence-table-data';

export default class ConfluenceTableTool {
  private data: ConfluenceTableData;
  private wrapper?: HTMLDivElement;
  private selectedRow = 0;
  private selectedColumn = 0;
  private suppressNextClick = false;
  static get toolbox() {
    return {
      title: 'Таблица Confluence',
      icon: LUCIDE_ICONS.table,
    };
  }
  constructor({ data }: ToolArgs) {
    this.data = normalizeTable(data);
  }

  render(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'slash-confluence-table-tool';
    wrapper.innerHTML = CONFLUENCE_TABLE_TEMPLATE;
    this.wrapper = wrapper;
    wrapper.querySelector('.ct-menu')?.addEventListener('click', (event) => this.handleMenuAction(event));
    wrapper.addEventListener('keydown', (event) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.code === 'KeyC' &&
        this.copySelectedCellsToHost()
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if ((event.key === 'Backspace' || event.key === 'Delete') && this.clearSelectedCells()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.isContentEditable) event.stopPropagation();
    });
    wrapper.addEventListener('copy', (event) => this.copySelectedCells(event), true);
    wrapper.addEventListener(
      'paste',
      (event) => {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>('.ct-cell');
        if (!cell) return;
        this.pasteTable(event, Number(cell.dataset.row), Number(cell.dataset.column));
      },
      true,
    );
    document.addEventListener('pointerdown', (event) => {
      if (
        window.__SLASH_DOC_TABLE_PASTE_TARGET__?.owner === wrapper &&
        !wrapper.contains(event.target as Node | null)
      ) {
        delete window.__SLASH_DOC_TABLE_PASTE_TARGET__;
      }
    });
    this.renderTable();
    return wrapper;
  }

  save(): ConfluenceTableData {
    return structuredClone(this.data);
  }

  private renderTable(): void {
    if (window.__SLASH_DOC_TABLE_PASTE_TARGET__?.owner === this.wrapper) {
      delete window.__SLASH_DOC_TABLE_PASTE_TARGET__;
    }
    const body = this.wrapper?.querySelector<HTMLTableSectionElement>('.ct-table tbody');
    const columns = this.wrapper?.querySelector<HTMLTableColElement>('.ct-table colgroup');
    if (!body || !columns) return;
    body.replaceChildren();
    columns.replaceChildren();
    const columnCount = this.data.rows[0]?.length ?? 1;
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const column = document.createElement('col');
      const width = this.data.columnWidths[columnIndex] ?? 0;
      if (width > 0) column.style.width = `${width}px`;
      columns.append(column);
    }
    this.data.rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      const rowHeight = this.data.rowHeights[rowIndex] ?? 0;
      if (rowHeight > 0) tr.style.height = `${rowHeight}px`;
      row.forEach((value, columnIndex) => {
        const isHeader = (this.data.headerRow && rowIndex === 0) || (this.data.headerColumn && columnIndex === 0);
        const cell = document.createElement(isHeader ? 'th' : 'td');
        const editor = document.createElement('div');
        editor.className = 'ct-cell';
        editor.contentEditable = 'true';
        editor.tabIndex = 0;
        editor.spellcheck = true;
        editor.textContent = value;
        const fixedWidth = this.data.columnWidths[columnIndex] ?? 0;
        if (fixedWidth > 0) {
          editor.style.width = `${fixedWidth}px`;
          editor.style.whiteSpace = 'pre-wrap';
          editor.style.overflowWrap = 'anywhere';
        }
        editor.dataset.row = String(rowIndex);
        editor.dataset.column = String(columnIndex);
        const paste = (text: string, html: string) => {
          this.pasteIntoCell(editor, text, html, rowIndex, columnIndex);
        };
        (editor as HTMLElement & { __slashDocPasteTable?: (text: string, html: string) => void }).__slashDocPasteTable =
          paste;
        if (rowIndex === this.selectedRow && columnIndex === this.selectedColumn) editor.classList.add('selected');
        editor.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          editor.focus();
          this.selectCell(rowIndex, columnIndex, editor, paste);
          this.startCellSelection(event, rowIndex, columnIndex);
        });
        editor.addEventListener('focus', () => this.selectCell(rowIndex, columnIndex, editor, paste));
        editor.addEventListener('click', (event) => {
          event.stopPropagation();
          if (this.suppressNextClick) {
            this.suppressNextClick = false;
            return;
          }
          this.selectCell(rowIndex, columnIndex, editor, paste);
        });
        editor.addEventListener('input', () => {
          this.data.rows[rowIndex][columnIndex] = editor.textContent ?? '';
          this.changed();
        });
        editor.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          this.selectCell(rowIndex, columnIndex, editor);
          this.openContextMenu(event.clientX, event.clientY);
        });
        cell.append(editor);
        if (rowIndex === 0) {
          const resize = document.createElement('span');
          resize.className = 'ct-column-resize';
          resize.addEventListener('pointerdown', (event) => this.resizeColumn(event, columnIndex));
          cell.append(resize);
        }
        if (columnIndex === 0) {
          const resize = document.createElement('span');
          resize.className = 'ct-row-resize';
          resize.addEventListener('pointerdown', (event) => this.resizeRow(event, rowIndex));
          cell.append(resize);
        }
        tr.append(cell);
      });
      body.append(tr);
    });
  }

  private selectCell(
    row: number,
    column: number,
    editor: HTMLElement,
    paste?: (text: string, html: string) => void,
  ): void {
    this.selectedRow = row;
    this.selectedColumn = column;
    this.clearCellRange();
    this.wrapper?.querySelectorAll('.ct-cell.selected').forEach((item) => item.classList.remove('selected'));
    editor.classList.add('selected');
    if (this.wrapper && paste) {
      window.__SLASH_DOC_TABLE_PASTE_TARGET__ = { owner: this.wrapper, paste };
    }
  }

  private startCellSelection(event: PointerEvent, anchorRow: number, anchorColumn: number): void {
    startTableCellSelection(event, this.wrapper, anchorRow, anchorColumn, () => {
      this.suppressNextClick = true;
      setTimeout(() => {
        this.suppressNextClick = false;
      }, 0);
    });
  }

  private clearCellRange(): void {
    clearTableCellRange(this.wrapper);
  }

  private clearSelectedCells(): boolean {
    const selected = Array.from(this.wrapper?.querySelectorAll<HTMLElement>('.ct-cell.range-selected') ?? []);
    if (selected.length === 0) return false;

    for (const cell of selected) {
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      if (!Number.isInteger(row) || !Number.isInteger(column) || !this.data.rows[row]) continue;
      this.data.rows[row][column] = '';
      cell.textContent = '';
    }

    this.changed();
    return true;
  }

  private copySelectedCells(event: ClipboardEvent): void {
    const values = this.getSelectedCellData();
    if (!values || !event.clipboardData) return;

    const text = serializeClipboardText(values);
    const html = `<table><tbody>${values
      .map((row) => `<tr>${row.map((value) => `<td>${escapeClipboardHtml(value)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;

    event.clipboardData.setData('text/plain', text);
    event.clipboardData.setData('text/html', html);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private copySelectedCellsToHost(): boolean {
    const values = this.getSelectedCellData();
    if (!values || !window.__SLASH_DOC_WRITE_CLIPBOARD__) return false;
    window.__SLASH_DOC_WRITE_CLIPBOARD__(serializeClipboardText(values));
    return true;
  }

  private getSelectedCellData(): string[][] | undefined {
    return getSelectedTableCellData(this.wrapper, this.data);
  }

  private addRow(index: number): void {
    const columns = this.data.rows[0]?.length ?? 1;
    this.data.rows.splice(
      index,
      0,
      Array.from({ length: columns }, () => ''),
    );
    this.data.rowHeights.splice(index, 0, 0);
    this.selectedRow = index;
    this.changed();
    this.renderTable();
  }

  private addColumn(index: number): void {
    for (const row of this.data.rows) row.splice(index, 0, '');
    this.data.columnWidths.splice(index, 0, 0);
    this.selectedColumn = index;
    this.changed();
    this.renderTable();
  }

  private deleteRow(): void {
    if (this.data.rows.length === 1) {
      this.data.rows[0].fill('');
    } else {
      this.data.rows.splice(this.selectedRow, 1);
      this.data.rowHeights.splice(this.selectedRow, 1);
      this.selectedRow = Math.min(this.selectedRow, this.data.rows.length - 1);
    }
    this.changed();
    this.renderTable();
  }

  private deleteColumn(): void {
    const columns = this.data.rows[0]?.length ?? 1;
    if (columns === 1) {
      for (const row of this.data.rows) row[0] = '';
    } else {
      for (const row of this.data.rows) row.splice(this.selectedColumn, 1);
      this.data.columnWidths.splice(this.selectedColumn, 1);
      this.selectedColumn = Math.min(this.selectedColumn, columns - 2);
    }
    this.changed();
    this.renderTable();
  }

  private openContextMenu(x: number, y: number): void {
    openTableContextMenu(this.wrapper, x, y, this.data.headerRow, this.data.headerColumn);
  }

  private handleMenuAction(event: Event): void {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    this.wrapper?.querySelector('.ct-menu')?.classList.remove('open');
    if (action === 'row-above') this.addRow(this.selectedRow);
    if (action === 'row-below') this.addRow(this.selectedRow + 1);
    if (action === 'row-delete') this.deleteRow();
    if (action === 'column-left') this.addColumn(this.selectedColumn);
    if (action === 'column-right') this.addColumn(this.selectedColumn + 1);
    if (action === 'column-delete') this.deleteColumn();
    if (action === 'header-row') {
      this.data.headerRow = !this.data.headerRow;
      this.changed();
      this.renderTable();
    }
    if (action === 'header-column') {
      this.data.headerColumn = !this.data.headerColumn;
      this.changed();
      this.renderTable();
    }
    if (action === 'paste') {
      const row = this.selectedRow;
      const column = this.selectedColumn;
      const editor = this.wrapper?.querySelector<HTMLElement>(`.ct-cell[data-row="${row}"][data-column="${column}"]`);
      if (editor && window.__SLASH_DOC_READ_CLIPBOARD__) {
        void window
          .__SLASH_DOC_READ_CLIPBOARD__()
          .then((text) => this.pasteIntoCell(editor, text, '', row, column))
          .catch(() => undefined);
      }
    }
  }

  private resizeColumn(event: PointerEvent, columnIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    const cell = (event.currentTarget as HTMLElement).parentElement;
    const start = event.clientX;
    const initial = cell?.getBoundingClientRect().width ?? 100;
    trackTableResize(
      event,
      (current) => {
        this.data.columnWidths[columnIndex] = Math.max(60, initial + current.clientX - start);
        const column = this.wrapper?.querySelectorAll<HTMLTableColElement>('.ct-table col')[columnIndex];
        if (column) column.style.width = `${this.data.columnWidths[columnIndex]}px`;
        this.wrapper?.querySelectorAll<HTMLElement>(`.ct-cell[data-column="${columnIndex}"]`).forEach((editor) => {
          editor.style.width = `${this.data.columnWidths[columnIndex]}px`;
          editor.style.whiteSpace = 'pre-wrap';
          editor.style.overflowWrap = 'anywhere';
        });
      },
      () => this.changed(),
    );
  }

  private resizeRow(event: PointerEvent, rowIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    const row = (event.currentTarget as HTMLElement).closest('tr');
    const start = event.clientY;
    const initial = row?.getBoundingClientRect().height ?? 36;
    trackTableResize(
      event,
      (current) => {
        this.data.rowHeights[rowIndex] = Math.max(28, initial + current.clientY - start);
        if (row) row.style.height = `${this.data.rowHeights[rowIndex]}px`;
      },
      () => this.changed(),
    );
  }

  private pasteTable(event: ClipboardEvent, startRow: number, startColumn: number): void {
    const clipboard = event.clipboardData;
    const text = clipboard?.getData('text/plain') ?? '';
    const html = clipboard?.getData('text/html') ?? '';
    const pasted = readClipboardTable(text, html);
    if (!pasted) return;
    event.preventDefault();
    event.stopPropagation();
    this.insertTableData(pasted, startRow, startColumn);
  }

  private pasteIntoCell(editor: HTMLElement, text: string, html: string, row: number, column: number): void {
    const pasted = readClipboardTable(text, html);
    if (pasted) {
      this.insertTableData(pasted, row, column);
      return;
    }
    editor.focus();
    insertTextAtSelection(editor, text);
    this.data.rows[row][column] = editor.textContent ?? '';
    this.changed();
  }

  private insertTableData(pasted: string[][], startRow: number, startColumn: number): void {
    insertTableData(this.data, pasted, startRow, startColumn);
    this.changed();
    this.renderTable();
  }

  private changed(): void {
    this.wrapper?.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }
}
