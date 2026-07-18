import * as vscode from 'vscode';
import { getWorkspaceRoot, pathExists } from './filesystem';
import { readMenu, renderMenuTree } from './pages';
import { getDefaultSettings } from './settings';
import { readSettings } from './settings-store';
import { renderSettingsPanel } from './sidebar-render';
import { getNonce } from './utils';
import { SIDEBAR_WEBVIEW_STYLES } from './sidebar-webview-styles';

type SidebarView = 'menu' | 'settings';

export async function getSidebarHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  view: SidebarView = 'menu',
): Promise<string> {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'sidebar.js'));
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
              <slash-tooltip class="import-tooltip" content="Импорт">
                <slash-button id="import-page" size="small" variant="default" aria-label="Импорт">
                  <svg class="import-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11.5V16h12v-4.5" />
                  </svg>
                </slash-button>
              </slash-tooltip>
              <slash-tooltip class="compile-tooltip" content="Собрать HTML">
                <slash-button id="compile-site" size="small" variant="default" aria-label="Собрать HTML">
                  <svg class="compile-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M5 2.75h6.5L15 6.25v11H5zM11.5 2.75v3.5H15" />
                    <path d="m9 9-2 2 2 2m2-4 2 2-2 2" />
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
  <style>${SIDEBAR_WEBVIEW_STYLES}</style>
</head>
<body>
  ${content}
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
