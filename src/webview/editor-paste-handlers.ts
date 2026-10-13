import { insertRichText } from './rich-text-paste';
import { BLOCK_CLIPBOARD_MIME, BLOCK_CLIPBOARD_PREFIX } from './block-clipboard';
import { consumeClipboardImage } from './editor-event-isolation';
import { pasteClipboardImages } from './block-editor-image-paste';
import type { BlockEditorElement } from './block-editor-element';
import { notifyTablePasteReceived } from './confluence-table-clipboard';

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
      const clipboard = event.clipboardData;
      if (
        clipboard &&
        (clipboard.getData('text/plain') ||
          clipboard.getData('text/html') ||
          clipboard.files.length ||
          Array.from(clipboard.items).some((item) => item.kind === 'file'))
      )
        notifyTablePasteReceived(event);
      if (
        event.clipboardData?.getData(BLOCK_CLIPBOARD_MIME) ||
        event.clipboardData?.getData('text/plain').startsWith(BLOCK_CLIPBOARD_PREFIX)
      )
        return;
      const imageTarget = findImageAnnotationTarget(event);
      if (imageTarget?.pasteImage && consumeClipboardImage(event, imageTarget.pasteImage.bind(imageTarget))) return;
      const editor = event
        .composedPath()
        .find(
          (target): target is BlockEditorElement => target instanceof HTMLElement && target.matches('slash-doc-editor'),
        );
      if (editor && pasteClipboardImages(editor, event)) return;
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
    'beforeinput',
    (event) => {
      if (!(event instanceof InputEvent) || event.inputType !== 'insertFromPaste') return;
      if (event.composedPath().some((target) => target instanceof HTMLElement && target.isContentEditable)) return;
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
    (item): item is HTMLTextAreaElement =>
      (matchesElement(item, '.slash-highlight-input') || matchesElement(item, '.fp-script')) &&
      hasNumericSelection(item),
  );
  if (highlightedCode) return (text) => insertTextIntoControl(highlightedCode, text);
  const listItem = path.find((item): item is HTMLElement => matchesElement(item, '.cdx-list__item'));
  if (listItem) return (text, html) => insertRichText(listItem, text, html);
  const editorText = path.find(
    (item): item is HTMLElement =>
      matchesElement(item, '.ce-paragraph') ||
      matchesElement(item, '.ce-header') ||
      matchesElement(item, '.ce-quote') ||
      matchesElement(item, '.mkdocs-content') ||
      matchesElement(item, '.image-tool__caption'),
  );
  if (editorText) return (text, html) => insertRichText(editorText, text, html);
  const tableTarget = path.find(
    (item): item is TablePasteElement =>
      matchesElement(item, '.ct-cell') && typeof (item as TablePasteElement).__slashDocPasteTable === 'function',
  );
  if (tableTarget) return tableTarget.__slashDocPasteTable;
  const editable = path.find(
    (item): item is HTMLElement =>
      matchesElement(item, '[contenteditable="true"]') || matchesElement(item, '[contenteditable=""]'),
  );
  return editable ? (text, html) => insertRichText(editable, text, html) : undefined;
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
  insertRichText(target, text);
}
