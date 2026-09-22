import { highlightSource, normalizeCodeLanguage } from '../shared/syntax-highlighter';
import { migrateApprovalTableData } from '../shared/approval-table-migration';
import type { SlashDocSettings } from './types';
import { escapeAttribute, escapeHtml, isRecord, stripHtml } from './utils';
import { createFlowDesignerDataUri, createNetworkCanvasDataUri } from './document-export-diagrams';
import { exportImageAnnotationToHtml, exportImageAnnotationToMarkdown } from './document-export-annotation';
import { exportMermaidFigure } from './document-export-mermaid';
import { exportTableToHtml } from './document-export-table';
import baseExportStyles from './styles/document-base.embedded.css?raw';
import codeExportStyles from './styles/document-code.embedded.css?raw';
import exportLayoutStyles from './styles/document-layout.embedded.css?raw';
import {
  exportApiEndpointToHtml,
  exportApiEndpointToMarkdown,
  exportFileProcessorToHtml,
  exportFileProcessorToMarkdown,
  exportTaskTableToHtml,
} from './document-export-widgets';
import {
  clampHeadingLevel,
  exportBpmnSvg,
  getEditorBlocks,
  getExportTitle,
  getListItems,
  type ExportListItem,
  getTableRows,
  htmlToMarkdownInline,
  markdownCodeFence,
} from './document-export-common';

export type ExportFormat = 'html' | 'md';
export type CustomBlockExporter = (
  block: Record<string, unknown>,
  format: ExportFormat,
  settings: SlashDocSettings,
) => Promise<string | undefined>;

export async function exportPageContent(
  data: unknown,
  format: ExportFormat,
  settings: SlashDocSettings,
  customBlockExporter?: CustomBlockExporter,
): Promise<string> {
  const blocks = getEditorBlocks(data);
  const rendered = await Promise.all(blocks.map((block) => exportBlock(block, format, settings, customBlockExporter)));

  if (format === 'html') {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(getExportTitle(blocks))}</title>
    <style>${baseExportStyles}${exportLayoutStyles}${codeExportStyles}</style>
  </head>
  <body>
${rendered.filter(Boolean).join('\n')}
  </body>
</html>
`;
  }

  return `${rendered.filter(Boolean).join('\n\n')}\n`;
}

async function exportBlock(
  block: Record<string, unknown>,
  format: ExportFormat,
  settings: SlashDocSettings,
  customBlockExporter?: CustomBlockExporter,
): Promise<string> {
  const sourceType = typeof block.type === 'string' ? block.type : '';
  const normalizedBlock =
    sourceType === 'approvalTable'
      ? { ...block, type: 'confluenceTable', data: migrateApprovalTableData(block.data) }
      : block;
  const type = typeof normalizedBlock.type === 'string' ? normalizedBlock.type : '';
  const custom = customBlockExporter ? await customBlockExporter(normalizedBlock, format, settings) : undefined;

  if (custom !== undefined) {
    return format === 'html' ? wrapHtmlExportBlock(type, custom) : custom;
  }

  const data = isRecord(normalizedBlock.data) ? normalizedBlock.data : {};

  if (format === 'html') {
    return wrapHtmlExportBlock(type, exportBuiltInBlockToHtml(type, data));
  }

  return exportBuiltInBlockToMarkdown(type, data);
}

function wrapHtmlExportBlock(type: string, html: string): string {
  if (!html) return '';
  const normalizedType = type.replaceAll(/[^a-zA-Z0-9_-]/g, '-');
  return `<div class="slash-doc-export-block slash-doc-export-block-${escapeAttribute(normalizedType)}" data-slash-doc-block-type="${escapeAttribute(type)}">${html}</div>`;
}

function exportBuiltInBlockToHtml(type: string, data: Record<string, unknown>): string {
  if (type === 'header') {
    const level = clampHeadingLevel(data.level);
    return `<h${level}>${data.text ?? ''}</h${level}>`;
  }

  if (type === 'paragraph') {
    return `<p>${data.text ?? ''}</p>`;
  }

  if (type === 'list') {
    return renderListHtml(getListItems(data), data.style === 'ordered');
  }

  if (type === 'table' || type === 'confluenceTable') {
    return exportTableToHtml(type, data);
  }

  if (type === 'image') {
    const file = isRecord(data.file) ? data.file : {};
    const url = typeof file.url === 'string' ? file.url : '';
    const caption = typeof data.caption === 'string' ? data.caption : '';
    return `<figure><img src="${escapeAttribute(url)}" alt="${escapeAttribute(stripHtml(caption))}">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  }

  if (type === 'mermaid') {
    return exportMermaidFigure(data);
  }

  if (type === 'flowDesigner') {
    const source = createFlowDesignerDataUri(data);
    return `<figure class="flow-designer-figure"><img src="${escapeAttribute(source)}" alt="Диаграмма конструктора процессов"></figure>`;
  }

  if (type === 'networkCanvas') {
    const source = createNetworkCanvasDataUri(data);
    return `<figure class="network-canvas-figure"><img src="${escapeAttribute(source)}" alt="Сетевая схема"></figure>`;
  }

  if (type === 'imageAnnotation') {
    return exportImageAnnotationToHtml(data);
  }

  if (type === 'apiEndpoint') {
    return exportApiEndpointToHtml(data);
  }

  if (type === 'fileProcessor') {
    return exportFileProcessorToHtml(data);
  }

  if (type === 'taskTable') {
    return exportTaskTableToHtml(data);
  }

  if (type === 'codeBlock') {
    const language = normalizeCodeLanguage(data.language);
    const code = typeof data.code === 'string' ? data.code : '';
    const state = Buffer.from(JSON.stringify({ language, code }), 'utf8').toString('base64');
    return `<pre class="slash-code-export" data-slash-doc-code="${state}"><code class="language-${language}">${highlightSource(code, language)}</code></pre>`;
  }

  if (type === 'diffBlock') {
    const diff = typeof data.diff === 'string' ? data.diff : '';
    const state = Buffer.from(JSON.stringify({ diff }), 'utf8').toString('base64');
    return `<pre class="slash-code-export slash-diff-export" data-slash-doc-diff="${state}"><code class="language-diff">${highlightSource(diff, 'diff')}</code></pre>`;
  }

  if (type === 'bpmnModeler' || type === 'bpmnPreview') {
    return exportBpmnSvg(type, data);
  }

  return `<pre><code>${escapeHtml(JSON.stringify(data, null, 2))}</code></pre>`;
}

