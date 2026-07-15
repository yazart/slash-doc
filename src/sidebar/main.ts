import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

type VSCodeApi = {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

type SwitchElement = HTMLElement & {
  checked?: boolean;
};

declare const acquireVsCodeApi: () => VSCodeApi;

const vscode = acquireVsCodeApi();
let selectedPageId: string | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | undefined;
const sidebarState = readSidebarState();
const collapsedPageIds = new Set(sidebarState.collapsedPageIds);

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

document.querySelector('#compile-site')?.addEventListener('click', () => {
  vscode.postMessage({ type: 'compileDocumentation' });
});

document.querySelector('#back-to-menu')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'backToMenu'
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

document.querySelectorAll<HTMLButtonElement>('[data-rename-page-id]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    vscode.postMessage({
      type: 'renamePage',
      pageId: button.dataset.renamePageId ?? null
    });
  });
});

bindTreeToggles();
bindPageDragAndDrop();

document.querySelector('#add-service')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createApiService'
  });
});

document.querySelector('#reload-api-services')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'reloadApiServices'
  });
});

document.querySelector('#add-addon')?.addEventListener('click', () => {
  vscode.postMessage({
    type: 'createCustomAddon'
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

type PageDropPosition = 'before' | 'inside' | 'after';
type PageDropTarget = { targetId?: string; position: PageDropPosition | 'root' };

function bindTreeToggles() {
  document.querySelectorAll<HTMLButtonElement>('[data-toggle-page-id]').forEach((button) => {
    const pageId = button.dataset.togglePageId;
    if (!pageId) return;
    setTreeNodeCollapsed(pageId, collapsedPageIds.has(pageId), false);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTreeNodeCollapsed(pageId, !collapsedPageIds.has(pageId));
    });
  });
}

function setTreeNodeCollapsed(pageId: string, collapsed: boolean, persist = true) {
  const node = document.querySelector<HTMLElement>(`[data-tree-node-id="${CSS.escape(pageId)}"]`);
  const toggle = node?.querySelector<HTMLButtonElement>(':scope > .tree-row [data-toggle-page-id]');
  node?.classList.toggle('collapsed', collapsed);
  toggle?.setAttribute('aria-expanded', String(!collapsed));
  toggle?.setAttribute('aria-label', collapsed ? 'Развернуть дочерние страницы' : 'Свернуть дочерние страницы');
  if (collapsed) collapsedPageIds.add(pageId);
  else collapsedPageIds.delete(pageId);
  if (persist) saveSidebarState();
}

function bindPageDragAndDrop() {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-page-drop-id]'));
  const handles = Array.from(document.querySelectorAll<HTMLElement>('[data-drag-page-id]'));
  const rootDrop = document.querySelector<HTMLElement>('[data-root-drop]');
  const tree = document.querySelector<HTMLElement>('.tree');

  const clearDropTargets = () => {
    document.querySelectorAll('.drop-before,.drop-inside,.drop-after,.drop-target').forEach((element) => {
      element.classList.remove('drop-before', 'drop-inside', 'drop-after', 'drop-target');
    });
  };

  handles.forEach((handle) => {
    handle.addEventListener('pointerdown', (startEvent) => {
      if (startEvent.button !== 0) return;
      const draggedPageId = handle.dataset.dragPageId;
      const sourceRow = handle.closest<HTMLElement>('.tree-row');
      if (!draggedPageId || !sourceRow) return;
      startEvent.stopPropagation();
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const pointerId = startEvent.pointerId;
      let dragging = false;
      let dropTarget: PageDropTarget | undefined;
      let ghost: HTMLElement | undefined;

      const move = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        if (!dragging && Math.hypot(event.clientX - startX, event.clientY - startY) < 4) return;
        event.preventDefault();
        if (!dragging) {
          dragging = true;
          sourceRow.classList.add('dragging');
          document.body.classList.add('page-dragging');
          ghost = createPageDragGhost(sourceRow.querySelector('.tree-label')?.textContent ?? 'Страница');
          document.body.append(ghost);
        }

        if (ghost) {
          ghost.style.left = `${event.clientX + 12}px`;
          ghost.style.top = `${event.clientY + 12}px`;
        }
        autoScrollPageTree(tree, event.clientY);
        clearDropTargets();
        dropTarget = undefined;
        const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;

        if (rootDrop && hit?.closest('[data-root-drop]') === rootDrop) {
          rootDrop.classList.add('drop-target');
          dropTarget = { position: 'root' };
          return;
        }

        const row = hit?.closest<HTMLElement>('[data-page-drop-id]');
        if (!row || !canDropOnRow(row, draggedPageId)) return;
        const position = getPageDropPosition(row, event.clientY);
        row.classList.add(`drop-${position}`);
        dropTarget = { targetId: row.dataset.pageDropId, position };
      };

      const finish = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('pointerup', finish, true);
        document.removeEventListener('pointercancel', cancel, true);
        clearDropTargets();
        sourceRow.classList.remove('dragging');
        document.body.classList.remove('page-dragging');
        ghost?.remove();
        if (dragging && dropTarget) {
          if (dropTarget.position === 'inside' && dropTarget.targetId) {
            setTreeNodeCollapsed(dropTarget.targetId, false);
          }
          vscode.postMessage({ type: 'movePage', pageId: draggedPageId, ...dropTarget });
        }
        if (dragging) {
          handle.dataset.suppressClick = 'true';
          setTimeout(() => delete handle.dataset.suppressClick, 0);
        }
      };

      const cancel = (event: PointerEvent) => {
        dropTarget = undefined;
        finish(event);
      };

      document.addEventListener('pointermove', move, { capture: true, passive: false });
      document.addEventListener('pointerup', finish, true);
      document.addEventListener('pointercancel', cancel, true);
    });
  });
}

