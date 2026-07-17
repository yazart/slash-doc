import EditorJS from '@editorjs/editorjs';
import type { EditorConfig } from '@editorjs/editorjs/types/configs';
import type { OutputData } from '@editorjs/editorjs';
import type { InlineToolConstructable, ToolConstructable } from '@editorjs/editorjs/types/tools';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import ImageTool from '@editorjs/image';
import Marker from '@editorjs/marker';
import InlineCode from '@editorjs/inline-code';
import Underline from '@editorjs/underline';
import TextColorTool from './text-color-tool';
import PageLinkTool, { type DocumentationPageLink } from './page-link-tool';
import { setupHeaderInlineTools } from './header-inline-tools';
import mermaid from 'mermaid';
import FlowDesignerTool from './flow-designer-tool';
import NetworkCanvasTool from './network-canvas-tool';
import ImageAnnotationTool from './image-annotation-tool';
import ApiEndpointTool from './api-endpoint-tool';
import FileProcessorTool, { type FileProcessorBridge } from './file-processor-tool';
import TaskTableTool from './task-table-tool';
import ConfluenceTableTool from './confluence-table-tool';
import CodeBlockTool from './code-block-tool';
import DiffBlockTool from './diff-block-tool';
import { BpmnModelerTool, BpmnPreviewTool } from './bpmn-tools';
import ApprovalTableTool from './approval-table-tool';
import { createUserDirectoryBridge, setupUserMentions } from './user-directory';
import { LUCIDE_ICONS } from './lucide-icons';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

type VSCodeApi = {
  postMessage(message: unknown): void;
};

declare const acquireVsCodeApi: () => VSCodeApi;
declare global {
  interface Window {
    __SLASH_DOC_INITIAL_DATA__?: unknown;
    __SLASH_DOC_SETTINGS__?: SlashDocSettings;
    __SLASH_DOC_CUSTOM_ADDONS__?: CustomAddonModule[];
    __SLASH_DOC_PAGES__?: DocumentationPageLink[];
    __SLASH_DOC_CURRENT_PAGE_ID__?: string | null;
    __SLASH_DOC_FOCUS_EDITOR__?: boolean;
  }
}

type SlashDocSettings = {
  editorAddons?: {
    header?: boolean;
    list?: boolean;
    confluenceTable?: boolean;
    image?: boolean;
    marker?: boolean;
    inlineCode?: boolean;
    underline?: boolean;
    textColor?: boolean;
    mermaid?: boolean;
    flowDesigner?: boolean;
    networkCanvas?: boolean;
    imageAnnotation?: boolean;
    apiEndpoint?: boolean;
    fileProcessor?: boolean;
    taskTable?: boolean;
    codeBlock?: boolean;
    diffBlock?: boolean;
    bpmnModeler?: boolean;
    bpmnPreview?: boolean;
    userMention?: boolean;
    approvalTable?: boolean;
  };
};

type MermaidToolData = {
  code?: string;
  caption?: string;
};

type MermaidToolConstructorArgs = {
  data?: MermaidToolData;
};

type CustomAddonModule = {
  id: string;
  toolName: string;
  uri: string;
};

type CustomBlockTool = {
  render(...args: unknown[]): HTMLElement;
};

type CustomBlockToolConstructor = new (...args: any[]) => CustomBlockTool;

const vscode = acquireVsCodeApi();
const userDirectory = createUserDirectoryBridge(vscode);
window.__SLASH_DOC_USER_DIRECTORY__ = userDirectory;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
let editor: EditorJS;
const settings = window.__SLASH_DOC_SETTINGS__ ?? {};
const tools: NonNullable<EditorConfig['tools']> = {};

class LucideMarker extends Marker {
  get toolboxIcon(): string {
    return LUCIDE_ICONS.highlighter;
  }
}

class LucideInlineCode extends InlineCode {
  get toolboxIcon(): string {
    return LUCIDE_ICONS.code;
  }
}

class LucideUnderline extends Underline {
  get toolboxIcon(): string {
    return LUCIDE_ICONS.underline;
  }
}
const inlineToolbarTools = [
  'convertTo',
  'bold',
  'italic',
  'link',
  ...(settings.editorAddons?.marker !== false ? ['marker'] : []),
  ...(settings.editorAddons?.inlineCode !== false ? ['inlineCode'] : []),
  ...(settings.editorAddons?.underline !== false ? ['underline'] : []),
];

