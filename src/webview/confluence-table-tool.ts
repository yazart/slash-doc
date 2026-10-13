import { renderConfluenceTable } from './confluence-table-render';
import { setTableCellBackground } from './confluence-table-background';
import { sanitizeTableCellHtml } from '../shared/table-cell-html';
import { createTextInlineToolbar } from './confluence-table-inline-toolbar';
import { LUCIDE_ICONS } from './lucide-icons';
import { CONFLUENCE_TABLE_TEMPLATE } from './confluence-table-template';
import {
  clearTableCellRange,
  getSelectedTableCellData,
  installTablePasteTargetCleanup,
  insertTableData,
  openTableContextMenu,
  startTableCellSelection,
  trackTableResize,
} from './confluence-table-interactions';
import {
  insertTableColumn,
  insertTextAtSelection,
  insertTableRow,
  normalizeTable,
  readClipboardTable,
  serializeClipboardText,
  type ConfluenceTableData,
  type ToolArgs,
} from './confluence-table-data';
import styles from './confluence-table-tool.shadow.css?raw';
import inlineToolbarStyles from './text-inline-toolbar.css?raw';
import { createToolSurface } from './tool-surface';
import { installTableClipboard } from './confluence-table-clipboard';
import { selectRangeForNode } from './editor-selection';
import { createTableHeaderControls, pasteTableCellFromClipboard } from './confluence-table-header-controls';

export type { ConfluenceTableData } from './confluence-table-data';

export default class ConfluenceTableTool {
  private data: ConfluenceTableData;
  private wrapper?: HTMLDivElement;
  private selectedRow = 0;
  private selectedColumn = 0;
  private suppressNextClick = false;
  private removePasteTargetCleanup?: () => void;
  private removeClipboard?: () => void;
  private readonly inlineToolbar;
  private headerControls?: ReturnType<typeof createTableHeaderControls>;
  static get toolbox() {
    return { title: 'Таблица Confluence', icon: LUCIDE_ICONS.table };
  }
  constructor({ data, config }: ToolArgs) {
    this.data = normalizeTable(data);
    this.inlineToolbar = createTextInlineToolbar(config);
  }

  renderHeaderControls(): HTMLElement {
    this.headerControls = createTableHeaderControls({
      cell: () => this.currentCell(),
      color: () =>
        this.data.cellBackgrounds[this.selectedRow]?.[this.selectedColumn] ||
        this.data.rowBackgrounds[this.selectedRow] ||
        '',
      fill: (value) => {
        const cell = this.currentCell();
        if (cell && setTableCellBackground(this.wrapper, this.data, cell, value)) this.changed();
        this.headerControls?.update();
      },
      addColumn: () => this.addColumn(this.selectedColumn + 1),
      deleteColumn: () => this.deleteColumn(),
      addRow: () => this.addRow(this.selectedRow + 1),
      deleteRow: () => this.deleteRow(),
      paste: (cell, text) => this.pasteIntoCell(cell, text, '', Number(cell.dataset.row), Number(cell.dataset.column)),
    });
    return this.headerControls.element;
  }

  private currentCell(): HTMLElement | undefined {
    return (
      this.wrapper?.querySelector<HTMLElement>(
        `.ct-cell[data-row="${this.selectedRow}"][data-column="${this.selectedColumn}"]`,
      ) ?? undefined
    );
  }

  render(): HTMLElement {
    const surface = createToolSurface(`${inlineToolbarStyles}\n${styles}`, 'slash-confluence-table-surface');
    const wrapper = document.createElement('div');
    wrapper.className = 'slash-confluence-table-tool';
    wrapper.innerHTML = CONFLUENCE_TABLE_TEMPLATE;
    wrapper.prepend(this.inlineToolbar.element);
    this.wrapper = wrapper;
    this.removeClipboard = installTableClipboard(wrapper, {
      paste: (cell, text, html) =>
        this.pasteIntoCell(cell, text, html, Number(cell.dataset.row), Number(cell.dataset.column)),
      selectText: () => this.clearCellRange(),
    });
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
    this.removePasteTargetCleanup = installTablePasteTargetCleanup(wrapper);
    this.renderTable();
    surface.content.append(wrapper);
    return surface;
  }

