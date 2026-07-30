import { describe, expect, it, vi } from 'vitest';
import { consumeClipboardImage, isolateEditorEvent } from '../src/webview/editor-event-isolation';
import { beginTaskTableDrag } from '../src/webview/task-table-drag';

describe('Editor.js event isolation', () => {
  it('does not expose a Task Table card id as dropped plain text', () => {
    const values = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: 'all',
      setData: (type: string, value: string) => values.set(type, value),
    };
    const stopPropagation = vi.fn();

    beginTaskTableDrag({ dataTransfer, stopPropagation } as unknown as DragEvent, 'card', 'card-42');

    expect(values.get('application/x-slash-doc-task-card')).toBe('card-42');
    expect(values.has('text/plain')).toBe(false);
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it('fully consumes an image paste before Editor.js can create another block', () => {
    const image = { name: 'clipboard.png', type: 'image/png' } as File;
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();
    const loadImage = vi.fn();
    const event = {
      clipboardData: { files: [image], items: [] },
      preventDefault,
      stopImmediatePropagation,
    } as unknown as ClipboardEvent;

    expect(consumeClipboardImage(event, loadImage)).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(loadImage).toHaveBeenCalledWith(image);
  });

  it('prevents a handled drop and stops it at the tool boundary', () => {
    const preventDefault = vi.fn();
    const stopImmediatePropagation = vi.fn();

    isolateEditorEvent({ preventDefault, stopImmediatePropagation });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
  });
});
