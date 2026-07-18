import * as vscode from 'vscode';
import type { ApiService, CustomEditorAddon, PageMovePosition, SlashDocMenuItem, SlashDocSettings } from './types';
import { createPageId, createSettingsId } from './utils';
import { getApiRouteTemplate, getCustomAddonTemplate, normalizeSettings, normalizeToolName, slugify } from './settings';
import {
  getApiServiceUri,
  getCustomAddonUri,
  getGlobalAddonRootUri,
  getGlobalApiRootUri,
  getPageContentUri,
  getPagesRootUri,
  getWorkspaceRoot,
  writeJsonIfMissing,
  writeTextIfMissing,
} from './filesystem';
import { addChildToMenu, createNewPageContent, moveMenuItem, readMenu, writeMenu } from './pages';
import { readSettings, writeSettings } from './settings-store';
import { importDocumentContent } from './document-import';
import { searchDocumentation } from './documentation-search';
import { getSidebarHtml } from './sidebar-webview';
import type { ApiServerManager } from './api-server';
import { compileDocumentation, initializeDocumentation } from './sidebar-provider-actions';
import { createSidebarPageWithContent, deleteSidebarPage, renameSidebarPage } from './sidebar-page-actions';

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

export class SlashDocSidebarProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly apiServerManager: ApiServerManager,
    private readonly openPagePanels: Map<string, Set<vscode.WebviewPanel>>,
    private readonly saveOpenPages: () => Promise<boolean>,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist')],
    };

    webviewView.webview.onDidReceiveMessage(async (message: SidebarMessage) => {
      if (message.type === 'initialize') {
        await initializeDocumentation(this.extensionUri, false);
        await this.apiServerManager.reload();
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
        await renameSidebarPage(message.pageId, this.openPagePanels);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'deletePage' && message.pageId) {
        await deleteSidebarPage(message.pageId);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'movePage' && message.pageId && message.position) {
        await this.movePage(message.pageId, message.targetId ?? undefined, message.position);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'compileDocumentation') {
        await compileDocumentation(this.extensionUri, this.saveOpenPages);
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
          await this.apiServerManager.reload();
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
  private async updateSettings(settings: SlashDocSettings): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    await writeSettings(workspaceRoot, normalizeSettings(settings));
    await this.apiServerManager.reload();
  }

  private async createApiService(): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    await initializeDocumentation(this.extensionUri, true);

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
    await this.apiServerManager.reload();
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

    await initializeDocumentation(this.extensionUri, true);

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

    await initializeDocumentation(this.extensionUri, true);

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

  private async importPageFromFile(parentId?: string): Promise<string | undefined> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Откройте папку рабочей области перед импортом страницы Slash Doc.');
      return undefined;
    }

    await initializeDocumentation(this.extensionUri, true);

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
    return createSidebarPageWithContent(imported.title, imported.content, parentId);
  }
}
