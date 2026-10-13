const SIMPLE_TAGS = new Set([
  'b',
  'strong',
  'i',
  'em',
  'u',
  'mark',
  'code',
  'ul',
  'ol',
  'li',
  'del',
  'blockquote',
  'pre',
]);

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr']);

export function sanitizeTableCellHtml(value: string, preserveBlocks = false): string {
  const tokens: string[] = [];
  const tokenized = value.replaceAll(/<[^>]*>/g, (tag) => {
    const safe = sanitizeTag(tag, preserveBlocks);
    const token = `\u0000SLASHDOCTAG${tokens.length}\u0000`;
    tokens.push(safe ?? escapeHtml(tag));
    return token;
  });
  return escapeHtml(decodeHtmlEntities(tokenized)).replaceAll(
    /\u0000SLASHDOCTAG(\d+)\u0000/g,
    (_match, index: string) => tokens[Number(index)] ?? '',
  );
}

export function tableCellHtmlToText(value: string): string {
  return decodeHtmlEntities(
    sanitizeTableCellHtml(value)
      .replaceAll(/<br\s*\/?>|<\/li>|<\/p>|<\/div>/gi, '\n')
      .replaceAll(/<[^>]*>/g, ''),
  );
}

function sanitizeTag(tag: string, preserveBlocks: boolean): string | undefined {
  const closing = /^<\s*\/\s*([a-z0-9-]+)\s*>$/i.exec(tag)?.[1]?.toLowerCase();
  if (preserveBlocks && closing && BLOCK_TAGS.has(closing) && closing !== 'hr') return `</${closing}>`;
  if (closing && (SIMPLE_TAGS.has(closing) || closing === 'span' || closing === 'a')) return `</${closing}>`;
  if (closing === 'div' || closing === 'p') return '';
  const name = /^<\s*([a-z0-9-]+)/i.exec(tag)?.[1]?.toLowerCase();
  if (!name) return undefined;
  if (preserveBlocks && BLOCK_TAGS.has(name)) return `<${name}>`;
  if (SIMPLE_TAGS.has(name)) return `<${name}>`;
  if (name === 'br') return '<br>';
  if (name === 'div' || name === 'p') return '<br>';
  if (name === 'span') return sanitizeSpan(tag);
  if (name === 'a') return sanitizeAnchor(tag, preserveBlocks);
  return undefined;
}

function sanitizeSpan(tag: string): string {
  const { color, background } = readInlineColors(tag);
  const inlineCode = /\bclass\s*=\s*["'][^"']*\binline-code\b/i.test(tag);
  if (color || background) {
    const classes = [
      color ? 'slash-text-color' : '',
      background ? 'slash-text-background' : '',
      inlineCode ? 'inline-code' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const data = `${color ? ` data-slash-text-color="${color}"` : ''}${background ? ` data-slash-text-background="${background}"` : ''}`;
    const style = [color ? `color:${color}` : '', background ? `background-color:${background}` : '']
      .filter(Boolean)
      .join(';');
    return `<span class="${classes}"${data} style="${style}">`;
  }
  return inlineCode ? '<span class="inline-code">' : '<span>';
}

function sanitizeAnchor(tag: string, allowRelativeLinks: boolean): string | undefined {
  const pageId = readAttribute(tag, 'data-page-id');
  const href = pageId ? `slash-doc://page/${encodeURIComponent(pageId)}` : readAttribute(tag, 'href');
  const relative = allowRelativeLinks && /^(?:#|\/(?!\/)|\.{1,2}\/)/.test(href);
  if (!href || (!/^(?:https?:|mailto:|slash-doc:)/i.test(href) && !relative)) return undefined;
  if (relative) return `<a href="${escapeAttribute(href)}">`;
  if (/\bclass\s*=\s*["'][^"']*\bslash-user-mention\b/i.test(tag) && /^https?:/i.test(href)) {
    const attributes = ['id', 'name', 'email', 'photo', 'link']
      .map((name) => {
        const value = readAttribute(tag, `data-user-${name}`);
        return value ? ` data-user-${name}="${escapeAttribute(value)}"` : '';
      })
      .join('');
    return `<a class="slash-user-mention" contenteditable="false" href="${escapeAttribute(href)}"${attributes} target="_blank" rel="noopener noreferrer">`;
  }
  if (/^slash-doc:/i.test(href)) {
    const data = pageId ? ` data-page-id="${escapeAttribute(pageId)}"` : '';
    return `<a class="slash-page-link" href="${escapeAttribute(href)}"${data}>`;
  }
  return `<a class="slash-external-link" href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">`;
}

function readAttribute(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll(/&#(x[0-9a-f]+|\d+);/gi, (match, code: string) => decodeNumericEntity(match, code))
    .replaceAll('&nbsp;', '\u00a0')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function decodeNumericEntity(match: string, code: string): string {
  const hexadecimal = code.toLowerCase().startsWith('x');
  const point = Number.parseInt(hexadecimal ? code.slice(1) : code, hexadecimal ? 16 : 10);
  return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;').replaceAll('`', '&#96;');
}
import { readInlineColors } from './inline-colors';
