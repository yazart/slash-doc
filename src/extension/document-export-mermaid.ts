import { escapeAttribute, escapeHtml } from './utils';

export function exportMermaidSvg(data: Record<string, unknown>): string {
  const code = typeof data.code === 'string' ? data.code : '';
  const caption = typeof data.caption === 'string' ? data.caption : '';
  const rawSvg = typeof data.svg === 'string' ? data.svg : '';
  const state = Buffer.from(JSON.stringify({ code, caption }), 'utf8').toString('base64');
  const svg =
    sanitizeMermaidSvg(extractSvgDocument(rawSvg)) ??
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120"><rect width="640" height="120" fill="#fff"/><text x="24" y="68" fill="#555" font-family="sans-serif" font-size="16">Mermaid diagram is not available</text></svg>';

  return svg.replace(/<svg\b([^>]*)>/i, (_opening, attributes: string) => {
    const existingClass = readSvgAttribute(attributes, 'class');
    const className = [...new Set([...existingClass.split(/\s+/), 'slash-mermaid-export'].filter(Boolean))].join(' ');
    const cleaned = ['class', 'role', 'preserveAspectRatio', 'data-slash-doc-mermaid-state'].reduce(
      (value, name) => removeSvgAttribute(value, name),
      attributes,
    );
    return `<svg${cleaned} class="${escapeAttribute(className)}" role="img" preserveAspectRatio="xMidYMid meet" data-slash-doc-mermaid-state="${escapeAttribute(state)}">`;
  });
}

export function exportMermaidFigure(data: Record<string, unknown>): string {
  const caption = typeof data.caption === 'string' ? data.caption : '';
  return `<figure class="mermaid-figure">${exportMermaidSvg(data)}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
}

function extractSvgDocument(source: string): string | undefined {
  const start = source.search(/<svg\b/i);
  const end = source.toLowerCase().lastIndexOf('</svg>');
  if (start < 0 || end < start) return undefined;
  return source.slice(start, end + '</svg>'.length);
}

function sanitizeMermaidSvg(source: string | undefined): string | undefined {
  if (!source) return undefined;
  return source
    .replaceAll(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replaceAll(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replaceAll(/\s+(href|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '');
}

function readSvgAttribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function removeSvgAttribute(attributes: string, name: string): string {
  return attributes.replace(new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'), '');
}
