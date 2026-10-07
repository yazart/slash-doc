import { createHash } from 'node:crypto';
import { renderSafeMarkdown } from '../shared/markdown';
import mkdocsStyles from './styles/mkdocs-widgets-export.embedded.css?raw';
import { escapeAttribute, escapeHtml, isRecord } from './utils';

export function exportMkDocsAdmonitionToHtml(data: Record<string, unknown>): string {
  const kind = normalizeKind(data.kind);
  const title = typeof data.title === 'string' ? data.title : '';
  const content = typeof data.content === 'string' ? data.content : '';
  const state = encodeState({
    kind,
    title,
    content,
    collapsible: data.collapsible === true,
    open: data.open !== false,
  });
  const body = `<div class="slash-mkdocs-admonition-body">${renderSafeMarkdown(content)}</div>`;
  const titleHtml = `<div class="slash-mkdocs-admonition-title">${escapeHtml(title || kind)}</div>`;
  const className = `slash-mkdocs-admonition slash-mkdocs-admonition-${escapeAttribute(kind)}`;
  const rendered =
    data.collapsible === true
      ? `<details class="${className}" data-slash-doc-mkdocs-admonition="${state}"${data.open !== false ? ' open' : ''}><summary>${escapeHtml(title || kind)}</summary>${body}</details>`
      : `<aside class="${className}" data-slash-doc-mkdocs-admonition="${state}">${titleHtml}${body}</aside>`;
  return `<style>${mkdocsStyles}</style>${rendered}`;
}

export function exportMkDocsTabsToHtml(data: Record<string, unknown>, blockIndex = 0): string {
  const tabs = normalizeTabs(data.tabs);
  if (tabs.length === 0) return '';
  const state = encodeState({ tabs });
  const group = `slash-tabs-${createHash('sha256').update(`${blockIndex}:${state}`).digest('hex').slice(0, 12)}`;
  const labels = tabs
    .map(
      (tab, index) =>
        `<button type="button" role="tab" id="${group}-tab-${index}" aria-controls="${group}-panel-${index}" aria-selected="${index === 0}">${escapeHtml(tab.title || `Вкладка ${index + 1}`)}</button>`,
    )
    .join('');
  const panels = tabs
    .map(
      (tab, index) =>
        `<section class="slash-mkdocs-tab-panel" role="tabpanel" id="${group}-panel-${index}" aria-labelledby="${group}-tab-${index}"${index === 0 ? '' : ' hidden'}>${renderSafeMarkdown(tab.content)}</section>`,
    )
    .join('');
  const behavior = `<script>(()=>{const root=document.currentScript.previousElementSibling;if(!root)return;const buttons=[...root.querySelectorAll('[role="tab"]')];const panels=[...root.querySelectorAll('[role="tabpanel"]')];buttons.forEach((button,index)=>button.addEventListener('click',()=>{buttons.forEach((item,itemIndex)=>item.setAttribute('aria-selected',String(itemIndex===index)));panels.forEach((panel,itemIndex)=>panel.hidden=itemIndex!==index)}))})()</script>`;
  return `<style>${mkdocsStyles}</style><div class="slash-mkdocs-tabs" data-slash-doc-mkdocs-tabs="${state}"><div class="slash-mkdocs-tab-labels" role="tablist">${labels}</div><div class="slash-mkdocs-tab-panels">${panels}</div></div>${behavior}`;
}

export function exportMkDocsDetailsToHtml(data: Record<string, unknown>): string {
  const summary = typeof data.summary === 'string' ? data.summary : 'Подробнее';
  const content = typeof data.content === 'string' ? data.content : '';
  const state = encodeState({ summary, content, open: data.open === true });
  return `<style>${mkdocsStyles}</style><details class="slash-mkdocs-details" data-slash-doc-mkdocs-details="${state}"${data.open === true ? ' open' : ''}><summary>${escapeHtml(summary)}</summary><div class="slash-mkdocs-details-body">${renderSafeMarkdown(content)}</div></details>`;
}

