export type ConfluenceTableData = {
  rows: string[][];
  headerRow: boolean;
  headerColumn: boolean;
  columnWidths: number[];
  rowHeights: number[];
};

type LegacyTableData = {
  content?: unknown;
  withHeadings?: unknown;
};

type ToolArgs = { data?: Partial<ConfluenceTableData> & LegacyTableData };

declare global {
  interface Window {
    __SLASH_DOC_READ_CLIPBOARD__?: () => Promise<string>;
    __SLASH_DOC_WRITE_CLIPBOARD__?: (text: string) => void;
    __SLASH_DOC_TABLE_PASTE_TARGET__?: {
      owner: HTMLElement;
      paste(text: string, html: string): void;
    };
  }
}

export default class ConfluenceTableTool {
  private data: ConfluenceTableData;
  private wrapper?: HTMLDivElement;
  private selectedRow = 0;
  private selectedColumn = 0;
  private suppressNextClick = false;

  static get toolbox() {
    return {
      title: 'Таблица Confluence',
      icon: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><rect x="1" y="2" width="15" height="13" rx="1" stroke="currentColor"/><path d="M1 6h15M6 2v13M11 2v13M1 10h15" stroke="currentColor"/></svg>',
    };
  }

  constructor({ data }: ToolArgs) {
    this.data = normalizeTable(data);
  }

  render(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'slash-confluence-table-tool';
    wrapper.innerHTML = `<style>
      .slash-confluence-table-tool{box-sizing:border-box;width:100%;color:var(--vscode-editor-foreground);font-family:var(--vscode-font-family,sans-serif)}.slash-confluence-table-tool *{box-sizing:border-box}
      .ct-shell{overflow:hidden;border:1px solid var(--vscode-panel-border);border-radius:5px;background:var(--vscode-editor-background)}
      .ct-scroll{overflow:auto;max-height:620px;padding:8px}.ct-table{width:max-content;min-width:100%;border-spacing:0;border-collapse:separate;table-layout:auto}.ct-table td,.ct-table th{position:relative;width:auto;min-width:100px;padding:0;border-right:1px solid var(--vscode-panel-border);border-bottom:1px solid var(--vscode-panel-border);vertical-align:top}.ct-table tr:first-child>*{border-top:1px solid var(--vscode-panel-border)}.ct-table tr>*:first-child{border-left:1px solid var(--vscode-panel-border)}.ct-table th{background:var(--vscode-editorWidget-background)}
      .ct-cell{width:max-content;min-width:100%;min-height:36px;padding:8px;outline:0;white-space:pre;font-size:12px;line-height:1.35}.ct-cell:focus,.ct-cell.selected{box-shadow:inset 0 0 0 2px var(--vscode-focusBorder);background:color-mix(in srgb,var(--vscode-focusBorder) 8%,transparent)}.ct-cell.range-selected{color:var(--vscode-list-activeSelectionForeground,#fff);background:var(--vscode-list-activeSelectionBackground,var(--vscode-focusBorder));box-shadow:inset 0 0 0 1px var(--vscode-focusBorder)}.slash-confluence-table-tool.selecting,.slash-confluence-table-tool.selecting *{user-select:none}.ct-hint{margin-left:auto;color:var(--vscode-descriptionForeground);font-size:10px}.ct-column-resize{position:absolute;z-index:3;top:0;right:-4px;width:8px;height:100%;cursor:col-resize}.ct-row-resize{position:absolute;z-index:3;right:0;bottom:-4px;left:0;height:8px;cursor:row-resize}.ct-column-resize:hover,.ct-row-resize:hover{background:color-mix(in srgb,var(--vscode-focusBorder) 65%,transparent)}
      .ct-menu{position:fixed;z-index:1000;display:none;min-width:190px;padding:4px;border:1px solid var(--vscode-menu-border,var(--vscode-panel-border));border-radius:4px;background:var(--vscode-menu-background,var(--vscode-editorWidget-background));box-shadow:0 4px 14px rgba(0,0,0,.28)}.ct-menu.open{display:grid}.ct-menu button{padding:6px 9px;color:var(--vscode-menu-foreground,var(--vscode-foreground));border:0;border-radius:2px;background:transparent;text-align:left;cursor:pointer;font-size:11px}.ct-menu button:hover{background:var(--vscode-menu-selectionBackground,var(--vscode-list-hoverBackground));color:var(--vscode-menu-selectionForeground,var(--vscode-foreground))}.ct-menu button.active::before{content:'✓';display:inline-block;width:16px}.ct-menu-separator{height:1px;margin:3px 0;background:var(--vscode-menu-separatorBackground,var(--vscode-panel-border))}
    </style><div class="ct-shell"><div class="ct-scroll"><table class="ct-table"><colgroup></colgroup><tbody></tbody></table></div></div><div class="ct-menu" role="menu">
      <button type="button" data-action="paste">Вставить из буфера</button><span class="ct-menu-separator"></span><button type="button" data-action="row-above">Добавить строку выше</button><button type="button" data-action="row-below">Добавить строку ниже</button><button type="button" data-action="row-delete">Удалить строку</button><span class="ct-menu-separator"></span>
      <button type="button" data-action="column-left">Добавить столбец слева</button><button type="button" data-action="column-right">Добавить столбец справа</button><button type="button" data-action="column-delete">Удалить столбец</button><span class="ct-menu-separator"></span>
      <button type="button" data-action="header-row">Заголовочная строка</button><button type="button" data-action="header-column">Заголовочный столбец</button>
    </div>`;
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
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragging = false;

    const move = (current: PointerEvent) => {
      if (current.pointerId !== pointerId) return;
      if (!dragging && Math.hypot(current.clientX - startX, current.clientY - startY) < 4) return;
      dragging = true;
      current.preventDefault();
      this.wrapper?.classList.add('selecting');
      window.getSelection()?.removeAllRanges();
      const target = this.findCellAtPoint(current.clientX, current.clientY);
      if (!target) return;
      this.highlightCellRange(anchorRow, anchorColumn, Number(target.dataset.row), Number(target.dataset.column));
    };

    const finish = (current: PointerEvent) => {
      if (current.pointerId !== pointerId) return;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', finish, true);
      this.wrapper?.classList.remove('selecting');
      if (dragging) {
        current.preventDefault();
        window.getSelection()?.removeAllRanges();
        this.suppressNextClick = true;
        setTimeout(() => {
          this.suppressNextClick = false;
        }, 0);
      }
    };

    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  }