function canDropOnRow(row: HTMLElement, draggedPageId: string): boolean {
  if (row.dataset.pageDropId === draggedPageId) return false;
  const draggedNode = document.querySelector<HTMLElement>(`[data-drag-page-id="${CSS.escape(draggedPageId)}"]`)?.closest('.tree-node');
  return !draggedNode?.contains(row);
}

function getPageDropPosition(row: HTMLElement, clientY: number): PageDropPosition {
  const bounds = row.getBoundingClientRect();
  const offset = (clientY - bounds.top) / Math.max(bounds.height, 1);
  if (offset < 0.25) return 'before';
  if (offset > 0.75) return 'after';
  return 'inside';
}

function createPageDragGhost(title: string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'page-drag-ghost';
  ghost.textContent = title;
  return ghost;
}

function autoScrollPageTree(tree: HTMLElement | null, clientY: number): void {
  if (!tree) return;
  const bounds = tree.getBoundingClientRect();
  if (clientY < bounds.top + 28) tree.scrollTop -= 10;
  if (clientY > bounds.bottom - 28) tree.scrollTop += 10;
}

function readSidebarState(): { collapsedPageIds: string[] } {
  const value = vscode.getState();
  if (!value || typeof value !== 'object' || !('collapsedPageIds' in value)) return { collapsedPageIds: [] };
  const collapsed = (value as { collapsedPageIds?: unknown }).collapsedPageIds;
  return { collapsedPageIds: Array.isArray(collapsed) ? collapsed.filter((item): item is string => typeof item === 'string') : [] };
}

function saveSidebarState() {
  vscode.setState({ ...sidebarState, collapsedPageIds: Array.from(collapsedPageIds) });
}

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
      confluenceTable: isAddonEnabled('confluenceTable'),
      image: isAddonEnabled('image'),
      marker: isAddonEnabled('marker'),
      inlineCode: isAddonEnabled('inlineCode'),
      underline: isAddonEnabled('underline'),
      textColor: isAddonEnabled('textColor'),
      mermaid: isAddonEnabled('mermaid'),
      flowDesigner: isAddonEnabled('flowDesigner'),
      networkCanvas: isAddonEnabled('networkCanvas'),
      imageAnnotation: isAddonEnabled('imageAnnotation'),
      apiEndpoint: isAddonEnabled('apiEndpoint'),
      fileProcessor: isAddonEnabled('fileProcessor'),
      taskTable: isAddonEnabled('taskTable')
    },
    customEditorAddons: Array.from(document.querySelectorAll<HTMLElement>('[data-custom-addon-id]')).map((row) => ({
      id: row.dataset.customAddonId ?? createId('addon'),
      name: getRowInput(row, 'custom-addon', 'name'),
      toolName: getRowInput(row, 'custom-addon', 'toolName'),
      file: getRowInput(row, 'custom-addon', 'file'),
      enabled: isCustomAddonEnabled(row.dataset.customAddonId)
    })),
    apiPrefix: document.querySelector<HTMLInputElement>('#api-prefix')?.value ?? '/api',
    apiPort: Number(document.querySelector<HTMLInputElement>('#api-port')?.value ?? '4317'),
    apiServices: Array.from(document.querySelectorAll<HTMLElement>('[data-service-id]')).map((row) => ({
      id: row.dataset.serviceId ?? createId('service'),
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
