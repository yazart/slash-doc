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

export type PasteAction = (text: string, html: string) => void;

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
  return findPasteActionInPath(event.composedPath());
}

export function findPasteActionInPath(path: EventTarget[]): PasteAction | undefined {
  const annotationTextarea = path.find(
    (item): item is HTMLTextAreaElement => matchesElement(item, 'textarea') && hasNumericSelection(item),
  );
  const isImageAnnotation = path.some((item) => matchesElement(item, 'slash-image-annotation'));
  if (annotationTextarea && isImageAnnotation) {
    return (text) => insertTextIntoControl(annotationTextarea, text);
  }

  const textTarget = path.find(
    (item): item is TextPasteElement =>
      matchesElement(item, '.slash-bpmn-xml') && typeof (item as TextPasteElement).__slashDocPasteText === 'function',
  );
  if (textTarget?.__slashDocPasteText) {
    return (text) => textTarget.__slashDocPasteText?.(text);
  }
  const mermaidCode = path.find(
    (item): item is HTMLTextAreaElement => matchesElement(item, '.slash-mermaid-code') && hasNumericSelection(item),
  );
  if (mermaidCode) return (text) => insertTextIntoControl(mermaidCode, text);
  const highlightedCode = path.find(
    (item): item is HTMLTextAreaElement => matchesElement(item, '.slash-highlight-input') && hasNumericSelection(item),
  );
  if (highlightedCode) return (text) => insertTextIntoControl(highlightedCode, text);
  const listItem = path.find((item): item is HTMLElement => matchesElement(item, '.cdx-list__item'));
  if (listItem) return (text) => insertTextIntoContentEditable(listItem, text);
  const editorText = path.find(
    (item): item is HTMLElement => matchesElement(item, '.ce-paragraph') || matchesElement(item, '.ce-header'),
  );
  if (editorText) return (text) => insertTextIntoContentEditable(editorText, text);
  const tableTarget = path.find(
    (item): item is TablePasteElement =>
      matchesElement(item, '.ct-cell') && typeof (item as TablePasteElement).__slashDocPasteTable === 'function',
  );
  return tableTarget?.__slashDocPasteTable;
}

function matchesElement(target: EventTarget, selector: string): target is HTMLElement {
  const candidate = target as EventTarget & { matches?: (value: string) => boolean };
  return typeof candidate.matches === 'function' && candidate.matches(selector);
}

function hasNumericSelection(target: EventTarget): target is HTMLTextAreaElement {
  const candidate = target as EventTarget & { selectionStart?: unknown; selectionEnd?: unknown };
  return typeof candidate.selectionStart === 'number' && typeof candidate.selectionEnd === 'number';
}

export function insertTextIntoControl(target: HTMLTextAreaElement, text: string): void {
  target.focus();
  target.setRangeText(text, target.selectionStart, target.selectionEnd, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

export function insertTextIntoContentEditable(target: HTMLElement, text: string): void {
  target.focus();
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  if (!selection || !range || !target.contains(range.commonAncestorContainer)) {
    target.append(createTextFragment(text));
  } else {
    range.deleteContents();
    const fragment = createTextFragment(text);
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  target.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

function createTextFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  text
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .forEach((line, index) => {
      if (index > 0) fragment.append(document.createElement('br'));
      fragment.append(document.createTextNode(line));
    });
  return fragment;
}
