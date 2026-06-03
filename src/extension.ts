import * as vscode from 'vscode';
import express = require('express');
import * as puppeteer from 'puppeteer';
import type { Router } from 'express';
import type { Server } from 'http';
import { pathToFileURL } from 'url';

const viewType = 'slashDoc.editor';
const sidebarViewId = 'slashDoc.actions';

type SidebarMessage = {
  type?: string;
  parentId?: string | null;
  pageId?: string | null;
  settings?: SlashDocSettings;
  serviceId?: string | null;
  addonId?: string | null;
  scope?: ApiServiceScope;
};

type SidebarView = 'menu' | 'settings';

type SlashDocMenu = {
  items: SlashDocMenuItem[];
};

type SlashDocMenuItem = {
  id: string;
  title: string;
  file: string;
  children: SlashDocMenuItem[];
};

type EditorMessage = {
  type?: string;
  data?: unknown;
  source?: 'auto' | 'manual';
  format?: ExportFormat;
};

type ExportFormat = 'html' | 'md';

type SlashDocSettings = {
  version: 1;
  editorAddons: {
    header: boolean;
    list: boolean;
    table: boolean;
    image: boolean;
    marker: boolean;
    inlineCode: boolean;
    underline: boolean;
    mermaid: boolean;
  };
  customEditorAddons: CustomEditorAddon[];
  apiPrefix: string;
  apiPort: number;
  apiServices: ApiService[];
  variables: SettingsVariable[];
};

type ApiService = {
  id: string;
  scope: ApiServiceScope;
  name: string;
  file: string;
};

type ApiServiceScope = 'local' | 'global';
type AddonScope = 'local' | 'global';

type CustomEditorAddon = {
  id: string;
  scope: AddonScope;
  name: string;
  toolName: string;
  file: string;
  enabled: boolean;
};

type SettingsVariable = {
  key: string;
  value: string;
};

type EditorAddonDefinition = {
  id: keyof SlashDocSettings['editorAddons'];
  label: string;
  icon: string;
};

type ImportedDocument = {
  title: string;
  content: unknown;
};

type CustomAddonWebviewModule = {
  id: string;
  toolName: string;
  uri: string;
};

const editorAddonDefinitions: EditorAddonDefinition[] = [
  {
    id: 'header',
    label: 'Header',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8 9V7.2C8 7.08954 8.08954 7 8.2 7L12 7M16 9V7.2C16 7.08954 15.9105 7 15.8 7L12 7M12 7L12 17M12 17H10M12 17H14"/></svg>'
  },
  {
    id: 'list',
    label: 'List',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><line x1="9" x2="19" y1="7" y2="7" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="9" x2="19" y1="12" y2="12" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><line x1="9" x2="19" y1="17" y2="17" stroke="currentColor" stroke-linecap="round" stroke-width="2"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 17H4.99002"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 12H4.99002"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M5.00001 7H4.99002"/></svg>'
  },
  {
    id: 'table',
    label: 'Table',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-width="2" d="M10 5V18.5"/><path stroke="currentColor" stroke-width="2" d="M14 5V18.5"/><path stroke="currentColor" stroke-width="2" d="M5 10H19"/><path stroke="currentColor" stroke-width="2" d="M5 14H19"/><rect width="14" height="14" x="5" y="5" stroke="currentColor" stroke-width="2" rx="4"/></svg>'
  },
  {
    id: 'image',
    label: 'Image',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><rect width="14" height="14" x="5" y="5" stroke="currentColor" stroke-width="2" rx="4"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.13968 15.32L8.69058 11.5661C9.02934 11.2036 9.48873 11 9.96774 11C10.4467 11 10.9061 11.2036 11.2449 11.5661L15.3871 16M13.5806 14.0664L15.0132 12.533C15.3519 12.1705 15.8113 11.9668 16.2903 11.9668C16.7693 11.9668 17.2287 12.1705 17.5675 12.533L18.841 13.9634"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.7778 9.33331H13.7867"/></svg>'
  },
  {
    id: 'marker',
    label: 'Marker',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9 17L15 7"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 17H17"/></svg>'
  },
  {
    id: 'inlineCode',
    label: 'Inline Code',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M9.5 8L6.11524 11.8683C6.04926 11.9437 6.04926 12.0563 6.11524 12.1317L9.5 16"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M15 8L18.3848 11.8683C18.4507 11.9437 18.4507 12.0563 18.3848 12.1317L15 16"/></svg>'
  },
  {
    id: 'underline',
    label: 'Underline',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8 5V10C8 12.2091 9.79086 14 12 14C14.2091 14 16 12.2091 16 10V5"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 19H17"/></svg>'
  },
  {
    id: 'mermaid',
    label: 'Mermaid',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 7H17"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 12H17"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 17H17"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4 7H4.01"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4 12H4.01"/><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M4 17H4.01"/></svg>'
  }
];

