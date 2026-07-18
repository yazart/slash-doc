import { createPageId, escapeHtml, stripHtml } from './utils';

export function createEditorBlock(type: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    id: createPageId(),
    type,
    data,
  };
}

export function markdownInlineToHtml(value: string): string {
  return escapeHtml(value)
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replaceAll(/__([^_]+)__/g, '<b>$1</b>')
    .replaceAll(/\*([^*]+)\*/g, '<i>$1</i>')
    .replaceAll(/_([^_]+)_/g, '<i>$1</i>')
    .replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function isMarkdownTableStart(lines: string[], index: number): boolean {
  return (
    isMarkdownTableLine(lines[index]) &&
    index + 1 < lines.length &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

export function isMarkdownTableLine(line: string): boolean {
  return line.includes('|') && line.trim().length > 0;
}

export function markdownTableToRows(lines: string[]): string[][] {
  return lines
    .filter((line, index) => index !== 1)
    .map((line) =>
      line
        .trim()
        .replaceAll(/^\||\|$/g, '')
        .split('|')
        .map((cell) => markdownInlineToHtml(cell.trim())),
    )
    .filter((row) => row.some((cell) => stripHtml(cell).trim().length > 0));
}
