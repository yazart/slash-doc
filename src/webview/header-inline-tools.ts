import type { DocumentationPageLink } from './page-link-tool';
import { LUCIDE_ICONS } from './lucide-icons';
import { preventDefault as preventSelectionLoss } from './event-utils';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

type HeaderInlineToolsConfig = {
  pages: DocumentationPageLink[];
  currentPageId?: string;
  textColorEnabled: boolean;
};

export function setupHeaderInlineTools(config: HeaderInlineToolsConfig): void {
  const root = document.querySelector<HTMLElement>('#header-inline-tools');
  if (!root) return;

  let savedRange: Range | undefined;
  const toolButtons: HTMLButtonElement[] = [];
  const closePanels = (except?: HTMLElement) => {
    for (const tool of Array.from(root.querySelectorAll<HTMLElement>('.header-inline-tool'))) {
      const panel = tool.querySelector<HTMLElement>('.header-inline-tool-panel');
      const button = tool.querySelector<HTMLButtonElement>('.header-inline-tool-button');
      const shouldRemainOpen = tool === except;
      if (panel) panel.hidden = !shouldRemainOpen;
      button?.setAttribute('aria-expanded', String(shouldRemainOpen));
    }
  };

  const getRange = (): Range | undefined => {
    if (!savedRange?.commonAncestorContainer.isConnected) return undefined;
    return savedRange.cloneRange();
  };

  if (config.textColorEnabled) {
    const colorTool = createHeaderTool('Цвет текста', LUCIDE_ICONS.palette);
    const actions = document.createElement('div');
    actions.className = 'slash-text-color-actions';
    for (const color of COLORS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'slash-text-color-swatch';
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.setAttribute('aria-label', `Цвет ${color}`);
      swatch.addEventListener('pointerdown', preventSelectionLoss);
      swatch.addEventListener('click', (event) => {
        event.stopPropagation();
        applyColor(getRange(), color);
        closePanels();
      });
      actions.append(swatch);
    }

    const customColor = document.createElement('input');
    customColor.className = 'slash-text-color-picker';
    customColor.type = 'color';
    customColor.value = '#3b82f6';
    customColor.title = 'Другой цвет';
    customColor.setAttribute('aria-label', 'Другой цвет');
    customColor.addEventListener('change', () => {
      applyColor(getRange(), customColor.value);
      closePanels();
    });
    actions.append(customColor);
    colorTool.panel.append(actions);
    colorTool.button.dataset.requiresSelection = 'true';
    toolButtons.push(colorTool.button);
    root.append(colorTool.root);
  }

  const pageTool = createHeaderTool('Ссылка на страницу', LUCIDE_ICONS.link);
  const picker = createPagePicker(config, getRange, closePanels);
  pageTool.panel.append(picker);
  pageTool.root.addEventListener('slash-doc-tool-open', () => {
    const remove = picker.querySelector<HTMLButtonElement>('.slash-page-link-remove');
    if (remove) remove.hidden = !findParentPageLink(getRange()?.commonAncestorContainer);
  });
  toolButtons.push(pageTool.button);
  root.append(pageTool.root);

  const externalTool = createHeaderTool('Внешняя ссылка', LUCIDE_ICONS.externalLink);
  const externalPicker = createExternalLinkPicker(getRange, closePanels);
  externalTool.panel.append(externalPicker);
  externalTool.root.addEventListener('slash-doc-tool-open', () => {
    const input = externalPicker.querySelector<HTMLInputElement>('.slash-external-link-input');
    const remove = externalPicker.querySelector<HTMLButtonElement>('.slash-external-link-remove');
    const existing = findParentExternalLink(getRange()?.commonAncestorContainer);
    if (input) {
      input.value = existing?.getAttribute('href') ?? '';
      input.setCustomValidity('');
      queueMicrotask(() => input.focus());
    }
    if (remove) remove.hidden = !existing;
  });
  toolButtons.push(externalTool.button);
  root.append(externalTool.root);

  for (const button of toolButtons) {
    button.disabled = true;
    button.addEventListener('pointerdown', preventSelectionLoss);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const tool = button.closest<HTMLElement>('.header-inline-tool');
      if (!tool) return;
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      closePanels(isOpen ? undefined : tool);
      tool.dispatchEvent(new CustomEvent('slash-doc-tool-open', { bubbles: false }));
    });
  }

  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!isEditorRange(range)) return;
    savedRange = range.cloneRange();
    for (const button of toolButtons) {
      button.disabled = button.dataset.requiresSelection === 'true' ? range.collapsed : false;
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !root.contains(event.target)) closePanels();
  });
}