let apiServerManager: ApiServerManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SlashDocSidebarProvider(context.extensionUri);
  apiServerManager = new ApiServerManager(context.extensionUri);
  void apiServerManager.reload();

  const disposable = vscode.commands.registerCommand('slashDoc.openEditor', async (pageId?: string) => {
    const workspaceRoot = getWorkspaceRoot();
    const menu = workspaceRoot ? await readMenu(workspaceRoot) : { items: [] };
    const page = pageId ? findMenuItem(menu.items, pageId) : undefined;
    const initialData = workspaceRoot && pageId
      ? await readPageContent(workspaceRoot, pageId, page?.title ?? 'Slash Doc')
      : createDefaultPageContent('Slash Doc');
    const settings = workspaceRoot ? await readSettings(workspaceRoot) : getDefaultSettings();

    const panel = vscode.window.createWebviewPanel(
      viewType,
      page?.title ?? 'Slash Doc',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(context.extensionUri, 'assets'),
          getGlobalAddonRootUri(context.extensionUri),
          ...(workspaceRoot ? [getLocalAddonRootUri(workspaceRoot)] : [])
        ]
      }
    );

    panel.webview.onDidReceiveMessage(
      async (message: EditorMessage) => {
        if (message.type !== 'save') {
          if (message.type === 'export' && message.format) {
            const content = await exportPageContent(
              message.data,
              message.format,
              settings,
              context.extensionUri,
              workspaceRoot
            );
            const document = await vscode.workspace.openTextDocument({
              content,
              language: message.format === 'html' ? 'html' : 'markdown'
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
      context.subscriptions
    );

    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, workspaceRoot, initialData, settings);
  });

  const sidebarRegistration = vscode.window.registerWebviewViewProvider(sidebarViewId, sidebarProvider);

  context.subscriptions.push(disposable, sidebarRegistration, {
    dispose: () => {
      void apiServerManager?.dispose();
    }
  });
}

export function deactivate() {
  return apiServerManager?.dispose();
}

function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined,
  initialData: unknown,
  settings: SlashDocSettings
): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'slash-doc.svg'));
  const nonce = getNonce();
  const initialDataJson = escapeScriptJson(initialData);
  const settingsJson = escapeScriptJson(settings);
  const customAddonsJson = escapeScriptJson(getCustomAddonWebviewModules(webview, extensionUri, workspaceRoot, settings));

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource};">
    <title>Slash Doc</title>
    <style>
      :root {
        --surface: var(--vscode-sideBar-background, var(--vscode-editor-background));
        --surface-raised: var(--vscode-editorWidget-background, var(--vscode-editor-background));
        --border: var(--vscode-panel-border, color-mix(in srgb, var(--vscode-editor-foreground) 16%, transparent));
        --focus-ring: var(--vscode-focusBorder, var(--vscode-button-background));

        --sl-font-sans: var(--vscode-font-family);
        --sl-font-size-small: var(--vscode-font-size);
        --sl-font-size-medium: var(--vscode-font-size);
        --sl-font-weight-normal: 400;
        --sl-font-weight-semibold: 600;
        --sl-input-height-small: 26px;
        --sl-line-height-small: 1;
        --sl-line-height-normal: 1;
        --sl-spacing-2x-small: 4px;
        --sl-spacing-x-small: 6px;
        --sl-spacing-small: 8px;
        --sl-border-radius-small: 2px;
        --sl-border-radius-medium: 2px;
        --sl-focus-ring-color: var(--focus-ring);
        --sl-focus-ring-width: 1px;
        --sl-focus-ring-offset: 1px;

        --sl-color-primary-600: var(--vscode-button-background);
        --sl-color-primary-700: var(--vscode-button-hoverBackground, var(--vscode-button-background));
        --sl-color-primary-500: var(--vscode-button-background);
        --sl-color-neutral-0: var(--vscode-button-foreground);
        --sl-color-neutral-50: var(--vscode-input-background, var(--surface-raised));
        --sl-color-neutral-100: var(--vscode-input-background, var(--surface-raised));
        --sl-color-neutral-200: var(--vscode-input-border, var(--border));
        --sl-color-neutral-300: var(--vscode-input-border, var(--border));
        --sl-color-neutral-600: var(--vscode-foreground);
        --sl-color-neutral-700: var(--vscode-foreground);
        --sl-color-neutral-800: var(--vscode-foreground);
        --sl-color-neutral-900: var(--vscode-foreground);

        --color-border: var(--border);
        --color-bg-main: var(--vscode-editor-background);
        --color-bg-secondary: var(--vscode-editorWidget-background, var(--vscode-editor-background));
        --color-text-main: var(--vscode-editor-foreground);
        --color-text-secondary: var(--vscode-descriptionForeground);
      }

      body {
        overflow: auto;
        min-height: 100vh;
        margin: 0;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
      }

      .shell {
        min-height: 100vh;
      }

      .toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border);
        background: var(--surface);
      }

      .title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .title-icon {
        display: inline-block;
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        background: var(--vscode-icon-foreground, var(--vscode-editor-foreground));
        -webkit-mask: url("${iconUri}") center / contain no-repeat;
        mask: url("${iconUri}") center / contain no-repeat;
      }

      .export-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .export-button {
        box-sizing: border-box;
        height: 24px;
        padding: 0 10px;
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--vscode-button-border, var(--vscode-input-border, transparent));
        border-radius: 2px;
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
        font: inherit;
        cursor: pointer;
      }

      .export-button:hover {
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      .export-button:focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: 2px;
      }

      sl-button::part(base) {
        min-width: 0;
        min-height: 24px;
        padding: 4px 10px;
        border-radius: 2px;
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        font-weight: 400;
        line-height: normal;
        box-shadow: none;
        transition: none;
      }

      sl-button::part(label) {
        padding: 0;
      }

      sl-button[variant="default"]::part(base) {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      sl-button[variant="default"]::part(base):hover {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      sl-button[variant="primary"]::part(base) {
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
      }

      sl-button[variant="default"]::part(base) {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      sl-button[variant="default"]::part(base):hover {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      sl-button[variant="primary"]::part(base):hover {
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-border, transparent);
        background: var(--vscode-button-hoverBackground);
      }

      sl-button[variant="default"]::part(base) {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      sl-button[variant="default"]::part(base):hover {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      sl-button::part(base):focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: 2px;
      }

      #editor {
        width: min(860px, 100vw);
        margin: 0 auto 48px;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
      }

      .ce-block__content,
      .ce-toolbar__content {
        max-width: 760px;
      }

      .codex-editor,
      .codex-editor__redactor {
        color: var(--vscode-editor-foreground);
      }

      .ce-paragraph,
      .ce-header,
      .cdx-list,
      .tc-table {
        color: var(--vscode-editor-foreground);
      }

      .ce-toolbar__plus,
      .ce-toolbar__settings-btn,
      .ce-inline-toolbar__button,
      .ce-popover__item,
      .ce-popover-item,
      .ce-inline-tool,
      .ce-conversion-tool,
      .ce-settings__button,
      .cdx-settings-button {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground)) !important;
        background: transparent !important;
      }

      .ce-toolbar__plus:hover,
      .ce-toolbar__settings-btn:hover,
      .ce-inline-toolbar__button:hover,
      .ce-inline-toolbar__button--active,
      .ce-popover__item:hover,
      .ce-popover-item:hover,
      .ce-popover-item--focused,
      .ce-popover-item--active,
      .ce-inline-tool:hover,
      .ce-inline-tool--active,
      .ce-conversion-tool:hover,
      .ce-conversion-tool--focused,
      .ce-settings__button:hover,
      .cdx-settings-button:hover,
      .cdx-settings-button--active {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground)) !important;
        background: var(--vscode-list-hoverBackground) !important;
      }

      .ce-popover,
      .ce-popover__container,
      .ce-popover__items,
      .ce-inline-toolbar,
      .ce-inline-toolbar__dropdown,
      .ce-inline-toolbar__toggler-and-button-wrapper,
      .ce-conversion-toolbar,
      .ce-conversion-toolbar__tools,
      .ce-settings,
      .cdx-settings {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground)) !important;
        border-color: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border))) !important;
        background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background, var(--vscode-editor-background))) !important;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--vscode-editor-background) 45%, transparent);
      }

      .ce-popover__search,
      .ce-popover__nothing-found-message,
      .ce-conversion-toolbar__label {
        color: var(--vscode-descriptionForeground) !important;
        background: var(--vscode-input-background) !important;
      }

      .ce-popover__search input,
      .ce-popover__search input::placeholder {
        color: var(--vscode-input-foreground) !important;
      }

      .ce-block--selected .ce-block__content,
      .ce-block--focused .ce-block__content {
        background: var(--vscode-editor-selectionBackground);
      }

      .tc-table,
      .tc-row,
      .tc-cell {
        border-color: var(--vscode-panel-border, var(--border));
      }

      .tc-wrap {
        --color-background: var(--vscode-list-hoverBackground);
        --color-text-secondary: var(--vscode-descriptionForeground);
        --color-border: var(--vscode-panel-border, var(--border));
        color: var(--vscode-editor-foreground);
      }

      .tc-table--heading .tc-row:first-child,
      .tc-add-column svg {
        background: var(--vscode-editor-background);
      }

      .tc-add-column,
      .tc-add-row,
      .tc-toolbox__toggler {
        color: var(--vscode-descriptionForeground);
      }

      .tc-add-column:hover,
      .tc-add-column:hover svg,
      .tc-add-column:focus-within,
      .tc-add-column:focus-within svg,
      .tc-add-row:hover,
      .tc-add-row:hover svg,
      .tc-add-row:focus-within,
      .tc-add-row:focus-within svg,
      .tc-add-row:hover::before,
      .tc-row--selected,
      .tc-row--selected::after {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground)) !important;
        background: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground, var(--vscode-editorWidget-background))) !important;
        background-color: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground, var(--vscode-editorWidget-background))) !important;
      }

      .tc-add-column:hover,
      .tc-add-column:hover svg,
      .tc-add-column:focus-within,
      .tc-add-column:focus-within svg {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground)) !important;
        background-color: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground, var(--vscode-editorWidget-background))) !important;
      }

      .tc-cell--selected,
      .tc-cell--selected::after {
        background: var(--vscode-editor-selectionBackground);
      }

      .tc-popover {
        --color-background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background, var(--vscode-editor-background)));
        --color-background-hover: var(--vscode-list-hoverBackground);
        --color-border: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border)));
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
        border-color: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border))) !important;
        background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background, var(--vscode-editor-background))) !important;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--vscode-editor-background) 45%, transparent);
      }

      .tc-popover__item {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
      }

      .tc-popover__item:hover {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
        background: var(--vscode-list-hoverBackground) !important;
      }

      .tc-popover__item-icon {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
        border-color: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border)));
        background: var(--vscode-input-background);
      }

      .image-tool__image,
      .image-tool__caption,
      .cdx-input {
        color: var(--vscode-input-foreground);
        border-color: var(--vscode-input-border, var(--border));
        background: var(--vscode-input-background);
        box-shadow: none;
      }

      .slash-mermaid-tool {
        display: grid;
        gap: 8px;
        color: var(--vscode-editor-foreground);
      }

      .slash-mermaid-code,
      .slash-mermaid-caption {
        box-sizing: border-box;
        width: 100%;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 2px;
        background: var(--vscode-input-background);
        font: inherit;
      }

      .slash-mermaid-code {
        min-height: 140px;
        padding: 8px;
        resize: vertical;
        font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
      }

      .slash-mermaid-caption {
        height: 24px;
        padding: 2px 6px;
      }

      .slash-mermaid-code:focus,
      .slash-mermaid-caption:focus {
        outline: 1px solid var(--focus-ring);
        outline-offset: -1px;
      }

      .slash-mermaid-preview {
        min-height: 40px;
        overflow: auto;
        padding: 8px;
        color: var(--vscode-editor-foreground);
        border: 1px solid var(--vscode-panel-border, var(--border));
        border-radius: 2px;
        background: var(--vscode-editor-background);
      }

      .slash-mermaid-preview svg {
        max-width: 100%;
        height: auto;
      }

      .cdx-marker {
        color: var(--vscode-editor-foreground);
        background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #ffcc00) 28%, transparent);
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="toolbar">
        <h1 class="title">
          <span class="title-icon" aria-hidden="true"></span>
          <span>Slash Doc</span>
        </h1>
        <div class="export-actions">
          <button class="export-button" type="button" id="export-html">HTML</button>
          <button class="export-button" type="button" id="export-md">MD</button>
        </div>
      </header>
      <section id="editor" aria-label="Document editor"></section>
    </main>
    <script nonce="${nonce}">
      window.__SLASH_DOC_INITIAL_DATA__ = ${initialDataJson};
      window.__SLASH_DOC_SETTINGS__ = ${settingsJson};
      window.__SLASH_DOC_CUSTOM_ADDONS__ = ${customAddonsJson};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

class SlashDocSidebarProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist')
      ]
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
          await vscode.commands.executeCommand('slashDoc.openEditor', pageId);
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

      if (message.type === 'deletePage' && message.pageId) {
        await this.deletePage(message.pageId);
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview);
      }

      if (message.type === 'updateSettings' && message.settings) {
        await this.updateSettings(message.settings);
      }

      if (message.type === 'createApiService') {
        await this.createApiService(message.scope ?? 'global');
        webviewView.webview.html = await this.getSidebarHtml(webviewView.webview, 'settings');
      }

      if (message.type === 'openApiService' && message.serviceId) {
        await this.openApiService(message.serviceId);
      }

      if (message.type === 'createCustomAddon') {
        await this.createCustomAddon(message.scope === 'global' ? 'global' : 'local');
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
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'sidebar.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'sidebar.css'));
    const nonce = getNonce();
    const workspaceRoot = getWorkspaceRoot();
    const isInitialized = workspaceRoot ? await pathExists(vscode.Uri.joinPath(workspaceRoot, '.slash-doc')) : false;
    const menu = workspaceRoot && isInitialized ? await readMenu(workspaceRoot) : undefined;
    const settings = workspaceRoot && isInitialized ? await readSettings(workspaceRoot) : getDefaultSettings();

    const content = workspaceRoot
      ? isInitialized
        ? view === 'settings'
          ? renderSettingsPanel(settings)
          : `<div class="panel panel-ready">
            <div class="menu-panel">
              <div class="actions-row">
                <sl-button id="create-page" size="small" variant="primary">Создать страницу</sl-button>
                <sl-button id="import-page" size="small" variant="default">Импорт</sl-button>
              </div>
              <nav class="tree" aria-label="Страницы">
                ${renderMenuTree(menu?.items ?? [])}
              </nav>
            </div>
            <div class="settings-button-row">
              <sl-button id="open-settings" size="small" variant="default">Настройки</sl-button>
            </div>
          </div>`
        : `<div class="panel panel-empty">
            <sl-button id="initialize" size="small" variant="primary">Инициализировать документацию</sl-button>
          </div>`
      : `<div class="panel panel-empty">
          <p class="empty-text">Откройте папку проекта</p>
        </div>`;

    return /* html */ `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
    <link rel="stylesheet" href="${styleUri}">
    <title>Slash Doc</title>
    <style>
      :root {
        --focus-ring: var(--vscode-focusBorder, var(--vscode-button-background));

        --sl-font-sans: var(--vscode-font-family);
        --sl-font-size-small: var(--vscode-font-size);
        --sl-font-size-medium: var(--vscode-font-size);
        --sl-input-height-small: 24px;
        --sl-line-height-small: 1;
        --sl-line-height-normal: 1;
        --sl-spacing-2x-small: 4px;
        --sl-spacing-x-small: 6px;
        --sl-spacing-small: 8px;
        --sl-border-radius-small: 2px;
        --sl-border-radius-medium: 2px;
        --sl-focus-ring-color: var(--focus-ring);
        --sl-focus-ring-width: 1px;
        --sl-focus-ring-offset: 1px;

        --sl-color-primary-600: var(--vscode-button-background);
        --sl-color-primary-700: var(--vscode-button-hoverBackground, var(--vscode-button-background));
        --sl-color-primary-500: var(--vscode-button-background);
        --sl-color-neutral-0: var(--vscode-button-foreground);
        --sl-color-neutral-600: var(--vscode-foreground);
        --sl-color-neutral-700: var(--vscode-foreground);
        --sl-color-neutral-800: var(--vscode-foreground);
        --sl-color-neutral-900: var(--vscode-foreground);
      }

      body {
        min-height: 100vh;
        margin: 0;
        color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
        background: var(--vscode-sideBar-background, var(--vscode-editor-background));
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }

      .panel {
        box-sizing: border-box;
        min-height: 100vh;
        padding: 0;
      }

      .panel-empty {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .panel-ready {
        display: grid;
        grid-template-rows: minmax(120px, 1fr) auto;
        gap: 12px;
      }

      .panel-settings {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 12px;
      }

      .menu-panel {
        display: grid;
        grid-template-rows: auto 1fr;
        min-height: 0;
        gap: 10px;
      }

      .actions-row {
        display: flex;
        min-width: 0;
      }

      .settings-button-row {
        display: flex;
        min-width: 0;
        padding-top: 12px;
        border-top: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      }

      .empty-text {
        margin: 0;
        color: var(--vscode-descriptionForeground);
        text-align: center;
      }

      sl-button {
        flex: 1;
        max-width: 100%;
      }

      sl-button::part(base) {
        min-width: 0;
        min-height: 24px;
        padding: 4px 10px;
        border-radius: 2px;
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        font-weight: 400;
        line-height: normal;
        box-shadow: none;
        transition: none;
      }

      sl-button::part(label) {
        overflow: hidden;
        padding: 0;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      sl-button[variant="primary"]::part(base) {
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
      }

      sl-button[variant="primary"]::part(base):hover {
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-border, transparent);
        background: var(--vscode-button-hoverBackground);
      }

      sl-button[variant="default"]::part(base) {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      sl-button[variant="default"]::part(base):hover {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      sl-button::part(base):focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: 2px;
      }

      .tree {
        min-width: 0;
        overflow: auto;
      }

      .tree-list {
        display: grid;
        gap: 1px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .tree-list .tree-list {
        margin-left: 12px;
      }

      .tree-node {
        min-width: 0;
      }

      .tree-row {
        display: flex;
        align-items: center;
        gap: 2px;
        min-width: 0;
      }

      .tree-item {
        display: flex;
        align-items: center;
        flex: 1 1 auto;
        width: 100%;
        min-width: 0;
        min-height: 22px;
        padding: 2px 6px;
        color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
        border: 0;
        border-radius: 2px;
        background: transparent;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .tree-item:hover {
        background: var(--vscode-list-hoverBackground);
      }

      .tree-item:focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: -1px;
      }

      .tree-item[aria-selected="true"] {
        color: var(--vscode-list-activeSelectionForeground, var(--vscode-sideBar-foreground));
        background: var(--vscode-list-activeSelectionBackground);
      }

      .tree-delete {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 22px;
        width: 22px;
        height: 22px;
        padding: 0;
        color: var(--vscode-descriptionForeground);
        border: 0;
        border-radius: 2px;
        background: transparent;
        cursor: pointer;
        opacity: 0;
      }

      .tree-row:hover .tree-delete,
      .tree-delete:focus-visible {
        opacity: 1;
      }

      .tree-delete:hover {
        color: var(--vscode-errorForeground, var(--vscode-foreground));
        background: var(--vscode-list-hoverBackground);
      }

      .tree-delete:focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: -1px;
      }

      .tree-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tree-empty {
        margin: 4px 0 0;
        color: var(--vscode-descriptionForeground);
      }

      .settings-panel {
        display: grid;
        align-items: start;
        gap: 12px;
        min-width: 0;
        overflow: auto;
      }

      .settings-panel sl-button {
        justify-self: start;
      }

      .settings-header {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .settings-header sl-button {
        flex: 0 0 auto;
      }

      .settings-title {
        margin: 0;
        color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-sideBar-foreground));
        font-size: var(--vscode-font-size);
        font-weight: 600;
      }

      .settings-group {
        display: grid;
        align-items: start;
        gap: 6px;
        min-width: 0;
      }

      .settings-list {
        display: grid;
        align-items: start;
        gap: 6px;
      }

      .settings-group-title {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        text-transform: uppercase;
      }

      .addon-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 24px;
      }

      .addon-info {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      .addon-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        color: var(--vscode-icon-foreground, currentColor);
        flex: 0 0 auto;
      }

      .addon-icon svg {
        width: 16px;
        height: 16px;
      }

      .addon-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .settings-row {
        display: grid;
        align-items: start;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 6px;
      }

      .service-row {
        grid-template-columns: 72px minmax(0, 1fr) minmax(0, 1.2fr) auto;
      }

      .custom-addon-row {
        grid-template-columns: 72px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) auto auto;
      }

      .api-settings-row {
        grid-template-columns: minmax(0, 1fr) 72px;
      }

      .settings-input {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        height: 24px;
        padding: 2px 6px;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, transparent);
        border-radius: 2px;
        background: var(--vscode-input-background);
        font: inherit;
      }

      .settings-input:focus {
        outline: 1px solid var(--focus-ring);
        outline-offset: -1px;
      }

      .settings-open-button {
        box-sizing: border-box;
        height: 24px;
        padding: 0 8px;
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--vscode-button-border, var(--vscode-input-border, transparent));
        border-radius: 2px;
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
        font: inherit;
        cursor: pointer;
      }

      .settings-open-button:hover {
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      .service-actions {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        min-width: 0;
      }

      .service-actions sl-button {
        flex: 0 1 auto;
      }

      sl-switch::part(base) {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }

      sl-switch::part(control) {
        border-color: var(--vscode-input-border, transparent);
        background: var(--vscode-input-background);
      }

      sl-switch[checked]::part(control) {
        border-color: var(--vscode-button-background);
        background: var(--vscode-button-background);
      }
    </style>
  </head>
  <body>
    ${content}
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  private async initializeDocumentation(silent = false): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Open a workspace folder before initializing Slash Doc.');
      return;
    }

    const slashDocRoot = vscode.Uri.joinPath(workspaceRoot, '.slash-doc');
    const docsRoot = vscode.Uri.joinPath(slashDocRoot, 'docs');
    const pagesRoot = vscode.Uri.joinPath(docsRoot, 'pages');
    const localApiRoot = getLocalApiRootUri(workspaceRoot);
    const localAddonRoot = getLocalAddonRootUri(workspaceRoot);

    await vscode.workspace.fs.createDirectory(pagesRoot);
    await vscode.workspace.fs.createDirectory(localApiRoot);
    await vscode.workspace.fs.createDirectory(localAddonRoot);
    await writeJsonIfMissing(vscode.Uri.joinPath(slashDocRoot, 'sdsettings.json'), getDefaultSettings());
    await writeJsonIfMissing(vscode.Uri.joinPath(docsRoot, 'menu.json'), {
      items: []
    });

    if (!silent) {
      void vscode.window.showInformationMessage('Slash Doc documentation initialized.');
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

  private async createApiService(scope: ApiServiceScope): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    await this.initializeDocumentation(true);

    const name = await vscode.window.showInputBox({
      prompt: 'Название API сервиса',
      value: 'service',
      valueSelection: [0, 'service'.length]
    });

    if (!name) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const id = createSettingsId('service');
    const file = `${slugify(name)}.mjs`;
    const service: ApiService = {
      id,
      scope,
      name,
      file
    };

    settings.apiServices.push(service);
    await writeSettings(workspaceRoot, settings);
    await vscode.workspace.fs.createDirectory(getApiRootUri(this.extensionUri, workspaceRoot, scope));
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

    const document = await vscode.workspace.openTextDocument(getApiServiceUri(this.extensionUri, workspaceRoot, service));
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  }

  private async createCustomAddon(scope: AddonScope): Promise<void> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      return;
    }

    await this.initializeDocumentation(true);

    const name = await vscode.window.showInputBox({
      prompt: 'Название Editor.js аддона',
      value: 'customTool',
      valueSelection: [0, 'customTool'.length]
    });

    if (!name) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const id = createSettingsId('addon');
    const file = `${slugify(name)}.mjs`;
    const addon: CustomEditorAddon = {
      id,
      scope,
      name,
      toolName: normalizeToolName(name),
      file,
      enabled: true
    };

    settings.customEditorAddons.push(addon);
    await writeSettings(workspaceRoot, settings);
    await vscode.workspace.fs.createDirectory(getAddonRootUri(this.extensionUri, workspaceRoot, scope));
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

    const document = await vscode.workspace.openTextDocument(getCustomAddonUri(this.extensionUri, workspaceRoot, addon));
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  }

  private async createPage(parentId?: string): Promise<string | undefined> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Open a workspace folder before creating a Slash Doc page.');
      return undefined;
    }

    await this.initializeDocumentation(true);

    const title = await vscode.window.showInputBox({
      prompt: 'Название страницы',
      value: 'Новая страница',
      valueSelection: [0, 'Новая страница'.length]
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
      children: []
    };

    if (parentId && addChildToMenu(menu.items, parentId, item)) {
      await writeMenu(workspaceRoot, menu);
    } else {
      menu.items.push(item);
      await writeMenu(workspaceRoot, menu);
    }

    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), id));
    await writeJsonIfMissing(getPageContentUri(workspaceRoot, id), createDefaultPageContent(title));

    return id;
  }

  private async importPageFromFile(parentId?: string): Promise<string | undefined> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      void vscode.window.showWarningMessage('Open a workspace folder before importing a Slash Doc page.');
      return undefined;
    }

    await this.initializeDocumentation(true);

    const files = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Markdown / HTML': ['md', 'markdown', 'html', 'htm']
      },
      openLabel: 'Импортировать'
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
        detail: 'Страница и все дочерние страницы будут удалены из .slash-doc.'
      },
      'Удалить'
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
      await vscode.workspace.fs.delete(vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), id), {
        recursive: true,
        useTrash: false
      }).then(undefined, () => undefined);
    }
  }

  private async createPageWithContent(title: string, content: unknown, parentId?: string): Promise<string> {
    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot) {
      throw new Error('Workspace folder is required to create a Slash Doc page.');
    }

    const menu = await readMenu(workspaceRoot);
    const id = createPageId();
    const file = `${id}/content.json`;
    const item: SlashDocMenuItem = {
      id,
      title,
      file,
      children: []
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

class ApiServerManager {
  private server?: Server;

  constructor(private readonly extensionUri: vscode.Uri) {}

  async reload(): Promise<void> {
    await this.dispose();

    const workspaceRoot = getWorkspaceRoot();

    if (!workspaceRoot || !(await pathExists(vscode.Uri.joinPath(workspaceRoot, '.slash-doc')))) {
      return;
    }

    const settings = await readSettings(workspaceRoot);
    const app = express();
    app.use(express.json());

    const context = {
      extensionUri: this.extensionUri.fsPath,
      workspaceRoot: workspaceRoot.fsPath,
      globalApiRoot: getGlobalApiRootUri(this.extensionUri).fsPath,
      localApiRoot: getLocalApiRootUri(workspaceRoot).fsPath,
      puppeteer,
      variables: Object.fromEntries(settings.variables.map((item) => [item.key, item.value])),
      settings
    };

    app.get('/__slash-doc/health', (_request, response) => {
      response.json({
        ok: true,
        prefix: settings.apiPrefix
      });
    });

    for (const service of settings.apiServices) {
      try {
        await mountApiService(app, this.extensionUri, workspaceRoot, settings.apiPrefix, service, context);
      } catch (error) {
        console.error(`Failed to mount Slash Doc API service ${service.file}`, error);
      }
    }

    this.server = app.listen(settings.apiPort);
  }

  async dispose(): Promise<void> {
    const server = this.server;
    this.server = undefined;

    if (!server) {
      return;
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

async function exportPageContent(
  data: unknown,
  format: ExportFormat,
  settings: SlashDocSettings,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined
): Promise<string> {
  const blocks = getEditorBlocks(data);
  const rendered = await Promise.all(blocks.map((block) => exportBlock(block, format, settings, extensionUri, workspaceRoot)));

  if (format === 'html') {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(getExportTitle(blocks))}</title>
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
  workspaceRoot: vscode.Uri | undefined
): Promise<string> {
  const custom = workspaceRoot
    ? await exportCustomBlock(block, format, settings, extensionUri, workspaceRoot)
    : undefined;

  if (custom !== undefined) {
    return custom;
  }

  const type = typeof block.type === 'string' ? block.type : '';
  const data = isRecord(block.data) ? block.data : {};

  if (format === 'html') {
    return exportBuiltInBlockToHtml(type, data);
  }

  return exportBuiltInBlockToMarkdown(type, data);
}

async function exportCustomBlock(
  block: Record<string, unknown>,
  format: ExportFormat,
  settings: SlashDocSettings,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri
): Promise<string | undefined> {
  const type = typeof block.type === 'string' ? block.type : '';
  const addon = settings.customEditorAddons.find((item) => item.enabled && item.toolName === type);

  if (!addon) {
    return undefined;
  }

  const moduleUrl = `${pathToFileURL(getCustomAddonUri(extensionUri, workspaceRoot, addon).fsPath).href}?v=${Date.now()}`;
  const adapterModule = await import(moduleUrl) as Record<string, unknown>;
  const adapters = isRecord(adapterModule.adapters) ? adapterModule.adapters : {};
  const adapter = format === 'html'
    ? adapterModule.toHtml ?? adapters.html
    : adapterModule.toMarkdown ?? adapters.md ?? adapters.markdown;

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

  if (type === 'table') {
    const rows = Array.isArray(data.content) ? data.content : [];
    return `<table>${rows.map((row) => {
      const cells = Array.isArray(row) ? row : [];
      return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    }).join('')}</table>`;
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
      .map((item, index) => data.style === 'ordered' ? `${index + 1}. ${htmlToMarkdownInline(item)}` : `- ${htmlToMarkdownInline(item)}`)
      .join('\n');
  }

  if (type === 'table') {
    const rows = Array.isArray(data.content) ? data.content.filter(Array.isArray) as unknown[][] : [];

    if (rows.length === 0) {
      return '';
    }

    const normalizedRows = rows.map((row) => row.map((cell) => htmlToMarkdownInline(String(cell ?? ''))));
    const header = normalizedRows[0];
    const separator = header.map(() => '---');
    return [header, separator, ...normalizedRows.slice(1)]
      .map((row) => `| ${row.join(' | ')} |`)
      .join('\n');
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

  return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

function getEditorBlocks(data: unknown): Record<string, unknown>[] {
  if (!isRecord(data) || !Array.isArray(data.blocks)) {
    return [];
  }

  return data.blocks.filter((block): block is Record<string, unknown> => isRecord(block));
}

function getExportTitle(blocks: Record<string, unknown>[]): string {
  const firstHeader = blocks.find((block) => block.type === 'header' && isRecord(block.data));
  const text = firstHeader && isRecord(firstHeader.data) && typeof firstHeader.data.text === 'string'
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
  return stripHtml(
    value
      .replaceAll(/<b>(.*?)<\/b>/g, '**$1**')
      .replaceAll(/<strong>(.*?)<\/strong>/g, '**$1**')
      .replaceAll(/<i>(.*?)<\/i>/g, '_$1_')
      .replaceAll(/<em>(.*?)<\/em>/g, '_$1_')
      .replaceAll(/<code>(.*?)<\/code>/g, '`$1`')
      .replaceAll(/<mark[^>]*>(.*?)<\/mark>/g, '==$1==')
  );
}

function importDocumentContent(text: string, source: vscode.Uri): ImportedDocument {
  const extension = source.fsPath.split('.').pop()?.toLowerCase() ?? '';
  const blocks = extension === 'html' || extension === 'htm'
    ? importHtmlBlocks(text)
    : importMarkdownBlocks(text);
  const fallbackTitle = getFileTitle(source);
  const title = getImportTitle(blocks) || fallbackTitle;
  const normalizedBlocks = blocks.length > 0 ? blocks : [
    createEditorBlock('header', {
      text: escapeHtml(title),
      level: 2
    })
  ];

  if (!getImportTitle(normalizedBlocks)) {
    normalizedBlocks.unshift(createEditorBlock('header', {
      text: escapeHtml(title),
      level: 2
    }));
  }

  return {
    title,
    content: {
      time: Date.now(),
      blocks: normalizedBlocks,
      version: '2.30.8'
    }
  };
}

function importMarkdownBlocks(markdown: string): Record<string, unknown>[] {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const blocks: Record<string, unknown>[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim();
    paragraph = [];

    if (text) {
      blocks.push(createEditorBlock('paragraph', {
        text: markdownInlineToHtml(text)
      }));
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (/^```mermaid\s*$/i.test(trimmed)) {
      flushParagraph();
      const code: string[] = [];
      index += 1;

      while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }

      blocks.push(createEditorBlock('mermaid', {
        code: code.join('\n'),
        caption: ''
      }));
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);

    if (heading) {
      flushParagraph();
      blocks.push(createEditorBlock('header', {
        text: markdownInlineToHtml(heading[2].trim()),
        level: heading[1].length
      }));
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);

    if (image) {
      flushParagraph();
      blocks.push(createEditorBlock('image', {
        file: {
          url: image[2].trim()
        },
        caption: markdownInlineToHtml(image[1].trim()),
        withBorder: false,
        withBackground: false,
        stretched: false
      }));
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      flushParagraph();
      const tableLines: string[] = [];

      while (index < lines.length && isMarkdownTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      index -= 1;
      blocks.push(createEditorBlock('table', {
        withHeadings: true,
        content: markdownTableToRows(tableLines)
      }));
      continue;
    }

    const list = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(line);

    if (list) {
      flushParagraph();
      const ordered = /\d+[.)]/.test(list[2]);
      const items: string[] = [];

      while (index < lines.length) {
        const item = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(lines[index]);

        if (!item || /\d+[.)]/.test(item[2]) !== ordered) {
          break;
        }

        items.push(markdownInlineToHtml(item[3].trim()));
        index += 1;
      }

      index -= 1;
      blocks.push(createEditorBlock('list', {
        style: ordered ? 'ordered' : 'unordered',
        items
      }));
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

function importHtmlBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const body = extractHtmlBody(html)
    .replaceAll(/<script[\s\S]*?<\/script>/gi, '')
    .replaceAll(/<style[\s\S]*?<\/style>/gi, '');
  const blockPattern = /<(h[1-6]|p|ul|ol|table|figure|pre|img)\b[^>]*>([\s\S]*?)(?:<\/\1>)?|<img\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(body)) !== null) {
    const tag = (match[1] ?? 'img').toLowerCase();
    const outer = match[0];
    const inner = match[2] ?? '';

    if (/^h[1-6]$/.test(tag)) {
      blocks.push(createEditorBlock('header', {
        text: cleanEditorHtml(inner),
        level: Number(tag.slice(1))
      }));
      continue;
    }

    if (tag === 'p') {
      const text = cleanEditorHtml(inner);

      if (stripHtml(text).trim()) {
        blocks.push(createEditorBlock('paragraph', { text }));
      }

      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      blocks.push(createEditorBlock('list', {
        style: tag === 'ol' ? 'ordered' : 'unordered',
        items: extractHtmlListItems(inner)
      }));
      continue;
    }

    if (tag === 'table') {
      blocks.push(createEditorBlock('table', {
        withHeadings: /<th\b/i.test(inner),
        content: extractHtmlTableRows(inner)
      }));
      continue;
    }

    if (tag === 'pre' && /\bclass\s*=\s*["'][^"']*\bmermaid\b/i.test(outer)) {
      blocks.push(createEditorBlock('mermaid', {
        code: stripHtml(decodeHtmlEntities(inner)).trim(),
        caption: ''
      }));
      continue;
    }

    if (tag === 'figure' || tag === 'img') {
      const imageHtml = tag === 'img' ? outer : outer.match(/<img\b[^>]*>/i)?.[0] ?? '';
      const url = getHtmlAttribute(imageHtml, 'src');

      if (url) {
        blocks.push(createEditorBlock('image', {
          file: { url },
          caption: tag === 'figure' ? cleanEditorHtml(outer.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '') : getHtmlAttribute(imageHtml, 'alt'),
          withBorder: false,
          withBackground: false,
          stretched: false
        }));
      }
    }
  }

  if (blocks.length === 0) {
    const text = cleanEditorHtml(body);

    if (stripHtml(text).trim()) {
      blocks.push(createEditorBlock('paragraph', { text }));
    }
  }

  return blocks;
}

