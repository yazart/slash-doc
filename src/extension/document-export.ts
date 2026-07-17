import * as vscode from 'vscode';
import { pathToFileURL } from 'url';
import { networkIconContent, type NetworkIconName } from '../webview/network-icons';
import { renderSafeMarkdown } from '../shared/markdown';
import { createApiEndpointData, generateApiHtmlPreview, type ApiEndpointData } from '../shared/api-endpoint';
import { highlightSource, normalizeCodeLanguage } from '../shared/syntax-highlighter';
import { getCustomAddonUri } from './filesystem';
import type { SlashDocSettings } from './types';
import { escapeAttribute, escapeHtml, isRecord, stripHtml } from './utils';

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

function markdownCodeFence(language: string, source: string): string {
  const longestFence = Math.max(0, ...(source.match(/`+/g) ?? []).map((match) => match.length));
  const fence = '`'.repeat(Math.max(3, longestFence + 1));
  return `${fence}${language}\n${source}\n${fence}`;
}

function exportBpmnSvg(type: string, data: Record<string, unknown>): string {
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

const CODE_EXPORT_STYLES = `.slash-code-export{overflow:auto;padding:14px;border:1px solid #d0d7de;border-radius:6px;background:#f6f8fa;color:#24292f;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre}.hljs-comment,.hljs-quote{color:#6e7781;font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-section,.hljs-link{color:#cf222e}.hljs-string,.hljs-title,.hljs-name,.hljs-type,.hljs-attribute,.hljs-symbol,.hljs-bullet,.hljs-addition{color:#0a3069}.hljs-number,.hljs-meta,.hljs-built_in,.hljs-builtin-name,.hljs-params{color:#0550ae}.hljs-variable,.hljs-template-variable,.hljs-selector-id,.hljs-selector-class{color:#953800}.hljs-regexp,.hljs-deletion{color:#82071e}.hljs-addition{background:#dafbe1}.hljs-deletion{background:#ffebe9}.hljs-strong{font-weight:700}.hljs-emphasis{font-style:italic}`;
const EXPORT_LAYOUT_STYLES = `.slash-doc-export-block{box-sizing:border-box;width:100%;max-width:860px;margin-right:auto;margin-left:auto}.slash-doc-export-block>*{max-width:100%}.slash-user-mention{display:inline-flex;align-items:center;padding:1px 6px;color:#0969da;border-radius:10px;background:#ddf4ff;text-decoration:none;white-space:nowrap}`;

function getTableRows(data: Record<string, unknown>): unknown[][] {
  const source = Array.isArray(data.rows) ? data.rows : Array.isArray(data.content) ? data.content : [];
  return source.filter(Array.isArray) as unknown[][];
}

type ExportFlowNode = {
  id: string;
  type: string;
  label: string;
  description: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
};

type ExportFlowConnection = {
  fromNodeId: string;
  fromPort: number;
  toNodeId: string;
  toPort: number;
};

function createFlowDesignerDataUri(data: Record<string, unknown>): string {
  const svg = renderFlowDesignerSvg(data);
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function renderFlowDesignerSvg(data: Record<string, unknown>): string {
  const nodes = normalizeExportFlowNodes(data.nodes);
  const connections = normalizeExportFlowConnections(data.connections);
  const nodeWidth = 180;
  const nodeHeight = 76;
  const padding = 32;
  const minX = nodes.length > 0 ? Math.min(...nodes.map((node) => node.x)) : 0;
  const minY = nodes.length > 0 ? Math.min(...nodes.map((node) => node.y)) : 0;
  const maxX = nodes.length > 0 ? Math.max(...nodes.map((node) => node.x + nodeWidth)) : 360;
  const maxY = nodes.length > 0 ? Math.max(...nodes.map((node) => node.y + nodeHeight)) : 180;
  const width = Math.max(360, maxX - minX + padding * 2);
  const height = Math.max(180, maxY - minY + padding * 2);
  const offsetX = padding - minX;
  const offsetY = padding - minY;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const viewport = isRecord(data.viewport)
    ? {
        x: getFiniteNumber(data.viewport.x, 0),
        y: getFiniteNumber(data.viewport.y, 0),
        scale: Math.max(0.25, Math.min(2, getFiniteNumber(data.viewport.scale, 1))),
      }
    : { x: 0, y: 0, scale: 1 };
  const serializedData = JSON.stringify({ version: 1, nodes, connections, viewport }).replaceAll(
    ']]>',
    ']]]]><![CDATA[>',
  );
  const connectionSvg = connections
    .map((connection) => {
      const from = nodeById.get(connection.fromNodeId);
      const to = nodeById.get(connection.toNodeId);

      if (!from || !to) {
        return '';
      }

      const startX = from.x + offsetX + nodeWidth;
      const startY = from.y + offsetY + nodeHeight / 2 + connection.fromPort * 12;
      const endX = to.x + offsetX;
      const endY = to.y + offsetY + nodeHeight / 2 + connection.toPort * 12;
      const bend = Math.max(42, Math.abs(endX - startX) / 2);
      return `<path d="M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}"/>`;
    })
    .join('');
  const nodeSvg = nodes
    .map((node) => {
      const x = node.x + offsetX;
      const y = node.y + offsetY;
      const color = getFlowNodeColor(node.type);
      const label = escapeHtml(node.label || getFlowNodeLabel(node.type));
      const description = node.description
        ? `<text class="description" x="${x + 14}" y="${y + 49}">${escapeHtml(node.description)}</text>`
        : '';
      const inputPorts = node.inputs
        .map(
          (_, index) =>
            `<circle cx="${x}" cy="${y + nodeHeight / 2 + index * 12}" r="5" fill="#ffffff" stroke="${color}"/>`,
        )
        .join('');
      const outputPorts = node.outputs
        .map(
          (_, index) =>
            `<circle cx="${x + nodeWidth}" cy="${y + nodeHeight / 2 + index * 12}" r="5" fill="#ffffff" stroke="${color}"/>`,
        )
        .join('');

      return `<g class="node node-${escapeAttribute(node.type)}"><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2"/><text class="label" x="${x + 14}" y="${y + 29}">${label}</text>${description}${inputPorts}${outputPorts}</g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Диаграмма конструктора процессов">
  <metadata id="slash-doc-flow-data"><![CDATA[${serializedData}]]></metadata>
  <style><![CDATA[
    .background { fill: #ffffff; }
    .connections path { fill: none; stroke: #4f83cc; stroke-width: 2; }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #202124; }
    .label { font-size: 14px; font-weight: 600; }
    .description { font-size: 11px; fill: #5f6368; }
  ]]></style>
  <rect class="background" width="100%" height="100%" rx="8"/>
  <g class="connections">${connectionSvg}</g>
  <g class="nodes">${nodeSvg}</g>
</svg>`;
}

function normalizeExportFlowNodes(value: unknown): ExportFlowNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((node, index) => ({
    id: typeof node.id === 'string' ? node.id : `node-${index + 1}`,
    type: typeof node.type === 'string' ? node.type : 'action',
    label: typeof node.label === 'string' ? node.label : '',
    description: typeof node.description === 'string' ? node.description : '',
    x: getFiniteNumber(node.x, index * 210),
    y: getFiniteNumber(node.y, 0),
    inputs: Array.isArray(node.inputs) ? node.inputs.filter((item): item is string => typeof item === 'string') : [],
    outputs: Array.isArray(node.outputs) ? node.outputs.filter((item): item is string => typeof item === 'string') : [],
  }));
}

function normalizeExportFlowConnections(value: unknown): ExportFlowConnection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).flatMap((connection) => {
    if (typeof connection.fromNodeId !== 'string' || typeof connection.toNodeId !== 'string') {
      return [];
    }

    return [
      {
        fromNodeId: connection.fromNodeId,
        fromPort: Math.max(0, Math.trunc(getFiniteNumber(connection.fromPort, 0))),
        toNodeId: connection.toNodeId,
        toPort: Math.max(0, Math.trunc(getFiniteNumber(connection.toPort, 0))),
      },
    ];
  });
}

function getFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getFlowNodeColor(type: string): string {
  return (
    (
      {
        trigger: '#2e9b57',
        action: '#3979c6',
        condition: '#b77900',
        transform: '#8655b6',
        output: '#c56824',
      } as Record<string, string>
    )[type] ?? '#697386'
  );
}

function getFlowNodeLabel(type: string): string {
  return (
    (
      {
        trigger: 'Триггер',
        action: 'Действие',
        condition: 'Условие',
        transform: 'Преобразование',
        output: 'Результат',
      } as Record<string, string>
    )[type] ?? 'Узел'
  );
}

type ExportNetworkNode = { id: string; type: string; label: string; x: number; y: number; vlanId?: string };
type ExportNetworkVlan = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type ExportNetworkConnection = { id: string; from: string; to: string; label: string; lineType: string };

function createNetworkCanvasDataUri(data: Record<string, unknown>): string {
  return `data:image/svg+xml;base64,${Buffer.from(renderNetworkCanvasSvg(data), 'utf8').toString('base64')}`;
}

function renderNetworkCanvasSvg(data: Record<string, unknown>): string {
  const nodes = normalizeExportNetworkNodes(data.nodes);
  const vlans = normalizeExportNetworkVlans(data.vlans);
  const connections = normalizeExportNetworkConnections(data.connections);
  const items = [
    ...nodes.map((node) => ({ left: node.x - 50, top: node.y - 40, right: node.x + 50, bottom: node.y + 40 })),
    ...vlans.map((vlan) => ({ left: vlan.x, top: vlan.y, right: vlan.x + vlan.width, bottom: vlan.y + vlan.height })),
  ];
  const padding = 36;
  const minX = items.length ? Math.min(...items.map((item) => item.left)) : 0;
  const minY = items.length ? Math.min(...items.map((item) => item.top)) : 0;
  const maxX = items.length ? Math.max(...items.map((item) => item.right)) : 500;
  const maxY = items.length ? Math.max(...items.map((item) => item.bottom)) : 280;
  const width = Math.max(500, maxX - minX + padding * 2);
  const height = Math.max(280, maxY - minY + padding * 2);
  const offsetX = padding - minX;
  const offsetY = padding - minY;
  const endpoints = new Map<string, { x: number; y: number }>([
    ...nodes.map((node) => [node.id, { x: node.x + offsetX, y: node.y + offsetY }] as const),
    ...vlans.map(
      (vlan) => [vlan.id, { x: vlan.x + vlan.width / 2 + offsetX, y: vlan.y + vlan.height / 2 + offsetY }] as const,
    ),
  ]);
  const viewport = isRecord(data.viewport)
    ? {
        x: getFiniteNumber(data.viewport.x, 0),
        y: getFiniteNumber(data.viewport.y, 0),
        scale: Math.max(0.2, Math.min(3, getFiniteNumber(data.viewport.scale, 1))),
      }
    : { x: 0, y: 0, scale: 1 };
  const metadata = JSON.stringify({ version: 1, nodes, vlans, connections, viewport }).replaceAll(
    ']]>',
    ']]]]><![CDATA[>',
  );
  const vlanSvg = vlans
    .map(
      (vlan) =>
        `<g class="vlan"><rect x="${vlan.x + offsetX}" y="${vlan.y + offsetY}" width="${vlan.width}" height="${vlan.height}" rx="9" fill="${escapeAttribute(vlan.color)}" fill-opacity="0.07" stroke="${escapeAttribute(vlan.color)}" stroke-width="2" stroke-dasharray="7 5"/><rect x="${vlan.x + offsetX}" y="${vlan.y + offsetY}" width="${Math.max(70, vlan.name.length * 8 + 18)}" height="25" rx="5" fill="${escapeAttribute(vlan.color)}" fill-opacity="0.18"/><text class="vlan-label" x="${vlan.x + offsetX + 9}" y="${vlan.y + offsetY + 17}" fill="${escapeAttribute(vlan.color)}">${escapeHtml(vlan.name)}</text></g>`,
    )
    .join('');
  const connectionSvg = connections
    .map((connection) => {
      const from = endpoints.get(connection.from);
      const to = endpoints.get(connection.to);
      if (!from || !to) return '';
      const dash =
        connection.lineType === 'dashed'
          ? ' stroke-dasharray="8 5"'
          : connection.lineType === 'dotted'
            ? ' stroke-dasharray="2 6" stroke-linecap="round"'
            : '';
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const px = (-dy / length) * 3;
      const py = (dx / length) * 3;
      const visible =
        connection.lineType === 'double'
          ? `<line x1="${from.x + px}" y1="${from.y + py}" x2="${to.x + px}" y2="${to.y + py}"/><line x1="${from.x - px}" y1="${from.y - py}" x2="${to.x - px}" y2="${to.y - py}"/>`
          : `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"${dash}/>`;
      const label = connection.label
        ? `<g class="connection-label"><rect x="${(from.x + to.x) / 2 - Math.max(34, connection.label.length * 3.5 + 8)}" y="${(from.y + to.y) / 2 - 12}" width="${Math.max(68, connection.label.length * 7 + 16)}" height="20" rx="4"/><text x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 + 2}">${escapeHtml(connection.label)}</text></g>`
        : '';
      return `<g class="connection">${visible}${label}</g>`;
    })
    .join('');
  const nodeSvg = nodes.map((node) => renderNetworkNodeSvg(node, offsetX, offsetY)).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Сетевая схема">
  <metadata id="slash-doc-network-data"><![CDATA[${metadata}]]></metadata>
  <style><![CDATA[
    .background { fill:#f6f8fa; }
    .grid { stroke:#d8dee4; stroke-width:1; }
    text { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .vlan-label { font-size:11px; font-weight:600; letter-spacing:.06em; }
    .connection line { stroke:#378b9c; stroke-width:2; }
    .connection-label rect { fill:#fff; stroke:#8dbbc4; }
    .connection-label text { fill:#57606a; font-size:10px; text-anchor:middle; }
    .node-label { fill:#424a53; font-size:11px; text-anchor:middle; }
  ]]></style>
  <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path class="grid" d="M20 0H0V20" fill="none"/></pattern></defs>
  <rect class="background" width="100%" height="100%" rx="8"/><rect width="100%" height="100%" fill="url(#grid)" opacity=".55"/>
  <g class="vlans">${vlanSvg}</g><g class="connections">${connectionSvg}</g><g class="nodes">${nodeSvg}</g>
</svg>`;
}

function renderNetworkNodeSvg(node: ExportNetworkNode, offsetX: number, offsetY: number): string {
  const x = node.x + offsetX;
  const y = node.y + offsetY;
  const color =
    ({ server: '#0891b2', database: '#7c3aed', workstation: '#159447', balancer: '#d97706' } as Record<string, string>)[
      node.type
    ] ?? '#697386';
  const iconName: NetworkIconName =
    node.type === 'database' || node.type === 'workstation' || node.type === 'balancer' ? node.type : 'server';
  return `<g class="node node-${escapeAttribute(node.type)}"><rect x="${x - 29}" y="${y - 29}" width="58" height="54" rx="8" fill="#fff" stroke="${color}"/><g transform="translate(${x - 22} ${y - 22}) scale(1.84)" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${networkIconContent(iconName)}</g><text class="node-label" x="${x}" y="${y + 42}">${escapeHtml(node.label)}</text></g>`;
}

function normalizeExportNetworkNodes(value: unknown): ExportNetworkNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((node, index) =>
    typeof node.id === 'string'
      ? [
          {
            id: node.id,
            type: typeof node.type === 'string' ? node.type : 'server',
            label: typeof node.label === 'string' ? node.label : `Node ${index + 1}`,
            x: getFiniteNumber(node.x, index * 130),
            y: getFiniteNumber(node.y, 0),
            ...(typeof node.vlanId === 'string' ? { vlanId: node.vlanId } : {}),
          },
        ]
      : [],
  );
}

function normalizeExportNetworkVlans(value: unknown): ExportNetworkVlan[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((vlan, index) =>
    typeof vlan.id === 'string'
      ? [
          {
            id: vlan.id,
            name: typeof vlan.name === 'string' ? vlan.name : `VLAN ${index + 1}`,
            color: typeof vlan.color === 'string' && /^#[0-9a-f]{6}$/i.test(vlan.color) ? vlan.color : '#06b6d4',
            x: getFiniteNumber(vlan.x, 0),
            y: getFiniteNumber(vlan.y, 0),
            width: Math.max(100, getFiniteNumber(vlan.width, 280)),
            height: Math.max(70, getFiniteNumber(vlan.height, 180)),
          },
        ]
      : [],
  );
}

function normalizeExportNetworkConnections(value: unknown): ExportNetworkConnection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((connection, index) =>
    typeof connection.from === 'string' && typeof connection.to === 'string'
      ? [
          {
            id: typeof connection.id === 'string' ? connection.id : `connection-${index + 1}`,
            from: connection.from,
            to: connection.to,
            label: typeof connection.label === 'string' ? connection.label : '',
            lineType: typeof connection.lineType === 'string' ? connection.lineType : 'dashed',
          },
        ]
      : [],
  );
}

type ExportAnnotationImage = { dataUrl: string; width: number; height: number; name: string };
type ExportImageRegion = {
  id: string;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  zIndex: number;
};
type ExportImageAnnotation = { version: 1; image: ExportAnnotationImage | null; annotations: ExportImageRegion[] };

function exportImageAnnotationToHtml(data: Record<string, unknown>): string {
  const annotation = normalizeExportImageAnnotation(data);

  if (!annotation.image) {
    return '';
  }

  const encodedState = Buffer.from(JSON.stringify(annotation), 'utf8').toString('base64');
  const metadata = JSON.stringify(annotation).replaceAll(']]>', ']]]]><![CDATA[>');
  const overlay = renderAnnotationOverlay(annotation.annotations, annotation.image.width, annotation.image.height);
  const hotspots = annotation.annotations
    .map(
      (region) =>
        `<div class="slash-annotation-hotspot" tabindex="0" style="left:${region.x * 100}%;top:${region.y * 100}%;width:${region.width * 100}%;height:${region.height * 100}%"><div class="slash-annotation-tooltip"><strong>${region.number}</strong>${renderAnnotationMarkdown(region.description || 'Без описания')}</div></div>`,
    )
    .join('');
  const rows = renderAnnotationHtmlRows(annotation.annotations);

  return `<style>
    .slash-image-annotation-export{margin:1em 0}.slash-annotation-canvas{position:relative;max-width:100%;line-height:0}.slash-annotation-canvas>img{display:block;max-width:100%;height:auto}.slash-annotation-overlay,.slash-annotation-hotspots{position:absolute;inset:0;width:100%;height:100%}.slash-annotation-overlay{pointer-events:none}.slash-annotation-hotspots{pointer-events:none}.slash-annotation-hotspot{position:absolute;pointer-events:auto;outline:none}.slash-annotation-tooltip{position:absolute;z-index:3;left:50%;bottom:calc(100% + 8px);display:none;min-width:180px;max-width:320px;padding:8px 10px;color:#fff;border-radius:5px;background:#202124;box-shadow:0 4px 14px #0005;font:12px/1.4 sans-serif;transform:translateX(-50%);line-height:1.4}.slash-annotation-tooltip strong{display:inline-grid;place-items:center;width:20px;height:20px;margin-right:6px;color:#202124;border-radius:50%;background:#ffbc00}.slash-annotation-tooltip p{display:inline;margin:0}.slash-annotation-tooltip a{color:#8cc8ff}.slash-annotation-hotspot:hover .slash-annotation-tooltip,.slash-annotation-hotspot:focus .slash-annotation-tooltip{display:block}.slash-annotation-table{width:100%;margin-top:10px;border-collapse:collapse;font:13px/1.45 sans-serif}.slash-annotation-table th,.slash-annotation-table td{padding:7px 9px;border:1px solid #bbb;text-align:left;vertical-align:top}.slash-annotation-table th:first-child,.slash-annotation-table td:first-child{width:48px;text-align:center}
  </style><figure class="slash-image-annotation-export"><div class="slash-annotation-canvas"><img src="${escapeAttribute(annotation.image.dataUrl)}" alt="${escapeAttribute(annotation.image.name)}" data-slash-doc-annotation="${encodedState}"><svg class="slash-annotation-overlay" viewBox="0 0 ${annotation.image.width} ${annotation.image.height}" preserveAspectRatio="none" aria-hidden="true">${overlay}</svg><div class="slash-annotation-hotspots">${hotspots}</div></div>${rows ? `<table class="slash-annotation-table"><thead><tr><th>#</th><th>Описание</th></tr></thead><tbody>${rows}</tbody></table>` : ''}<svg width="0" height="0" aria-hidden="true"><metadata id="slash-doc-image-annotation-data"><![CDATA[${metadata}]]></metadata></svg></figure>`;
}

function exportImageAnnotationToMarkdown(data: Record<string, unknown>): string {
  const annotation = normalizeExportImageAnnotation(data);

  if (!annotation.image) {
    return '';
  }

  const image = createAnnotatedImageDataUri(annotation);
  const rows = annotation.annotations.map(
    (region) => `| ${region.number} | ${escapeMarkdownTableCell(region.description || '—')} |`,
  );
  const table = rows.length ? `\n| # | Описание |\n| ---: | --- |\n${rows.join('\n')}` : '';
  return `![Annotated image](${image})${table}`;
}

function createAnnotatedImageDataUri(annotation: ExportImageAnnotation): string {
  const image = annotation.image;

  if (!image) {
    return '';
  }

  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  const overlay = renderAnnotationOverlay(annotation.annotations, width, height);
  const metadata = JSON.stringify(annotation).replaceAll(']]>', ']]]]><![CDATA[>');
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><metadata id="slash-doc-image-annotation-data"><![CDATA[${metadata}]]></metadata><image href="${escapeAttribute(image.dataUrl)}" width="${width}" height="${height}" preserveAspectRatio="none"/>${overlay}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function renderAnnotationOverlay(regions: ExportImageRegion[], width = 1000, height = 1000): string {
  const strokeWidth = 2;
  const badgeRadius = Math.max(8, Math.min(14, Math.min(width, height) * 0.012));
  const fontSize = badgeRadius;
  return [...regions]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((region) => {
      const x = region.x * width;
      const y = region.y * height;
      const regionWidth = region.width * width;
      const regionHeight = region.height * height;
      const badgeX = x + badgeRadius + strokeWidth;
      const badgeY = y + badgeRadius + strokeWidth;
      return `<g><rect x="${x}" y="${y}" width="${regionWidth}" height="${regionHeight}" fill="#ffbc00" fill-opacity="0.12" stroke="#ffbc00" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"/><circle cx="${badgeX}" cy="${badgeY}" r="${badgeRadius}" fill="#ffbc00"/><text x="${badgeX}" y="${badgeY + fontSize * 0.34}" fill="#202124" font-family="sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle">${region.number}</text></g>`;
    })
    .join('');
}

function renderAnnotationHtmlRows(regions: ExportImageRegion[]): string {
  return regions
    .map(
      (region) => `<tr><td>${region.number}</td><td>${renderAnnotationMarkdown(region.description || '—')}</td></tr>`,
    )
    .join('');
}

function renderAnnotationMarkdown(value: string): string {
  return renderSafeMarkdown(value);
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
}

function normalizeExportImageAnnotation(data: Record<string, unknown>): ExportImageAnnotation {
  const value = isRecord(data.image) ? data.image : undefined;
  const image =
    value && typeof value.dataUrl === 'string' && value.dataUrl.startsWith('data:image/')
      ? {
          dataUrl: value.dataUrl,
          width: Math.max(1, getFiniteNumber(value.width, 1)),
          height: Math.max(1, getFiniteNumber(value.height, 1)),
          name: typeof value.name === 'string' ? value.name : 'annotated-image',
        }
      : null;
  const annotations = Array.isArray(data.annotations)
    ? data.annotations.filter(isRecord).flatMap((region, index) => {
        if (typeof region.id !== 'string') return [];
        return [
          {
            id: region.id,
            number: index + 1,
            x: clampUnit(region.x),
            y: clampUnit(region.y),
            width: clampUnit(region.width),
            height: clampUnit(region.height),
            description: typeof region.description === 'string' ? region.description : '',
            zIndex: getFiniteNumber(region.zIndex, index),
          },
        ];
      })
    : [];
  return { version: 1, image, annotations };
}

function clampUnit(value: unknown): number {
  return Math.max(0, Math.min(1, getFiniteNumber(value, 0)));
}

function exportApiEndpointToHtml(data: Record<string, unknown>): string {
  const endpoint = createApiEndpointData(data as Partial<ApiEndpointData>);
  const state = Buffer.from(JSON.stringify(endpoint), 'utf8').toString('base64');
  return `<style>.slash-api-export{margin:1em 0;padding:18px;color:#202124;border:1px solid #d0d7de;border-radius:7px;background:#fff;font:14px/1.5 sans-serif}.slash-api-export .api-endpoint-doc header{display:flex;align-items:center;gap:9px}.slash-api-export .api-method{padding:4px 8px;color:#fff;border-radius:3px;background:#3979c6;font:bold 12px monospace}.slash-api-export .api-method-post{background:#2e9b57}.slash-api-export .api-method-put,.slash-api-export .api-method-patch{background:#b77900}.slash-api-export .api-method-delete{background:#c43b3b}.slash-api-export .api-uri{font-size:14px}.slash-api-export table{width:100%;border-collapse:collapse}.slash-api-export th,.slash-api-export td{padding:7px;border:1px solid #d0d7de;text-align:left;vertical-align:top}</style><section class="slash-api-export" data-slash-doc-api-endpoint="${state}">${generateApiHtmlPreview(endpoint)}</section>`;
}

function exportApiEndpointToMarkdown(data: Record<string, unknown>): string {
  return exportApiEndpointToHtml(data);
}

function exportFileProcessorToHtml(data: Record<string, unknown>): string {
  const script = typeof data.script === 'string' ? data.script : '';
  return `<pre><code class="language-javascript">${escapeHtml(script)}</code></pre>`;
}

function exportFileProcessorToMarkdown(data: Record<string, unknown>): string {
  const script = typeof data.script === 'string' ? data.script : '';
  const longestFence = Math.max(2, ...[...script.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(longestFence + 1);
  return `${fence}javascript\n${script}\n${fence}`;
}

function exportTaskTableToHtml(data: Record<string, unknown>): string {
  const state = Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
  const title = typeof data.title === 'string' ? data.title : 'Задачи';
  const columns = Array.isArray(data.columns) ? data.columns.filter(isRecord) : [];
  const renderedColumns = columns
    .map((column) => {
      const cards = Array.isArray(column.cards) ? column.cards.filter(isRecord) : [];
      return `<div class="task-table-column"><h3>${escapeHtml(String(column.title ?? ''))}</h3><div class="task-table-cards">${cards.map((card) => `<article class="task-table-card"><strong>${escapeHtml(String(card.title ?? ''))}</strong>${card.description ? `<p>${escapeHtml(String(card.description))}</p>` : ''}</article>`).join('')}</div></div>`;
    })
    .join('');
  return `<style>.task-table-export{margin:1em 0;padding:14px;border:1px solid #d0d7de;border-radius:7px;background:#f6f8fa;font:14px/1.4 sans-serif}.task-table-export>h2{margin:0 0 12px}.task-table-board{display:flex;align-items:flex-start;gap:12px;overflow-x:auto}.task-table-column{flex:1 0 220px;padding:10px;border-radius:6px;background:#eaeef2}.task-table-column h3{margin:0 0 8px;font-size:14px}.task-table-cards{display:grid;gap:8px}.task-table-card{padding:9px;border:1px solid #d0d7de;border-radius:5px;background:#fff}.task-table-card p{margin:5px 0 0;color:#57606a;white-space:pre-wrap}</style><section class="task-table-export" data-slash-doc-task-table="${state}"><h2>${escapeHtml(title)}</h2><div class="task-table-board">${renderedColumns}</div></section>`;
}

function exportApprovalTableToHtml(data: Record<string, unknown>): string {
  const rows = getApprovalRows(data);
  const state = Buffer.from(JSON.stringify({ rows }), 'utf8').toString('base64');
  const body = rows
    .map((row) => {
      const responsibles = Array.isArray(row.responsibles) ? row.responsibles.filter(isRecord) : [];
      const users = responsibles
        .map((user) => {
          const name = String(user.fullName ?? '');
          const email = String(user.email ?? '');
          const photo = String(user.photo ?? '');
          const link = String(user.link ?? '');
          const label = `<span><strong>${escapeHtml(name)}</strong>${email ? `<small>${escapeHtml(email)}</small>` : ''}</span>`;
          const content = `${photo ? `<img src="${escapeAttribute(photo)}" alt="">` : ''}${label}`;
          return link
            ? `<a class="slash-approval-person" href="${escapeAttribute(link)}" target="_blank" rel="noopener noreferrer">${content}</a>`
            : `<span class="slash-approval-person">${content}</span>`;
        })
        .join('');
      return `<tr><td>${escapeHtml(String(row.stage ?? ''))}</td><td><div class="slash-approval-people">${users}</div></td><td>${escapeHtml(String(row.result ?? ''))}</td></tr>`;
    })
    .join('');
  return `<style>.slash-approval-export{width:100%;border-collapse:collapse;font:14px/1.4 sans-serif}.slash-approval-export th,.slash-approval-export td{padding:8px 10px;border:1px solid #d0d7de;text-align:left;vertical-align:top}.slash-approval-export th{background:#f6f8fa}.slash-approval-people{display:flex;flex-wrap:wrap;gap:5px}.slash-approval-person{display:inline-flex;align-items:center;gap:5px;padding:3px 7px 3px 3px;color:#24292f;border-radius:16px;background:#eaeef2;text-decoration:none}.slash-approval-person img{width:24px;height:24px;border-radius:50%}.slash-approval-person span,.slash-approval-person strong,.slash-approval-person small{display:block}.slash-approval-person small{color:#57606a;font-size:11px}</style><table class="slash-approval-export" data-slash-doc-approval-table="${state}"><thead><tr><th>Этап</th><th>Ответственные</th><th>Результат</th></tr></thead><tbody>${body}</tbody></table>`;
}

function exportApprovalTableToMarkdown(data: Record<string, unknown>): string {
  const rows = getApprovalRows(data).map((row) => {
    const users = Array.isArray(row.responsibles)
      ? row.responsibles
          .filter(isRecord)
          .map((user) => String(user.fullName ?? ''))
          .filter(Boolean)
          .join(', ')
      : '';
    return [row.stage, users, row.result].map((value) => escapeMarkdownTableCell(String(value ?? '')));
  });
  return [
    '| Этап | Ответственные | Результат |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function getApprovalRows(data: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(data.rows) ? data.rows.filter(isRecord) : [];
}

function getEditorBlocks(data: unknown): Record<string, unknown>[] {
  if (!isRecord(data) || !Array.isArray(data.blocks)) {
    return [];
  }

  return data.blocks.filter((block): block is Record<string, unknown> => isRecord(block));
}

function getExportTitle(blocks: Record<string, unknown>[]): string {
  const firstHeader = blocks.find((block) => block.type === 'header' && isRecord(block.data));
  const text =
    firstHeader && isRecord(firstHeader.data) && typeof firstHeader.data.text === 'string'
      ? stripHtml(firstHeader.data.text).trim()
      : '';

  return text || 'Slash Doc';
}

function getListItems(data: Record<string, unknown>): string[] {
  if (!Array.isArray(data.items)) {
    return [];
  }

  return data.items.map((item) => {
    if (typeof item === 'string') {
      return item;
    }

    if (isRecord(item) && typeof item.content === 'string') {
      return item.content;
    }

    return String(item ?? '');
  });
}

function clampHeadingLevel(value: unknown): number {
  const level = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
}

function htmlToMarkdownInline(value: string): string {
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
      const markdownHref = href.replaceAll(' ', '%20').replaceAll(')', '%29');
      return `[${content}](${markdownHref})`;
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
