import type { PageBlock } from './page-block-diff';

export type TextDiffPart = { value: string; kind: 'equal' | 'added' | 'removed' };

export function diffText(previous: string, next: string): TextDiffPart[] {
  const left = tokenize(previous);
  const right = tokenize(next);
  if (left.length * right.length > 250_000) {
    return [
      ...(previous ? [{ value: previous, kind: 'removed' as const }] : []),
      ...(next ? [{ value: next, kind: 'added' as const }] : []),
    ];
  }
  const lengths = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      lengths[row][column] =
        left[row - 1] === right[column - 1]
          ? lengths[row - 1][column - 1] + 1
          : Math.max(lengths[row - 1][column], lengths[row][column - 1]);
    }
  }

  const parts: TextDiffPart[] = [];
  let row = left.length;
  let column = right.length;
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && left[row - 1] === right[column - 1]) {
      prepend(parts, left[row - 1], 'equal');
      row -= 1;
      column -= 1;
    } else if (column > 0 && (row === 0 || lengths[row][column - 1] >= lengths[row - 1][column])) {
      prepend(parts, right[column - 1], 'added');
      column -= 1;
    } else {
      prepend(parts, left[row - 1], 'removed');
      row -= 1;
    }
  }
  return parts;
}

export function readBlockText(block: PageBlock | undefined): string | undefined {
  if (!block || !isRecord(block.data)) return undefined;
  if (typeof block.data.text === 'string') return htmlToText(block.data.text);
  if (Array.isArray(block.data.items)) return readItems(block.data.items).join('\n');
  if (Array.isArray(block.data.rows)) return readRows(block.data.rows);
  return undefined;
}

function tokenize(value: string): string[] {
  return value.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
}

function prepend(parts: TextDiffPart[], value: string, kind: TextDiffPart['kind']): void {
  if (parts[0]?.kind === kind) parts[0].value = value + parts[0].value;
  else parts.unshift({ value, kind });
}

function htmlToText(value: string): string {
  const template = document.createElement('template');
  template.innerHTML = value;
  return template.content.textContent ?? '';
}

function readItems(items: unknown[]): string[] {
  return items.flatMap((item) => {
    if (typeof item === 'string') return [htmlToText(item)];
    if (!isRecord(item)) return [];
    const content = typeof item.content === 'string' ? htmlToText(item.content) : '';
    const children = Array.isArray(item.items) ? readItems(item.items) : [];
    return [content, ...children];
  });
}

function readRows(rows: unknown[]): string | undefined {
  const lines = rows
    .filter(Array.isArray)
    .map((row) => row.map((cell) => (typeof cell === 'string' ? htmlToText(cell) : '')).join('\t'));
  return lines.length ? lines.join('\n') : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
