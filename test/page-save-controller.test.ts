import type { OutputData } from '@editorjs/editorjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPageSaveController, type PageSaveStatus } from '../src/webview/page-save-controller';

afterEach(() => vi.useRealTimers());

describe('page autosave controller', () => {
  it('saves a dirty page after the configured interval', async () => {
    vi.useFakeTimers();
    const state = createController({ enabled: true, intervalSeconds: 2 });

    state.controller.schedule();
    vi.advanceTimersByTime(1999);
    await flushPromises();
    expect(state.messages).toEqual([]);

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ type: 'save', source: 'auto', revision: 1 });
  });

  it('supports a 0.3 second autosave interval', async () => {
    vi.useFakeTimers();
    const state = createController({ enabled: true, intervalSeconds: 0.3 });

    state.controller.schedule();
    vi.advanceTimersByTime(299);
    await flushPromises();
    expect(state.messages).toEqual([]);
    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(state.messages).toHaveLength(1);
  });

  it('keeps manual saving available when autosave is disabled', async () => {
    vi.useFakeTimers();
    const state = createController({ enabled: false, intervalSeconds: 1 });

    state.controller.schedule();
    vi.advanceTimersByTime(5000);
    await flushPromises();
    expect(state.messages).toEqual([]);

    await state.controller.saveNow('manual');
    expect(state.messages[0]).toMatchObject({ type: 'save', source: 'manual' });
  });

  it('applies updated settings to an already dirty page', async () => {
    vi.useFakeTimers();
    const state = createController({ enabled: false, intervalSeconds: 5 });

    state.controller.schedule();
    expect(
      state.controller.handleMessage({
        type: 'settingsUpdated',
        autoSave: { enabled: true, intervalSeconds: 1 },
      }),
    ).toBe(true);
    vi.advanceTimersByTime(1000);
    await flushPromises();

    expect(state.messages).toHaveLength(1);
    state.controller.handleMessage({ type: 'saveResult', ok: true, revision: 1 });
    expect(state.statuses.at(-1)).toBe('saved');
    await state.controller.saveNow('auto');
    expect(state.messages).toHaveLength(1);
  });
});

function createController(autoSave: { enabled: boolean; intervalSeconds: number }) {
  const messages: Array<Record<string, unknown>> = [];
  const statuses: PageSaveStatus[] = [];
  const controller = createPageSaveController({
    autoSave,
    readData: async () => ({ blocks: [] }) as OutputData,
    postMessage: (message) => messages.push(message as Record<string, unknown>),
    reportError: () => undefined,
    setStatus: (status) => statuses.push(status),
  });
  return { controller, messages, statuses };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
