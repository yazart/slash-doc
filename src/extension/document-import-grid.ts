import { normalizeMkDocsGrid, type MkDocsGridData } from '../shared/mkdocs-grid';
import { getHtmlAttribute } from './document-import-readers';

export function isMkDocsGridOpening(html: string): boolean {
  const opening = /^\s*<(div|section)\b[^>]*>/i.exec(html)?.[0] ?? '';
  return (
    getHtmlAttribute(opening, 'class').split(/\s+/).includes('grid') || opening.includes('data-slash-doc-mkdocs-grid=')
  );
}

/** Find a complete wrapper, including nested elements of the same type. */
export function htmlElementEnd(source: string, start: number): number | undefined {
  const opening = /^<([a-z][\w-]*)\b[^>]*>/i.exec(source.slice(start));
  if (!opening) return;
  const tags = new RegExp(`<(/?)${opening[1]}\\b[^>]*>`, 'gi');
  tags.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(source))) {
    if (/\/>$/.test(match[0])) continue;
    depth += match[1] ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
}

export function readMkDocsGrid(html: string, markdown = false): MkDocsGridData | undefined {
  if (!isMkDocsGridOpening(html)) return;
  const opening = /^\s*<(div|section)\b[^>]*>/i.exec(html)!;
  const encoded = getHtmlAttribute(opening[0], 'data-slash-doc-mkdocs-grid');
  if (encoded) {
    try {
      return normalizeMkDocsGrid(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')));
    } catch {
      return;
    }
  }
  const inner = html
    .slice(opening[0].length)
    .replace(new RegExp(`</${opening[1]}\\s*>\\s*$`, 'i'), '')
    .trim();
  const classes = getHtmlAttribute(opening[0], 'class').split(/\s+/);
  const cards =
    classes.includes('cards') || /\{\s*\.card\s*\}/.test(inner) || /\bclass\s*=\s*["'][^"']*\bcard\b/.test(inner);
  let contents: string[] = [];
  if (markdown && /^\s*(?:[-*+]|\d+[.)])\s+/.test(inner) && cards) {
    contents = markdownListItems(inner);
  } else if (!markdown && /^<(?:ul|ol)\b/i.test(inner) && cards) {
    const list = inner.replace(/^<(?:ul|ol)\b[^>]*>/i, '').replace(/<\/(?:ul|ol)>\s*$/i, '');
    contents = htmlItems(list).map((item) => item.replace(/^<li\b[^>]*>/i, '').replace(/<\/li>\s*$/i, ''));
  } else if (/^</.test(inner)) {
    contents = htmlItems(inner, markdown).map((item) => {
      const wrapper = /^<div\b[^>]*>/i.exec(item);
      return wrapper
        ? item
            .slice(wrapper[0].length)
            .replace(/<\/div>\s*$/i, '')
            .trim()
        : item;
    });
  } else {
    contents = inner.split(/\n\s*\n/).map((item) => item.replace(/\n?\s*\{\s*\.card\s*\}/g, '').trim());
  }
  return normalizeMkDocsGrid({
    cards,
    items: contents.filter(Boolean).map((content, index) => ({ id: `grid-${index + 1}`, content })),
  });
}

export function readMkDocsGridMarkdown(
  lines: string[],
  start: number,
): { data: MkDocsGridData; endIndex: number } | undefined {
  if (!isMkDocsGridOpening(lines[start])) return;
  const source = lines.slice(start).join('\n');
  const masked = maskMarkdownFences(source);
  const offset = source.search(/\S/);
  const end = htmlElementEnd(masked, offset);
  if (end === undefined) return;
  const data = readMkDocsGrid(source.slice(0, end), true);
  return data ? { data, endIndex: start + source.slice(0, end).split('\n').length - 1 } : undefined;
}

function htmlItems(source: string, markdown = false): string[] {
  const masked = markdown ? maskMarkdownFences(source) : source;
  const items: string[] = [];
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? '') && index < source.length) index += 1;
    const end = htmlElementEnd(masked, index);
    if (end === undefined) {
      if (source.slice(index).trim()) items.push(source.slice(index).trim());
      break;
    }
    items.push(source.slice(index, end));
    index = end;
  }
  return items;
}

function markdownListItems(source: string): string[] {
  const lines = source.split('\n');
  const base = /^(\s*)/.exec(lines[0])![1].length;
  const items: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const item = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item && item[1].length === base) {
      if (current.length) items.push(current.join('\n').trim());
      current = [item[2].trim()];
    } else current.push(line.replace(new RegExp(`^ {0,${base + 4}}`), ''));
  }
  if (current.length) items.push(current.join('\n').trim());
  return items;
}

function maskMarkdownFences(source: string): string {
  // Literal HTML in fenced code must not close the surrounding grid.
  let fence = '';
  return source
    .split('\n')
    .map((line) => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker) {
        if (!fence) fence = marker[0];
        else if (fence === marker[0]) fence = '';
        return ' '.repeat(line.length);
      }
      return fence ? ' '.repeat(line.length) : line;
    })
    .join('\n');
}