document.addEventListener(
  'click',
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    const pageId = getDocumentationPageId(anchor);
    if (pageId) {
      event.preventDefault();
      event.stopPropagation();
      vscode.postMessage({ type: 'openPage', pageId });
      return;
    }
    const url = getExternalUrl(anchor);
    if (url) {
      event.preventDefault();
      event.stopPropagation();
      vscode.postMessage({ type: 'openExternal', url });
    }
  },
  true,
);
const fileProcessorRequests = new Map<
  string,
  {
    resolve(value: unknown): void;
    reject(error: Error): void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();
const clipboardRequests = new Map<
  string,
  {
    resolve(value: string): void;
    reject(error: Error): void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

window.__SLASH_DOC_READ_CLIPBOARD__ = () => {
  const requestId = `clipboard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      clipboardRequests.delete(requestId);
      reject(new Error('Не удалось прочитать буфер обмена.'));
    }, 5_000);
    clipboardRequests.set(requestId, { resolve, reject, timeout });
    vscode.postMessage({ type: 'readClipboard', requestId });
  });
};

window.__SLASH_DOC_WRITE_CLIPBOARD__ = (text) => {
  vscode.postMessage({ type: 'writeClipboard', text });
};

window.__SLASH_DOC_FILE_PROCESSOR__ = {
  upload: (files) => requestFileProcessor('fileProcessorUpload', { files }),
  run: (script, inputFiles) => requestFileProcessor('fileProcessorRun', { script, inputFiles }),
  download: (fileName) => requestFileProcessor('fileProcessorDownload', { fileName }),
} satisfies FileProcessorBridge;

window.addEventListener(
  'paste',
  (event) => {
    const target = event
      .composedPath()
      .find((item) => item instanceof HTMLElement && item.matches('.slash-confluence-table-tool .ct-cell')) as
      | (HTMLElement & {
          __slashDocPasteTable?: (text: string, html: string) => void;
        })
      | undefined;
    const paste = target?.__slashDocPasteTable ?? window.__SLASH_DOC_TABLE_PASTE_TARGET__?.paste;
    if (!paste) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const html = event.clipboardData?.getData('text/html') ?? '';
    // Some VS Code/Electron versions expose an empty DataTransfer to webviews.
    // In that case do not suppress the native paste; beforeinput/keydown below
    // will request the clipboard through the extension host instead.
    if (!text && !html) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    paste(text, html);
  },
  true,
);

window.addEventListener(
  'keydown',
  (event) => {
    const isPasteKey = event.code === 'KeyV' || ['v', 'м'].includes(event.key.toLowerCase());
    if (!(event.metaKey || event.ctrlKey) || event.altKey || !isPasteKey) return;
    const paste = window.__SLASH_DOC_TABLE_PASTE_TARGET__?.paste;
    if (!paste || !window.__SLASH_DOC_READ_CLIPBOARD__) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void window
      .__SLASH_DOC_READ_CLIPBOARD__()
      .then((text) => paste(text, ''))
      .catch(() => undefined);
  },
  true,
);

window.addEventListener(
  'beforeinput',
  (event) => {
    if (!(event instanceof InputEvent) || event.inputType !== 'insertFromPaste') return;
    const paste = window.__SLASH_DOC_TABLE_PASTE_TARGET__?.paste;
    if (!paste || !window.__SLASH_DOC_READ_CLIPBOARD__) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void window
      .__SLASH_DOC_READ_CLIPBOARD__()
      .then((text) => paste(text, ''))
      .catch(() => undefined);
  },
  true,
);

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: {
    background: getCssVariable('--vscode-editor-background', '#1e1e1e'),
    primaryColor: getCssVariable('--vscode-editorWidget-background', '#252526'),
    primaryTextColor: getCssVariable('--vscode-editor-foreground', '#cccccc'),
    primaryBorderColor: getCssVariable('--vscode-panel-border', '#3c3c3c'),
    lineColor: getCssVariable('--vscode-descriptionForeground', '#8f8f8f'),
    textColor: getCssVariable('--vscode-editor-foreground', '#cccccc'),
    secondaryColor: getCssVariable('--vscode-list-hoverBackground', '#2a2d2e'),
    tertiaryColor: getCssVariable('--vscode-input-background', '#3c3c3c'),
  },
});

if (settings.editorAddons?.header !== false) {
  tools.header = { class: Header, toolbox: { title: 'Заголовок', icon: LUCIDE_ICONS.heading } };
}

if (settings.editorAddons?.list !== false) {
  tools.list = {
    class: List as unknown as ToolConstructable,
    toolbox: { title: 'Список', icon: LUCIDE_ICONS.list },
  };
}

if (settings.editorAddons?.confluenceTable !== false) {
  tools.confluenceTable = ConfluenceTableTool;
}

if (settings.editorAddons?.image !== false) {
  tools.image = {
    class: ImageTool,
    toolbox: { title: 'Изображение', icon: LUCIDE_ICONS.image },
    config: {
      uploader: {
        uploadByFile: async (file: File) => ({
          success: 1,
          file: {
            url: await readFileAsDataUrl(file),
          },
        }),
      },
    },
  };
}

if (settings.editorAddons?.marker !== false) {
  tools.marker = { class: LucideMarker, toolbox: { title: 'Маркер' } };
}

if (settings.editorAddons?.inlineCode !== false) {
  tools.inlineCode = { class: LucideInlineCode, toolbox: { title: 'Встроенный код' } };
}

if (settings.editorAddons?.underline !== false) {
  tools.underline = { class: LucideUnderline, toolbox: { title: 'Подчёркивание' } };
}

if (settings.editorAddons?.textColor !== false) {
  tools.textColor = TextColorTool as unknown as InlineToolConstructable;
}

if (settings.editorAddons?.approvalTable !== false) {
  tools.approvalTable = ApprovalTableTool;
}

tools.pageLink = {
  class: PageLinkTool as unknown as InlineToolConstructable,
  config: {
    pages: window.__SLASH_DOC_PAGES__ ?? [],
    currentPageId: window.__SLASH_DOC_CURRENT_PAGE_ID__ ?? undefined,
  },
};

setupHeaderInlineTools({
  pages: window.__SLASH_DOC_PAGES__ ?? [],
  currentPageId: window.__SLASH_DOC_CURRENT_PAGE_ID__ ?? undefined,
  textColorEnabled: settings.editorAddons?.textColor !== false,
});

if (settings.editorAddons?.userMention !== false) {
  setupUserMentions(userDirectory);
}

class MermaidTool {
  private readonly data: MermaidToolData;
  private wrapper?: HTMLDivElement;
  private textarea?: HTMLTextAreaElement;
  private caption?: HTMLInputElement;
  private preview?: HTMLDivElement;
  private renderTimer?: ReturnType<typeof setTimeout>;

  static get toolbox() {
    return {
      title: 'Диаграмма Mermaid',
      icon: LUCIDE_ICONS.chart,
    };
  }

  constructor({ data }: MermaidToolConstructorArgs) {
    this.data = {
      code: data?.code ?? 'flowchart TD\n  A[Начало] --> B[Диаграмма Mermaid]',
      caption: data?.caption ?? '',
    };
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'slash-mermaid-tool';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'slash-mermaid-code';
    this.textarea.spellcheck = false;
    this.textarea.value = this.data.code ?? '';

    this.caption = document.createElement('input');
    this.caption.className = 'slash-mermaid-caption';
    this.caption.placeholder = 'Подпись';
    this.caption.value = this.data.caption ?? '';

    this.preview = document.createElement('div');
    this.preview.className = 'slash-mermaid-preview';

    this.textarea.addEventListener('input', () => this.scheduleRender());
    this.caption.addEventListener('input', () => this.scheduleRender());

    this.wrapper.append(this.textarea, this.caption, this.preview);
    this.scheduleRender();

    return this.wrapper;
  }

  save() {
    return {
      code: this.textarea?.value ?? '',
      caption: this.caption?.value ?? '',
    };
  }

  private scheduleRender() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }

    this.renderTimer = setTimeout(() => {
      void this.renderPreview();
    }, 150);
  }

  private async renderPreview() {
    if (!this.preview) {
      return;
    }

    const code = this.textarea?.value.trim() ?? '';

    if (!code) {
      this.preview.textContent = '';
      return;
    }

    try {
      const id = `slash-mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await mermaid.render(id, code);
      this.preview.innerHTML = result.svg;
    } catch (error) {
      this.preview.textContent = error instanceof Error ? error.message : 'Ошибка отрисовки Mermaid';
    }
  }
}

