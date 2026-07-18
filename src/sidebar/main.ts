import { collectSettings } from './settings-collector';
import { setupPageTree } from './page-tree';
import './styled-button';
import './styled-switch';
import './styled-tooltip';

type VSCodeApi = {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare const acquireVsCodeApi: () => VSCodeApi;

const vscode = acquireVsCodeApi();
let selectedPageId: string | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | undefined;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const sidebarState = readSidebarState();
const collapsedPageIds = new Set(sidebarState.collapsedPageIds);

type DocumentationSearchResult = {
  pageId: string;
  title: string;
  snippet: string;
};

bindDocumentationSearch();

document.querySelector('#initialize')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'initialize',
  });
});

document.querySelector('#create-page')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createPage',
    parentId: selectedPageId,
  });
});

document.querySelector('#import-page')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'importPage',
    parentId: selectedPageId,
  });
});

document.querySelector('#open-settings')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'openSettings',
  });
});

document.querySelector('#compile-site')?.addEventListener('click', () => {
  vscode.postMessage({ type: 'compileDocumentation' });
});

document.querySelector('#back-to-menu')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'backToMenu',
  });
});

document.querySelectorAll<HTMLButtonElement>('.tree-item').forEach((button) => {
  button.addEventListener('click', (event) => {
    if (button.dataset.suppressClick === 'true') {
      event.preventDefault();
      event.stopPropagation();
      delete button.dataset.suppressClick;
      return;
    }
    selectedPageId = button.dataset.pageId ?? null;

    document.querySelectorAll<HTMLButtonElement>('.tree-item').forEach((item) => {
      item.setAttribute('aria-selected', String(item === button));
    });

    vscode.postMessage({
      type: 'openPage',
      pageId: selectedPageId,
    });
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-delete-page-id]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const pageId = button.dataset.deletePageId ?? null;

    if (selectedPageId === pageId) {
      selectedPageId = null;
    }

    vscode.postMessage({
      type: 'deletePage',
      pageId,
    });
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-rename-page-id]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    vscode.postMessage({
      type: 'renamePage',
      pageId: button.dataset.renamePageId ?? null,
    });
  });
});

setupPageTree(collapsedPageIds, (message) => vscode.postMessage(message), saveSidebarState);

document.querySelector('#add-service')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createApiService',
  });
});

document.querySelector('#reload-api-services')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'reloadApiServices',
  });
});

document.querySelector('#add-addon')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createCustomAddon',
  });
});

document.querySelector('#add-variable')?.addEventListener('click', () => {
  document.querySelector('#variables-list')?.insertAdjacentHTML('beforeend', getVariableRowHtml());
  bindSettingsInputs();
  postSettings();
});

bindSettingsInputs();
bindServiceOpenButtons();
bindAddonOpenButtons();

function bindDocumentationSearch() {
  const input = document.querySelector<HTMLInputElement>('#documentation-search');
  const clear = document.querySelector<HTMLButtonElement>('#clear-documentation-search');
  if (!input) return;
  input.value = sidebarState.searchQuery;

  const submit = () => {
    const query = input.value.trim();
    sidebarState.searchQuery = input.value;
    saveSidebarState();
    setSearchMode(query.length > 0);
    if (searchTimer) clearTimeout(searchTimer);
    if (query.length === 0) return;
    if (query.length < 2) {
      renderSearchStatus('Введите не менее двух символов');
      return;
    }
    renderSearchStatus('Поиск…');
    searchTimer = setTimeout(() => vscode.postMessage({ type: 'searchPages', query }), 180);
  };

  input.addEventListener('input', submit);
  clear?.addEventListener('click', () => {
    input.value = '';
    input.focus();
    submit();
  });
  window.addEventListener('message', (event) => {
    const message = event.data as { type?: string; query?: string; results?: DocumentationSearchResult[] };
    if (message.type !== 'searchResults' || message.query !== input.value.trim()) return;
    renderSearchResults(message.results ?? []);
  });

  if (input.value.trim()) submit();
}

function setSearchMode(active: boolean) {
  const tree = document.querySelector<HTMLElement>('.tree');
  const results = document.querySelector<HTMLElement>('#documentation-search-results');
  if (tree) tree.hidden = active;
  if (results) results.hidden = !active;
  if (!active) results?.replaceChildren();
}

function renderSearchStatus(text: string) {
  const container = document.querySelector<HTMLElement>('#documentation-search-results');
  if (!container) return;
  const status = document.createElement('div');
  status.className = 'documentation-search-status';
  status.textContent = text;
  container.replaceChildren(status);
}

function renderSearchResults(results: DocumentationSearchResult[]) {
  const container = document.querySelector<HTMLElement>('#documentation-search-results');
  if (!container) return;
  if (results.length === 0) {
    renderSearchStatus('Ничего не найдено');
    return;
  }
  container.replaceChildren(
    ...results.map((result) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'documentation-search-result';
      const title = document.createElement('span');
      title.className = 'documentation-search-result-title';
      title.textContent = result.title;
      const snippet = document.createElement('span');
      snippet.className = 'documentation-search-result-snippet';
      snippet.textContent = result.snippet;
      button.append(title, snippet);
      button.addEventListener('click', () => vscode.postMessage({ type: 'openPage', pageId: result.pageId }));
      return button;
    }),
  );
}

function readSidebarState(): { collapsedPageIds: string[]; searchQuery: string } {
  const value = vscode.getState();
  if (!value || typeof value !== 'object') return { collapsedPageIds: [], searchQuery: '' };
  const state = value as { collapsedPageIds?: unknown; searchQuery?: unknown };
  const collapsed = state.collapsedPageIds;
  return {
    collapsedPageIds: Array.isArray(collapsed)
      ? collapsed.filter((item): item is string => typeof item === 'string')
      : [],
    searchQuery: typeof state.searchQuery === 'string' ? state.searchQuery : '',
  };
}

function saveSidebarState() {
  vscode.setState({ ...sidebarState, collapsedPageIds: Array.from(collapsedPageIds) });
}

function bindSettingsInputs() {
  document.querySelectorAll<HTMLElement>('[data-addon]').forEach((element) => {
    element.addEventListener('change', scheduleSettingsSave);
  });

  document.querySelectorAll<HTMLElement>('[data-custom-addon-enabled]').forEach((element) => {
    element.addEventListener('change', scheduleSettingsSave);
  });

  document.querySelectorAll<HTMLInputElement>('.settings-input').forEach((input) => {
    input.oninput = scheduleSettingsSave;
  });

  document.querySelectorAll<HTMLSelectElement>('select.settings-input').forEach((select) => {
    select.onchange = scheduleSettingsSave;
  });
}

function bindServiceOpenButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-open-service]').forEach((button) => {
    button.onclick = () => {
      vscode.postMessage({
        type: 'openApiService',
        serviceId: button.dataset.openService,
      });
    };
  });
}

function bindAddonOpenButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-open-addon]').forEach((button) => {
    button.onclick = () => {
      vscode.postMessage({
        type: 'openCustomAddon',
        addonId: button.dataset.openAddon,
      });
    };
  });
}

function scheduleSettingsSave() {
  if (settingsTimer) {
    clearTimeout(settingsTimer);
  }

  settingsTimer = setTimeout(postSettings, 300);
}

function postSettings() {
  vscode.postMessage({
    type: 'updateSettings',
    settings: collectSettings(),
  });
}

function getVariableRowHtml(): string {
  return `<div class="settings-row variable-row">
    <input class="settings-input" data-variable-field="key" placeholder="ключ">
    <input class="settings-input" data-variable-field="value" placeholder="значение">
  </div>`;
}