function createEditorBlock(type: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    id: createPageId(),
    type,
    data
  };
}

function markdownInlineToHtml(value: string): string {
  return escapeHtml(value)
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replaceAll(/__([^_]+)__/g, '<b>$1</b>')
    .replaceAll(/\*([^*]+)\*/g, '<i>$1</i>')
    .replaceAll(/_([^_]+)_/g, '<i>$1</i>')
    .replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  return isMarkdownTableLine(lines[index]) && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]);
}

function isMarkdownTableLine(line: string): boolean {
  return line.includes('|') && line.trim().length > 0;
}

function markdownTableToRows(lines: string[]): string[][] {
  return lines
    .filter((line, index) => index !== 1)
    .map((line) => line.trim().replaceAll(/^\||\|$/g, '').split('|').map((cell) => markdownInlineToHtml(cell.trim())))
    .filter((row) => row.some((cell) => stripHtml(cell).trim().length > 0));
}

function extractHtmlBody(html: string): string {
  return /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
}

function extractHtmlListItems(html: string): string[] {
  const items: string[] = [];
  const itemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) !== null) {
    items.push(cleanEditorHtml(match[1]));
  }

  return items;
}

function extractHtmlTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row: string[] = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      row.push(cleanEditorHtml(cellMatch[1]));
    }

    if (row.length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

function getHtmlAttribute(html: string, attribute: string): string {
  const pattern = new RegExp(`${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = pattern.exec(html);
  return decodeHtmlEntities(match?.[2] ?? match?.[3] ?? match?.[4] ?? '');
}

function cleanEditorHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replaceAll(/<\/?(span|div|section|article|main|header|footer)[^>]*>/gi, '')
      .replaceAll(/\s+/g, ' ')
      .trim()
  );
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };

  return value.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();

    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }

    if (normalized.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }

    return named[normalized] ?? entity;
  });
}

function getImportTitle(blocks: Record<string, unknown>[]): string {
  const firstHeader = blocks.find((block) => block.type === 'header' && isRecord(block.data));

  if (!firstHeader || !isRecord(firstHeader.data) || typeof firstHeader.data.text !== 'string') {
    return '';
  }

  return stripHtml(firstHeader.data.text).trim();
}

function getFileTitle(uri: vscode.Uri): string {
  const fileName = uri.fsPath.split(/[\\/]/).at(-1) ?? 'Imported page';
  return fileName.replaceAll(/\.(md|markdown|html|htm)$/gi, '') || 'Imported page';
}

function getWorkspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonIfMissing(uri: vscode.Uri, value: unknown): Promise<void> {
  if (await pathExists(uri)) {
    return;
  }

  await writeJson(uri, value);
}

async function writeJson(uri: vscode.Uri, value: unknown): Promise<void> {
  const content = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
  await vscode.workspace.fs.writeFile(uri, content);
}

async function writeTextIfMissing(uri: vscode.Uri, value: string): Promise<void> {
  if (await pathExists(uri)) {
    return;
  }

  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(value));
}

async function readMenu(workspaceRoot: vscode.Uri): Promise<SlashDocMenu> {
  const menuUri = getMenuUri(workspaceRoot);

  if (!(await pathExists(menuUri))) {
    return { items: [] };
  }

  const data = await vscode.workspace.fs.readFile(menuUri);
  const parsed = JSON.parse(new TextDecoder().decode(data)) as Partial<SlashDocMenu>;

  return {
    items: normalizeMenuItems(parsed.items)
  };
}

async function writeMenu(workspaceRoot: vscode.Uri, menu: SlashDocMenu): Promise<void> {
  await writeJson(getMenuUri(workspaceRoot), menu);
}

async function readSettings(workspaceRoot: vscode.Uri): Promise<SlashDocSettings> {
  const settingsUri = getSettingsUri(workspaceRoot);

  if (!(await pathExists(settingsUri))) {
    return getDefaultSettings();
  }

  const data = await vscode.workspace.fs.readFile(settingsUri);
  return normalizeSettings(JSON.parse(new TextDecoder().decode(data)));
}

async function writeSettings(workspaceRoot: vscode.Uri, settings: SlashDocSettings): Promise<void> {
  await writeJson(getSettingsUri(workspaceRoot), settings);
}

async function mountApiService(
  app: express.Express,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
  apiPrefix: string,
  service: ApiService,
  context: unknown
): Promise<void> {
  const serviceUri = getApiServiceUri(extensionUri, workspaceRoot, service);
  const serviceContext = {
    ...(isRecord(context) ? context : {}),
    scope: service.scope,
    apiRoot: getApiRootUri(extensionUri, workspaceRoot, service.scope).fsPath
  };

  if (!(await pathExists(serviceUri))) {
    return;
  }

  const moduleUrl = `${pathToFileURL(serviceUri.fsPath).href}?v=${Date.now()}`;
  const routeModule = await import(moduleUrl) as Record<string, unknown>;
  const router = express.Router();
  const register = routeModule.register ?? routeModule.default;

  if (typeof register === 'function') {
    await register(router, serviceContext);
    app.use(apiPrefix, router);
    return;
  }

  const exportedRouter = routeModule.router ?? routeModule.default;

  if (isExpressRouter(exportedRouter)) {
    app.use(apiPrefix, exportedRouter);
  }
}

function getMenuUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'docs', 'menu.json');
}

function getSettingsUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'sdsettings.json');
}

function getGlobalApiRootUri(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, 'api');
}

function getLocalApiRootUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'api');
}

function getApiRootUri(extensionUri: vscode.Uri, workspaceRoot: vscode.Uri, scope: ApiServiceScope): vscode.Uri {
  return scope === 'local' ? getLocalApiRootUri(workspaceRoot) : getGlobalApiRootUri(extensionUri);
}

function getApiServiceUri(extensionUri: vscode.Uri, workspaceRoot: vscode.Uri, service: ApiService): vscode.Uri {
  return vscode.Uri.joinPath(getApiRootUri(extensionUri, workspaceRoot, service.scope), service.file);
}

function getGlobalAddonRootUri(extensionUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(extensionUri, 'addons');
}

function getLocalAddonRootUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'addons');
}

function getAddonRootUri(extensionUri: vscode.Uri, workspaceRoot: vscode.Uri, scope: AddonScope): vscode.Uri {
  return scope === 'local' ? getLocalAddonRootUri(workspaceRoot) : getGlobalAddonRootUri(extensionUri);
}

function getCustomAddonUri(
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
  addon: CustomEditorAddon
): vscode.Uri {
  return vscode.Uri.joinPath(getAddonRootUri(extensionUri, workspaceRoot, addon.scope), addon.file);
}

function getCustomAddonWebviewModules(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined,
  settings: SlashDocSettings
): CustomAddonWebviewModule[] {
  if (!workspaceRoot) {
    return [];
  }

  return settings.customEditorAddons
    .filter((addon) => addon.enabled)
    .map((addon) => ({
      id: addon.id,
      toolName: addon.toolName,
      uri: webview.asWebviewUri(getCustomAddonUri(extensionUri, workspaceRoot, addon)).toString()
    }));
}

function getPagesRootUri(workspaceRoot: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceRoot, '.slash-doc', 'docs', 'pages');
}

function getPageContentUri(workspaceRoot: vscode.Uri, pageId: string): vscode.Uri {
  return vscode.Uri.joinPath(getPagesRootUri(workspaceRoot), pageId, 'content.json');
}

function normalizeMenuItems(items: unknown): SlashDocMenuItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<SlashDocMenuItem> => typeof item === 'object' && item !== null)
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : createPageId();

      return {
        id,
        title: typeof item.title === 'string' ? item.title : 'Untitled',
        file: `${id}/content.json`,
        children: normalizeMenuItems(item.children)
      };
    });
}

function getDefaultSettings(): SlashDocSettings {
  return {
    version: 1,
    editorAddons: {
      header: true,
      list: true,
      table: true,
      image: true,
      marker: true,
      inlineCode: true,
      underline: true,
      mermaid: true
    },
    customEditorAddons: [],
    apiPrefix: '/api',
    apiPort: 4317,
    apiServices: [],
    variables: []
  };
}

function normalizeSettings(value: unknown): SlashDocSettings {
  const defaults = getDefaultSettings();

  if (!isRecord(value)) {
    return defaults;
  }

  return {
    version: 1,
    editorAddons: {
      header: getBooleanSetting(value.editorAddons, 'header', defaults.editorAddons.header),
      list: getBooleanSetting(value.editorAddons, 'list', defaults.editorAddons.list),
      table: getBooleanSetting(value.editorAddons, 'table', defaults.editorAddons.table),
      image: getBooleanSetting(value.editorAddons, 'image', defaults.editorAddons.image),
      marker: getBooleanSetting(value.editorAddons, 'marker', defaults.editorAddons.marker),
      inlineCode: getBooleanSetting(value.editorAddons, 'inlineCode', defaults.editorAddons.inlineCode),
      underline: getBooleanSetting(value.editorAddons, 'underline', defaults.editorAddons.underline),
      mermaid: getBooleanSetting(value.editorAddons, 'mermaid', defaults.editorAddons.mermaid)
    },
    customEditorAddons: normalizeCustomEditorAddons(value.customEditorAddons),
    apiPrefix: typeof value.apiPrefix === 'string' ? normalizeApiPrefix(value.apiPrefix) : defaults.apiPrefix,
    apiPort: typeof value.apiPort === 'number' ? value.apiPort : defaults.apiPort,
    apiServices: normalizeApiServices(value.apiServices),
    variables: normalizeVariables(value.variables)
  };
}

function getBooleanSetting(value: unknown, key: string, fallback: boolean): boolean {
  if (!isRecord(value) || typeof value[key] !== 'boolean') {
    return fallback;
  }

  return value[key];
}

function normalizeApiServices(value: unknown): ApiService[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<ApiService> => isRecord(item))
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : createSettingsId('service'),
      scope: normalizeApiServiceScope(item.scope),
      name: typeof item.name === 'string' ? item.name : '',
      file: typeof item.file === 'string' ? ensureMjsFileName(item.file) : `${createSettingsId('route')}.mjs`
    }));
}

function normalizeCustomEditorAddons(value: unknown): CustomEditorAddon[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<CustomEditorAddon> => isRecord(item))
    .map((item) => {
      const name = typeof item.name === 'string' ? item.name : 'Custom Tool';

      return {
        id: typeof item.id === 'string' ? item.id : createSettingsId('addon'),
        scope: normalizeAddonScope(item.scope),
        name,
        toolName: typeof item.toolName === 'string' ? normalizeToolName(item.toolName) : normalizeToolName(name),
        file: typeof item.file === 'string' ? ensureJavaScriptModuleFileName(item.file) : `${slugify(name)}.mjs`,
        enabled: typeof item.enabled === 'boolean' ? item.enabled : true
      };
    });
}

function normalizeAddonScope(value: unknown): AddonScope {
  return value === 'local' || value === 'global' ? value : 'local';
}

function normalizeApiServiceScope(value: unknown): ApiServiceScope {
  return value === 'local' || value === 'global' ? value : 'global';
}

function normalizeApiPrefix(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '/api';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function ensureMjsFileName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.length > 0 ? trimmed : createSettingsId('route');
  const fileName = safe.split(/[\\/]/).at(-1) ?? safe;
  const normalized = fileName.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.endsWith('.mjs') ? normalized : `${normalized}.mjs`;
}

function ensureJavaScriptModuleFileName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.length > 0 ? trimmed : createSettingsId('addon');
  const fileName = safe.split(/[\\/]/).at(-1) ?? safe;
  const normalized = fileName.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.endsWith('.mjs') || normalized.endsWith('.js') ? normalized : `${normalized}.mjs`;
}

function normalizeToolName(value: string): string {
  const normalized = value
    .trim()
    .replaceAll(/[^a-zA-Z0-9_$]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part, index) => index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  return normalized || `custom${Date.now().toString(36)}`;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

  return slug.length > 0 ? slug : createSettingsId('route');
}

function getApiRouteTemplate(name: string): string {
  const routePath = `/${slugify(name)}`;

  return `export default function register(router, context) {
  router.get('${routePath}', (_request, response) => {
    response.json({
      ok: true,
      service: '${escapeJavaScriptString(name)}',
      puppeteer: typeof context.puppeteer?.launch === 'function',
      variables: context.variables
    });
  });
}
`;
}

function getCustomAddonTemplate(name: string): string {
  const className = `${normalizeToolName(name).replace(/^[a-z]/, (letter) => letter.toUpperCase())}Tool`;

  return `export default class ${className} {
  static get toolbox() {
    return {
      title: '${escapeJavaScriptString(name)}',
      icon: '<svg width="17" height="15" viewBox="0 0 17 15" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 0L10.4 5.7H16.4L11.5 9.2L13.4 14.9L8.5 11.4L3.6 14.9L5.5 9.2L0.6 5.7H6.6L8.5 0Z"/></svg>'
    };
  }

  constructor({ data }) {
    this.data = data || {};
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'true';
    wrapper.textContent = this.data.text || '${escapeJavaScriptString(name)}';
    return wrapper;
  }

  save(blockContent) {
    return {
      text: blockContent.textContent || ''
    };
  }
}

export function toHtml(data) {
  return '<div>' + escapeHtml(data.text || '') + '</div>';
}

export function toMarkdown(data) {
  return data.text || '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
`;
}

function isExpressRouter(value: unknown): value is Router {
  return typeof value === 'function' && typeof (value as { use?: unknown }).use === 'function';
}

function normalizeVariables(value: unknown): SettingsVariable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<SettingsVariable> => isRecord(item))
    .map((item) => ({
      key: typeof item.key === 'string' ? item.key : '',
      value: typeof item.value === 'string' ? item.value : ''
    }));
}

async function readPageContent(workspaceRoot: vscode.Uri, pageId: string, fallbackTitle: string): Promise<unknown> {
  const contentUri = getPageContentUri(workspaceRoot, pageId);

  if (!(await pathExists(contentUri))) {
    return createDefaultPageContent(fallbackTitle);
  }

  const data = await vscode.workspace.fs.readFile(contentUri);
  return JSON.parse(new TextDecoder().decode(data));
}

function createDefaultPageContent(title: string): unknown {
  return {
    time: Date.now(),
    blocks: [
      {
        type: 'header',
        data: {
          text: title,
          level: 2
        }
      }
    ],
    version: '2.30.8'
  };
}

function addChildToMenu(items: SlashDocMenuItem[], parentId: string, child: SlashDocMenuItem): boolean {
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

function removeMenuItem(items: SlashDocMenuItem[], pageId: string): boolean {
  const index = items.findIndex((item) => item.id === pageId);

  if (index >= 0) {
    items.splice(index, 1);
    return true;
  }

  return items.some((item) => removeMenuItem(item.children, pageId));
}

function collectMenuItemIds(item: SlashDocMenuItem): string[] {
  return [item.id, ...item.children.flatMap(collectMenuItemIds)];
}

function renderMenuTree(items: SlashDocMenuItem[]): string {
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
      <button class="tree-delete" type="button" data-delete-page-id="${escapeAttribute(item.id)}" aria-label="Удалить ${escapeAttribute(item.title)}" title="Удалить">
        <span aria-hidden="true">×</span>
      </button>
    </div>
    ${children}
  </li>`;
}

function renderSettingsPanel(settings: SlashDocSettings): string {
  return `<div class="panel panel-settings">
    <header class="settings-header">
      <sl-button id="back-to-menu" size="small" variant="default">Назад</sl-button>
      <h2 class="settings-title">Настройки</h2>
    </header>
    <section class="settings-panel" aria-label="Настройки">
      <div class="settings-group">
        <div class="settings-group-title">Editor.js аддоны</div>
        ${editorAddonDefinitions.map((definition) => renderAddonToggle(definition, settings.editorAddons[definition.id])).join('')}
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Свои Editor.js аддоны</div>
        <div id="custom-addons-list" class="settings-list">
          ${settings.customEditorAddons.map(renderCustomAddonRow).join('')}
        </div>
        <div class="service-actions">
          <sl-button id="add-local-addon" size="small" variant="default">Локальный модуль</sl-button>
          <sl-button id="add-global-addon" size="small" variant="default">Глобальный модуль</sl-button>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">HTTP API сервисы</div>
        <div class="settings-row api-settings-row">
          <input class="settings-input" id="api-prefix" value="${escapeAttribute(settings.apiPrefix)}" placeholder="/api">
          <input class="settings-input" id="api-port" value="${escapeAttribute(String(settings.apiPort))}" inputmode="numeric" placeholder="4317">
        </div>
        <div id="services-list" class="settings-list">
          ${settings.apiServices.map(renderServiceRow).join('')}
        </div>
        <div class="service-actions">
          <sl-button id="add-local-service" size="small" variant="default">Локальный route</sl-button>
          <sl-button id="add-global-service" size="small" variant="default">Глобальный route</sl-button>
        </div>
      </div>
      <div class="settings-group">
        <div class="settings-group-title">Переменные сервисов</div>
        <div id="variables-list" class="settings-list">
          ${settings.variables.map(renderVariableRow).join('')}
        </div>
        <sl-button id="add-variable" size="small" variant="default">Добавить переменную</sl-button>
      </div>
    </section>
  </div>`;
}

function renderAddonToggle(definition: EditorAddonDefinition, checked: boolean): string {
  return `<label class="addon-row">
    <span class="addon-info">
      <span class="addon-icon" aria-hidden="true">${definition.icon}</span>
      <span class="addon-label">${escapeHtml(definition.label)}</span>
    </span>
    <sl-switch data-addon="${definition.id}" ${checked ? 'checked' : ''}></sl-switch>
  </label>`;
}

function renderServiceRow(service: ApiService): string {
  return `<div class="settings-row service-row" data-service-id="${escapeAttribute(service.id)}">
    <select class="settings-input" data-service-field="scope">
      <option value="local" ${service.scope === 'local' ? 'selected' : ''}>local</option>
      <option value="global" ${service.scope === 'global' ? 'selected' : ''}>global</option>
    </select>
    <input class="settings-input" data-service-field="name" value="${escapeAttribute(service.name)}" placeholder="name">
    <input class="settings-input" data-service-field="file" value="${escapeAttribute(service.file)}" placeholder="route.mjs">
    <button class="settings-open-button" type="button" data-open-service="${escapeAttribute(service.id)}">Открыть</button>
  </div>`;
}

function renderCustomAddonRow(addon: CustomEditorAddon): string {
  return `<div class="settings-row custom-addon-row" data-custom-addon-id="${escapeAttribute(addon.id)}">
    <select class="settings-input" data-custom-addon-field="scope">
      <option value="local" ${addon.scope === 'local' ? 'selected' : ''}>local</option>
      <option value="global" ${addon.scope === 'global' ? 'selected' : ''}>global</option>
    </select>
    <input class="settings-input" data-custom-addon-field="name" value="${escapeAttribute(addon.name)}" placeholder="name">
    <input class="settings-input" data-custom-addon-field="toolName" value="${escapeAttribute(addon.toolName)}" placeholder="toolName">
    <input class="settings-input" data-custom-addon-field="file" value="${escapeAttribute(addon.file)}" placeholder="tool.mjs">
    <sl-switch data-custom-addon-enabled="${escapeAttribute(addon.id)}" ${addon.enabled ? 'checked' : ''}></sl-switch>
    <button class="settings-open-button" type="button" data-open-addon="${escapeAttribute(addon.id)}">Открыть</button>
  </div>`;
}

function renderVariableRow(variable: SettingsVariable): string {
  return `<div class="settings-row variable-row">
    <input class="settings-input" data-variable-field="key" value="${escapeAttribute(variable.key)}" placeholder="key">
    <input class="settings-input" data-variable-field="value" value="${escapeAttribute(variable.value)}" placeholder="value">
  </div>`;
}

function findMenuItem(items: SlashDocMenuItem[], pageId: string): SlashDocMenuItem | undefined {
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

function updateMenuItemTitle(items: SlashDocMenuItem[], pageId: string, title: string): boolean {
  const item = findMenuItem(items, pageId);

  if (!item || item.title === title) {
    return false;
  }

  item.title = title;
  return true;
}

function getFirstHeaderText(data: unknown): string | undefined {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stripHtml(value: string): string {
  return value.replaceAll(/<[^>]*>/g, '');
}

function createPageId(): string {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSettingsId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function escapeJavaScriptString(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
}