function createHeaderTool(title: string, icon: string) {
  const root = document.createElement('div');
  root.className = 'header-inline-tool';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-inline-tool-button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = icon;
  const panel = document.createElement('div');
  panel.className = 'header-inline-tool-panel';
  panel.hidden = true;
  root.append(button, panel);
  return { root, button, panel };
}

function createPagePicker(
  config: HeaderInlineToolsConfig,
  getRange: () => Range | undefined,
  closePanels: () => void,
): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'slash-page-link-picker';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'slash-page-link-search';
  search.placeholder = 'Найти страницу…';
  search.setAttribute('aria-label', 'Поиск страницы');
  const list = document.createElement('div');
  list.className = 'slash-page-link-list';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'slash-page-link-remove';
  remove.textContent = 'Удалить ссылку';

  const renderPages = () => {
    const query = search.value.trim().toLocaleLowerCase('ru');
    const pages = config.pages.filter((page) => page.title.toLocaleLowerCase('ru').includes(query));
    list.replaceChildren();
    if (pages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'slash-page-link-empty';
      empty.textContent = config.pages.length === 0 ? 'Нет доступных страниц' : 'Страницы не найдены';
      list.append(empty);
      return;
    }
    for (const page of pages) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'slash-page-link-option';
      if (page.id === config.currentPageId) option.classList.add('slash-page-link-current');
      option.style.paddingInlineStart = `${8 + page.depth * 14}px`;
      option.textContent = page.title;
      option.title = page.title;
      option.addEventListener('pointerdown', preventSelectionLoss);
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        applyPageLink(getRange(), page);
        closePanels();
      });
      list.append(option);
    }
  };

  search.addEventListener('input', renderPages);
  remove.addEventListener('pointerdown', preventSelectionLoss);
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    removePageLink(getRange());
    closePanels();
  });
  picker.append(search, list, remove);
  renderPages();
  return picker;
}

function createExternalLinkPicker(getRange: () => Range | undefined, closePanels: () => void): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'slash-external-link-picker';
  const input = document.createElement('input');
  input.type = 'url';
  input.className = 'slash-external-link-input';
  input.placeholder = 'https://example.com';
  input.setAttribute('aria-label', 'Внешний адрес');
  const actions = document.createElement('div');
  actions.className = 'slash-external-link-actions';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'slash-external-link-remove';
  remove.textContent = 'Удалить';
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'slash-external-link-save';
  save.textContent = 'Сохранить';

  const apply = () => {
    const href = normalizeExternalUrl(input.value);
    if (!href) {
      input.setCustomValidity('Введите корректный адрес http:// или https://');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    applyExternalLink(getRange(), href);
    closePanels();
  };

  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key !== 'Enter') return;
    event.preventDefault();
    apply();
  });
  save.addEventListener('pointerdown', preventSelectionLoss);
  save.addEventListener('click', (event) => {
    event.stopPropagation();
    apply();
  });
  remove.addEventListener('pointerdown', preventSelectionLoss);
  remove.addEventListener('click', (event) => {
    event.stopPropagation();
    removeExternalLink(getRange());
    closePanels();
  });
  actions.append(remove, save);
  picker.append(input, actions);
  return picker;
}

