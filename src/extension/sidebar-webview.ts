import * as vscode from 'vscode';
import { getWorkspaceRoot, pathExists } from './filesystem';
import { readMenu, renderMenuTree } from './pages';
import { getDefaultSettings } from './settings';
import { readSettings } from './settings-store';
import { renderSettingsPanel } from './sidebar-render';
import { getNonce } from './utils';

type SidebarView = 'menu' | 'settings';

export async function getSidebarHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  view: SidebarView = 'menu',
): Promise<string> {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'sidebar.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'sidebar.css'));
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
              <sl-tooltip class="import-tooltip" content="Импорт">
                <sl-button id="import-page" size="small" variant="default" aria-label="Импорт">
                  <svg class="import-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11.5V16h12v-4.5" />
                  </svg>
                </sl-button>
              </sl-tooltip>
              <sl-tooltip class="compile-tooltip" content="Собрать HTML">
                <sl-button id="compile-site" size="small" variant="default" aria-label="Собрать HTML">
                  <svg class="compile-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 2.75h6.5L15 6.25v11H5zM11.5 2.75v3.5H15" />
                    <path d="m9 9-2 2 2 2m2-4 2 2-2 2" />
                  </svg>
                </sl-button>
              </sl-tooltip>
            </div>
            <div class="documentation-search">
              <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>
              <input id="documentation-search" type="search" placeholder="Поиск по документации" autocomplete="off" aria-label="Поиск по документации">
              <button id="clear-documentation-search" type="button" aria-label="Очистить поиск" title="Очистить">×</button>
            </div>
            <div class="menu-content">
              <div id="documentation-search-results" class="documentation-search-results" aria-live="polite" hidden></div>
              <nav class="tree" aria-label="Страницы">
                <div class="tree-root-drop" data-root-drop>Переместить на верхний уровень</div>
                ${renderMenuTree(menu?.items ?? [])}
              </nav>
            </div>
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
        grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
      gap: 10px;
      }

      .documentation-search {
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr) 24px;
        align-items: center;
        min-width: 0;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
        border-radius: 3px;
        background: var(--vscode-input-background);
      }

      .documentation-search:focus-within {
        border-color: var(--vscode-focusBorder);
      }

      .documentation-search svg {
        width: 14px;
        height: 14px;
        margin-left: 5px;
        fill: none;
        stroke: var(--vscode-descriptionForeground);
        stroke-width: 1.6;
        stroke-linecap: round;
      }

      #documentation-search {
        min-width: 0;
        height: 27px;
        padding: 3px 5px;
        color: inherit;
        border: 0;
        outline: 0;
        background: transparent;
        font: inherit;
      }

      #documentation-search::-webkit-search-cancel-button {
        display: none;
      }

      #clear-documentation-search {
        width: 22px;
        height: 22px;
        padding: 0;
        color: var(--vscode-descriptionForeground);
        border: 0;
        border-radius: 2px;
        background: transparent;
        cursor: pointer;
      }

      #clear-documentation-search:hover {
        color: var(--vscode-foreground);
        background: var(--vscode-list-hoverBackground);
      }

      .menu-content {
        min-height: 0;
        overflow: hidden;
      }

      .documentation-search-results {
        display: grid;
        align-content: start;
        gap: 3px;
        height: 100%;
        overflow: auto;
      }

      .documentation-search-results[hidden],
      .tree[hidden] {
        display: none;
      }

      .documentation-search-result {
        display: grid;
        gap: 3px;
        width: 100%;
        padding: 7px;
        color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
        border: 0;
        border-radius: 3px;
        background: transparent;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .documentation-search-result:hover,
      .documentation-search-result:focus-visible {
        outline: none;
        background: var(--vscode-list-hoverBackground);
      }

      .documentation-search-result-title {
        overflow: hidden;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .documentation-search-result-snippet {
        display: -webkit-box;
        overflow: hidden;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        line-height: 1.35;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }

      .documentation-search-status {
        padding: 8px 6px;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }

    .actions-row {
      display: flex;
      gap: 6px;
      min-width: 0;
    }

    .actions-row #create-page {
      flex: 1 1 90%;
    }

    .import-tooltip,
    .compile-tooltip {
      flex: 0 0 28px;
      width: 28px;
    }

    .import-tooltip #import-page,
    .compile-tooltip #compile-site {
      width: 100%;
      min-width: 28px;
    }

    .import-tooltip #import-page::part(base),
    .compile-tooltip #compile-site::part(base) {
      justify-content: center;
      padding: 4px;
    }

    .import-icon,
    .compile-icon {
      display: block;
      width: 15px;
      height: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .settings-button-row {
      display: flex;
      gap: 6px;
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
      height: 100%;
      min-width: 0;
      overflow: auto;
    }

    .tree-root-drop {
      display: none;
      margin-bottom: 4px;
      padding: 5px 6px;
      color: var(--vscode-descriptionForeground);
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 3px;
      font-size: 11px;
      text-align: center;
    }

    body.page-dragging .tree-root-drop {
      display: block;
    }

    body.page-dragging {
      cursor: grabbing;
      user-select: none;
    }

    .tree-root-drop.drop-target {
      color: var(--vscode-list-activeSelectionForeground, #fff);
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
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
      position: relative;
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }

    .tree-toggle,
    .tree-toggle-spacer {
      flex: 0 0 18px;
      width: 18px;
      height: 22px;
    }

    .tree-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: var(--vscode-descriptionForeground);
      border: 0;
      border-radius: 2px;
      background: transparent;
      cursor: pointer;
    }

    .tree-toggle:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }

    .tree-toggle:focus-visible {
      outline: 1px solid var(--focus-ring);
      outline-offset: -1px;
    }

    .tree-toggle svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      transform: rotate(90deg);
      transition: transform .12s ease;
    }

    .tree-node.collapsed > .tree-row .tree-toggle svg {
      transform: rotate(0deg);
    }

    .tree-node.collapsed > .tree-list {
      display: none;
    }

    .tree-row.dragging {
      opacity: .4;
    }

    .page-drag-ghost {
      position: fixed;
      z-index: 1000;
      max-width: 180px;
      padding: 4px 7px;
      overflow: hidden;
      color: var(--vscode-list-activeSelectionForeground, #fff);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 3px;
      background: var(--vscode-list-activeSelectionBackground);
      box-shadow: 0 3px 10px rgba(0,0,0,.25);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    }

    .tree-row.drop-inside {
      border-radius: 2px;
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
      background: color-mix(in srgb, var(--vscode-focusBorder) 18%, transparent);
    }

    .tree-row.drop-before::before,
    .tree-row.drop-after::after {
      position: absolute;
      z-index: 2;
      right: 0;
      left: 0;
      height: 2px;
      border-radius: 1px;
      background: var(--vscode-focusBorder);
      content: '';
    }

    .tree-row.drop-before::before { top: -1px; }
    .tree-row.drop-after::after { bottom: -1px; }

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
      cursor: grab;
      touch-action: none;
    }

    .tree-item:active {
      cursor: grabbing;
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

    .tree-rename,
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

    .tree-row:hover .tree-rename,
    .tree-row:hover .tree-delete,
    .tree-rename:focus-visible,
    .tree-delete:focus-visible {
      opacity: 1;
    }

    .tree-rename:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }

    .tree-delete:hover {
      color: var(--vscode-errorForeground, var(--vscode-foreground));
      background: var(--vscode-list-hoverBackground);
    }

    .tree-rename:focus-visible,
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
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto;
    }

    .custom-addon-row {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) auto auto;
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
