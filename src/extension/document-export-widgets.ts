import { createApiEndpointData, generateApiHtmlPreview, type ApiEndpointData } from '../shared/api-endpoint';
import { escapeAttribute, escapeHtml, isRecord } from './utils';

export function exportApiEndpointToHtml(data: Record<string, unknown>): string {
  const endpoint = createApiEndpointData(data as Partial<ApiEndpointData>);
  const state = Buffer.from(JSON.stringify(endpoint), 'utf8').toString('base64');
  return `<style>.slash-api-export{margin:1em 0;padding:18px;color:#202124;border:1px solid #d0d7de;border-radius:7px;background:#fff;font:14px/1.5 sans-serif}.slash-api-export .api-endpoint-doc header{display:flex;align-items:center;gap:9px}.slash-api-export .api-method{padding:4px 8px;color:#fff;border-radius:3px;background:#3979c6;font:bold 12px monospace}.slash-api-export .api-method-post{background:#2e9b57}.slash-api-export .api-method-put,.slash-api-export .api-method-patch{background:#b77900}.slash-api-export .api-method-delete{background:#c43b3b}.slash-api-export .api-uri{font-size:14px}.slash-api-export table{width:100%;border-collapse:collapse}.slash-api-export th,.slash-api-export td{padding:7px;border:1px solid #d0d7de;text-align:left;vertical-align:top}</style><section class="slash-api-export" data-slash-doc-api-endpoint="${state}">${generateApiHtmlPreview(endpoint)}</section>`;
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
  return `<style>.task-table-export{margin:1em 0;padding:14px;border:1px solid #d0d7de;border-radius:7px;background:#f6f8fa;font:14px/1.4 sans-serif}.task-table-export>h2{margin:0 0 12px}.task-table-board{display:flex;align-items:flex-start;gap:12px;overflow-x:auto}.task-table-column{flex:1 0 220px;padding:10px;border-radius:6px;background:#eaeef2}.task-table-column h3{margin:0 0 8px;font-size:14px}.task-table-cards{display:grid;gap:8px}.task-table-card{padding:9px;border:1px solid #d0d7de;border-radius:5px;background:#fff}.task-table-card p{margin:5px 0 0;color:#57606a;white-space:pre-wrap}</style><section class="task-table-export" data-slash-doc-task-table="${state}"><h2>${escapeHtml(title)}</h2><div class="task-table-board">${renderedColumns}</div></section>`;
}

export function exportApprovalTableToHtml(data: Record<string, unknown>): string {
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

export function exportApprovalTableToMarkdown(data: Record<string, unknown>): string {
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

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
}
