const SIMPLE_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'mark', 'code']);

export function sanitizeTableCellHtml(value: string): string {
  const tokens: string[] = [];
  const tokenized = value.replaceAll(/<[^>]*>/g, (tag) => {
    const safe = sanitizeTag(tag);
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
      .replaceAll(/<br\s*\/?>/gi, '\n')
      .replaceAll(/<[^>]*>/g, ''),
  );
}

function sanitizeTag(tag: string): string | undefined {
  const closing = /^<\s*\/\s*([a-z0-9-]+)\s*>$/i.exec(tag)?.[1]?.toLowerCase();
  if (closing && (SIMPLE_TAGS.has(closing) || closing === 'span' || closing === 'a')) return `</${closing}>`;
  if (closing === 'div' || closing === 'p') return '';
  const name = /^<\s*([a-z0-9-]+)/i.exec(tag)?.[1]?.toLowerCase();
  if (!name) return undefined;
  if (SIMPLE_TAGS.has(name)) return `<${name}>`;
  if (name === 'br') return '<br>';
  if (name === 'div' || name === 'p') return '<br>';
  if (name === 'span') return sanitizeSpan(tag);
  if (name === 'a') return sanitizeAnchor(tag);
  return undefined;
}

function sanitizeSpan(tag: string): string {
  const color =
    /\bdata-slash-text-color\s*=\s*["'](#[0-9a-f]{6})["']/i.exec(tag)?.[1] ??
    /\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*(#[0-9a-f]{6})/i.exec(tag)?.[1];
  const inlineCode = /\bclass\s*=\s*["'][^"']*\binline-code\b/i.test(tag);
  if (color) {
    const normalized = color.toLowerCase();
    return `<span class="slash-text-color" data-slash-text-color="${normalized}" style="color:${normalized}">`;
  }
  return inlineCode ? '<span class="inline-code">' : '<span>';
}

function sanitizeAnchor(tag: string): string | undefined {
  const pageId = readAttribute(tag, 'data-page-id');
  const href = pageId ? `slash-doc://page/${encodeURIComponent(pageId)}` : readAttribute(tag, 'href');
  if (!href || !/^(?:https?:|mailto:|slash-doc:)/i.test(href)) return undefined;
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
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
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
