import * as vscode from 'vscode';
import { getPageContentUri, getPagesRootUri, getWorkspaceRoot, writeJson } from './filesystem';
import {
  addChildToMenu,
  collectMenuItemIds,
  findMenuItem,
  readMenu,
  readPageContent,
  removeMenuItem,
  updatePageContentTitle,
  writeMenu,
} from './pages';
import type { SlashDocMenuItem } from './types';
import { createPageId } from './utils';

export async function deleteSidebarPage(pageId: string): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;
  const menu = await readMenu(workspaceRoot);
  const item = findMenuItem(menu.items, pageId);
  if (!item) return;
  const answer = await vscode.window.showWarningMessage(
    `Удалить страницу "${item.title}"?`,
    { modal: true, detail: 'Страница и все дочерние страницы будут удалены из .slash-doc.' },
    'Удалить',
  );
  if (answer !== 'Удалить') return;
  const pageIds = collectMenuItemIds(item);
  if (!removeMenuItem(menu.items, pageId)) return;
  await writeMenu(workspaceRoot, menu);
  for (const id of pageIds) {
    await vscode.workspace.fs
      .delete(vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), id), { recursive: true, useTrash: false })
      .then(undefined, () => undefined);
  }
}

export async function renameSidebarPage(
  pageId: string,
  openPagePanels: Map<string, Set<vscode.WebviewPanel>>,
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;
  const menu = await readMenu(workspaceRoot);
  const item = findMenuItem(menu.items, pageId);
  if (!item) return;
  const title = await vscode.window.showInputBox({
    prompt: 'Новый заголовок страницы',
    value: item.title,
    valueSelection: [0, item.title.length],
    validateInput: (value) => (value.trim() ? undefined : 'Заголовок не может быть пустым'),
  });
  if (!title?.trim()) return;
  const normalizedTitle = title.trim();
  item.title = normalizedTitle;
  await writeMenu(workspaceRoot, menu);
  const content = await readPageContent(workspaceRoot, pageId, normalizedTitle);
  const updatedContent = updatePageContentTitle(content, normalizedTitle);
  await writeJson(getPageContentUri(workspaceRoot, pageId), updatedContent);
  for (const panel of openPagePanels.get(pageId) ?? []) {
    panel.title = normalizedTitle;
    void panel.webview.postMessage({ type: 'replaceData', data: updatedContent });
  }
}

export async function createSidebarPageWithContent(
  title: string,
  content: unknown,
  parentId?: string,
): Promise<string> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) throw new Error('Для создания страницы Slash Doc требуется папка рабочей области.');
  const menu = await readMenu(workspaceRoot);
  const id = createPageId();
  const item: SlashDocMenuItem = { id, title, file: `${id}/content.json`, children: [] };
  if (parentId && addChildToMenu(menu.items, parentId, item)) await writeMenu(workspaceRoot, menu);
  else {
    menu.items.push(item);
    await writeMenu(workspaceRoot, menu);
  }
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), id));
  await writeJson(getPageContentUri(workspaceRoot, id), content);
  return id;
}
