import { escapeAttribute, isRecord, stripHtml } from './utils';

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
  const svg = rawSvg.startsWith('<svg')
    ? rawSvg
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120" role="img"><rect width="640" height="120" fill="#fff"/><text x="24" y="68" fill="#555" font-family="sans-serif" font-size="16">BPMN diagram is not available</text></svg>';
  const kind = type === 'bpmnModeler' ? 'modeler' : 'preview';
  const cleanSvg = svg
    .replace(/\sdata-slash-doc-bpmn=("[^"]*"|'[^']*')/gi, '')
    .replace(/\sdata-slash-doc-bpmn-state=("[^"]*"|'[^']*')/gi, '');
  return cleanSvg.replace(
    /<svg\b/i,
    `<svg data-slash-doc-bpmn="${kind}" data-slash-doc-bpmn-state="${escapeAttribute(state)}"`,
  );
}

export const CODE_EXPORT_STYLES = `.slash-code-export{overflow:auto;padding:14px;border:1px solid #d0d7de;border-radius:6px;background:#f6f8fa;color:#24292f;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.hljs-comment,.hljs-quote{color:#6e7781;font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-section,.hljs-link{color:#cf222e}.hljs-string,.hljs-title,.hljs-name,.hljs-type,.hljs-attribute,.hljs-symbol,.hljs-bullet,.hljs-addition{color:#0a3069}.hljs-number,.hljs-meta,.hljs-built_in,.hljs-builtin-name,.hljs-params{color:#0550ae}.hljs-variable,.hljs-template-variable,.hljs-selector-id,.hljs-selector-class{color:#953800}.hljs-regexp,.hljs-deletion{color:#82071e}.hljs-addition{background:#dafbe1}.hljs-deletion{background:#ffebe9}.hljs-strong{font-weight:700}.hljs-emphasis{font-style:italic}`;
export const EXPORT_LAYOUT_STYLES = `.slash-doc-export-block{box-sizing:border-box;width:100%;max-width:860px;margin-right:auto;margin-left:auto}.slash-doc-export-block>*{max-width:100%}.slash-user-mention{display:inline-flex;align-items:center;padding:1px 6px;color:#0969da;border-radius:10px;background:#ddf4ff;text-decoration:none;white-space:nowrap}`;

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
    .replaceAll(/<code>(.*?)<\/code>/g, '`$1`')
    .replaceAll(/<mark[^>]*>(.*?)<\/mark>/g, '==$1==')
    .replaceAll(/<span\b([^>]*)>(.*?)<\/span>/gis, (_match, attributes: string, content: string) => {
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
