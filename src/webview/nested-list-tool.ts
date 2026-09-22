import type { API, BlockToolConstructorOptions } from '@editorjs/editorjs/types';
import { LUCIDE_ICONS } from './lucide-icons';

export type NestedListItem = { content: string; items: NestedListItem[] };
export type NestedListData = { style: 'ordered' | 'unordered'; items: NestedListItem[] };

export default class NestedListTool {
  private readonly api: API;
  private readonly readOnly: boolean;
  private data: NestedListData;
  private root?: HTMLOListElement | HTMLUListElement;

  static get toolbox() {
    return { title: 'Многоуровневый список', icon: LUCIDE_ICONS.list };
  }

  static get isReadOnlySupported(): boolean {
    return true;
  }

  static get enableLineBreaks(): boolean {
    return true;
  }

  static get sanitize() {
    return { style: {}, items: {} };
  }

  static get conversionConfig() {
    return {
      export: (data: NestedListData) => flattenListText(data.items).join('. '),
      import: (content: string) => ({ style: 'unordered', items: [{ content, items: [] }] }),
    };
  }

  constructor({ data, api, readOnly }: BlockToolConstructorOptions<NestedListData>) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = { style: data?.style === 'ordered' ? 'ordered' : 'unordered', items: normalizeNestedListItems(data?.items) };
  }

  render(): HTMLElement {
    this.root = this.renderList(this.data.items, true);
    if (!this.readOnly) {
      this.root.addEventListener('keydown', (event) => this.handleKeydown(event as KeyboardEvent));
    }
    return this.root;
  }

  save(): NestedListData {
    return { style: this.data.style, items: this.root ? readListItems(this.root) : this.data.items };
  }

  validate(): boolean {
    return true;
  }

  renderSettings(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'slash-list-settings';
    panel.append(
      this.settingButton(panel, 'unordered', 'Маркированный список', LUCIDE_ICONS.list),
      this.settingButton(panel, 'ordered', 'Нумерованный список', LUCIDE_ICONS.listOrdered),
    );
    return panel;
  }

  private settingButton(
    panel: HTMLElement,
    style: NestedListData['style'],
    label: string,
    icon: string,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cdx-settings-button slash-list-style-button';
    button.classList.toggle('cdx-settings-button--active', this.data.style === style);
    button.dataset.style = style;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(this.data.style === style));
    button.innerHTML = icon;
    button.addEventListener('click', () => {
      this.changeStyle(style);
      panel.querySelectorAll<HTMLButtonElement>('.slash-list-style-button').forEach((item) => {
        const active = item.dataset.style === style;
        item.classList.toggle('cdx-settings-button--active', active);
        item.setAttribute('aria-pressed', String(active));
      });
    });
    return button;
  }

  private changeStyle(style: NestedListData['style']): void {
    if (!this.root || this.data.style === style) return;
    this.data = { style, items: readListItems(this.root) };
    const replacement = this.renderList(this.data.items, true);
    if (!this.readOnly) {
      replacement.addEventListener('keydown', (event) => this.handleKeydown(event as KeyboardEvent));
    }
    this.root.replaceWith(replacement);
    this.root = replacement;
  }

  private renderList(items: NestedListItem[], root = false): HTMLOListElement | HTMLUListElement {
    const list = document.createElement(this.data.style === 'ordered' ? 'ol' : 'ul');
    list.className = `cdx-list ${root ? 'cdx-block ' : ''}cdx-list--${this.data.style}`;
    list.contentEditable = 'false';
    for (const item of items.length ? items : [{ content: '', items: [] }]) list.append(this.renderItem(item));
    return list;
  }

  private renderItem(item: NestedListItem): HTMLLIElement {
    const row = document.createElement('li');
    row.className = 'slash-nested-list-item';
    const content = document.createElement('div');
    content.className = 'cdx-list__item';
    content.contentEditable = String(!this.readOnly);
    content.innerHTML = item.content;
    row.append(content);
    if (item.items.length) row.append(this.renderList(item.items));
    return row;
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      if (changeSelectedListLevel(this.root, event.shiftKey ? -1 : 1)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.root?.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    const content = currentContent(event);
    if (!content) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!visibleText(content)) {
      if (this.outdentEmptyItem(content)) return;
      if (!this.exitList(content)) this.splitItem(content);
      return;
    }
    this.splitItem(content);
  }

  private outdentEmptyItem(content: HTMLElement): boolean {
    const item = content.parentElement;
    const list = item?.parentElement;
    if (!item || !list || list === this.root) return false;
    const parentItem = list.parentElement;
    parentItem?.parentElement?.insertBefore(item, parentItem.nextSibling);
    if (!list.children.length) list.remove();
    focusContent(content);
    return true;
  }

  private exitList(content: HTMLElement): boolean {
    const item = content.parentElement;
    if (!item || item.parentElement !== this.root || item !== this.root.lastElementChild || this.root.children.length < 2) {
      return false;
    }
    item.remove();
    const index = this.api.blocks.getCurrentBlockIndex();
    this.api.blocks.insert('paragraph', { text: '' }, undefined, index + 1, true);
    this.api.caret.setToBlock(index + 1, 'start');
    return true;
  }

  private splitItem(content: HTMLElement): void {
    const item = content.parentElement;
    if (!item) return;
    const next = this.renderItem({ content: '', items: [] });
    const nextContent = next.querySelector<HTMLElement>('.cdx-list__item');
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
    if (nextContent && range && content.contains(range.startContainer)) {
      range.deleteContents();
      const tail = document.createRange();
      tail.selectNodeContents(content);
      tail.setStart(range.startContainer, range.startOffset);
      nextContent.append(tail.extractContents());
    }
    item.parentElement?.insertBefore(next, item.nextSibling);
    if (nextContent) focusContent(nextContent);
  }
}

