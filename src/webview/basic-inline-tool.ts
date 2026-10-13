import { toggleInlineFormat } from './inline-format-toggle';
import { selectionForNode } from './editor-selection';

export function createBasicInlineTool(tag: 'code' | 'mark' | 'u', icon: string, title: string) {
  return class BasicInlineTool {
    static get isInline() {
      return true;
    }
    static get title() {
      return title;
    }
    get toolboxIcon() {
      return icon;
    }
    render(): HTMLElement {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = icon;
      button.title = title;
      return button;
    }
    surround(range: Range): void {
      const parent =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      const editable = parent?.closest<HTMLElement>('[contenteditable="true"]');
      if (!editable) return;
      const selected = toggleInlineFormat(editable, range, {
        matcher: (element) => element.tagName.toLowerCase() === tag,
        create: () => document.createElement(tag),
      });
      const selection = selectionForNode(editable);
      selection?.removeAllRanges();
      selection?.addRange(selected);
      editable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    checkState(): boolean {
      return Boolean(
        selectionForNode(document.activeElement ?? document.body)?.anchorNode?.parentElement?.closest(tag),
      );
    }
  };
}
