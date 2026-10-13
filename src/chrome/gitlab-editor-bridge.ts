import { getGitLabPageLocation } from './gitlab-location';

type SourceEditor = {
  getValue(): string;
  setValue(value: string): void;
  layout?(): void;
};

let capturedEditor: SourceEditor | undefined;
let capturedElement: Element | undefined;

// GitLab SourceEditor dispatches this event with its instance in detail.
// Capture at document_start, including events that do not bubble.
document.addEventListener(
  'editor-ready',
  (event) => {
    if (!getGitLabPageLocation(location.href)) return;
    const instance = (event as CustomEvent<{ instance?: SourceEditor }>).detail?.instance;
    if (instance && typeof instance.getValue === 'function' && typeof instance.setValue === 'function') {
      capturedEditor = instance;
      capturedElement = event.target instanceof Element ? event.target : undefined;
    }
  },
  true,
);

window.addEventListener('message', async (event) => {
  if (event.source !== window || event.origin !== location.origin || !getGitLabPageLocation(location.href)) return;
  const request = event.data;
  if (request?.channel !== 'slash-doc-gitlab-request' || typeof request.id !== 'string') return;
  if (!['read', 'write', 'layout'].includes(request.action)) return;
  try {
    const editor = findEditor();
    if (!editor) throw new Error('Редактор GitLab ещё не готов. Обновите страницу после установки расширения.');
    if (request.action === 'write') {
      if (typeof request.value !== 'string') throw new Error('Некорректное содержимое YAML.');
      editor.setValue(request.value);
      // Vue SourceEditor debounces its model -> component update by 250ms.
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (request.action === 'layout') editor.layout?.();
    window.postMessage(
      { channel: 'slash-doc-gitlab-response', id: request.id, value: editor.getValue(), ok: true },
      location.origin,
    );
  } catch (error) {
    window.postMessage(
      { channel: 'slash-doc-gitlab-response', id: request.id, ok: false, error: String(error) },
      location.origin,
    );
  }
});

function findEditor(): SourceEditor | undefined {
  if (capturedEditor && capturedElement?.isConnected) return capturedEditor;
  const root = document.querySelector('#editor, [data-testid="source-editor-container"]');
  if (!root) return;
  // Vue-based GitLab versions also expose the SourceEditor through the component.
  const vue = root as Element & { __vue__?: any; __vueParentComponent?: any };
  for (const component of [vue.__vue__, vue.__vueParentComponent?.proxy]) {
    const editor = component?.getEditor?.() ?? component?.editor;
    if (editor && typeof editor.getValue === 'function' && typeof editor.setValue === 'function') return editor;
  }
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea#file_content, textarea#file-content, textarea[name="content"]',
  );
  if (!textarea || textarea.closest('.monaco-editor')) return;
  return {
    getValue: () => textarea.value,
    setValue: (value) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, value);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    },
  };
}
