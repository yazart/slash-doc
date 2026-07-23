import * as vscode from 'vscode';
import type { SlashDocSettings } from './extension/types';
import { getDefaultSettings } from './extension/settings';
import { getGlobalAddonRootUri, getPageContentUri, getWorkspaceRoot, writeJson } from './extension/filesystem';
import {
  createDefaultPageContent,
  findMenuItem,
  flattenMenuPages,
  getFirstHeaderText,
  readMenu,
  readPageContent,
  updateMenuItemTitle,
  writeMenu,
} from './extension/pages';
import { readSettings } from './extension/settings-store';
import { exportPageContent } from './extension/document-export';
import { ApiServerManager, migrateLegacyModules } from './extension/api-server';
import { getWebviewHtml } from './extension/editor-webview';
import {
  downloadProcessorFile,
  runPageProcessor,
  uploadProcessorFiles,
  type UploadedProcessorFile,
} from './extension/file-processor';
import { SlashDocSidebarProvider } from './extension/sidebar-provider';
import type { OpenPagePanel } from './extension/sidebar-page-actions';
import { searchMockUsers } from './shared/users';

const viewType = 'slashDoc.editor';
const sidebarViewId = 'slashDoc.actions';
const requestedSaves = new Map<string, (ok: boolean) => void>();

type EditorMessage = {
  type?: string;
  data?: unknown;
  source?: 'auto' | 'manual';
  format?: ExportFormat;
  requestId?: string;
  files?: UploadedProcessorFile[];
  script?: string;
  inputFiles?: string[];
  fileName?: string;
  text?: string;
  pageId?: string;
  url?: string;
  query?: string;
  revision?: number;
  error?: string;
};

type ExportFormat = 'html' | 'md';

let apiServerManager: ApiServerManager | undefined;
let openPagePanel: OpenPagePanel | undefined;
let pageOpenQueue = Promise.resolve();

export function activate(context: vscode.ExtensionContext) {
  apiServerManager = new ApiServerManager(context.extensionUri);
  const sidebarProvider = new SlashDocSidebarProvider(
    context.extensionUri,
    apiServerManager,
    () => openPagePanel,
    saveOpenPage,
  );
  void migrateLegacyModules(context.extensionUri)
    .catch((error) => console.error('Failed to migrate legacy Slash Doc modules', error))
    .then(() => apiServerManager?.reload());

  const disposable = vscode.commands.registerCommand(
    'slashDoc.openEditor',
    (pageId?: string, options?: { focusEditor?: boolean }) => {
      const open = async () => {
        const current = openPagePanel;
        if (current && current.pageId === pageId && current.panel.active) {
          current.panel.reveal(current.panel.viewColumn, false);
          return;
        }
        if (!(await saveAndCloseOpenPage())) return;

        const workspaceRoot = getWorkspaceRoot();
        const menu = workspaceRoot ? await readMenu(workspaceRoot) : { items: [] };
        const page = pageId ? findMenuItem(menu.items, pageId) : undefined;
        const initialData =
          workspaceRoot && pageId
            ? await readPageContent(workspaceRoot, pageId, page?.title ?? 'Slash Doc')
            : createDefaultPageContent('Slash Doc');
        const settings = workspaceRoot ? await readSettings(workspaceRoot) : getDefaultSettings();

        const panel = vscode.window.createWebviewPanel(viewType, page?.title ?? 'Slash Doc', vscode.ViewColumn.One, {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'dist'),
            vscode.Uri.joinPath(context.extensionUri, 'assets'),
            getGlobalAddonRootUri(context.extensionUri),
          ],
        });

        let saveQueue = Promise.resolve();
        const panelState: OpenPagePanel = { pageId, panel, waitForPendingSave: () => saveQueue };
        openPagePanel = panelState;
        panel.onDidDispose(() => {
          if (openPagePanel === panelState) openPagePanel = undefined;
        });

        panel.webview.onDidReceiveMessage(
          async (message: EditorMessage) => {
            if (message.type === 'saveClientError') {
              const error = message.error ?? 'неизвестная ошибка сериализации';
              console.error(`Slash Doc: page ${pageId ?? 'unknown'} was not saved: ${error}`);
              void vscode.window.showErrorMessage(`Slash Doc: страница не сохранена. ${error}`);
              resolveRequestedSave(message.requestId, false);
              return;
            }

            if (message.type === 'readClipboard') {
              let text = '';
              try {
                text = await vscode.env.clipboard.readText();
              } catch (error) {
                console.error('Slash Doc: failed to read clipboard', error);
              }
              await panel.webview.postMessage({ type: 'clipboardResponse', requestId: message.requestId, text });
              return;
            }

            if (message.type === 'writeClipboard' && typeof message.text === 'string') {
              try {
                await vscode.env.clipboard.writeText(message.text);
              } catch (error) {
                console.error('Slash Doc: failed to write clipboard', error);
              }
              return;
            }

            if (message.type === 'openPage' && message.pageId) {
              await vscode.commands.executeCommand('slashDoc.openEditor', message.pageId);
              return;
            }

            if (message.type === 'openExternal' && message.url) {
              try {
                const externalUri = vscode.Uri.parse(message.url);
                if (externalUri.scheme === 'http' || externalUri.scheme === 'https') {
                  await vscode.env.openExternal(externalUri);
                }
              } catch (error) {
                console.error('Slash Doc: invalid external URL', error);
              }
              return;
            }

            if (message.type === 'searchUsers') {
              await panel.webview.postMessage({
                type: 'userSearchResponse',
                requestId: message.requestId,
                users: await searchUsers(settings, message.query ?? ''),
              });
              return;
            }

            if (message.type?.startsWith('fileProcessor')) {
              const respond = (ok: boolean, data?: unknown, error?: string) =>
                panel.webview.postMessage({
                  type: 'fileProcessorResponse',
                  requestId: message.requestId,
                  ok,
                  data,
                  error,
                });

              if (!workspaceRoot || !pageId) {
                await respond(false, undefined, 'Сначала сохраните виджет на странице документа.');
                return;
              }

              try {
                if (message.type === 'fileProcessorUpload') {
                  await respond(true, await uploadProcessorFiles(workspaceRoot, pageId, message.files ?? []));
                } else if (message.type === 'fileProcessorRun') {
                  const result = await runPageProcessor(
                    context.extensionUri,
                    workspaceRoot,
                    pageId,
                    message.script ?? '',
                    message.inputFiles ?? [],
                  );
                  await respond(true, result);
                } else if (message.type === 'fileProcessorDownload' && message.fileName) {
                  await downloadProcessorFile(workspaceRoot, pageId, message.fileName);
                  await respond(true);
                }
              } catch (error) {
                await respond(false, undefined, error instanceof Error ? error.message : String(error));
              }
              return;
            }

            if (message.type !== 'save') {
              if (message.type === 'export' && message.format) {
                const content = await exportPageContent(
                  message.data,
                  message.format,
                  settings,
                  context.extensionUri,
                  workspaceRoot,
                );
                const document = await vscode.workspace.openTextDocument({
                  content,
                  language: message.format === 'html' ? 'html' : 'markdown',
                });
                await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
              }

              return;
            }

            if (!workspaceRoot || !pageId) {
              const detail = !workspaceRoot
                ? 'Не открыта рабочая папка.'
                : 'Редактор открыт без привязки к странице документации.';
              await panel.webview.postMessage({
                type: 'saveResult',
                ok: false,
                revision: message.revision,
                error: detail,
              });
              void vscode.window.showErrorMessage(`Slash Doc: страница не сохранена. ${detail}`);
              resolveRequestedSave(message.requestId, false);
              return;
            }

            saveQueue = saveQueue.then(async () => {
              try {
                await writeJson(getPageContentUri(workspaceRoot, pageId), message.data);
                const title = getFirstHeaderText(message.data);

                if (title) {
                  const menu = await readMenu(workspaceRoot);

                  if (updateMenuItemTitle(menu.items, pageId, title)) {
                    await writeMenu(workspaceRoot, menu);
                    panel.title = title;
                    await sidebarProvider.refresh();
                  }
                }
                await panel.webview.postMessage({ type: 'saveResult', ok: true, revision: message.revision });
                resolveRequestedSave(message.requestId, true);
              } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                console.error(`Slash Doc: failed to save page ${pageId}`, error);
                await panel.webview.postMessage({
                  type: 'saveResult',
                  ok: false,
                  revision: message.revision,
                  error: detail,
                });
                void vscode.window.showErrorMessage(`Slash Doc: страница не сохранена. ${detail}`);
                resolveRequestedSave(message.requestId, false);
              }
            });
            await saveQueue;
          },
          undefined,
          context.subscriptions,
        );

        panel.webview.html = getWebviewHtml(
          panel.webview,
          context.extensionUri,
          workspaceRoot,
          initialData,
          settings,
          flattenMenuPages(menu.items),
          pageId,
          options?.focusEditor === true,
        );
      };
      pageOpenQueue = pageOpenQueue.then(open, open);
      return pageOpenQueue;
    },
  );

  const sidebarRegistration = vscode.window.registerWebviewViewProvider(sidebarViewId, sidebarProvider);

  context.subscriptions.push(disposable, sidebarRegistration, {
    dispose: () => {
      void apiServerManager?.dispose();
    },
  });
}

