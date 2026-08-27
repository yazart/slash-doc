import EditorJS, { type OutputData } from '@editorjs/editorjs';
import type { FileProcessorBridge } from './file-processor-tool';
import type { DocumentationPageLink } from './page-link-tool';
import { createUserDirectoryBridge } from './user-directory';
import { createEditorTools } from './editor-tool-registry';
import { installEditorPasteHandlers } from './editor-paste-handlers';
import { isRecord, normalizeEditorData, preserveInlineMarkup } from './editor-data';
import type { SlashDocWebviewSettings } from './editor-settings';
import { protectCustomTool, type CustomAddonModule, type CustomBlockToolConstructor } from './custom-tool-protection';
import { createPageSaveController, updatePageSaveStatus } from './page-save-controller';
import { renderPendingMermaidDiagrams } from './mermaid-tool';
import { createEditorUndoHistory, installEditorHistoryListeners } from './editor-undo-history';
import { installListExitHandler } from './list-exit-handler';
import { findEventAnchor, getDocumentationPageId, getExternalUrl } from './editor-link-navigation';
import { installEditorTextInlineToolbar } from './editor-text-inline-toolbar';
import { installPageHistoryPanel } from './page-history-panel';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './editor-foundation.css';
import './editor-layout.css';
import './editor-components.css';
import './editor-editorjs.css';
import './text-inline-toolbar.css';
import './page-history-panel.css';

type VSCodeApi = { postMessage(message: unknown): void };

declare const acquireVsCodeApi: () => VSCodeApi;
declare global {
  interface Window {
    __SLASH_DOC_INITIAL_DATA__?: unknown;
    __SLASH_DOC_SETTINGS__?: SlashDocWebviewSettings;
    __SLASH_DOC_CUSTOM_ADDONS__?: CustomAddonModule[];
    __SLASH_DOC_PAGES__?: DocumentationPageLink[];
    __SLASH_DOC_CURRENT_PAGE_ID__?: string | null;
    __SLASH_DOC_FOCUS_EDITOR__?: boolean;
  }
}

const vscode = acquireVsCodeApi();
const userDirectory = createUserDirectoryBridge(vscode);
window.__SLASH_DOC_USER_DIRECTORY__ = userDirectory;
let editor: EditorJS;
const settings = window.__SLASH_DOC_SETTINGS__ ?? {};
const { tools, inlineToolbarTools } = createEditorTools(settings, userDirectory);
const editorHistory = createEditorUndoHistory<OutputData>(5);
let historyCapture = Promise.resolve();
let isRestoringHistory = false;
const saveStatus = document.querySelector<HTMLElement>('#save-status');
const pageSave = createPageSaveController({
  autoSave: settings.autoSave,
  readData: readEditorData,
  postMessage: (message) => vscode.postMessage(message),
  setStatus: (status) => updatePageSaveStatus(saveStatus, status),
  reportError: (error, requestId) => {
    console.error('Slash Doc: не удалось подготовить страницу к сохранению', error);
    vscode.postMessage({
      type: 'saveClientError',
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  },
});

document.addEventListener(
  'click',
  (event) => {
    const anchor = findEventAnchor(event);
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
installEditorPasteHandlers(window.__SLASH_DOC_READ_CLIPBOARD__);

window.__SLASH_DOC_FILE_PROCESSOR__ = {
  upload: (files) => requestFileProcessor('fileProcessorUpload', { files }),
  run: (script, inputFiles) => requestFileProcessor('fileProcessorRun', { script, inputFiles }),
  download: (fileName) => requestFileProcessor('fileProcessorDownload', { fileName }),
} satisfies FileProcessorBridge;

async function exportPage(format: 'html' | 'md') {
  vscode.postMessage({ type: 'export', format, data: await readEditorData() });
}

async function readEditorData(): Promise<OutputData> {
  await renderPendingMermaidDiagrams();
  return preserveInlineMarkup(await editor.save());
}

const editorInitialization = initEditor();

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (userDirectory.handleMessage(event.data)) return;
  if (pageSave.handleMessage(event.data)) return;

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
  await historyCapture;
  const normalized = normalizeEditorData(data);
  isRestoringHistory = true;
  try {
    await editor.render(normalized);
    editorHistory.reset(normalized);
  } finally {
    isRestoringHistory = false;
  }
}

async function initEditor() {
  await loadCustomTools();
  const initialData = normalizeEditorData(window.__SLASH_DOC_INITIAL_DATA__);
  editorHistory.reset(initialData);

  editor = new EditorJS({
    holder: 'editor',
    defaultBlock: 'paragraph',
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
    data: initialData,
    onChange: handleEditorChange,
  });

  await editor.isReady;
  installPageHistoryPanel(tools, (message) => vscode.postMessage(message));
  const holder = document.querySelector('#editor');
  pageSave.installFallback(holder);
  installEditorHistoryListeners(holder, handleEditorChange);
  if (holder) installListExitHandler(holder, editor.blocks, editor.caret);
  if (holder instanceof HTMLElement) {
    installEditorTextInlineToolbar(holder, {
      pages: window.__SLASH_DOC_PAGES__ ?? [],
      currentPageId: window.__SLASH_DOC_CURRENT_PAGE_ID__ ?? undefined,
    });
  }
  installUndoShortcut();
  if (window.__SLASH_DOC_FOCUS_EDITOR__) {
    requestAnimationFrame(() => editor.caret.setToLastBlock('start'));
  }
}

function handleEditorChange(): void {
  if (isRestoringHistory) return;
  historyCapture = historyCapture
    .then(async () => editorHistory.record(preserveInlineMarkup(await editor.save())))
    .catch((error: unknown) => console.error('Slash Doc: не удалось записать шаг истории', error));
  pageSave.schedule();
}

function installUndoShortcut(): void {
  window.addEventListener(
    'keydown',
    (event) => {
      const isUndoKey = event.code === 'KeyZ' || ['z', 'я'].includes(event.key.toLowerCase());
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || !isUndoKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void undoEditor().catch((error: unknown) => console.error('Slash Doc: не удалось отменить изменение', error));
    },
    true,
  );
}

async function undoEditor(): Promise<void> {
  await editorInitialization;
  await historyCapture;
  const current = preserveInlineMarkup(await editor.save());
  const previous = editorHistory.undo(current);
  if (!previous) return;
  isRestoringHistory = true;
  try {
    await editor.render(previous);
  } catch (error) {
    editorHistory.record(current);
    throw error;
  } finally {
    isRestoringHistory = false;
  }
  pageSave.schedule();
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

document.querySelector('#export-html')?.addEventListener('click', () => {
  void exportPage('html');
});

document.querySelector('#export-md')?.addEventListener('click', () => {
  void exportPage('md');
});

document.querySelector('#save-page')?.addEventListener('click', () => void pageSave.saveNow('manual'));
