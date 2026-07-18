import type { ApiService, CustomEditorAddon, SettingsVariable, SlashDocSettings } from './types';
import { createSettingsId, escapeJavaScriptString, isRecord } from './utils';

export function getDefaultSettings(): SlashDocSettings {
  return {
    version: 1,
    editorAddons: {
      header: true,
      list: true,
      confluenceTable: true,
      image: true,
      marker: true,
      inlineCode: true,
      underline: true,
      textColor: true,
      mermaid: true,
      flowDesigner: true,
      networkCanvas: true,
      imageAnnotation: true,
      apiEndpoint: true,
      fileProcessor: true,
      taskTable: true,
      codeBlock: true,
      diffBlock: true,
      bpmnModeler: true,
      bpmnPreview: true,
      userMention: true,
      approvalTable: true,
    },
    customEditorAddons: [],
    apiPrefix: '/api',
    apiPort: 4317,
    apiServices: [],
    variables: [],
  };
}

export function normalizeSettings(value: unknown): SlashDocSettings {
  const defaults = getDefaultSettings();

  if (!isRecord(value)) {
    return defaults;
  }

  return {
    version: 1,
    editorAddons: {
      header: getBooleanSetting(value.editorAddons, 'header', defaults.editorAddons.header),
      list: getBooleanSetting(value.editorAddons, 'list', defaults.editorAddons.list),
      confluenceTable: getBooleanSetting(
        value.editorAddons,
        'confluenceTable',
        getBooleanSetting(value.editorAddons, 'table', defaults.editorAddons.confluenceTable),
      ),
      image: getBooleanSetting(value.editorAddons, 'image', defaults.editorAddons.image),
      marker: getBooleanSetting(value.editorAddons, 'marker', defaults.editorAddons.marker),
      inlineCode: getBooleanSetting(value.editorAddons, 'inlineCode', defaults.editorAddons.inlineCode),
      underline: getBooleanSetting(value.editorAddons, 'underline', defaults.editorAddons.underline),
      textColor: getBooleanSetting(value.editorAddons, 'textColor', defaults.editorAddons.textColor),
      mermaid: getBooleanSetting(value.editorAddons, 'mermaid', defaults.editorAddons.mermaid),
      flowDesigner: getBooleanSetting(value.editorAddons, 'flowDesigner', defaults.editorAddons.flowDesigner),
      networkCanvas: getBooleanSetting(value.editorAddons, 'networkCanvas', defaults.editorAddons.networkCanvas),
      imageAnnotation: getBooleanSetting(value.editorAddons, 'imageAnnotation', defaults.editorAddons.imageAnnotation),
      apiEndpoint: getBooleanSetting(value.editorAddons, 'apiEndpoint', defaults.editorAddons.apiEndpoint),
      fileProcessor: getBooleanSetting(value.editorAddons, 'fileProcessor', defaults.editorAddons.fileProcessor),
      taskTable: getBooleanSetting(value.editorAddons, 'taskTable', defaults.editorAddons.taskTable),
      codeBlock: getBooleanSetting(value.editorAddons, 'codeBlock', defaults.editorAddons.codeBlock),
      diffBlock: getBooleanSetting(value.editorAddons, 'diffBlock', defaults.editorAddons.diffBlock),
      bpmnModeler: getBooleanSetting(value.editorAddons, 'bpmnModeler', defaults.editorAddons.bpmnModeler),
      bpmnPreview: getBooleanSetting(value.editorAddons, 'bpmnPreview', defaults.editorAddons.bpmnPreview),
      userMention: getBooleanSetting(value.editorAddons, 'userMention', defaults.editorAddons.userMention),
      approvalTable: getBooleanSetting(value.editorAddons, 'approvalTable', defaults.editorAddons.approvalTable),
    },
    customEditorAddons: normalizeCustomEditorAddons(value.customEditorAddons),
    apiPrefix: typeof value.apiPrefix === 'string' ? normalizeApiPrefix(value.apiPrefix) : defaults.apiPrefix,
    apiPort: typeof value.apiPort === 'number' ? value.apiPort : defaults.apiPort,
    apiServices: normalizeApiServices(value.apiServices),
    variables: normalizeVariables(value.variables),
  };
}

export function normalizeApiPrefix(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '/api';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function ensureMjsFileName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.length > 0 ? trimmed : createSettingsId('route');
  const fileName = safe.split(/[\\/]/).at(-1) ?? safe;
  const normalized = fileName.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.endsWith('.mjs') ? normalized : `${normalized}.mjs`;
}

export function ensureJavaScriptModuleFileName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.length > 0 ? trimmed : createSettingsId('addon');
  const fileName = safe.split(/[\\/]/).at(-1) ?? safe;
  const normalized = fileName.replaceAll(/[^a-zA-Z0-9._-]/g, '-');
  return normalized.endsWith('.mjs') || normalized.endsWith('.js') ? normalized : `${normalized}.mjs`;
}

export function normalizeToolName(value: string): string {
  const normalized = value
    .trim()
    .replaceAll(/[^a-zA-Z0-9_$]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join('');

  return normalized || `custom${Date.now().toString(36)}`;
}

export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

  return slug.length > 0 ? slug : createSettingsId('route');
}

export function getApiRouteTemplate(name: string): string {
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

export function getCustomAddonTemplate(name: string): string {
  const className = `${normalizeToolName(name).replace(/^[a-z]/, (letter) => letter.toUpperCase())}Tool`;

  return `export default class ${className} {
  static get toolbox() {
    return {
      title: '${escapeJavaScriptString(name)}',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>'
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

function getBooleanSetting(value: unknown, key: string, fallback: boolean): boolean {
  if (!isRecord(value)) return fallback;
  const setting = value[key];
  return typeof setting === 'boolean' ? setting : fallback;
}

function normalizeApiServices(value: unknown): ApiService[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => ({
    id: typeof item.id === 'string' ? item.id : createSettingsId('service'),
    name: typeof item.name === 'string' ? item.name : '',
    file: typeof item.file === 'string' ? ensureMjsFileName(item.file) : `${createSettingsId('route')}.mjs`,
  }));
}

function normalizeCustomEditorAddons(value: unknown): CustomEditorAddon[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => {
    const name = typeof item.name === 'string' ? item.name : 'Пользовательский инструмент';
    return {
      id: typeof item.id === 'string' ? item.id : createSettingsId('addon'),
      name,
      toolName: typeof item.toolName === 'string' ? normalizeToolName(item.toolName) : normalizeToolName(name),
      file: typeof item.file === 'string' ? ensureJavaScriptModuleFileName(item.file) : `${slugify(name)}.mjs`,
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    };
  });
}

function normalizeVariables(value: unknown): SettingsVariable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((item) => ({
    key: typeof item.key === 'string' ? item.key : '',
    value: typeof item.value === 'string' ? item.value : '',
  }));
}