if (settings.editorAddons?.mermaid !== false) {
  tools.mermaid = MermaidTool;
}

if (settings.editorAddons?.flowDesigner !== false) {
  tools.flowDesigner = FlowDesignerTool;
}

if (settings.editorAddons?.networkCanvas !== false) {
  tools.networkCanvas = NetworkCanvasTool;
}

if (settings.editorAddons?.imageAnnotation !== false) {
  tools.imageAnnotation = ImageAnnotationTool;
}

if (settings.editorAddons?.apiEndpoint !== false) {
  tools.apiEndpoint = ApiEndpointTool;
}

if (settings.editorAddons?.fileProcessor !== false) {
  tools.fileProcessor = FileProcessorTool;
}

if (settings.editorAddons?.taskTable !== false) {
  tools.taskTable = TaskTableTool;
}

if (settings.editorAddons?.codeBlock !== false) {
  tools.codeBlock = CodeBlockTool;
}

if (settings.editorAddons?.diffBlock !== false) {
  tools.diffBlock = DiffBlockTool;
}

if (settings.editorAddons?.bpmnModeler !== false) {
  tools.bpmnModeler = BpmnModelerTool;
}

if (settings.editorAddons?.bpmnPreview !== false) {
  tools.bpmnPreview = BpmnPreviewTool;
}

