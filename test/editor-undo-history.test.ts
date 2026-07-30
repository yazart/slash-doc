import { describe, expect, it } from 'vitest';
import { createEditorUndoHistory } from '../src/webview/editor-undo-history';

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
});

function state(text: string): State {
  return { blocks: [{ text }] };
}
