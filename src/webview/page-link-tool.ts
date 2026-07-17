import type { API } from '@editorjs/editorjs/types';
import type { InlineTool, MenuConfig } from '@editorjs/editorjs/types/tools';
import type { PopoverItemType } from '@editorjs/editorjs/types/utils/popover';
import { LUCIDE_ICONS } from './lucide-icons';

export type DocumentationPageLink = {
  id: string;
  title: string;
  depth: number;
};

type PageLinkToolConfig = {
  pages?: DocumentationPageLink[];
  currentPageId?: string;
};

export default class PageLinkTool implements InlineTool {
  private readonly api: API;
  private readonly pages: DocumentationPageLink[];
  private readonly currentPageId?: string;
  private range?: Range;
  private removeButton?: HTMLButtonElement;

  static get isInline(): boolean {
    return true;
  }

  static get title(): string {
    return 'Ссылка на страницу';
  }

  static get sanitize(): Record<string, Record<string, boolean>> {
    return {
      a: {
        class: true,
        href: true,
        'data-page-id': true,
        target: true,
        rel: true,
      },
    };
  }

  constructor({ api, config }: { api: API; config?: PageLinkToolConfig }) {
    this.api = api;
    this.pages = config?.pages ?? [];
    this.currentPageId = config?.currentPageId;
  }

  render(): MenuConfig {
    this.captureRange();
    return {
      icon: LUCIDE_ICONS.link,
      title: 'Ссылка на страницу',
      isActive: () => Boolean(this.findSelectedLink()),
      children: {
        isFlippable: false,
        items: [
          {
            type: 'html' as PopoverItemType.Html,
            element: this.createPicker(),
          },
        ],
        onOpen: () => {
          // surround() runs for the trigger item. Do not touch the selection
          // while opening: Editor.js would rebuild and close the submenu.
          if (this.removeButton) this.removeButton.hidden = !this.findSelectedLink();
        },
        onClose: () => this.api.selection.removeFakeBackground?.(),
      },
    };
  }

  surround(range: Range | null): void {
    if (!range) return;
    this.range = range.cloneRange();
    this.api.selection.setFakeBackground?.();
    this.api.selection.save?.();
  }

  clear(): void {
    this.api.selection.removeFakeBackground?.();
    this.range = undefined;
  }

  private createPicker(): HTMLElement {
    const picker = document.createElement('div');
    picker.className = 'slash-page-link-picker';
    picker.addEventListener('pointerdown', (event) => event.stopPropagation());
    picker.addEventListener('mousedown', (event) => event.stopPropagation());
    picker.addEventListener('click', (event) => event.stopPropagation());

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'slash-page-link-search';
    search.placeholder = 'Найти страницу…';
    search.setAttribute('aria-label', 'Поиск страницы');

    const list = document.createElement('div');
    list.className = 'slash-page-link-list';
    const renderPages = () => {
      const query = search.value.trim().toLocaleLowerCase('ru');
      const pages = this.pages.filter((page) => page.title.toLocaleLowerCase('ru').includes(query));
      list.replaceChildren();

      if (pages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'slash-page-link-empty';
        empty.textContent = this.pages.length === 0 ? 'Нет доступных страниц' : 'Страницы не найдены';
        list.append(empty);
        return;
      }

      for (const page of pages) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'slash-page-link-option';
        if (page.id === this.currentPageId) option.classList.add('slash-page-link-current');
        option.style.paddingInlineStart = `${8 + page.depth * 14}px`;
        option.textContent = page.title;
        option.title = page.title;
        option.addEventListener('pointerdown', preventSelectionLoss);
        option.addEventListener('mousedown', preventSelectionLoss);
        option.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.applyPage(page);
        });
        list.append(option);
      }
    };

    search.addEventListener('input', renderPages);
    picker.append(search, list);

    this.removeButton = document.createElement('button');
    this.removeButton.type = 'button';
    this.removeButton.className = 'slash-page-link-remove';
    this.removeButton.textContent = 'Удалить ссылку';
    this.removeButton.hidden = !this.findSelectedLink();
    this.removeButton.addEventListener('pointerdown', preventSelectionLoss);
    this.removeButton.addEventListener('mousedown', preventSelectionLoss);
    this.removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.removeLink();
    });
    picker.append(this.removeButton);

    renderPages();
    return picker;
  }

  private captureRange(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    this.range = selection.getRangeAt(0).cloneRange();
    this.api.selection.save?.();
  }

  private applyPage(page: DocumentationPageLink): void {
    const range = this.range;
    if (!range) return;
    const existing = findParentPageLink(range.commonAncestorContainer);
    const href = `slash-doc://page/${encodeURIComponent(page.id)}`;

    if (existing) {
      existing.href = href;
      existing.dataset.pageId = page.id;
      this.finishChange(existing);
      return;
    }

    const anchor = document.createElement('a');
    anchor.className = 'slash-page-link';
    anchor.href = href;
    anchor.dataset.pageId = page.id;
    if (range.collapsed) {
      anchor.textContent = page.title;
    } else {
      anchor.append(range.extractContents());
    }
    range.insertNode(anchor);
    this.finishChange(anchor);
  }

  private removeLink(): void {
    const anchor = this.findSelectedLink();
    if (!anchor) return;
    const parent = anchor.parentNode;
    if (!parent) return;
    const lastChild = anchor.lastChild;
    while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
    anchor.remove();
    this.api.selection.removeFakeBackground?.();
    if (lastChild) {
      const range = document.createRange();
      range.setStartAfter(lastChild);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    parent.dispatchEvent(new Event('input', { bubbles: true }));
    this.api.inlineToolbar.close();
    this.range = undefined;
  }

  private findSelectedLink(): HTMLAnchorElement | null {
    if (this.range) return findParentPageLink(this.range.commonAncestorContainer);
    const selection = window.getSelection();
    return selection?.rangeCount ? findParentPageLink(selection.getRangeAt(0).commonAncestorContainer) : null;
  }

  private finishChange(anchor: HTMLAnchorElement): void {
    this.api.selection.removeFakeBackground?.();
    this.api.selection.expandToTag(anchor);
    anchor.dispatchEvent(new Event('input', { bubbles: true }));
    this.api.inlineToolbar.close();
    this.range = undefined;
  }
}

function findParentPageLink(node: Node): HTMLAnchorElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLAnchorElement>('a.slash-page-link, a[data-page-id], a[href^="slash-doc:"]') ?? null;
}

function preventSelectionLoss(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
}
