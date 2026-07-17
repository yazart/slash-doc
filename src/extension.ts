import * as vscode from 'vscode';
import type {
  ApiService,
  CustomEditorAddon,
  EditorAddonDefinition,
  PageMovePosition,
  SlashDocMenuItem,
  SlashDocSettings,
} from './extension/types';
import { createPageId, createSettingsId } from './extension/utils';
import {
  getApiRouteTemplate,
  getCustomAddonTemplate,
  getDefaultSettings,
  normalizeSettings,
  normalizeToolName,
  slugify,
} from './extension/settings';
import {
  getApiServiceUri,
  getCustomAddonUri,
  getGlobalAddonRootUri,
  getGlobalApiRootUri,
  getPageContentUri,
  getPagesRootUri,
  getWorkspaceRoot,
  writeJson,
  writeJsonIfMissing,
  writeTextIfMissing,
} from './extension/filesystem';
import {
  addChildToMenu,
  collectMenuItemIds,
  createDefaultPageContent,
  createNewPageContent,
  findMenuItem,
  flattenMenuPages,
  getFirstHeaderText,
  readMenu,
  readPageContent,
  removeMenuItem,
  moveMenuItem,
  updateMenuItemTitle,
  updatePageContentTitle,
  writeMenu,
} from './extension/pages';
import { readSettings, writeSettings } from './extension/settings-store';
import { exportPageContent } from './extension/document-export';
import { importDocumentContent } from './extension/document-import';
import { compileDocumentationSite } from './extension/site-compiler';
import { ApiServerManager, migrateLegacyModules } from './extension/api-server';
import { getWebviewHtml } from './extension/editor-webview';
import { getSidebarHtml } from './extension/sidebar-webview';
import { searchDocumentation } from './extension/documentation-search';
import {
  downloadProcessorFile,
  runPageProcessor,
  uploadProcessorFiles,
  type UploadedProcessorFile,
} from './extension/file-processor';
import { searchMockUsers } from './shared/users';

const viewType = 'slashDoc.editor';
const sidebarViewId = 'slashDoc.actions';

type SidebarMessage = {
  type?: string;
  parentId?: string | null;
  pageId?: string | null;
  settings?: SlashDocSettings;
  serviceId?: string | null;
  addonId?: string | null;
  targetId?: string | null;
  position?: PageMovePosition;
  query?: string;
};

type SidebarView = 'menu' | 'settings';

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
};