  private findCellAtPoint(x: number, y: number): HTMLElement | undefined {
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const editor =
      hit?.closest<HTMLElement>('.ct-cell') ??
      hit?.closest<HTMLTableCellElement>('td, th')?.querySelector<HTMLElement>('.ct-cell');
    return editor && this.wrapper?.contains(editor) ? editor : undefined;
  }

  private highlightCellRange(anchorRow: number, anchorColumn: number, endRow: number, endColumn: number): void {
    const minRow = Math.min(anchorRow, endRow);
    const maxRow = Math.max(anchorRow, endRow);
    const minColumn = Math.min(anchorColumn, endColumn);
    const maxColumn = Math.max(anchorColumn, endColumn);
    this.wrapper?.querySelectorAll<HTMLElement>('.ct-cell').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      cell.classList.toggle(
        'range-selected',
        row >= minRow && row <= maxRow && column >= minColumn && column <= maxColumn,
      );
    });
  }

  private clearCellRange(): void {
    this.wrapper
      ?.querySelectorAll('.ct-cell.range-selected')
      .forEach((item) => item.classList.remove('range-selected'));
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
    const selected = Array.from(this.wrapper?.querySelectorAll<HTMLElement>('.ct-cell.range-selected') ?? []);
    if (selected.length === 0) return undefined;
    const rows = selected.map((cell) => Number(cell.dataset.row)).filter(Number.isInteger);
    const columns = selected.map((cell) => Number(cell.dataset.column)).filter(Number.isInteger);
    if (rows.length === 0 || columns.length === 0) return undefined;

    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minColumn = Math.min(...columns);
    const maxColumn = Math.max(...columns);
    return this.data.rows.slice(minRow, maxRow + 1).map((row) => row.slice(minColumn, maxColumn + 1));
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
    const menu = this.wrapper?.querySelector<HTMLElement>('.ct-menu');
    if (!menu) return;
    menu.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 230)}px`;
    menu.querySelector('[data-action="header-row"]')?.classList.toggle('active', this.data.headerRow);
    menu.querySelector('[data-action="header-column"]')?.classList.toggle('active', this.data.headerColumn);
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
    this.trackResize(event, (current) => {
      this.data.columnWidths[columnIndex] = Math.max(60, initial + current.clientX - start);
      const column = this.wrapper?.querySelectorAll<HTMLTableColElement>('.ct-table col')[columnIndex];
      if (column) column.style.width = `${this.data.columnWidths[columnIndex]}px`;
      this.wrapper?.querySelectorAll<HTMLElement>(`.ct-cell[data-column="${columnIndex}"]`).forEach((editor) => {
        editor.style.width = `${this.data.columnWidths[columnIndex]}px`;
        editor.style.whiteSpace = 'pre-wrap';
        editor.style.overflowWrap = 'anywhere';
      });
    });
  }

  private resizeRow(event: PointerEvent, rowIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    const row = (event.currentTarget as HTMLElement).closest('tr');
    const start = event.clientY;
    const initial = row?.getBoundingClientRect().height ?? 36;
    this.trackResize(event, (current) => {
      this.data.rowHeights[rowIndex] = Math.max(28, initial + current.clientY - start);
      if (row) row.style.height = `${this.data.rowHeights[rowIndex]}px`;
    });
  }

  private trackResize(event: PointerEvent, update: (event: PointerEvent) => void): void {
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const move = (current: PointerEvent) => update(current);
    const finish = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', finish);
      target.removeEventListener('pointercancel', finish);
      this.changed();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
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
    const requiredRows = startRow + pasted.length;
    const requiredColumns = startColumn + Math.max(...pasted.map((row) => row.length));
    const currentColumns = this.data.rows[0]?.length ?? 1;
    while (this.data.rows.length < requiredRows) {
      this.data.rows.push(Array.from({ length: Math.max(currentColumns, requiredColumns) }, () => ''));
      this.data.rowHeights.push(0);
    }
    for (const row of this.data.rows) while (row.length < requiredColumns) row.push('');
    while (this.data.columnWidths.length < requiredColumns) this.data.columnWidths.push(0);
    pasted.forEach((row, rowOffset) =>
      row.forEach((value, columnOffset) => {
        this.data.rows[startRow + rowOffset][startColumn + columnOffset] = value;
      }),
    );
    this.changed();
    this.renderTable();
  }

  private changed(): void {
    this.wrapper?.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }
}

function normalizeTable(value: (Partial<ConfluenceTableData> & LegacyTableData) | undefined): ConfluenceTableData {
  const sourceRows = Array.isArray(value?.rows) ? value.rows : Array.isArray(value?.content) ? value.content : [];
  const rows = sourceRows.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? '')));
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const normalizedRows = (
    rows.length > 0
      ? rows
      : [
          ['', ''],
          ['', ''],
        ]
  ).map((row) => [...row, ...Array.from({ length: Math.max(0, columns - row.length) }, () => '')]);
  return {
    rows: normalizedRows,
    headerRow: typeof value?.headerRow === 'boolean' ? value.headerRow : value?.withHeadings === true,
    headerColumn: value?.headerColumn === true,
    columnWidths: normalizeSizes(value?.columnWidths, normalizedRows[0]?.length ?? 1),
    rowHeights: normalizeSizes(value?.rowHeights, normalizedRows.length),
  };
}

function normalizeSizes(value: unknown, length: number): number[] {
  const sizes = Array.isArray(value)
    ? value.map((item) => (typeof item === 'number' && Number.isFinite(item) ? Math.max(0, item) : 0))
    : [];
  return Array.from({ length }, (_, index) => sizes[index] ?? 0);
}

function readClipboardTable(text: string, html: string): string[][] | undefined {
  if (/<table\b/i.test(html)) {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const rows = Array.from(document.querySelectorAll('table tr'))
      .map((row) =>
        Array.from(row.children)
          .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
          .map((cell) => cell.textContent ?? ''),
      )
      .filter((row) => row.length > 0);
    if (rows.length > 0) return rows;
  }

  const lines = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replace(/\n$/, '').split('\n');
  if (lines.length >= 2 && /^\s*```/.test(lines[0]) && /^\s*```\s*$/.test(lines.at(-1) ?? '')) {
    lines.shift();
    lines.pop();
  }
  const normalized = lines.join('\n');
  if (!normalized.includes('\t') && !normalized.includes('\n')) return undefined;
  return normalized.split('\n').map((line) => line.split('\t'));
}

function insertTextAtSelection(editor: HTMLElement, text: string): void {
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!selection || !range || !editor.contains(range.commonAncestorContainer)) {
    editor.append(document.createTextNode(text));
    return;
  }
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function normalizeClipboardText(value: string): string {
  return value.replaceAll('\t', ' ').replaceAll(/\r?\n/g, ' ');
}

function serializeClipboardText(values: string[][]): string {
  return values.map((row) => row.map(normalizeClipboardText).join('\t')).join('\n');
}

function escapeClipboardHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll(/\r?\n/g, '<br>');
}
