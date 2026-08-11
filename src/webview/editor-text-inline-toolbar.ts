import { createTextInlineToolbar, type TextInlineToolbarConfig } from './confluence-table-inline-toolbar';

export const EDITOR_TEXT_INLINE_TARGETS = [
  '.ce-paragraph[contenteditable="true"]',
  '.ce-header[contenteditable="true"]',
  '.cdx-list__item',
] as const;
const EDITABLE_SELECTOR = EDITOR_TEXT_INLINE_TARGETS.join(',');

export function installEditorTextInlineToolbar(holder: HTMLElement, config: TextInlineToolbarConfig): () => void {
  const toolbar = createTextInlineToolbar(config);
  const bound = new WeakSet<HTMLElement>();
  document.body.append(toolbar.element);

  const bind = (root: ParentNode) => {
    const editors = root instanceof HTMLElement && root.matches(EDITABLE_SELECTOR) ? [root] : [];
    editors.push(...Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)));
    for (const editor of editors) {
      if (bound.has(editor)) continue;
      bound.add(editor);
      toolbar.bindCell(editor);
    }
  };

  bind(holder);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLElement) bind(node);
      }
    }
  });
  observer.observe(holder, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    toolbar.element.remove();
  };
}