type ExportFormat = 'html' | 'md';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const editorAddonDefinitions: EditorAddonDefinition[] = [
  {
    id: 'header',
    label: 'Заголовок',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14"/></svg>',
  },
  {
    id: 'list',
    label: 'Список',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><line x1="9" x2="19" y1="7" y2="7" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="9" x2="19" y1="12" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="9" x2="19" y1="17" y2="17" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 17H4.99002"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 12H4.99002"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 7H4.99002"/></svg>',
  },
  {
    id: 'confluenceTable',
    label: 'Таблица Confluence',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" d="M10 5V18.5"/><path stroke="currentColor" stroke-width="2" d="M14 5V18.5"/><path stroke="currentColor" stroke-width="2" d="M5 10H19"/><path stroke="currentColor" stroke-width="2" d="M5 14H19"/><rect width="14" height="14" x="5" y="5" stroke="currentColor" stroke-width="2" rx="4"/></svg>',
  },
  {
    id: 'image',
    label: 'Изображение',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect width="14" height="14" x="5" y="5" stroke="currentColor" stroke-width="2" rx="4"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.13968 15.32L8.69058 11.5661C9.02934 11.2036 9.48873 11 9.96774 11C10.4467 11 10.9061 11.2036 11.2449 11.5661L15.3871 16M13.5806 14.0664L15.0132 12.533C15.3519 12.1705 15.8113 11.9668 16.2903 11.9668C16.7693 11.9668 17.2287 12.1705 17.5675 12.533L18.841 13.9634"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.7778 9.33331H13.7867"/></svg>',
  },
  {
    id: 'marker',
    label: 'Маркер',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 17L15 7"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 17H17"/></svg>',
  },
  {
    id: 'inlineCode',
    label: 'Встроенный код',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9.5 8L6.11524 11.8683C6.04926 11.9437 6.04926 12.0563 6.11524 12.1317L9.5 16"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M15 8L18.3848 11.8683C18.4507 11.9437 18.4507 12.0563 18.3848 12.1317L15 16"/></svg>',
  },
  {
    id: 'underline',
    label: 'Подчёркивание',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8 5V10C8 12.2091 9.79086 14 12 14C14.2091 14 16 12.2091 16 10V5"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 19H17"/></svg>',
  },
  {
    id: 'textColor',
    label: 'Цвет текста',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 17 12 4l5 13M9 12h6"/><path stroke="#3b82f6" stroke-linecap="round" stroke-width="3" d="M6 20h12"/></svg>',
  },
  {
    id: 'mermaid',
    label: 'Mermaid',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 7H17"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 12H17"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 17H17"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4 7H4.01"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4 12H4.01"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4 17H4.01"/></svg>',
  },
  {
    id: 'flowDesigner',
    label: 'Конструктор процессов',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="5" cy="5" r="2" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="12" r="2" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="19" r="2" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="M7 5h3a5 5 0 0 1 5 5M7 19h3a5 5 0 0 0 5-5"/></svg>',
  },
  {
    id: 'networkCanvas',
    label: 'Сетевая схема',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="5" rx="1" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="6.5" r="2.5" stroke="currentColor" stroke-width="2"/><rect x="14" y="16" width="7" height="5" rx="1" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="M10 6.5h5.5M18 9v3a6 6 0 0 1-6 6H7a4 4 0 0 1-4-4V9"/></svg>',
  },
  {
    id: 'imageAnnotation',
    label: 'Аннотация изображения',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="m4 17 5-5 4 4 3-3 4 4"/><rect x="13" y="6" width="6" height="5" rx="1" stroke="currentColor" stroke-width="2"/></svg>',
  },
  {
    id: 'apiEndpoint',
    label: 'Эндпоинт API',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m8 5-5 7 5 7M16 5l5 7-5 7M14 3l-4 18"/></svg>',
  },
  {
    id: 'fileProcessor',
    label: 'Обработчик файлов',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" d="M6 3h8l4 4v14H6z"/><path stroke="currentColor" stroke-width="2" d="M14 3v5h5M9 12h6M9 16h4"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m4 9-2 3 2 3"/></svg>',
  },
  {
    id: 'taskTable',
    label: 'Доска задач',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="M9 4v16M15 4v16M5 8h2M11 8h2M17 8h2"/></svg>',
  },
];

