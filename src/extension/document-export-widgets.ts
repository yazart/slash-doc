import { createApiEndpointData, generateApiHtmlPreview, type ApiEndpointData } from '../shared/api-endpoint';
import apiExportStyles from './styles/api-export.embedded.css?raw';
import taskTableExportStyles from './styles/task-table-export.embedded.css?raw';
import { escapeHtml, isRecord } from './utils';

export function exportApiEndpointToHtml(data: Record<string, unknown>): string {
  const endpoint = createApiEndpointData(data as Partial<ApiEndpointData>);
  const state = Buffer.from(JSON.stringify(endpoint), 'utf8').toString('base64');
  return `<style>${apiExportStyles}</style><section class="slash-api-export" data-slash-doc-api-endpoint="${state}">${generateApiHtmlPreview(endpoint)}</section>`;
}

export function exportApiEndpointToMarkdown(data: Record<string, unknown>): string {
  return exportApiEndpointToHtml(data);
}

export function exportFileProcessorToHtml(data: Record<string, unknown>): string {
  const script = typeof data.script === 'string' ? data.script : '';
  return `<pre><code class="language-javascript">${escapeHtml(script)}</code></pre>`;
}

export function exportFileProcessorToMarkdown(data: Record<string, unknown>): string {
  const script = typeof data.script === 'string' ? data.script : '';
  const longestFence = Math.max(2, ...[...script.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(longestFence + 1);
  return `${fence}javascript\n${script}\n${fence}`;
}

export function exportTaskTableToHtml(data: Record<string, unknown>): string {
  const state = Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
  const title = typeof data.title === 'string' ? data.title : 'Задачи';
  const columns = Array.isArray(data.columns) ? data.columns.filter(isRecord) : [];
  const renderedColumns = columns
    .map((column) => {
      const cards = Array.isArray(column.cards) ? column.cards.filter(isRecord) : [];
      return `<div class="task-table-column"><h3>${escapeHtml(String(column.title ?? ''))}</h3><div class="task-table-cards">${cards.map((card) => `<article class="task-table-card"><strong>${escapeHtml(String(card.title ?? ''))}</strong>${card.description ? `<p>${escapeHtml(String(card.description))}</p>` : ''}</article>`).join('')}</div></div>`;
    })
    .join('');
  return `<style>${taskTableExportStyles}</style><section class="task-table-export" data-slash-doc-task-table="${state}"><h2>${escapeHtml(title)}</h2><div class="task-table-board">${renderedColumns}</div></section>`;
}