function applyColor(range: Range | undefined, color: string): void {
  if (!range || range.collapsed || !/^#[0-9a-f]{6}$/i.test(color)) return;
  const span = document.createElement('span');
  span.className = 'slash-text-color';
  span.dataset.slashTextColor = color.toLowerCase();
  span.style.color = color;
  span.append(range.extractContents());
  range.insertNode(span);
  finishChange(span);
}

function applyPageLink(range: Range | undefined, page: DocumentationPageLink): void {
  if (!range) return;
  const existing = findParentAnyLink(range.commonAncestorContainer);
  const href = `slash-doc://page/${encodeURIComponent(page.id)}`;
  if (existing) {
    existing.href = href;
    existing.dataset.pageId = page.id;
    existing.classList.add('slash-page-link');
    existing.classList.remove('slash-external-link');
    existing.removeAttribute('target');
    existing.removeAttribute('rel');
    finishChange(existing);
    return;
  }
  const anchor = document.createElement('a');
  anchor.className = 'slash-page-link';
  anchor.href = href;
  anchor.dataset.pageId = page.id;
  if (range.collapsed) anchor.textContent = page.title;
  else anchor.append(range.extractContents());
  range.insertNode(anchor);
  finishChange(anchor);
}

function applyExternalLink(range: Range | undefined, href: string): void {
  if (!range) return;
  const existing = findParentAnyLink(range.commonAncestorContainer);
  if (existing) {
    existing.href = href;
    existing.classList.add('slash-external-link');
    existing.classList.remove('slash-page-link');
    delete existing.dataset.pageId;
    existing.target = '_blank';
    existing.rel = 'noopener noreferrer';
    finishChange(existing);
    return;
  }
  const anchor = document.createElement('a');
  anchor.className = 'slash-external-link';
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  if (range.collapsed) anchor.textContent = href;
  else anchor.append(range.extractContents());
  range.insertNode(anchor);
  finishChange(anchor);
}

function removePageLink(range: Range | undefined): void {
  const anchor = findParentPageLink(range?.commonAncestorContainer);
  const parent = anchor?.parentNode;
  if (!anchor || !parent) return;
  const lastChild = anchor.lastChild;
  while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
  anchor.remove();
  if (lastChild) setCaretAfter(lastChild);
  dispatchEditorInput(parent);
}

function removeExternalLink(range: Range | undefined): void {
  unwrapLink(findParentExternalLink(range?.commonAncestorContainer));
}

function unwrapLink(anchor: HTMLAnchorElement | null): void {
  const parent = anchor?.parentNode;
  if (!anchor || !parent) return;
  const lastChild = anchor.lastChild;
  while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
  anchor.remove();
  if (lastChild) setCaretAfter(lastChild);
  dispatchEditorInput(parent);
}

function finishChange(element: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  dispatchEditorInput(element);
}

function setCaretAfter(node: Node): void {
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function dispatchEditorInput(node: Node): void {
  const element = node instanceof Element ? node : node.parentElement;
  element?.closest<HTMLElement>('[contenteditable="true"]')?.dispatchEvent(new Event('input', { bubbles: true }));
}

function isEditorRange(range: Range): boolean {
  const node = range.commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest('#editor [contenteditable="true"]'));
}

function findParentPageLink(node: Node | undefined): HTMLAnchorElement | null {
  if (!node) return null;
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLAnchorElement>('a.slash-page-link, a[data-page-id], a[href^="slash-doc:"]') ?? null;
}

function findParentAnyLink(node: Node | undefined): HTMLAnchorElement | null {
  if (!node) return null;
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLAnchorElement>('a[href]') ?? null;
}

function findParentExternalLink(node: Node | undefined): HTMLAnchorElement | null {
  if (!node) return null;
  const element = node instanceof Element ? node : node.parentElement;
  const anchor = element?.closest<HTMLAnchorElement>('a[href]') ?? null;
  return anchor && normalizeExternalUrl(anchor.getAttribute('href') ?? '') ? anchor : null;
}

function normalizeExternalUrl(value: string): string | undefined {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
