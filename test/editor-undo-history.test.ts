import { describe, expect, it } from 'vitest';
import { createEditorUndoHistory, installEditorHistoryListeners } from '../src/webview/editor-undo-history';

type State = { blocks: Array<{ text: string }> };

describe('Editor undo history', () => {
  it('restores the previous state and ignores duplicate snapshots', () => {
    const history = createEditorUndoHistory<State>(5);
    history.reset(state('initial'));
    history.record(state('first'));
    history.record(state('first'));

    expect(history.size).toBe(2);
    expect(history.undo(state('first'))).toEqual(state('initial'));
    expect(history.undo(state('initial'))).toBeUndefined();
  });

  it('keeps no more than five undo steps', () => {
    const history = createEditorUndoHistory<State>(5);
    history.reset(state('initial'));
    for (let index = 1; index <= 6; index += 1) history.record(state(`edit-${index}`));

    expect(history.size).toBe(6);
    expect(history.undo(state('edit-6'))).toEqual(state('edit-5'));
    expect(history.undo(state('edit-5'))).toEqual(state('edit-4'));
    expect(history.undo(state('edit-4'))).toEqual(state('edit-3'));
    expect(history.undo(state('edit-3'))).toEqual(state('edit-2'));
    expect(history.undo(state('edit-2'))).toEqual(state('edit-1'));
    expect(history.undo(state('edit-1'))).toBeUndefined();
  });

  it('returns cloned snapshots that cannot mutate stored history', () => {
    const history = createEditorUndoHistory<State>(5);
    history.reset(state('initial'));
    history.record(state('first'));
    const restored = history.undo(state('first'))!;
    restored.blocks[0].text = 'changed outside';
    history.record(state('second'));

    expect(history.undo(state('second'))).toEqual(state('initial'));
  });

  it('keeps a Confluence Table block when undoing its latest cell edit', () => {
    const history = createEditorUndoHistory<{ blocks: unknown[] }>(5);
    const table = (value: string) => ({
      blocks: [{ type: 'confluenceTable', data: { rows: [[value]], headerRow: false, headerColumn: false } }],
    });
    history.reset({ blocks: [] });
    history.record(table(''));
    history.record(table('first'));
    history.record(table('second'));

    expect(history.undo(table('second'))).toEqual(table('first'));
  });

  it('records input and change events emitted by custom blocks', () => {
    const target = new EventTarget();
    let changes = 0;
    installEditorHistoryListeners(target, () => {
      changes += 1;
    });

    target.dispatchEvent(new Event('input'));
    target.dispatchEvent(new Event('change'));

    expect(changes).toBe(2);
  });
});

function state(text: string): State {
  return { blocks: [{ text }] };
}