export function deactivate() {
  return apiServerManager?.dispose();
}

async function saveAndCloseOpenPage(): Promise<boolean> {
  const current = openPagePanel;
  if (!current) return true;
  if (!(await savePagePanel(current))) {
    void vscode.window.showErrorMessage('Slash Doc: переход отменён — не удалось сохранить открытую страницу.');
    return false;
  }
  current.panel.dispose();
  return true;
}

async function saveOpenPage(): Promise<boolean> {
  return openPagePanel ? savePagePanel(openPagePanel) : true;
}

async function savePagePanel(current: OpenPagePanel): Promise<boolean> {
  if (!current.pageId) return true;
  if (current.panel.visible) return requestPanelSave(current.panel);
  await current.waitForPendingSave();
  return true;
}

async function requestPanelSave(panel: vscode.WebviewPanel): Promise<boolean> {
  const requestId = `close-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const result = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      requestedSaves.delete(requestId);
      resolve(false);
    }, 10_000);
    requestedSaves.set(requestId, (ok) => {
      clearTimeout(timeout);
      requestedSaves.delete(requestId);
      resolve(ok);
    });
  });
  if (!(await panel.webview.postMessage({ type: 'requestSave', requestId }))) resolveRequestedSave(requestId, false);
  return result;
}

function resolveRequestedSave(requestId: string | undefined, ok: boolean): void {
  if (requestId) requestedSaves.get(requestId)?.(ok);
}

async function searchUsers(settings: SlashDocSettings, query: string) {
  try {
    const url = new URL(`http://127.0.0.1:${settings.apiPort}${settings.apiPrefix}/v1/users`);
    url.searchParams.set('query', query);
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    const payload = (await response.json()) as unknown;
    if (response.ok && payload && typeof payload === 'object' && 'users' in payload && Array.isArray(payload.users)) {
      return payload.users;
    }
  } catch {
    // The built-in API can be restarting; keep the editor usable with the same mock dataset.
  }
  return searchMockUsers(query);
}
