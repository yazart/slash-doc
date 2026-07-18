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

export type ToolArgs = { data?: Partial<ConfluenceTableData> & LegacyTableData };

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

export function normalizeTable(
  value: (Partial<ConfluenceTableData> & LegacyTableData) | undefined,
): ConfluenceTableData {
  const rowsValue = value?.rows;
  const contentValue = value?.content;
  const sourceRows = Array.isArray(rowsValue) ? rowsValue : Array.isArray(contentValue) ? contentValue : [];
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

export function normalizeSizes(value: unknown, length: number): number[] {
  const sizes = Array.isArray(value)
    ? value.map((item) => (typeof item === 'number' && Number.isFinite(item) ? Math.max(0, item) : 0))
    : [];
  return Array.from({ length }, (_, index) => sizes[index] ?? 0);
}

export function readClipboardTable(text: string, html: string): string[][] | undefined {
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

export function insertTextAtSelection(editor: HTMLElement, text: string): void {
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

export function normalizeClipboardText(value: string): string {
  return value.replaceAll('\t', ' ').replaceAll(/\r?\n/g, ' ');
}

export function serializeClipboardText(values: string[][]): string {
  return values.map((row) => row.map(normalizeClipboardText).join('\t')).join('\n');
}

export function escapeClipboardHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll(/\r?\n/g, '<br>');
}
