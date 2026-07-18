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
  const svg =
    extractSvgDocument(rawSvg) ??
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120" role="img"><rect width="640" height="120" fill="#fff"/><text x="24" y="68" fill="#555" font-family="sans-serif" font-size="16">BPMN diagram is not available</text></svg>';
  const kind = type === 'bpmnModeler' ? 'modeler' : 'preview';
  const cleanSvg = svg
    .replace(/\sdata-slash-doc-bpmn=("[^"]*"|'[^']*')/gi, '')
    .replace(/\sdata-slash-doc-bpmn-state=("[^"]*"|'[^']*')/gi, '');
  return cleanSvg.replace(/<svg\b([^>]*)>/i, (_opening, attributes: string) =>
    renderBpmnSvgOpening(attributes, kind, state),
  );
}

function renderBpmnSvgOpening(attributes: string, kind: string, state: string): string {
  const existingClass = readSvgAttribute(attributes, 'class');
  const className = [...new Set([...existingClass.split(/\s+/), 'slash-bpmn-export'].filter(Boolean))].join(' ');
  const cleanedAttributes = ['class', 'role', 'preserveAspectRatio'].reduce(
    (value, name) => removeSvgAttribute(value, name),
    attributes,
  );
  return `<svg${cleanedAttributes} class="${escapeAttribute(className)}" role="img" preserveAspectRatio="xMidYMid meet" data-slash-doc-bpmn="${kind}" data-slash-doc-bpmn-state="${escapeAttribute(state)}">`;
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

export const BASE_EXPORT_STYLES = `:root{--slash-page-background:#fff;--slash-page-foreground:#172033;--slash-page-muted:#667085;--slash-page-border:#d7dce4;--slash-page-surface:#f7f8fa;--slash-page-link:#2563eb;--slash-inline-code-background:rgba(175,184,193,.2);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--slash-page-foreground);background:var(--slash-page-background);line-height:1.55}*{box-sizing:border-box}html{min-width:320px;background:var(--slash-page-background)}body{max-width:940px;margin:0 auto;padding:32px 40px 64px;color:var(--slash-page-foreground);background:var(--slash-page-background);overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{margin:1.35em 0 .55em;color:inherit;line-height:1.25}h1:first-child,h2:first-child,h3:first-child{margin-top:0}p,ul,ol,blockquote,pre,table,figure{margin:0 0 1em}a{color:var(--slash-page-link);text-underline-offset:2px}a:hover{text-decoration-thickness:2px}img,svg,video,canvas{max-width:100%;height:auto}figure{margin-right:0;margin-left:0}figcaption{color:var(--slash-page-muted);font-size:.9em}blockquote{margin-right:0;margin-left:0;padding:2px 16px;color:var(--slash-page-muted);border-left:4px solid var(--slash-page-border)}hr{height:1px;margin:24px 0;border:0;background:var(--slash-page-border)}table{width:100%;border-spacing:0;border-collapse:collapse}th,td{padding:8px 10px;border:1px solid var(--slash-page-border);text-align:left;vertical-align:top}th{background:var(--slash-page-surface);font-weight:600}pre{max-width:100%;overflow:auto;padding:14px;border:1px solid var(--slash-page-border);border-radius:6px;background:var(--slash-page-surface)}code,.inline-code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}.inline-code,code:not(pre code){padding:.2em .4em;color:inherit;border-radius:6px;background:var(--slash-inline-code-background);font-size:85%;white-space:break-spaces;-webkit-box-decoration-break:clone;box-decoration-break:clone}@media(max-width:650px){html,body{color:var(--slash-page-foreground);background:var(--slash-page-background)}body{padding:20px 16px 40px}.slash-doc-export-block{color:inherit}.slash-doc-export-block-table,.slash-doc-export-block-confluenceTable{overflow-x:auto}table{min-width:max-content}pre{padding:12px;font-size:.9em}h1{font-size:1.8em}h2{font-size:1.45em}}`;
export const CODE_EXPORT_STYLES = `.slash-code-export{overflow:auto;padding:14px;border:1px solid #d0d7de;border-radius:6px;background:#f6f8fa;color:#24292f;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.hljs-comment,.hljs-quote{color:#6e7781;font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-section,.hljs-link{color:#cf222e}.hljs-string,.hljs-title,.hljs-name,.hljs-type,.hljs-attribute,.hljs-symbol,.hljs-bullet,.hljs-addition{color:#0a3069}.hljs-number,.hljs-meta,.hljs-built_in,.hljs-builtin-name,.hljs-params{color:#0550ae}.hljs-variable,.hljs-template-variable,.hljs-selector-id,.hljs-selector-class{color:#953800}.hljs-regexp,.hljs-deletion{color:#82071e}.hljs-addition{background:#dafbe1}.hljs-deletion{background:#ffebe9}.hljs-strong{font-weight:700}.hljs-emphasis{font-style:italic}`;
export const EXPORT_LAYOUT_STYLES = `.slash-doc-export-block{box-sizing:border-box;width:100%;max-width:860px;margin-right:auto;margin-left:auto}.slash-doc-export-block>*{max-width:100%}.slash-bpmn-export{display:block;width:100%;height:auto;min-height:80px;background:#fff}.slash-user-mention{display:inline-flex;align-items:center;padding:1px 6px;color:#0969da;border-radius:10px;background:#ddf4ff;text-decoration:none;white-space:nowrap}`;

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