function exportBuiltInBlockToMarkdown(type: string, data: Record<string, unknown>): string {
  if (type === 'header') {
    const level = clampHeadingLevel(data.level);
    return `${'#'.repeat(level)} ${htmlToMarkdownInline(String(data.text ?? ''))}`;
  }

  if (type === 'paragraph') {
    return htmlToMarkdownInline(String(data.text ?? ''));
  }

  if (type === 'list') {
    return renderListMarkdown(getListItems(data), data.style === 'ordered');
  }

  if (type === 'table' || type === 'confluenceTable') {
    const rows = getTableRows(data);

    if (rows.length === 0) {
      return '';
    }

    const normalizedRows = rows.map((row) => row.map((cell) => htmlToMarkdownInline(String(cell ?? ''))));
    const header = normalizedRows[0];
    const separator = header.map(() => '---');
    return [header, separator, ...normalizedRows.slice(1)].map((row) => `| ${row.join(' | ')} |`).join('\n');
  }

  if (type === 'image') {
    const file = isRecord(data.file) ? data.file : {};
    const url = typeof file.url === 'string' ? file.url : '';
    const caption = typeof data.caption === 'string' ? htmlToMarkdownInline(data.caption) : '';
    return `![${caption}](${url})`;
  }

  if (type === 'mermaid') {
    const code = typeof data.code === 'string' ? data.code.trim() : '';
    return code ? `\`\`\`mermaid\n${code}\n\`\`\`` : '';
  }

  if (type === 'flowDesigner') {
    return `![Диаграмма конструктора процессов](${createFlowDesignerDataUri(data)})`;
  }

  if (type === 'networkCanvas') {
    return `![Сетевая схема](${createNetworkCanvasDataUri(data)})`;
  }

  if (type === 'imageAnnotation') {
    return exportImageAnnotationToMarkdown(data);
  }

  if (type === 'apiEndpoint') {
    return exportApiEndpointToMarkdown(data);
  }

  if (type === 'fileProcessor') {
    return exportFileProcessorToMarkdown(data);
  }

  if (type === 'taskTable') {
    return exportTaskTableToHtml(data);
  }

  if (type === 'codeBlock') {
    const language = normalizeCodeLanguage(data.language);
    return markdownCodeFence(language, typeof data.code === 'string' ? data.code : '');
  }

  if (type === 'diffBlock') {
    return markdownCodeFence('diff', typeof data.diff === 'string' ? data.diff : '');
  }

  if (type === 'bpmnModeler' || type === 'bpmnPreview') {
    return exportBpmnSvg(type, data);
  }

  return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

function renderListHtml(items: ExportListItem[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items
    .map((item) => `<li>${item.content}${item.items.length ? renderListHtml(item.items, ordered) : ''}</li>`)
    .join('')}</${tag}>`;
}

function renderListMarkdown(items: ExportListItem[], ordered: boolean, depth = 0): string {
  return items
    .flatMap((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const line = `${'  '.repeat(depth)}${marker} ${htmlToMarkdownInline(item.content)}`;
      return [line, ...(item.items.length ? [renderListMarkdown(item.items, ordered, depth + 1)] : [])];
    })
    .join('\n');
}