function scheduleAutosave() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }

  autosaveTimer = setTimeout(() => {
    void savePage('auto');
  }, 300);
}

async function savePage(source: 'auto' | 'manual') {
  const data = preserveInlineMarkup(await editor.save());
  vscode.postMessage({
    type: 'save',
    source,
    data,
  });
}

async function exportPage(format: 'html' | 'md') {
  const data = preserveInlineMarkup(await editor.save());
  vscode.postMessage({
    type: 'export',
    format,
    data,
  });
}

const editorInitialization = initEditor();

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (userDirectory.handleMessage(event.data)) return;

  if (isRecord(event.data) && event.data.type === 'clipboardResponse' && typeof event.data.requestId === 'string') {
    const pending = clipboardRequests.get(event.data.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    clipboardRequests.delete(event.data.requestId);
    pending.resolve(typeof event.data.text === 'string' ? event.data.text : '');
    return;
  }

  if (isRecord(event.data) && event.data.type === 'fileProcessorResponse' && typeof event.data.requestId === 'string') {
    const pending = fileProcessorRequests.get(event.data.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    fileProcessorRequests.delete(event.data.requestId);
    if (event.data.ok === true) {
      pending.resolve(event.data.data);
    } else {
      pending.reject(new Error(typeof event.data.error === 'string' ? event.data.error : 'Ошибка файлового сервиса'));
    }
    return;
  }

  if (
    !isRecord(event.data) ||
    event.data.type !== 'replaceData' ||
    !isRecord(event.data.data) ||
    !Array.isArray(event.data.data.blocks)
  ) {
    return;
  }

  void replaceEditorData(event.data.data as unknown as OutputData);
});

