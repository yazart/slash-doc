import * as vscode from 'vscode';
import { getCustomAddonWebviewModules } from './filesystem';
import type { DocumentationPageLink, SlashDocSettings } from './types';
import { escapeScriptJson, getNonce } from './utils';
import { getEditorWebviewStyles } from './editor-webview-styles';

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined,
  initialData: unknown,
  settings: SlashDocSettings,
  pages: DocumentationPageLink[],
  currentPageId: string | undefined,
  focusEditor: boolean,
): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'slash-doc.svg'));
  const nonce = getNonce();
  const initialDataJson = escapeScriptJson(initialData);
  const settingsJson = escapeScriptJson(settings);
  const pagesJson = escapeScriptJson(pages);
  const currentPageIdJson = escapeScriptJson(currentPageId ?? null);
  const focusEditorJson = escapeScriptJson(focusEditor);
  const customAddonsJson = escapeScriptJson(
    getCustomAddonWebviewModules(webview, extensionUri, workspaceRoot, settings),
  );

  return /* html */ `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <link rel="stylesheet" href="${styleUri}">
    <title>Slash Doc</title>
    <style>${getEditorWebviewStyles(iconUri.toString())}</style>
  </head>
  <body>
    <main class="shell">
      <header class="toolbar">
        <h1 class="title">
          <span class="title-icon" aria-hidden="true"></span>
          <span>Slash Doc</span>
        </h1>
        <div class="header-inline-tools" id="header-inline-tools" aria-label="Инструменты форматирования"></div>
        <div class="export-actions">
          <span class="save-status" id="save-status" data-status="saved" role="status">Сохранено</span>
          <button class="export-button save-button" type="button" id="save-page" title="Сохранить страницу" aria-label="Сохранить страницу">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
          </button>
          <button class="export-button" type="button" id="export-html">HTML</button>
          <button class="export-button" type="button" id="export-md">MD</button>
        </div>
      </header>
      <section id="editor" aria-label="Редактор документа"></section>
    </main>
    <script nonce="${nonce}">
      window.__SLASH_DOC_INITIAL_DATA__ = ${initialDataJson};
      window.__SLASH_DOC_SETTINGS__ = ${settingsJson};
      window.__SLASH_DOC_CUSTOM_ADDONS__ = ${customAddonsJson};
      window.__SLASH_DOC_PAGES__ = ${pagesJson};
      window.__SLASH_DOC_CURRENT_PAGE_ID__ = ${currentPageIdJson};
      window.__SLASH_DOC_FOCUS_EDITOR__ = ${focusEditorJson};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
