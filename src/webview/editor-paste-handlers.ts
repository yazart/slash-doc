import { consumeClipboardImage } from './editor-event-isolation';

type TablePasteElement = HTMLElement & {
  __slashDocPasteTable?: (text: string, html: string) => void;
};

type TextPasteElement = HTMLElement & {
  __slashDocPasteText?: (text: string) => void;
};

type ImagePasteElement = HTMLElement & {
  pasteImage?: (file: File) => void;
};

type PasteAction = (text: string, html: string) => void;

export function installEditorPasteHandlers(readClipboard: () => Promise<string>): void {
  window.addEventListener(
    'paste',
    (event) => {
      const imageTarget = findImageAnnotationTarget(event);
      if (imageTarget?.pasteImage && consumeClipboardImage(event, imageTarget.pasteImage.bind(imageTarget))) return;
      const paste = findPasteAction(event);
      if (!paste) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      const html = event.clipboardData?.getData('text/html') ?? '';
      if (!text && !html) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      paste(text, html);
    },
    true,
  );

  window.addEventListener(
    'keydown',
    (event) => {
      const isPasteKey = event.code === 'KeyV' || ['v', 'м'].includes(event.key.toLowerCase());
      if (!(event.metaKey || event.ctrlKey) || event.altKey || !isPasteKey) return;
      const paste = findPasteAction(event);
      if (!paste) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void readClipboard()
        .then((text) => paste(text, ''))
        .catch(() => undefined);
    },
    true,
  );

  window.addEventListener(
    'beforeinput',
    (event) => {
      if (!(event instanceof InputEvent) || event.inputType !== 'insertFromPaste') return;
      const paste = findPasteAction(event);
      if (!paste) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void readClipboard()
        .then((text) => paste(text, ''))
        .catch(() => undefined);
    },
    true,
  );
}

function findImageAnnotationTarget(event: Event): ImagePasteElement | undefined {
  return event
    .composedPath()
    .find(
      (item): item is ImagePasteElement =>
        item instanceof HTMLElement &&
        item.matches('slash-image-annotation') &&
        typeof (item as ImagePasteElement).pasteImage === 'function',
    );
}

function findPasteAction(event: Event): PasteAction | undefined {
  const path = event.composedPath();
  const textTarget = path.find(
    (item): item is TextPasteElement =>
      item instanceof HTMLElement &&
      item.matches('.slash-bpmn-xml') &&
      typeof (item as TextPasteElement).__slashDocPasteText === 'function',
  );
  if (textTarget?.__slashDocPasteText) {
    return (text) => textTarget.__slashDocPasteText?.(text);
  }
  const tableTarget = path.find(
    (item): item is TablePasteElement =>
      item instanceof HTMLElement &&
      item.matches('.ct-cell') &&
      typeof (item as TablePasteElement).__slashDocPasteTable === 'function',
  );
  return tableTarget?.__slashDocPasteTable ?? window.__SLASH_DOC_TABLE_PASTE_TARGET__?.paste;
}