function requestFileProcessor<T>(type: string, payload: Record<string, unknown>): Promise<T> {
  const requestId = `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      fileProcessorRequests.delete(requestId);
      reject(new Error('Файловый сервис не ответил вовремя.'));
    }, 40_000);
    fileProcessorRequests.set(requestId, {
      resolve: (value) => resolve(value as T),
      reject,
      timeout,
    });
    vscode.postMessage({ type, requestId, ...payload });
  });
}

async function replaceEditorData(data: OutputData) {
  await editorInitialization;
  await editor.render(normalizeEditorData(data));
}

async function initEditor() {
  await loadCustomTools();

  editor = new EditorJS({
    holder: 'editor',
    autofocus: true,
    placeholder: 'Начните писать в Editor.js…',
    inlineToolbar: inlineToolbarTools,
    i18n: {
      messages: {
        ui: {
          blockTunes: {
            toggler: {
              'Click to tune': 'Нажмите для настройки',
              'or drag to move': 'или перетащите для перемещения',
            },
          },
          inlineToolbar: {
            converter: {
              'Convert to': 'Преобразовать в',
            },
          },
          toolbar: {
            toolbox: {
              Add: 'Добавить',
            },
          },
          popover: {
            Filter: 'Поиск',
            'Nothing found': 'Ничего не найдено',
          },
        },
        toolNames: {
          Text: 'Текст',
          Heading: 'Заголовок',
          List: 'Список',
          Image: 'Изображение',
          Marker: 'Маркер',
          'Inline Code': 'Встроенный код',
          Underline: 'Подчёркивание',
          'Confluence Table': 'Таблица Confluence',
          Mermaid: 'Диаграмма Mermaid',
          'Flow Designer': 'Конструктор процессов',
          'Network Canvas': 'Сетевая схема',
          'Image Annotation': 'Аннотация изображения',
          'API Endpoint': 'Эндпоинт API',
          'File Processor': 'Обработчик файлов',
          'Task Table': 'Доска задач',
          'Page Link': 'Ссылка на страницу',
          Code: 'Код',
          Diff: 'Diff',
          'BPMN Modeler': 'BPMN-редактор',
          'BPMN Preview': 'Предпросмотр BPMN',
          'Approval Table': 'Таблица согласования',
        },
        tools: {
          header: {
            'Heading 1': 'Заголовок 1',
            'Heading 2': 'Заголовок 2',
            'Heading 3': 'Заголовок 3',
            'Heading 4': 'Заголовок 4',
            'Heading 5': 'Заголовок 5',
            'Heading 6': 'Заголовок 6',
          },
          list: {
            Ordered: 'Нумерованный',
            Unordered: 'Маркированный',
          },
          image: {
            'Select an Image': 'Выбрать изображение',
            Caption: 'Подпись',
            'With border': 'С рамкой',
            'Stretch image': 'Растянуть изображение',
            'With background': 'С фоном',
            'With caption': 'С подписью',
            'Couldn’t upload image. Please try another.': 'Не удалось загрузить изображение. Попробуйте другое.',
          },
        },
        blockTunes: {
          delete: {
            Delete: 'Удалить',
            'Click to delete': 'Нажмите для удаления',
          },
          moveUp: {
            'Move up': 'Переместить вверх',
          },
          moveDown: {
            'Move down': 'Переместить вниз',
          },
        },
      },
    },
    tools,
    data: normalizeEditorData(window.__SLASH_DOC_INITIAL_DATA__),
    onChange: scheduleAutosave,
  });

  await editor.isReady;
  if (window.__SLASH_DOC_FOCUS_EDITOR__) {
    requestAnimationFrame(() => editor.caret.setToLastBlock('start'));
  }
}

function normalizeEditorData(value: unknown): OutputData {
  const source = isRecord(value) ? value : {};
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  return {
    ...source,
    blocks: blocks.filter(isRecord).map((block) =>
      block.type === 'table'
        ? {
            ...block,
            type: 'confluenceTable',
            data: isRecord(block.data)
              ? {
                  rows: Array.isArray(block.data.content) ? block.data.content : [],
                  headerRow: block.data.withHeadings === true,
                  headerColumn: false,
                }
              : { rows: [['']], headerRow: false, headerColumn: false },
          }
        : block,
    ),
  } as unknown as OutputData;
}

function preserveInlineMarkup(data: OutputData): OutputData {
  const blockElements = Array.from(document.querySelectorAll<HTMLElement>('#editor .ce-block'));
  data.blocks.forEach((block, index) => {
    const element = blockElements[index];
    if (!element || !isRecord(block.data)) return;
    if (block.type === 'paragraph' || block.type === 'header') {
      const editable = element.querySelector<HTMLElement>('.ce-paragraph, .ce-header, [contenteditable="true"]');
      if (editable) block.data.text = editable.innerHTML;
      return;
    }
    if (block.type === 'list') {
      const items = Array.from(element.querySelectorAll<HTMLElement>('.cdx-list__item')).map((item) => item.innerHTML);
      if (items.length > 0) block.data.items = items;
    }
  });
  return data;
}

async function loadCustomTools() {
  await Promise.all(
    (window.__SLASH_DOC_CUSTOM_ADDONS__ ?? []).map(async (addon) => {
      const module = await import(addon.uri);
      const tool = module.default ?? module.tool;

      if (tool) {
        tools[addon.toolName] = protectCustomTool(tool as CustomBlockToolConstructor, addon);
      }
    }),
  );
}

function protectCustomTool(tool: CustomBlockToolConstructor, addon: CustomAddonModule): ToolConstructable {
  return class ProtectedCustomTool extends tool {
    override render(...args: unknown[]): HTMLElement {
      const root = super.render(...args);
      root.dataset.slashDocCustomAddon = addon.id;
      root.addEventListener('keydown', stopCustomBlockDeletion);
      return root;
    }
  } as unknown as ToolConstructable;
}

function stopCustomBlockDeletion(event: KeyboardEvent): void {
  if (event.key !== 'Backspace') return;
  event.stopPropagation();
}

function getDocumentationPageId(anchor: HTMLAnchorElement): string | undefined {
  const explicitPageId = anchor.dataset.pageId;
  if (explicitPageId) return explicitPageId;
  const href = anchor.getAttribute('href')?.trim() ?? '';
  const encodedPageId =
    /^slash-doc:\/\/(?:page\/)?([^/?#]+)/i.exec(href)?.[1] ?? /^slash-doc:page\/([^/?#]+)/i.exec(href)?.[1];
  if (!encodedPageId) return undefined;
  try {
    return decodeURIComponent(encodedPageId);
  } catch {
    return encodedPageId;
  }
}

function getExternalUrl(anchor: HTMLAnchorElement): string | undefined {
  const href = anchor.getAttribute('href')?.trim();
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

document.querySelector('#export-html')?.addEventListener('click', () => {
  void exportPage('html');
});

document.querySelector('#export-md')?.addEventListener('click', () => {
  void exportPage('md');
});

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function getCssVariable(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
