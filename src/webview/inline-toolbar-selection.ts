import { selectionForNode } from './editor-selection';
import { readSelectionRange, selectContainedRange } from './confluence-table-inline-utils';

type SelectionContext = {
  current(): { cell: HTMLElement; range?: Range } | undefined;
  remember(range: Range): void;
  close(): void;
};

export function readInlineToolbarRange(cell: HTMLElement): Range | undefined {
  return selectContainedRange(cell, [
    readSelectionRange(selectionForNode(cell)),
    readSelectionRange(window.getSelection()),
  ]);
}

/** Native pickers can clear DOM selection and temporarily take focus outside the document. */
export function installInlineToolbarSelection(
  toolbar: HTMLElement,
  context: SelectionContext,
): {
  isInteracting(): boolean;
  reset(): void;
  destroy(): void;
} {
  let interacting = false;
  let frame: number | undefined;
  const reset = () => {
    interacting = false;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
  };
  const refresh = () => {
    frame = undefined;
    if (toolbar.hidden) return;
    const current = context.current();
    if (!current?.cell.isConnected || !current.cell.isContentEditable) {
      context.close();
      return;
    }
    const selected = readInlineToolbarRange(current.cell);
    if (selected) {
      context.remember(selected.cloneRange());
      return;
    }
    // Selection is retained semantically while editing a toolbar control or its native popup.
    if (
      interacting &&
      current.range &&
      !current.range.collapsed &&
      current.cell.contains(current.range.commonAncestorContainer)
    )
      return;
    context.close();
  };
  const schedule = () => {
    if (toolbar.hidden) return;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(refresh);
  };
  const pointerdown = (event: PointerEvent) => {
    interacting = event.composedPath().includes(toolbar);
    schedule();
  };
  const focusin = (event: FocusEvent) => {
    interacting = event.composedPath().includes(toolbar);
    schedule();
  };
  const focusControls = () => {
    interacting = true;
    schedule();
  };
  toolbar.addEventListener('focusin', focusControls, true);
  toolbar.addEventListener('pointerdown', focusControls, true);
  document.addEventListener('pointerdown', pointerdown, true);
  document.addEventListener('focusin', focusin, true);
  document.addEventListener('focusout', schedule, true);
  document.addEventListener('selectionchange', schedule);
  return {
    isInteracting: () => interacting,
    reset,
    destroy() {
      reset();
      toolbar.removeEventListener('focusin', focusControls, true);
      toolbar.removeEventListener('pointerdown', focusControls, true);
      document.removeEventListener('pointerdown', pointerdown, true);
      document.removeEventListener('focusin', focusin, true);
      document.removeEventListener('focusout', schedule, true);
      document.removeEventListener('selectionchange', schedule);
    },
  };
}