export function exportMkDocsChecklistToHtml(data: Record<string, unknown>): string {
  const items = normalizeChecklistItems(data.items);
  if (items.length === 0) return '';
  const state = encodeState({ items });
  return `<style>${mkdocsStyles}</style><section class="slash-mkdocs-checklist" data-slash-doc-mkdocs-checklist="${state}">${renderChecklistTree(buildChecklistTree(items))}</section>`;
}

export function exportMkDocsAdmonitionToMarkdown(data: Record<string, unknown>): string {
  const marker = data.collapsible === true ? (data.open !== false ? '???+' : '???') : '!!!';
  const kind = normalizeKind(data.kind);
  const title = typeof data.title === 'string' && data.title.trim() ? ` "${escapeTitle(data.title)}"` : '';
  return `${marker} ${kind}${title}\n\n${indentMarkdown(typeof data.content === 'string' ? data.content : '')}`;
}

export function exportMkDocsTabsToMarkdown(data: Record<string, unknown>): string {
  return normalizeTabs(data.tabs)
    .map((tab) => `=== "${escapeTitle(tab.title)}"\n\n${indentMarkdown(tab.content)}`)
    .join('\n\n');
}

export function exportMkDocsDetailsToMarkdown(data: Record<string, unknown>): string {
  const summary = typeof data.summary === 'string' ? data.summary : 'Подробнее';
  const content = typeof data.content === 'string' ? data.content : '';
  const state = encodeState({ summary, content, open: data.open === true });
  return `<details data-slash-doc-mkdocs-details="${state}"${data.open === true ? ' open' : ''}>\n<summary>${escapeHtml(summary)}</summary>\n\n${content}\n\n</details>`;
}

export function exportMkDocsChecklistToMarkdown(data: Record<string, unknown>): string {
  return normalizeChecklistItems(data.items)
    .map((item) => `${'    '.repeat(item.level)}- [${item.checked ? 'x' : ' '}] ${item.text}`)
    .join('\n');
}

function normalizeTabs(value: unknown): Array<{ id: string; title: string; content: string }> {
  return Array.isArray(value)
    ? value.filter(isRecord).map((tab, index) => ({
        id: typeof tab.id === 'string' ? tab.id : `tab-${index + 1}`,
        title: typeof tab.title === 'string' ? tab.title : `Вкладка ${index + 1}`,
        content: typeof tab.content === 'string' ? tab.content : '',
      }))
    : [];
}

type ChecklistItem = { id: string; text: string; checked: boolean; level: number };
type ChecklistNode = ChecklistItem & { children: ChecklistNode[] };

function normalizeChecklistItems(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  let previousLevel = 0;
  return value.filter(isRecord).map((item, index) => {
    const requested = typeof item.level === 'number' ? Math.max(0, Math.floor(item.level)) : 0;
    const level = index === 0 ? 0 : Math.min(requested, previousLevel + 1);
    previousLevel = level;
    return {
      id: typeof item.id === 'string' ? item.id : `task-${index + 1}`,
      text: typeof item.text === 'string' ? item.text : '',
      checked: item.checked === true,
      level,
    };
  });
}

function buildChecklistTree(items: ChecklistItem[]): ChecklistNode[] {
  const roots: ChecklistNode[] = [];
  const stack: ChecklistNode[] = [];
  for (const item of items) {
    const node: ChecklistNode = { ...item, children: [] };
    if (item.level === 0 || !stack[item.level - 1]) roots.push(node);
    else stack[item.level - 1].children.push(node);
    stack[item.level] = node;
    stack.length = item.level + 1;
  }
  return roots;
}

function renderChecklistTree(nodes: ChecklistNode[]): string {
  return `<ul>${nodes
    .map(
      (node) =>
        `<li><label><input type="checkbox"${node.checked ? ' checked' : ''} disabled><span>${renderSafeMarkdown(node.text)}</span></label>${node.children.length ? renderChecklistTree(node.children) : ''}</li>`,
    )
    .join('')}</ul>`;
}

function normalizeKind(value: unknown): string {
  const kind = typeof value === 'string' ? value.toLowerCase().replaceAll(/[^a-z-]/g, '') : '';
  return kind || 'note';
}

function encodeState(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function indentMarkdown(value: string): string {
  return value
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
}

function escapeTitle(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
