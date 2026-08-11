import { escapeAttribute, isRecord, stripHtml } from './utils';
import { resolveBpmnSvgDimensions } from './bpmn-export-dimensions';

export function markdownCodeFence(language: string, source: string): string {
  const longestFence = Math.max(0, ...(source.match(/`+/g) ?? []).map((match) => match.length));
  const fence = '`'.repeat(Math.max(3, longestFence + 1));
  return `${fence}${language}\n${source}\n${fence}`;
}

export function exportBpmnSvg(type: string, data: Record<string, unknown>): string {
  const xml = typeof data.xml === 'string' ? data.xml : '';
  const fileName = typeof data.fileName === 'string' ? data.fileName : undefined;
  const state = Buffer.from(JSON.stringify({ xml, fileName }), 'utf8').toString('base64');
  const rawSvg = typeof data.svg === 'string' ? data.svg.trim() : '';
  const svg =
    extractSvgDocument(rawSvg) ??
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120" role="img"><rect width="640" height="120" fill="#fff"/><text x="24" y="68" fill="#555" font-family="sans-serif" font-size="16">BPMN diagram is not available</text></svg>';
  const kind = type === 'bpmnModeler' ? 'modeler' : 'preview';
  const cleanSvg = svg
    .replace(/\sdata-slash-doc-bpmn=("[^"]*"|'[^']*')/gi, '')
    .replace(/\sdata-slash-doc-bpmn-state=("[^"]*"|'[^']*')/gi, '');
  return cleanSvg.replace(/<svg\b([^>]*)>/i, (_opening, attributes: string) =>
    renderBpmnSvgOpening(attributes, kind, state, xml),
  );
}

function renderBpmnSvgOpening(attributes: string, kind: string, state: string, xml: string): string {
  const existingClass = readSvgAttribute(attributes, 'class');
  const className = [...new Set([...existingClass.split(/\s+/), 'slash-bpmn-export'].filter(Boolean))].join(' ');
  const dimensions = resolveBpmnSvgDimensions(attributes, xml);
  const cleanedAttributes = ['class', 'role', 'preserveAspectRatio', 'width', 'height', 'viewBox'].reduce(
    (value, name) => removeSvgAttribute(value, name),
    attributes,
  );
  return `<svg${cleanedAttributes} width="${dimensions.width}" height="${dimensions.height}" viewBox="${dimensions.viewBox}" class="${escapeAttribute(className)}" role="img" preserveAspectRatio="xMidYMid meet" data-slash-doc-bpmn="${kind}" data-slash-doc-bpmn-state="${escapeAttribute(state)}">`;
}

function readSvgAttribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function removeSvgAttribute(attributes: string, name: string): string {
  return attributes.replace(new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'), '');
}

function extractSvgDocument(source: string): string | undefined {
  const start = source.search(/<svg\b/i);
  const end = source.toLowerCase().lastIndexOf('</svg>');
  if (start < 0 || end < start) return undefined;
  return source.slice(start, end + '</svg>'.length);
}

export function getTableRows(data: Record<string, unknown>): unknown[][] {
  const source = Array.isArray(data.rows) ? data.rows : Array.isArray(data.content) ? data.content : [];
  return source.filter(Array.isArray) as unknown[][];
}

export function getEditorBlocks(data: unknown): Record<string, unknown>[] {
  if (!isRecord(data) || !Array.isArray(data.blocks)) return [];
  return data.blocks.filter((block): block is Record<string, unknown> => isRecord(block));
}

export function getExportTitle(blocks: Record<string, unknown>[]): string {
  const firstHeader = blocks.find((block) => block.type === 'header' && isRecord(block.data));
  const text =
    firstHeader && isRecord(firstHeader.data) && typeof firstHeader.data.text === 'string'
      ? stripHtml(firstHeader.data.text).trim()
      : '';
  return text || 'Slash Doc';
}

export function getListItems(data: Record<string, unknown>): string[] {
  if (!Array.isArray(data.items)) return [];
  return data.items.map((item) => {
    if (typeof item === 'string') return item;
    if (isRecord(item) && typeof item.content === 'string') return item.content;
    return String(item ?? '');
  });
}

export function clampHeadingLevel(value: unknown): number {
  const level = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
}

export function htmlToMarkdownInline(value: string): string {
  const colorSpans: string[] = [];
  const formatted = value
    .replaceAll(/<b>(.*?)<\/b>/g, '**$1**')
    .replaceAll(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replaceAll(/<i>(.*?)<\/i>/g, '_$1_')
    .replaceAll(/<em>(.*?)<\/em>/g, '_$1_')
    .replaceAll(/<code\b[^>]*>(.*?)<\/code>/gis, (_match, content: string) => markdownInlineCode(content))
    .replaceAll(/<mark[^>]*>(.*?)<\/mark>/g, '==$1==')
    .replaceAll(/<span\b([^>]*)>(.*?)<\/span>/gis, (_match, attributes: string, content: string) => {
      if (readInlineAttribute(attributes, 'class').split(/\s+/).includes('inline-code')) {
        return markdownInlineCode(content);
      }
      const color = readInlineTextColor(attributes);
      if (!color) return content;
      const index = colorSpans.push(`<span style="color:${color}">${content}</span>`) - 1;
      return `SLASHDOCCOLOR${index}TOKEN`;
    })
    .replaceAll(/<a\b([^>]*)>(.*?)<\/a>/gis, (_match, attributes: string, content: string) => {
      const pageId = readInlineAttribute(attributes, 'data-page-id');
      const href = pageId ? `slash-doc://page/${encodeURIComponent(pageId)}` : readInlineAttribute(attributes, 'href');
      if (!href) return content;
      return `[${content}](${href.replaceAll(' ', '%20').replaceAll(')', '%29')})`;
    });
  return stripHtml(formatted).replaceAll(
    /SLASHDOCCOLOR(\d+)TOKEN/g,
    (_match, index: string) => colorSpans[Number(index)] ?? '',
  );
}

function markdownInlineCode(content: string): string {
  const value = stripHtml(content);
  const longestRun = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
  const delimiter = '`'.repeat(Math.max(1, longestRun + 1));
  const needsPadding = /^\s|\s$|^`|`$/.test(value);
  return `${delimiter}${needsPadding ? ` ${value} ` : value}${delimiter}`;
}

function readInlineAttribute(attributes: string, name: string): string {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function readInlineTextColor(attributes: string): string | undefined {
  const dataColor = /\bdata-slash-text-color\s*=\s*["'](#[0-9a-f]{6})["']/i.exec(attributes)?.[1];
  const styleColor = /\bstyle\s*=\s*["'][^"']*\bcolor\s*:\s*(#[0-9a-f]{6})\b[^"']*["']/i.exec(attributes)?.[1];
  return (dataColor ?? styleColor)?.toLowerCase();
}
