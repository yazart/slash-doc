import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';

type VSCodeApi = {
  postMessage(message: unknown): void;
};

type SwitchElement = HTMLElement & {
  checked?: boolean;
};

declare const acquireVsCodeApi: () => VSCodeApi;

const vscode = acquireVsCodeApi();
let selectedPageId: string | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | undefined;

document.querySelector('#initialize')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'initialize'
  });
});

document.querySelector('#create-page')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createPage',
    parentId: selectedPageId
  });
});

document.querySelector('#import-page')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'importPage',
    parentId: selectedPageId
  });
});

document.querySelector('#open-settings')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'openSettings'
  });
});

document.querySelector('#back-to-menu')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'backToMenu'
  });
});

document.querySelectorAll<HTMLButtonElement>('.tree-item').forEach((button) => {
  button.addEventListener('click', () => {
    selectedPageId = button.dataset.pageId ?? null;

    document.querySelectorAll<HTMLButtonElement>('.tree-item').forEach((item) => {
      item.setAttribute('aria-selected', String(item === button));
    });

    vscode.postMessage({
      type: 'openPage',
      pageId: selectedPageId
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
      pageId
    });
  });
});

document.querySelector('#add-local-service')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createApiService',
    scope: 'local'
  });
});

document.querySelector('#add-global-service')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createApiService',
    scope: 'global'
  });
});

document.querySelector('#add-local-addon')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createCustomAddon',
    scope: 'local'
  });
});

document.querySelector('#add-global-addon')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createCustomAddon',
    scope: 'global'
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

function bindSettingsInputs() {
  document.querySelectorAll<HTMLElement>('[data-addon]').forEach((element) => {
    element.addEventListener('sl-change', scheduleSettingsSave);
  });

  document.querySelectorAll<HTMLElement>('[data-custom-addon-enabled]').forEach((element) => {
    element.addEventListener('sl-change', scheduleSettingsSave);
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
        serviceId: button.dataset.openService
      });
    };
  });
}

function bindAddonOpenButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-open-addon]').forEach((button) => {
    button.onclick = () => {
      vscode.postMessage({
        type: 'openCustomAddon',
        addonId: button.dataset.openAddon
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
    settings: collectSettings()
  });
}

function collectSettings() {
  return {
    version: 1,
    editorAddons: {
      header: isAddonEnabled('header'),
      list: isAddonEnabled('list'),
      table: isAddonEnabled('table'),
      image: isAddonEnabled('image'),
      marker: isAddonEnabled('marker'),
      inlineCode: isAddonEnabled('inlineCode'),
      underline: isAddonEnabled('underline'),
      mermaid: isAddonEnabled('mermaid')
    },
    customEditorAddons: Array.from(document.querySelectorAll<HTMLElement>('[data-custom-addon-id]')).map((row) => ({
      id: row.dataset.customAddonId ?? createId('addon'),
      scope: getRowInput(row, 'custom-addon', 'scope'),
      name: getRowInput(row, 'custom-addon', 'name'),
      toolName: getRowInput(row, 'custom-addon', 'toolName'),
      file: getRowInput(row, 'custom-addon', 'file'),
      enabled: isCustomAddonEnabled(row.dataset.customAddonId)
    })),
    apiPrefix: document.querySelector<HTMLInputElement>('#api-prefix')?.value ?? '/api',
    apiPort: Number(document.querySelector<HTMLInputElement>('#api-port')?.value ?? '4317'),
    apiServices: Array.from(document.querySelectorAll<HTMLElement>('[data-service-id]')).map((row) => ({
      id: row.dataset.serviceId ?? createId('service'),
      scope: getRowInput(row, 'service', 'scope'),
      name: getRowInput(row, 'service', 'name'),
      file: getRowInput(row, 'service', 'file')
    })),
    variables: Array.from(document.querySelectorAll<HTMLElement>('.variable-row')).map((row) => ({
      key: getRowInput(row, 'variable', 'key'),
      value: getRowInput(row, 'variable', 'value')
    }))
  };
}

function isAddonEnabled(addon: string): boolean {
  const element = document.querySelector<SwitchElement>(`[data-addon="${addon}"]`);
  return element?.checked ?? element?.hasAttribute('checked') ?? true;
}

function isCustomAddonEnabled(addonId: string | undefined): boolean {
  if (!addonId) {
    return true;
  }

  const element = document.querySelector<SwitchElement>(`[data-custom-addon-enabled="${addonId}"]`);
  return element?.checked ?? element?.hasAttribute('checked') ?? true;
}

function getRowInput(row: HTMLElement, scope: 'service' | 'variable' | 'custom-addon', field: string): string {
  return row.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-${scope}-field="${field}"]`)?.value ?? '';
}

function getVariableRowHtml(): string {
  return `<div class="settings-row variable-row">
    <input class="settings-input" data-variable-field="key" placeholder="key">
    <input class="settings-input" data-variable-field="value" placeholder="value">
  </div>`;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
