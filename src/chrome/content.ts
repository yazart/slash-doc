import { getGitLabPageLocation, getRawFileUrl } from './gitlab-location';
import styles from './content.css?inline';

declare const chrome: { runtime: { getURL(path: string): string } };
const context = getGitLabPageLocation(location.href);

if (context) void mount();

async function mount(): Promise<void> {
  const page = context!;
  const native = await waitForEditor();
  if (!native || document.querySelector('#slash-doc-gitlab')) return;
  const host = document.createElement('div');
  host.id = 'slash-doc-gitlab';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${styles}</style><section class="panel">
    <div class="controls"><strong>Slash Doc</strong><button type="button">Открыть визуальный редактор</button>
    <span role="status">Загрузка редактора…</span></div></section>`;
  const panel = shadow.querySelector('section')!;
  const toggle = shadow.querySelector('button')!;
  const status = shadow.querySelector<HTMLElement>('[role="status"]')!;
  toggle.disabled = true;
  native.before(host);
  const frame = document.createElement('iframe');
  const token = crypto.randomUUID();
  frame.src = chrome.runtime.getURL(`editor.html#${token}`);
  frame.title = 'Визуальный редактор Slash Doc';
  frame.allow = 'clipboard-read; clipboard-write';
  frame.hidden = true;
  panel.append(frame);
  const extensionOrigin = new URL(frame.src).origin;
  const nativeDisplay = native.style.display;
  let visual = false;
  let dirty = false;
  let changeVersion = 0;
  let ready = false;
  let committing = false;
  const pageIds = new Set<string>();
  let saveQueue = Promise.resolve();
  const flushes = new Map<
    string,
    { resolve(): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
  >();
  const send = (message: Record<string, unknown>) =>
    frame.contentWindow?.postMessage({ ...message, token }, extensionOrigin);

  const activate = async () => {
    const source = await nativeRequest('read');
    let pages: unknown[] = [];
    try {
      const menu = JSON.parse(new TextDecoder().decode(await readFile('.slash-doc/docs/menu.json')));
      const flatten = (items: any[], depth = 0): any[] =>
        items.flatMap((item) => [
          { id: item.id, title: item.title, depth },
          ...flatten(item.children ?? [], depth + 1),
        ]);
      pages = flatten(menu.items ?? []);
      pageIds.clear();
      for (const item of pages as { id: string }[]) pageIds.add(item.id);
    } catch {
      /* Internal links still keep their saved URLs if the menu is unavailable. */
    }
    send({ type: 'initialize', source, pages, pageId: page.pageId });
  };

  const flush = () =>
    new Promise<void>((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        flushes.delete(id);
        reject(new Error('Редактор Slash Doc не ответил.'));
      }, 15000);
      flushes.set(id, { resolve, reject, timer });
      send({ type: 'flush', id });
    });

  toggle.addEventListener('click', () => {
    toggle.disabled = true;
    void (async () => {
      if (visual) {
        await flush();
        visual = false;
        frame.hidden = true;
        native.style.display = nativeDisplay;
        await nativeRequest('layout');
        toggle.textContent = 'Открыть визуальный редактор';
      } else {
        await activate();
      }
    })()
      .catch(reportError)
      .finally(() => {
        toggle.disabled = false;
      });
  });

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow || event.origin !== extensionOrigin || event.data?.token !== token) return;
    const message = event.data;
    if (message.type === 'ready') {
      ready = true;
      void activate().catch(reportError);
    } else if (message.type === 'initialized') {
      visual = true;
      dirty = false;
      native.style.display = 'none';
      frame.hidden = false;
      toggle.disabled = false;
      toggle.textContent = 'Стандартный редактор GitLab';
      status.textContent = 'Изменения применяются в GitLab. Для сохранения используйте Commit changes.';
    } else if (message.type === 'dirty') {
      dirty = true;
      changeVersion += 1;
      status.textContent = 'Есть изменения…';
    } else if (message.type === 'save' && typeof message.yaml === 'string') {
      const savedChangeVersion = changeVersion;
      const sync = saveQueue.then(async () => {
        await nativeRequest('write', message.yaml);
        if (savedChangeVersion === changeVersion) dirty = false;
        status.textContent = 'YAML передан в GitLab. Коммит ещё не выполнен.';
        send({ type: 'saved', revision: message.revision });
      });
      saveQueue = sync.catch((error) => {
        reportError(error);
        send({ type: 'save-error', error: String(error) });
      });
      void sync.then(
        () => completeFlush(message.id),
        (error) => completeFlush(message.id, error),
      );
    } else if (message.type === 'resource' && typeof message.fileName === 'string') {
      const fileName = message.fileName;
      if (!/^(?:image|svg|bpmn)-[0-9a-f]{16}\.[a-z0-9+.-]+$/i.test(fileName)) return;
      const path = page.filePath.replace(/content\.yaml$/, fileName);
      void readFile(path).then(
        (bytes) => send({ type: 'resource-result', id: message.id, bytes: Array.from(bytes) }),
        (error) => send({ type: 'resource-result', id: message.id, error: String(error) }),
      );
    } else if (message.type === 'searchUsers' && typeof message.query === 'string') {
      void fetch(`/api/v4/users?search=${encodeURIComponent(message.query)}&per_page=20`, {
        credentials: 'same-origin',
      })
        .then(async (response) => (response.ok ? response.json() : []))
        .then(
          (users) =>
            send({
              type: 'userSearchResponse',
              requestId: message.requestId,
              users: Array.isArray(users)
                ? users.map((user) => ({
                    id: String(user.id),
                    fullName: user.name,
                    email: user.public_email ?? '',
                    photo: user.avatar_url ?? '',
                    link: user.web_url ?? '',
                  }))
                : [],
            }),
          () => send({ type: 'userSearchResponse', requestId: message.requestId, users: [] }),
        );
    } else if (message.type === 'openPage' && typeof message.pageId === 'string' && pageIds.has(message.pageId)) {
      void flush()
        .then(() => {
          location.href = `${page.origin}${page.projectPath}/-/edit/${encodeURIComponent(page.ref)}/.slash-doc/docs/pages/${encodeURIComponent(message.pageId)}/content.yaml`;
        })
        .catch(reportError);
    } else if (message.type === 'error') {
      reportError(new Error(message.error));
      completeFlush(message.id, new Error(message.error));
    }
  });

  const form = native.closest('form') ?? document.querySelector('form.js-edit-blob-form');
  // New GitLab versions read the model when opening the commit modal.
  document.addEventListener(
    'click',
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('[data-testid="blob-edit-header-commit-button"]')
          : null;
      if (!button || !visual || committing) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void flush()
        .then(() => {
          committing = true;
          button.click();
          committing = false;
        })
        .catch(reportError);
    },
    true,
  );
  form?.addEventListener(
    'submit',
    (event) => {
      if (!visual || committing) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitter = (event as SubmitEvent).submitter;
      void flush()
        .then(() => {
          committing = true;
          (form as HTMLFormElement).requestSubmit(
            submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined,
          );
          committing = false;
        })
        .catch(reportError);
    },
    true,
  );
  window.addEventListener('beforeunload', (event) => {
    if (visual && dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  setTimeout(() => {
    if (!ready) reportError(new Error('Iframe расширения заблокирован. Проверьте frame-src CSP вашего GitLab.'));
  }, 15000);

  function completeFlush(id: unknown, error?: Error) {
    if (typeof id !== 'string') return;
    const pending = flushes.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    flushes.delete(id);
    if (error) pending.reject(error);
    else pending.resolve();
  }

  function reportError(error: unknown) {
    status.textContent = String(error);
    toggle.disabled = false;
  }

  async function readFile(path: string): Promise<Uint8Array> {
    const response = await fetch(getRawFileUrl(page, path), { credentials: 'same-origin' });
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
      throw new Error(`Не удалось прочитать ${path}: HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

function nativeRequest(action: string, value?: string): Promise<string> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', listener);
      reject(new Error('Нет ответа от редактора GitLab.'));
    }, 5000);
    const listener = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.channel !== 'slash-doc-gitlab-response' ||
        event.data.id !== id
      )
        return;
      clearTimeout(timeout);
      window.removeEventListener('message', listener);
      if (event.data.ok) resolve(event.data.value);
      else reject(new Error(event.data.error));
    };
    window.addEventListener('message', listener);
    window.postMessage({ channel: 'slash-doc-gitlab-request', id, action, value }, location.origin);
  });
}

async function waitForEditor(): Promise<HTMLElement | undefined> {
  for (let attempt = 0; attempt < 120; attempt++) {
    const editor = document.querySelector<HTMLElement>('#editor, [data-testid="source-editor-container"]');
    if (editor && (editor.querySelector('.monaco-editor') || editor.matches('textarea'))) return editor;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