export function normalizeNestedListItems(value: unknown): NestedListItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { content: item, items: [] };
    if (!isRecord(item)) return { content: String(item ?? ''), items: [] };
    return {
      content: typeof item.content === 'string' ? item.content : '',
      items: normalizeNestedListItems(item.items),
    };
  });
}

export function readListItems(list: Element): NestedListItem[] {
  return Array.from(list.children)
    .filter((item): item is HTMLLIElement => item instanceof HTMLLIElement)
    .map((item) => ({
      content: item.querySelector<HTMLElement>(':scope > .cdx-list__item')?.innerHTML ?? '',
      items: readListItems(item.querySelector(':scope > ol, :scope > ul') ?? document.createElement('ul')),
    }));
}

function changeSelectedListLevel(root: Element | undefined, direction: -1 | 1): boolean {
  if (!root) return false;
  const selected = selectedItems(root);
  if (!selected.length) return false;
  const parent = selected[0].parentElement;
  const items = selected.filter((item) => item.parentElement === parent);
  if (!parent || !items.length) return false;
  if (direction > 0) {
    const previous = items[0].previousElementSibling as HTMLLIElement | null;
    if (!previous) return false;
    let nested = previous.querySelector<HTMLOListElement | HTMLUListElement>(':scope > ol, :scope > ul');
    if (!nested) nested = previous.appendChild(document.createElement(root.tagName.toLowerCase()) as HTMLUListElement);
    nested.className = root.className.replace('cdx-block', '').trim();
    items.forEach((item) => nested?.append(item));
  } else {
    const parentItem = parent.parentElement;
    if (!(parentItem instanceof HTMLLIElement) || !parentItem.parentElement) return false;
    let anchor: Element = parentItem;
    items.forEach((item) => {
      anchor.after(item);
      anchor = item;
    });
    if (!parent.children.length) parent.remove();
  }
  return true;
}

function selectedItems(root: Element): HTMLLIElement[] {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [];
  const range = selection.getRangeAt(0);
  return Array.from(root.querySelectorAll<HTMLLIElement>('li.slash-nested-list-item')).filter((item) => {
    const content = item.querySelector(':scope > .cdx-list__item');
    return Boolean(content && (range.collapsed ? content.contains(selection.anchorNode) : range.intersectsNode(content)));
  });
}

function currentContent(event: KeyboardEvent): HTMLElement | undefined {
  return event.composedPath().find((item): item is HTMLElement => item instanceof HTMLElement && item.matches('.cdx-list__item'));
}

function focusContent(content: HTMLElement): void {
  content.focus();
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function visibleText(element: HTMLElement): string {
  return (element.textContent ?? '').replaceAll(/[\s\u200B-\u200D\uFEFF]/g, '');
}

function flattenListText(items: NestedListItem[]): string[] {
  return items.flatMap((item) => [item.content, ...flattenListText(item.items)]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
