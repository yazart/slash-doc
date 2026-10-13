import { createTextInlineToolbar, type TextInlineToolbarConfig } from './confluence-table-inline-toolbar';

export const EDITOR_TEXT_INLINE_TARGETS = ['[contenteditable="true"]', '[contenteditable=""]'] as const;
const EDITABLE_SELECTOR = EDITOR_TEXT_INLINE_TARGETS.join(',');

export function installEditorTextInlineToolbar(holder: HTMLElement, config: TextInlineToolbarConfig): () => void {
  const toolbar = createTextInlineToolbar(config);
  const observed = new WeakSet<ParentNode>();
  const bound = new WeakSet<HTMLElement>();
  document.body.append(toolbar.element);

  const bind = (root: ParentNode) => {
    const editors = root instanceof HTMLElement && root.matches(EDITABLE_SELECTOR) ? [root] : [];
    editors.push(...Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)));
    for (const editor of editors) {
      if (bound.has(editor) || editor.closest('.ct-cell')) continue;
      bound.add(editor);
      toolbar.bindCell(editor);
    }
  };

  const bindTree = (root: ParentNode) => {
    bind(root);
    if (!observed.has(root)) {
      observed.add(root);
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['contenteditable'],
      });
    }
    for (const node of Array.from(root.querySelectorAll('*'))) if (node.shadowRoot) bindTree(node.shadowRoot);
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLElement) bind(record.target);
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLElement) {
          bind(node);
          if (node.shadowRoot) bindTree(node.shadowRoot);
          for (const child of Array.from(node.querySelectorAll('*'))) if (child.shadowRoot) bindTree(child.shadowRoot);
        }
      }
    }
  });
  bindTree(holder);

  // A custom tool may attach its Shadow DOM later without adding a light-DOM node.
  const capture = (event: Event) => {
    const current = event
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement && node.matches(EDITABLE_SELECTOR));
    if (!current) return;
    if (current.closest('.ct-cell')) return;
    bind(current);
    toolbar.captureSelection(current);
  };
  for (const event of ['focusin', 'mouseup', 'keyup']) holder.addEventListener(event, capture, true);

  return () => {
    observer.disconnect();
    toolbar.destroy();
    for (const event of ['focusin', 'mouseup', 'keyup']) holder.removeEventListener(event, capture, true);
    toolbar.element.remove();
  };
}
