import * as vscode from 'vscode';
import { pathToFileURL } from 'url';
import { highlightSource, normalizeCodeLanguage } from '../shared/syntax-highlighter';
import { getCustomAddonUri } from './filesystem';
import type { SlashDocSettings } from './types';
import { escapeAttribute, escapeHtml, isRecord, stripHtml } from './utils';
import { createFlowDesignerDataUri, createNetworkCanvasDataUri } from './document-export-diagrams';
import { exportImageAnnotationToHtml, exportImageAnnotationToMarkdown } from './document-export-annotation';
import {
  exportApiEndpointToHtml,
  exportApiEndpointToMarkdown,
  exportApprovalTableToHtml,
  exportApprovalTableToMarkdown,
  exportFileProcessorToHtml,
  exportFileProcessorToMarkdown,
  exportTaskTableToHtml,
} from './document-export-widgets';
import {
  clampHeadingLevel,
  CODE_EXPORT_STYLES,
  EXPORT_LAYOUT_STYLES,
  exportBpmnSvg,
  getEditorBlocks,
  getExportTitle,
  getListItems,
  getTableRows,
  htmlToMarkdownInline,
  markdownCodeFence,
} from './document-export-common';

type ExportFormat = 'html' | 'md';

export async function exportPageContent(
  data: unknown,
  format: ExportFormat,
  settings: SlashDocSettings,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined,
): Promise<string> {
  const blocks = getEditorBlocks(data);
  const rendered = await Promise.all(
    blocks.map((block) => exportBlock(block, format, settings, extensionUri, workspaceRoot)),
  );

  if (format === 'html') {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(getExportTitle(blocks))}</title>
    <style>${EXPORT_LAYOUT_STYLES}${CODE_EXPORT_STYLES}</style>
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
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined,
): Promise<string> {
  const type = typeof block.type === 'string' ? block.type : '';
  const custom = workspaceRoot
    ? await exportCustomBlock(block, format, settings, extensionUri, workspaceRoot)
    : undefined;

  if (custom !== undefined) {
    return format === 'html' ? wrapHtmlExportBlock(type, custom) : custom;
  }

  const data = isRecord(block.data) ? block.data : {};

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

async function exportCustomBlock(
  block: Record<string, unknown>,
  format: ExportFormat,
  settings: SlashDocSettings,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
): Promise<string | undefined> {
  const type = typeof block.type === 'string' ? block.type : '';
  const addon = settings.customEditorAddons.find((item) => item.enabled && item.toolName === type);

  if (!addon) {
    return undefined;
  }

  const moduleUrl = `${pathToFileURL(getCustomAddonUri(extensionUri, workspaceRoot, addon).fsPath).href}?v=${Date.now()}`;
  const adapterModule = (await import(moduleUrl)) as Record<string, unknown>;
  const adapters = isRecord(adapterModule.adapters) ? adapterModule.adapters : {};
  const adapter =
    format === 'html'
      ? (adapterModule.toHtml ?? adapters.html)
      : (adapterModule.toMarkdown ?? adapters.md ?? adapters.markdown);

  if (typeof adapter !== 'function') {
    return undefined;
  }

  return String(await adapter(block.data, { block, settings, format }));
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
    const tag = data.style === 'ordered' ? 'ol' : 'ul';
    const items = getListItems(data);
    return `<${tag}>${items.map((item) => `<li>${item}</li>`).join('')}</${tag}>`;
  }

  if (type === 'table' || type === 'confluenceTable') {
    const rows = getTableRows(data);
    const headerRow = type === 'table' ? data.withHeadings === true : data.headerRow === true;
    const headerColumn = type === 'confluenceTable' && data.headerColumn === true;
    const columnWidths = Array.isArray(data.columnWidths) ? data.columnWidths : [];
    const rowHeights = Array.isArray(data.rowHeights) ? data.rowHeights : [];
    return `<table>${rows
      .map((row, rowIndex) => {
        const cells = Array.isArray(row) ? row : [];
        const rowHeight =
          typeof rowHeights[rowIndex] === 'number' && rowHeights[rowIndex] > 0
            ? ` style="height:${rowHeights[rowIndex]}px"`
            : '';
        return `<tr${rowHeight}>${cells
          .map((cell, columnIndex) => {
            const tag = (headerRow && rowIndex === 0) || (headerColumn && columnIndex === 0) ? 'th' : 'td';
            const width =
              typeof columnWidths[columnIndex] === 'number' && columnWidths[columnIndex] > 0
                ? ` style="width:${columnWidths[columnIndex]}px"`
                : '';
            return `<${tag}${width}>${escapeHtml(String(cell ?? ''))}</${tag}>`;
          })
          .join('')}</tr>`;
      })
      .join('')}</table>`;
  }

  if (type === 'image') {
    const file = isRecord(data.file) ? data.file : {};
    const url = typeof file.url === 'string' ? file.url : '';
    const caption = typeof data.caption === 'string' ? data.caption : '';
    return `<figure><img src="${escapeAttribute(url)}" alt="${escapeAttribute(stripHtml(caption))}">${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
  }

  if (type === 'mermaid') {
    const code = typeof data.code === 'string' ? data.code : '';
    const caption = typeof data.caption === 'string' ? data.caption : '';
    return `<figure class="mermaid-figure"><pre class="mermaid">${escapeHtml(code)}</pre>${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
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

  if (type === 'approvalTable') {
    return exportApprovalTableToHtml(data);
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
    return getListItems(data)
      .map((item, index) =>
        data.style === 'ordered' ? `${index + 1}. ${htmlToMarkdownInline(item)}` : `- ${htmlToMarkdownInline(item)}`,
      )
      .join('\n');
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

  if (type === 'approvalTable') {
    return exportApprovalTableToMarkdown(data);
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
