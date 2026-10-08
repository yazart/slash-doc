type SwitchElement = HTMLElement & { checked?: boolean };

export function collectSettings() {
  return {
    version: 1,
    autoSave: {
      enabled: isSwitchEnabled('auto-save-enabled', true),
      intervalSeconds: Number(document.querySelector<HTMLInputElement>('#auto-save-interval')?.value ?? '1'),
    },
    exportOptions: {
      separateFiles: isSwitchEnabled('separate-files', false),
      repositoryUrl: document.querySelector<HTMLInputElement>('#repository-url')?.value.trim() ?? '',
      defaultBranch: document.querySelector<HTMLInputElement>('#default-branch')?.value.trim() || 'master',
      markdownRootFileName:
        document.querySelector<HTMLInputElement>('#markdown-root-file-name')?.value.trim() ?? 'README.md',
    },
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
      taskTable: isAddonEnabled('taskTable'),
      codeBlock: isAddonEnabled('codeBlock'),
      diffBlock: isAddonEnabled('diffBlock'),
      bpmnModeler: isAddonEnabled('bpmnModeler'),
      bpmnPreview: isAddonEnabled('bpmnPreview'),
      userMention: isAddonEnabled('userMention'),
      mkdocsAdmonition: isAddonEnabled('mkdocsAdmonition'),
      mkdocsTabs: isAddonEnabled('mkdocsTabs'),
      mkdocsDetails: isAddonEnabled('mkdocsDetails'),
      mkdocsChecklist: isAddonEnabled('mkdocsChecklist'),
    },
    customEditorAddons: Array.from(document.querySelectorAll<HTMLElement>('[data-custom-addon-id]')).map((row) => ({
      id: row.dataset.customAddonId ?? createId('addon'),
      name: getRowInput(row, 'custom-addon', 'name'),
      toolName: getRowInput(row, 'custom-addon', 'toolName'),
      file: getRowInput(row, 'custom-addon', 'file'),
      enabled: isCustomAddonEnabled(row.dataset.customAddonId),
    })),
    apiPrefix: document.querySelector<HTMLInputElement>('#api-prefix')?.value ?? '/api',
    apiPort: Number(document.querySelector<HTMLInputElement>('#api-port')?.value ?? '4317'),
    apiServices: Array.from(document.querySelectorAll<HTMLElement>('[data-service-id]')).map((row) => ({
      id: row.dataset.serviceId ?? createId('service'),
      name: getRowInput(row, 'service', 'name'),
      file: getRowInput(row, 'service', 'file'),
    })),
    variables: Array.from(document.querySelectorAll<HTMLElement>('.variable-row')).map((row) => ({
      key: getRowInput(row, 'variable', 'key'),
      value: getRowInput(row, 'variable', 'value'),
    })),
  };
}

function isAddonEnabled(addon: string): boolean {
  const element = document.querySelector<SwitchElement>(`[data-addon="${addon}"]`);
  return element?.checked ?? element?.hasAttribute('checked') ?? true;
}

function isSwitchEnabled(id: string, fallback: boolean): boolean {
  const element = document.querySelector<SwitchElement>(`#${id}`);
  return element ? (element.checked ?? element.hasAttribute('checked')) : fallback;
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

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
