import EditorJS, { type OutputData } from '@editorjs/editorjs';
import { createBrowserPageStorage } from './browser-page-storage';
import { createEditorTools } from '../webview/editor-tool-registry';
import { normalizeEditorData, preserveInlineMarkup } from '../webview/editor-data';
import { createUserDirectoryBridge } from '../webview/user-directory';
import { installEditorPasteHandlers } from '../webview/editor-paste-handlers';
import { installEditorTextInlineToolbar } from '../webview/editor-text-inline-toolbar';
import { installListExitHandler } from '../webview/list-exit-handler';
import { renderPendingMermaidDiagrams } from '../webview/mermaid-tool';
import { createEditorUndoHistory, installEditorHistoryListeners } from '../webview/editor-undo-history';
import { installEditorTextStyles } from './editor-theme';
import { findEventAnchor, getDocumentationPageId, getExternalUrl } from '../webview/editor-link-navigation';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import '../webview/editor-foundation.css';
import '../webview/editor-layout.css';
import '../webview/editor-components.css';
import '../webview/editor-editorjs.css';
import '../webview/text-inline-toolbar.css';
import '../webview/nested-list-tool.css';
import './editor.css';

const token = location.hash.slice(1);
const status = document.querySelector<HTMLElement>('#save-status')!;
let parentOrigin: string | undefined;
let editor: EditorJS | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let revision = 0;
let restoring = false;
let queue = Promise.resolve();
const history = createEditorUndoHistory<OutputData>(5);
const resources = new Map<
  string,
  {
    resolve(bytes: Uint8Array): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
const storage = createBrowserPageStorage(
  (fileName) =>
    new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        resources.delete(id);
        reject(new Error(`Не удалось загрузить ${fileName}`));
      }, 15000);
      resources.set(id, { resolve, reject, timer });
      send({ type: 'resource', id, fileName });
    }),
);
const users = createUserDirectoryBridge({
  postMessage(message: unknown) {
    send(message as Record<string, unknown>);
  },
});
window.__SLASH_DOC_USER_DIRECTORY__ = users;
window.__SLASH_DOC_READ_CLIPBOARD__ = () => navigator.clipboard.readText();
window.__SLASH_DOC_WRITE_CLIPBOARD__ = (text) => {
  void navigator.clipboard.writeText(text);
};
installEditorPasteHandlers(window.__SLASH_DOC_READ_CLIPBOARD__);
installEditorTextStyles();

document.addEventListener(
  'click',
  (event) => {
    const anchor = findEventAnchor(event);
    if (!anchor) return;
    const pageId = getDocumentationPageId(anchor);
    const url = getExternalUrl(anchor);
    if (!pageId && !url) return;
    event.preventDefault();
    event.stopPropagation();
    if (pageId) send({ type: 'openPage', pageId });
    else if (url) window.open(url, '_blank', 'noopener,noreferrer');
  },
  true,
);

window.addEventListener('message', (event) => {
  if (event.source !== parent || event.data?.token !== token) return;
  if (parentOrigin && event.origin !== parentOrigin) return;
  parentOrigin ??= event.origin;
  const message = event.data;
  if (users.handleMessage(message)) return;
  if (message.type === 'resource-result') {
    const pending = resources.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    resources.delete(message.id);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(new Uint8Array(message.bytes));
  } else if (message.type === 'initialize') {
    queue = queue.then(() => initialize(message)).catch(reportError);
  } else if (message.type === 'flush') {
    clearTimeout(timer);
    enqueueSave(message.id);
  } else if (message.type === 'saved' && message.revision === revision) {
    status.textContent = 'YAML применён в GitLab';
  } else if (message.type === 'save-error') {
    status.textContent = message.error;
  }
});

document.querySelector('#save-page')?.addEventListener('click', () => {
  clearTimeout(timer);
  enqueueSave();
});
window.addEventListener(
  'keydown',
  (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.code !== 'KeyZ') return;
    event.preventDefault();
    queue = queue
      .then(async () => {
        if (!editor) return;
        const previous = history.undo(preserveInlineMarkup(await editor.save()));
        if (!previous) return;
        restoring = true;
        try {
          await editor.render(previous);
        } finally {
          restoring = false;
        }
        changed();
      })
      .catch(reportError);
  },
  true,
);

async function initialize(message: { source: string; pages: any[]; pageId: string }): Promise<void> {
  restoring = true;
  clearTimeout(timer);
  try {
    const data = normalizeEditorData(await storage.decode(message.source));
    window.__SLASH_DOC_PAGES__ = message.pages;
    window.__SLASH_DOC_CURRENT_PAGE_ID__ = message.pageId;
    if (editor) {
      await editor.render(data);
    } else {
      const { tools, inlineToolbarTools } = createEditorTools({}, users);
      editor = new EditorJS({
        holder: 'editor',
        defaultBlock: 'paragraph',
        placeholder: 'Начните писать…',
        tools,
        inlineToolbar: inlineToolbarTools,
        data,
        onChange: changed,
      });
      await editor.isReady;
      const holder = document.querySelector<HTMLElement>('#editor')!;
      installEditorTextInlineToolbar(holder, { pages: message.pages, currentPageId: message.pageId });
      installListExitHandler(holder, editor.blocks, editor.caret);
      installEditorHistoryListeners(holder, changed);
    }
    history.reset(data);
    status.textContent = 'Готово';
    send({ type: 'initialized' });
  } finally {
    restoring = false;
  }
}

function changed(): void {
  if (restoring || !editor) return;
  status.textContent = 'Есть изменения';
  send({ type: 'dirty' });
  queue = queue
    .then(async () => {
      if (editor) history.record(preserveInlineMarkup(await editor.save()));
    })
    .catch(reportError);
  clearTimeout(timer);
  timer = setTimeout(() => enqueueSave(), 1000);
}

function enqueueSave(id?: string): void {
  queue = queue
    .then(async () => {
      if (!editor) throw new Error('Редактор не готов.');
      await renderPendingMermaidDiagrams();
      const data = preserveInlineMarkup(await editor.save());
      status.textContent = 'Применение YAML…';
      send({
        type: 'save',
        yaml: storage.encode(data as unknown as Record<string, unknown>),
        revision: ++revision,
        id,
      });
    })
    .catch((error) => reportError(error, id));
}

function reportError(error: unknown, id?: string): void {
  status.textContent = String(error);
  send({ type: 'error', error: String(error), id });
}

function send(message: Record<string, unknown>): void {
  parent.postMessage({ ...message, token }, parentOrigin ?? '*');
}

send({ type: 'ready' });
