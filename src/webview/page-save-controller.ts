import type { OutputData } from '@editorjs/editorjs';
import { normalizeAutoSaveSettings, type AutoSaveSettings } from '../shared/autosave';

export type PageSaveSource = 'auto' | 'manual';
export type PageSaveStatus = 'dirty' | 'saving' | 'saved' | 'error';

type PageSaveControllerOptions = {
  autoSave?: Partial<AutoSaveSettings>;
  readData(): Promise<OutputData>;
  postMessage(message: unknown): void;
  reportError(error: unknown, requestId?: string): void;
  setStatus(status: PageSaveStatus): void;
};

export type PageSaveController = {
  installFallback(holder: Element | null): void;
  handleMessage(message: unknown): boolean;
  schedule(): void;
  saveNow(source: PageSaveSource, requestId?: string): Promise<void>;
};

export function createPageSaveController(options: PageSaveControllerOptions): PageSaveController {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queuedSave: { source: PageSaveSource; requestId?: string } | undefined;
  let activeSave: Promise<void> | undefined;
  let revision = 0;
  let latestSentRevision = 0;
  let changeRevision = 0;
  let latestSentChangeRevision = 0;
  let dirty = false;
  let autoSave = normalizeAutoSaveSettings(options.autoSave);

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const scheduleAutoSave = () => {
    clearTimer();
    if (!autoSave.enabled || !dirty) return;
    timer = setTimeout(() => {
      timer = undefined;
      void saveNow('auto');
    }, autoSave.intervalSeconds * 1000);
  };

  const drainQueue = async (): Promise<void> => {
    while (queuedSave) {
      const { source, requestId } = queuedSave;
      queuedSave = undefined;

      try {
        const data = await options.readData();
        latestSentChangeRevision = changeRevision;
        latestSentRevision = ++revision;
        options.setStatus('saving');
        options.postMessage({ type: 'save', source, revision: latestSentRevision, requestId, data });
      } catch (error) {
        options.setStatus('error');
        options.reportError(error, requestId);
      }
    }
  };

  const saveNow = (source: PageSaveSource, requestId?: string): Promise<void> => {
    clearTimer();
    if (source === 'auto' && !dirty) return Promise.resolve();
    queuedSave = { source, requestId };
    activeSave ??= drainQueue().finally(() => {
      activeSave = undefined;
      if (queuedSave) void saveNow(queuedSave.source, queuedSave.requestId);
    });
    return activeSave;
  };

  return {
    installFallback(holder) {
      if (!holder) return;
      holder.addEventListener('input', this.schedule, true);
      holder.addEventListener('change', this.schedule, true);
      holder.addEventListener('click', this.schedule, true);
      window.addEventListener('pagehide', () => autoSave.enabled && void this.saveNow('auto'));
      window.addEventListener('blur', () => autoSave.enabled && void this.saveNow('auto'));
      document.addEventListener('visibilitychange', () => {
        if (autoSave.enabled && document.visibilityState === 'hidden') void this.saveNow('auto');
      });
      window.addEventListener('keydown', (event) => {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
        event.preventDefault();
        void this.saveNow('manual');
      });
    },
    handleMessage(message) {
      if (!message || typeof message !== 'object' || !('type' in message)) return false;
      if (message.type === 'requestSave' && 'requestId' in message && typeof message.requestId === 'string') {
        void this.saveNow('manual', message.requestId);
        return true;
      }
      if (message.type === 'settingsUpdated' && 'autoSave' in message) {
        autoSave = normalizeAutoSaveSettings(message.autoSave);
        scheduleAutoSave();
        return true;
      }
      if (message.type !== 'saveResult') return false;
      const savedRevision =
        'revision' in message && typeof message.revision === 'number' ? message.revision : undefined;
      const ok = 'ok' in message && message.ok === true;
      if (typeof savedRevision === 'number' && savedRevision < latestSentRevision) return true;
      if (ok && latestSentChangeRevision === changeRevision) dirty = false;
      options.setStatus(ok ? (dirty ? 'dirty' : 'saved') : 'error');
      return true;
    },
    schedule() {
      dirty = true;
      changeRevision += 1;
      options.setStatus('dirty');
      scheduleAutoSave();
    },
    saveNow,
  };
}

export function updatePageSaveStatus(element: HTMLElement | null, status: PageSaveStatus): void {
  if (!element) return;
  const labels: Record<PageSaveStatus, string> = {
    dirty: 'Есть изменения',
    saving: 'Сохранение…',
    saved: 'Сохранено',
    error: 'Ошибка сохранения',
  };
  element.textContent = labels[status];
  element.dataset.status = status;
}