let apiServerManager: ApiServerManager | undefined;
const openPagePanels = new Map<string, Set<vscode.WebviewPanel>>();

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SlashDocSidebarProvider(context.extensionUri);
  apiServerManager = new ApiServerManager(context.extensionUri);
  void migrateLegacyModules(context.extensionUri)
    .catch((error) => console.error('Failed to migrate legacy Slash Doc modules', error))
    .then(() => apiServerManager?.reload());

  const disposable = vscode.commands.registerCommand(
    'slashDoc.openEditor',
    async (pageId?: string, options?: { focusEditor?: boolean }) => {
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

      if (pageId) {
        const panels = openPagePanels.get(pageId) ?? new Set<vscode.WebviewPanel>();
        panels.add(panel);
        openPagePanels.set(pageId, panels);
        panel.onDidDispose(() => {
          panels.delete(panel);

          if (panels.size === 0) {
            openPagePanels.delete(pageId);
          }
        });
      }

      panel.webview.onDidReceiveMessage(
        async (message: EditorMessage) => {
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
            return;
          }

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

class SlashDocSidebarProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
    };

    webviewView.webview.onDidReceiveMessage(async (message: SidebarMessage) => {
      if (message.type === 'initialize') {
        await this.initializeDocumentation(false);
        await apiServerManager?.reload();
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'openSettings') {
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview, 'settings');
      }

      if (message.type === 'backToMenu') {
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'createPage') {
        const pageId = await this.createPage(message.parentId ?? undefined);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);

        if (pageId) {
          await vscode.commands.executeCommand('slashDoc.openEditor', pageId, { focusEditor: true });
        }
      }

      if (message.type === 'importPage') {
        const pageId = await this.importPageFromFile(message.parentId ?? undefined);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);

        if (pageId) {
          await vscode.commands.executeCommand('slashDoc.openEditor', pageId);
        }
      }

      if (message.type === 'openPage' && message.pageId) {
        await vscode.commands.executeCommand('slashDoc.openEditor', message.pageId);
      }

      if (message.type === 'searchPages' && typeof message.query === 'string') {
        const workspaceRoot = getWorkspaceRoot();
        const results = workspaceRoot ? await searchDocumentation(workspaceRoot, message.query) : [];
        await webviewView.webview.postMessage({ type: 'searchResults', query: message.query, results });
      }

      if (message.type === 'renamePage' && message.pageId) {
        await this.renamePage(message.pageId);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'deletePage' && message.pageId) {
        await this.deletePage(message.pageId);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'movePage' && message.pageId && message.position) {
        await this.movePage(message.pageId, message.targetId ?? undefined, message.position);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'compileDocumentation') {
        await this.compileDocumentation();
      }

      if (message.type === 'updateSettings' && message.settings) {
        await this.updateSettings(message.settings);
      }

      if (message.type === 'createApiService') {
        await this.createApiService();
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview, 'settings');
      }

      if (message.type === 'reloadApiServices') {
        try {
          await apiServerManager?.reload();
          void vscode.window.showInformationMessage('API-сервис Slash Doc перезагружен.');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(`Не удалось перезагрузить API-сервис Slash Doc: ${message}`);
        }
      }

      if (message.type === 'openApiService' && message.serviceId) {
        await this.openApiService(message.serviceId);
      }

      if (message.type === 'createCustomAddon') {
        await this.createCustomAddon();
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview, 'settings');
      }

      if (message.type === 'openCustomAddon' && message.addonId) {
        await this.openCustomAddon(message.addonId);
      }
    });

    void this.getSidebarHtml(webviewView.webview).then((html) => {
      webviewView.webview.html = html;
    });
  }

  async refresh(): Promise<void> {
    if (!this.webviewView) {
      return;
    }

    this.webviewView.webview.html = await this.getSidebarHtml(this.webviewView.webview);
  }

  private async getSidebarHtml(webview: vscode.Webview, view: SidebarView = 'menu'): Promise<string> {
    return getSidebarHtml(webview, this.extensionUri, view);
  }
  private async initializeDocumentation(silent = false): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Откройте папку рабочей области перед инициализацией Slash Doc.');
      return;
    }

    const slashDocRoot = vscode.Uri.joinPath(workspaceRoot, '.slash-doc');
    const docsRoot = vscode.Uri.joinPath(slashDocRoot, 'docs');
    const pagesRoot = vscode.Uri.joinPath(docsRoot, 'pages');

    await vscode.workspace.fs.createDirectory(pagesRoot);
    await vscode.workspace.fs.createDirectory(getGlobalApiRootUri(this.extensionUri));
    await vscode.workspace.fs.createDirectory(getGlobalAddonRootUri(this.extensionUri));
    await writeJsonIfMissing(vscode.Uri.joinPath(slashDocRoot, 'sdsettings.json'), getDefaultSettings());
    await writeJsonIfMissing(vscode.Uri.joinPath(docsRoot, 'menu.json'), {
      items: [],
    });

    if (!silent) {
      void vscode.window.showInformationMessage('Документация Slash Doc инициализирована.');
    }
  }

  private async updateSettings(settings: SlashDocSettings): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    await writeSettings(workspaceRoot, normalizeSettings(settings));
    await apiServerManager?.reload();
  }

  private async createApiService(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    await this.initializeDocumentation(true);

    const name = await vscode.window.showInputBox({
      prompt: 'Название API сервиса',
      value: 'service',
      valueSelection: [0, 'service'.length],
    });

    if (!name) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const id = createSettingsId('service');
    const file = `${slugify(name)}.mjs`;
    const service: ApiService = {
      id,
      name,
      file,
    };

    settings.apiServices.push(service);
    await writeSettings(workspaceRoot, settings);
    await vscode.workspace.fs.createDirectory(getGlobalApiRootUri(this.extensionUri));
    await writeTextIfMissing(getApiServiceUri(this.extensionUri, workspaceRoot, service), getApiRouteTemplate(name));
    await this.openApiService(id);
    await apiServerManager?.reload();
  }

  private async openApiService(serviceId: string): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const service = settings.apiServices.find((item) => item.id === serviceId);

    if (!service) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(
      getApiServiceUri(this.extensionUri, workspaceRoot, service),
    );
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  }

  private async createCustomAddon(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    await this.initializeDocumentation(true);

    const name = await vscode.window.showInputBox({
      prompt: 'Название Editor.js аддона',
      value: 'customTool',
      valueSelection: [0, 'customTool'.length],
    });

    if (!name) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const id = createSettingsId('addon');
    const file = `${slugify(name)}.mjs`;
    const addon: CustomEditorAddon = {
      id,
      name,
      toolName: normalizeToolName(name),
      file,
      enabled: true,
    };

    settings.customEditorAddons.push(addon);
    await writeSettings(workspaceRoot, settings);
    await vscode.workspace.fs.createDirectory(getGlobalAddonRootUri(this.extensionUri));
    await writeTextIfMissing(getCustomAddonUri(this.extensionUri, workspaceRoot, addon), getCustomAddonTemplate(name));
    await this.openCustomAddon(id);
  }

  private async openCustomAddon(addonId: string): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const addon = settings.customEditorAddons.find((item) => item.id === addonId);

    if (!addon) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(
      getCustomAddonUri(this.extensionUri, workspaceRoot, addon),
    );
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  }

  private async createPage(parentId?: string): Promise<string | undefined> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Откройте папку рабочей области перед созданием страницы Slash Doc.');
      return undefined;
    }

    await this.initializeDocumentation(true);

    const title = await vscode.window.showInputBox({
      prompt: 'Название страницы',
      value: 'Новая страница',
      valueSelection: [0, 'Новая страница'.length],
    });

    if (!title) {
      return undefined;
    }

    const menu = await readMenu(workspaceRoot);
    const id = createPageId();
    const file = `${id}/content.json`;
    const item: SlashDocMenuItem = {
      id,
      title,
      file,
      children: [],
    };

    if (parentId && addChildToMenu(menu.items, parentId, item)) {
      await writeMenu(workspaceRoot, menu);
    } else {
      menu.items.push(item);
      await writeMenu(workspaceRoot, menu);
    }

    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), id));
    await writeJsonIfMissing(getPageContentUri(workspaceRoot, id), createNewPageContent(title));

    return id;
  }

  private async movePage(pageId: string, targetId: string | undefined, position: PageMovePosition): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return;
    const menu = await readMenu(workspaceRoot);
    if (moveMenuItem(menu.items, pageId, targetId, position)) {
      await writeMenu(workspaceRoot, menu);
    }
  }

  private async compileDocumentation(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Откройте папку рабочей области перед сборкой документации.');
      return;
    }

    const folders = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceRoot,
      openLabel: 'Собрать документацию сюда',
      title: 'Папка для HTML-документации',
    });
    const outputRoot = folders?.[0];
    if (!outputRoot) return;

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Сборка Slash Doc в HTML…',
        },
        () => compileDocumentationSite(this.extensionUri, workspaceRoot, outputRoot),
      );
      const action = await vscode.window.showInformationMessage(
        `Собрано страниц: ${result.pageCount}.`,
        'Открыть документацию',
      );
      if (action === 'Открыть документацию') {
        await vscode.env.openExternal(result.indexUri);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Не удалось собрать документацию: ${message}`);
    }
  }

  private async importPageFromFile(parentId?: string): Promise<string | undefined> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Откройте папку рабочей области перед импортом страницы Slash Doc.');
      return undefined;
    }

    await this.initializeDocumentation(true);

    const files = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Markdown / HTML': ['md', 'markdown', 'html', 'htm'],
      },
      openLabel: 'Импортировать',
    });

    const file = files?.[0];

    if (!file) {
      return undefined;
    }

    const bytes = await vscode.workspace.fs.readFile(file);
    const text = new TextDecoder().decode(bytes);
    const imported = importDocumentContent(text, file);
    return this.createPageWithContent(imported.title, imported.content, parentId);
  }

  private async deletePage(pageId: string): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    const menu = await readMenu(workspaceRoot);
    const item = findMenuItem(menu.items, pageId);

    if (!item) {
      return;
    }

    const answer = await vscode.window.showWarningMessage(
      `Удалить страницу "${item.title}"?`,
      {
        modal: true,
        detail: 'Страница и все дочерние страницы будут удалены из .slash-doc.',
      },
      'Удалить',
    );

    if (answer !== 'Удалить') {
      return;
    }

    const pageIds = collectMenuItemIds(item);

    if (!removeMenuItem(menu.items, pageId)) {
      return;
    }

    await writeMenu(workspaceRoot, menu);

    for (const id of pageIds) {
      await vscode.workspace.fs
        .delete(vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), id), {
          recursive: true,
          useTrash: false,
        })
        .then(undefined, () => undefined);
    }
  }

  private async renamePage(pageId: string): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    const menu = await readMenu(workspaceRoot);
    const item = findMenuItem(menu.items, pageId);

    if (!item) {
      return;
    }

    const title = await vscode.window.showInputBox({
      prompt: 'Новый заголовок страницы',
      value: item.title,
      valueSelection: [0, item.title.length],
      validateInput: (value) => (value.trim() ? undefined : 'Заголовок не может быть пустым'),
    });

    if (!title?.trim()) {
      return;
    }

    const normalizedTitle = title.trim();
    item.title = normalizedTitle;
    await writeMenu(workspaceRoot, menu);
    const content = await readPageContent(workspaceRoot, pageId, normalizedTitle);
    const updatedContent = updatePageContentTitle(content, normalizedTitle);
    await writeJson(getPageContentUri(workspaceRoot, pageId), updatedContent);

    for (const panel of openPagePanels.get(pageId) ?? []) {
      panel.title = normalizedTitle;
      void panel.webview.postMessage({
        type: 'replaceData',
        data: updatedContent,
      });
    }
  }

  private async createPageWithContent(title: string, content: unknown, parentId?: string): Promise<string> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      throw new Error('Для создания страницы Slash Doc требуется папка рабочей области.');
    }

    const menu = await readMenu(workspaceRoot);
    const id = createPageId();
    const file = `${id}/content.json`;
    const item: SlashDocMenuItem = {
      id,
      title,
      file,
      children: [],
    };

    if (parentId && addChildToMenu(menu.items, parentId, item)) {
      await writeMenu(workspaceRoot, menu);
    } else {
      menu.items.push(item);
      await writeMenu(workspaceRoot, menu);
    }

    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), id));
    await writeJson(getPageContentUri(workspaceRoot, id), content);

    return id;
  }
}
