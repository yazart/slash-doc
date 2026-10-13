import { selectionForNode, selectRangeForNode } from './editor-selection';
import { readClipboardText } from './confluence-table-inline-utils';

type TableClipboardActions = {
  paste(cell: HTMLElement, text: string, html: string): void;
  selectText(cell: HTMLElement): void;
};

/** Global image/rich paste handlers may consume the event before it reaches the table. */
export function notifyTablePasteReceived(event: ClipboardEvent): void {
  const cell = event
    .composedPath()
    .find((node): node is HTMLElement => node instanceof HTMLElement && node.matches('.ct-cell'));
  cell?.dispatchEvent(new Event('slash-table-paste-received', { bubbles: true }));
}

export function installTableClipboard(wrapper: HTMLElement, actions: TableClipboardActions): () => void {
  let pending: object | undefined;
  let timer: number | undefined;
  const cancel = () => {
    pending = undefined;
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.code !== 'KeyV') cancel();
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.shiftKey ||
      !(event.ctrlKey || event.metaKey)
    )
      return;
    const cell = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && node.matches('.ct-cell'));
    if (!cell?.isContentEditable) return;
    if (event.code === 'KeyA') {
      event.preventDefault();
      event.stopImmediatePropagation();
      actions.selectText(cell);
      const range = document.createRange();
      range.selectNodeContents(cell);
      selectRangeForNode(cell, range);
      cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    }
    if (event.code !== 'KeyV') return;
    cancel();
    const token = {};
    pending = token;
    const selection = selectionForNode(cell);
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined;
    // Keep the browser paste for rich HTML/images. The host bridge is a fallback
    // for webviews that deliver the shortcut without a usable clipboard event.
    timer = window.setTimeout(() => {
      timer = undefined;
      if (pending !== token) return;
      void readClipboardText()
        .then((text) => {
          if (
            pending !== token ||
            !cell.isConnected ||
            !cell.isContentEditable ||
            (cell.getRootNode() as Document | ShadowRoot).activeElement !== cell
          )
            return;
          pending = undefined;
          if (!text) return;
          if (range && cell.contains(range.commonAncestorContainer)) selectRangeForNode(cell, range);
          actions.paste(cell, text, '');
        })
        .catch(() => {
          if (pending === token) pending = undefined;
        });
    }, 0);
  };
  const paste = (event: ClipboardEvent) => {
    const cell = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && node.matches('.ct-cell'));
    if (event.defaultPrevented || !cell?.isContentEditable) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const html = event.clipboardData?.getData('text/html') ?? '';
    if (!text && !html) return;
    cancel();
    event.preventDefault();
    event.stopImmediatePropagation();
    actions.paste(cell, text, html);
  };
  wrapper.addEventListener('keydown', keydown);
  wrapper.addEventListener('paste', paste, true);
  wrapper.addEventListener('input', cancel, true);
  wrapper.addEventListener('pointerdown', cancel, true);
  wrapper.addEventListener('slash-table-paste-received', cancel);
  return () => {
    cancel();
    wrapper.removeEventListener('keydown', keydown);
    wrapper.removeEventListener('paste', paste, true);
    wrapper.removeEventListener('input', cancel, true);
    wrapper.removeEventListener('pointerdown', cancel, true);
    wrapper.removeEventListener('slash-table-paste-received', cancel);
  };
}