  save(): ConfluenceTableData {
    return structuredClone(this.data);
  }

  destroy(): void {
    this.inlineToolbar.destroy();
    this.removePasteTargetCleanup?.();
    this.removeClipboard?.();
  }

  private renderTable(): void {
    renderConfluenceTable({
      wrapper: this.wrapper,
      data: this.data,
      selectedRow: this.selectedRow,
      selectedColumn: this.selectedColumn,
      inlineToolbar: this.inlineToolbar,
      selectCell: (...args) => this.selectCell(...args),
      pasteIntoCell: (...args) => this.pasteIntoCell(...args),
      startCellSelection: (...args) => this.startCellSelection(...args),
      consumeSuppressedClick: () => {
        const suppressed = this.suppressNextClick;
        this.suppressNextClick = false;
        return suppressed;
      },
      changed: () => this.changed(),
      openContextMenu: (...args) => this.openContextMenu(...args),
      resizeColumn: (...args) => this.resizeColumn(...args),
      resizeRow: (...args) => this.resizeRow(...args),
    });
    this.headerControls?.update();
    if (this.wrapper?.isConnected) this.currentCell()?.focus();
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
    this.headerControls?.update();
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
      .map((row) => `<tr>${row.map((value) => `<td>${sanitizeTableCellHtml(value)}</td>`).join('')}</tr>`)
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
    this.selectedRow = insertTableRow(this.data, index);
    this.changed();
    this.renderTable();
  }

  private addColumn(index: number): void {
    this.selectedColumn = insertTableColumn(this.data, index);
    this.changed();
    this.renderTable();
  }

  private deleteRow(): void {
    if (this.data.rows.length === 1) {
      this.data.rows[0].fill('');
      this.data.rowBackgrounds[0] = '';
      this.data.cellBackgrounds[0].fill('');
    } else {
      this.data.rows.splice(this.selectedRow, 1);
      this.data.rowHeights.splice(this.selectedRow, 1);
      this.data.rowBackgrounds.splice(this.selectedRow, 1);
      this.data.cellBackgrounds.splice(this.selectedRow, 1);
      this.selectedRow = Math.min(this.selectedRow, this.data.rows.length - 1);
    }
    this.changed();
    this.renderTable();
  }

  private deleteColumn(): void {
    const columns = this.data.rows[0]?.length ?? 1;
    if (columns === 1) {
      for (const row of this.data.rows) row[0] = '';
      for (const row of this.data.cellBackgrounds) row[0] = '';
    } else {
      for (const row of this.data.rows) row.splice(this.selectedColumn, 1);
      for (const row of this.data.cellBackgrounds) row.splice(this.selectedColumn, 1);
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
      void pasteTableCellFromClipboard(
        () => this.currentCell(),
        (cell, text) => this.pasteIntoCell(cell, text, '', Number(cell.dataset.row), Number(cell.dataset.column)),
      );
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

  private pasteIntoCell(editor: HTMLElement, text: string, html: string, row: number, column: number): void {
    if (!editor.isConnected || !editor.isContentEditable) return;
    const pasted = readClipboardTable(text, html);
    if (pasted) {
      this.insertTableData(pasted, row, column);
      return;
    }
    editor.focus();
    insertTextAtSelection(editor, text, html);
    this.data.rows[row][column] = sanitizeTableCellHtml(editor.innerHTML);
    this.changed();
  }

  private insertTableData(pasted: string[][], startRow: number, startColumn: number): void {
    insertTableData(this.data, pasted, startRow, startColumn);
    this.selectedRow = startRow;
    this.selectedColumn = startColumn;
    this.changed();
    this.renderTable();
    const cell = this.wrapper?.querySelector<HTMLElement>(
      `.ct-cell[data-row="${startRow}"][data-column="${startColumn}"]`,
    );
    if (cell) {
      cell.focus();
      const range = document.createRange();
      range.selectNodeContents(cell);
      range.collapse(false);
      selectRangeForNode(cell, range);
      this.inlineToolbar.captureSelection(cell);
    }
  }

  private changed(): void {
    this.wrapper?.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }
}
