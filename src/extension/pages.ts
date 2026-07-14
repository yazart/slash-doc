import * as vscode from 'vscode';
import { getMenuUri, getPageContentUri, pathExists, writeJson } from './filesystem';
import type { SlashDocMenu, SlashDocMenuItem } from './types';
import { createPageId, escapeAttribute, escapeHtml, isRecord, stripHtml } from './utils';

export async function readMenu(workspaceRoot: vscode.Uri): Promise<SlashDocMenu> {
  const menuUri = getMenuUri(workspaceRoot);

  if (!(await pathExists(menuUri))) {
    return { items: [] };
  }

  const data = await vscode.workspace.fs.readFile(menuUri);
  const parsed = JSON.parse(new TextDecoder().decode(data)) as Partial<SlashDocMenu>;
  return { items: normalizeMenuItems(parsed.items) };
}

export async function writeMenu(workspaceRoot: vscode.Uri, menu: SlashDocMenu): Promise<void> {
  await writeJson(getMenuUri(workspaceRoot), menu);
}

export async function readPageContent(
  workspaceRoot: vscode.Uri,
  pageId: string,
  fallbackTitle: string
): Promise<unknown> {
  const contentUri = getPageContentUri(workspaceRoot, pageId);

  if (!(await pathExists(contentUri))) {
    return createDefaultPageContent(fallbackTitle);
  }

  const data = await vscode.workspace.fs.readFile(contentUri);
  return JSON.parse(new TextDecoder().decode(data));
}

export function createDefaultPageContent(title: string): unknown {
  return {
    time: Date.now(),
    blocks: [{ type: 'header', data: { text: title, level: 2 } }],
    version: '2.30.8'
  };
}

export function updatePageContentTitle(data: unknown, title: string): unknown {
  if (!isRecord(data) || !Array.isArray(data.blocks)) {
    return createDefaultPageContent(title);
  }

  const blocks = [...data.blocks];
  const firstBlock = blocks[0];

  if (isRecord(firstBlock) && firstBlock.type === 'header' && isRecord(firstBlock.data)) {
    blocks[0] = { ...firstBlock, data: { ...firstBlock.data, text: escapeHtml(title) } };
  } else {
    blocks.unshift({ type: 'header', data: { text: escapeHtml(title), level: 2 } });
  }

  return { ...data, time: Date.now(), blocks };
}

export function normalizeMenuItems(items: unknown): SlashDocMenuItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter(isRecord).map((item) => {
    const id = typeof item.id === 'string' ? item.id : createPageId();
    return {
      id,
      title: typeof item.title === 'string' ? item.title : 'Untitled',
      file: `${id}/content.json`,
      children: normalizeMenuItems(item.children)
    };
  });
}

export function addChildToMenu(items: SlashDocMenuItem[], parentId: string, child: SlashDocMenuItem): boolean {
  for (const item of items) {
    if (item.id === parentId) {
      item.children.push(child);
      return true;
    }
    if (addChildToMenu(item.children, parentId, child)) {
      return true;
    }
  }
  return false;
}

export function removeMenuItem(items: SlashDocMenuItem[], pageId: string): boolean {
  const index = items.findIndex((item) => item.id === pageId);
  if (index >= 0) {
    items.splice(index, 1);
    return true;
  }
  return items.some((item) => removeMenuItem(item.children, pageId));
}

export function collectMenuItemIds(item: SlashDocMenuItem): string[] {
  return [item.id, ...item.children.flatMap(collectMenuItemIds)];
}

export function renderMenuTree(items: SlashDocMenuItem[]): string {
  if (items.length === 0) {
    return '<p class="tree-empty">Страниц пока нет</p>';
  }
  return `<ul class="tree-list">${items.map(renderMenuItem).join('')}</ul>`;
}

function renderMenuItem(item: SlashDocMenuItem): string {
  const children = item.children.length > 0 ? renderMenuTree(item.children) : '';
  return `<li class="tree-node">
    <div class="tree-row">
      <button class="tree-item" type="button" data-page-id="${escapeAttribute(item.id)}" aria-selected="false">
        <span class="tree-label">${escapeHtml(item.title)}</span>
      </button>
      <button class="tree-rename" type="button" data-rename-page-id="${escapeAttribute(item.id)}" aria-label="Переименовать ${escapeAttribute(item.title)}" title="Переименовать">
        <span aria-hidden="true">✎</span>
      </button>
      <button class="tree-delete" type="button" data-delete-page-id="${escapeAttribute(item.id)}" aria-label="Удалить ${escapeAttribute(item.title)}" title="Удалить">
        <span aria-hidden="true">×</span>
      </button>
    </div>
    ${children}
  </li>`;
}

export function findMenuItem(items: SlashDocMenuItem[], pageId: string): SlashDocMenuItem | undefined {
  for (const item of items) {
    if (item.id === pageId) {
      return item;
    }
    const child = findMenuItem(item.children, pageId);
    if (child) {
      return child;
    }
  }
  return undefined;
}

export function updateMenuItemTitle(items: SlashDocMenuItem[], pageId: string, title: string): boolean {
  const item = findMenuItem(items, pageId);
  if (!item || item.title === title) {
    return false;
  }
  item.title = title;
  return true;
}

export function getFirstHeaderText(data: unknown): string | undefined {
  if (!isRecord(data) || !Array.isArray(data.blocks)) {
    return undefined;
  }
  const header = data.blocks[0];
  if (!isRecord(header) || header.type !== 'header' || !isRecord(header.data) || typeof header.data.text !== 'string') {
    return undefined;
  }
  const text = stripHtml(header.data.text).trim();
  return text.length > 0 ? text : undefined;
}
