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
              <slash-button id="create-page" size="small" variant="primary">Создать страницу</slash-button>
              <slash-tooltip class="import-tooltip" content="Импорт страницы или MkDocs ZIP">
                <slash-button id="import-page" size="small" variant="default" aria-label="Импорт страницы или MkDocs ZIP">
                  <svg class="import-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11.5V16h12v-4.5" />
                  </svg>
                </slash-button>
              </slash-tooltip>
              <slash-tooltip class="compile-tooltip" content="Собрать HTML">
                <slash-button id="compile-site" size="small" variant="default" aria-label="Собрать HTML">
                  <svg class="compile-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <g transform="translate(0 .5)">
                      <path d="M22 9.5V8c0-1.097-.903-2-2-2h-7.9a2.02 2.02 0 0 1-1.69-.9L9.6 3.9A1.998 1.998 0 0 0 7.93 3H4c-1.097 0-2 .903-2 2v13c0 1.097.903 2 2 2" stroke-width="2" />
                    </g>
                    <g transform="matrix(.78858 0 0 1.27743 -272.657 -186.835)">
                      <path d="M354 158v4.207-2.103h3V158v4.207" stroke-width="1.15" />
                    </g>
                    <g transform="matrix(.78858 0 0 1.27743 -271.299 -186.791)">
                      <path d="M357.701 158.069h3.458-1.729v4.138" stroke-width="1.15" />
                    </g>
                    <g transform="matrix(1.1121 0 0 1.27743 -387.041 -186.791)">
                      <path d="M362 158.069v4.138m0-4.138 1.574 3.931 1.426-3.931v4.138" stroke-width="1.03" />
                    </g>
                    <g transform="matrix(.78858 0 0 1.27743 -267.986 -186.791)">
                      <path d="M367 158v4.207h2" stroke-width="1.15" />
                    </g>
                  </svg>
                </slash-button>
              </slash-tooltip>
              <slash-tooltip class="compile-tooltip" content="Собрать Markdown">
                <slash-button id="compile-markdown" size="small" variant="default" aria-label="Собрать Markdown">
                  <svg class="compile-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <g transform="translate(0 .5)">
                      <path d="M22 10.333V8c0-1.097-.903-2-2-2h-7.9a2.02 2.02 0 0 1-1.69-.9L9.6 3.9A1.998 1.998 0 0 0 7.93 3H4c-1.097 0-2 .903-2 2v13c0 1.097.903 2 2 2" stroke-width="2" />
                    </g>
                    <g transform="matrix(1.83728 0 0 1.51114 -657.294 -224.618)">
                      <path d="M362 158.069v4.138m0-4.138 1.574 3.931 1.426-3.931v4.138" stroke-width="1" />
                    </g>
                    <g transform="matrix(1.60344 0 0 1.85986 -6.86192 -10.0358)">
                      <path d="m14 14.737 2 1.681 2-1.681M16 16.418V13" stroke-width=".97" />
                    </g>
                  </svg>
                </slash-button>
              </slash-tooltip>
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
            <slash-button id="open-settings" size="small" variant="default">Настройки</slash-button>
          </div>
        </div>`
      : `<div class="panel panel-empty">
          <slash-button id="initialize" size="small" variant="primary">Инициализировать документацию</slash-button>
        </div>`
    : `<div class="panel panel-empty">
        <p class="empty-text">Откройте папку проекта</p>
      </div>`;

  return /* html */ `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Slash Doc</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  ${content}
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
