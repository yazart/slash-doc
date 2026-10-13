export type EditorUndoHistory<T> = {
  reset(value: T): void;
  record(value: T): void;
  undo(currentValue: T): T | undefined;
  readonly size: number;
};

export function createEditorUndoHistory<T>(maxUndoSteps = 5): EditorUndoHistory<T> {
  const capacity = Math.max(1, Math.floor(maxUndoSteps)) + 1;
  let entries: Array<{ value: T; signature: string }> = [];

  const record = (value: T): void => {
    const snapshot = structuredClone(value);
    const signature = JSON.stringify(snapshot);
    if (entries.at(-1)?.signature === signature) return;
    entries.push({ value: snapshot, signature });
    if (entries.length > capacity) entries = entries.slice(-capacity);
  };

  return {
    reset(value) {
      entries = [];
      record(value);
    },
    record,
    undo(currentValue) {
      record(currentValue);
      if (entries.length < 2) return undefined;
      entries.pop();
      return structuredClone(entries.at(-1)!.value);
    },
    get size() {
      return entries.length;
    },
  };
}

export function installEditorHistoryListeners(target: EventTarget | null, recordChange: () => void): void {
  target?.addEventListener('input', recordChange);
  target?.addEventListener('change', recordChange);
}
