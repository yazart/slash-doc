import { LUCIDE_ICONS } from './lucide-icons';
import { readActiveEditorRange, selectionForNode } from './editor-selection';
import type { DocumentationPageLink } from './page-link-tool';

type SelectionRoot = ShadowRoot & { getSelection?: () => Selection | null };

export type TextInlineToolbar = {
  element: HTMLElement;
  bindCell(cell: HTMLElement): void;
};

export type TextInlineToolbarConfig = {
  pages?: DocumentationPageLink[];
  currentPageId?: string;
};

export function createTextInlineToolbar(config: TextInlineToolbarConfig = {}): TextInlineToolbar {
  const element = document.createElement('div');
  element.className = 'slash-text-inline-toolbar';
  element.hidden = true;
  let range: Range | undefined;
  let cell: HTMLElement | undefined;
  let captureFrame: number | undefined;

  const apply = (tag: keyof HTMLElementTagNameMap, className?: string, configure?: (wrapper: HTMLElement) => void) => {
    if (!range || range.collapsed || !cell?.contains(range.commonAncestorContainer)) return;
    const wrapper = document.createElement(tag);
    if (className) wrapper.className = className;
    configure?.(wrapper);
    wrapper.append(range.extractContents());
    range.insertNode(wrapper);
    selectNode(wrapper);
    cell.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };

  const tools: Array<{ title: string; icon: string; action: () => void }> = [
    { title: 'Полужирный', icon: LUCIDE_ICONS.bold, action: () => apply('strong') },
    { title: 'Курсив', icon: LUCIDE_ICONS.italic, action: () => apply('em') },
    { title: 'Подчёркивание', icon: LUCIDE_ICONS.underline, action: () => apply('u') },
    { title: 'Маркер', icon: LUCIDE_ICONS.highlighter, action: () => apply('mark') },
    { title: 'Встроенный код', icon: LUCIDE_ICONS.code, action: () => apply('code') },
  ];

  for (const tool of tools) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = tool.title;
    button.setAttribute('aria-label', tool.title);
    button.innerHTML = tool.icon;
    button.addEventListener('pointerdown', (event) => event.preventDefault());
    button.addEventListener('click', tool.action);
    element.append(button);
  }

  const pageLink = createButton('Ссылка на страницу', LUCIDE_ICONS.link);
  const pageSelect = document.createElement('select');
  pageSelect.className = 'slash-text-inline-link-select';
  pageSelect.title = 'Выберите страницу';
  pageSelect.setAttribute('aria-label', 'Выберите страницу');
  pageSelect.hidden = true;
  populatePageOptions(pageSelect, config.pages ?? [], config.currentPageId);
  pageLink.addEventListener('click', () => togglePanel(pageSelect));
  pageSelect.addEventListener('change', () => {
    const page = (config.pages ?? []).find((item) => item.id === pageSelect.value);
    if (page) applyPageLink(page);
  });
  element.append(pageLink, pageSelect);

  const externalLink = createButton('Внешняя ссылка', LUCIDE_ICONS.externalLink);
  const externalPanel = document.createElement('span');
  externalPanel.className = 'slash-text-inline-link-panel';
  externalPanel.hidden = true;
  const externalInput = document.createElement('input');
  externalInput.type = 'url';
  externalInput.placeholder = 'https://example.com';
  externalInput.setAttribute('aria-label', 'Внешний адрес');
  externalInput.setAttribute('style', 'width: 128px;');
  const externalPaste = createButton('Вставить из буфера обмена', LUCIDE_ICONS.clipboardPaste);
  const externalSave = createButton('Сохранить ссылку', LUCIDE_ICONS.check);
  const saveExternalLink = () => {
    const href = normalizeExternalUrl(externalInput.value);
    if (!href) {
      externalInput.setCustomValidity('Введите корректный адрес http:// или https://');
      externalInput.reportValidity();
      return;
    }
    externalInput.setCustomValidity('');
    applyLink(href, 'slash-external-link', { target: '_blank', rel: 'noopener noreferrer' });
  };
  externalLink.addEventListener('click', () => {
    togglePanel(externalPanel);
    if (!externalPanel.hidden) queueMicrotask(() => externalInput.focus());
  });
  externalInput.addEventListener('input', () => externalInput.setCustomValidity(''));
  externalInput.addEventListener('paste', (event) => event.stopPropagation());
  externalInput.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key !== 'Enter') return;
    event.preventDefault();
    saveExternalLink();
  });
  externalPaste.addEventListener('click', () => void pasteExternalLink());
  externalSave.addEventListener('click', saveExternalLink);
  externalPanel.append(externalInput, externalPaste, externalSave);
  element.append(externalLink, externalPanel);

  const unlink = createButton('Удалить ссылку', LUCIDE_ICONS.unlink);
  unlink.disabled = true;
  unlink.addEventListener('click', removeSelectedLinks);
  element.append(unlink);

  const color = document.createElement('input');
  color.type = 'color';
  color.value = '#3b82f6';
  color.title = 'Цвет текста';
  color.setAttribute('aria-label', 'Цвет текста');
  color.addEventListener('change', () => applyColor(color.value));
  element.append(color);
  element.addEventListener('pointerdown', (event) => event.stopPropagation());
  element.addEventListener('click', (event) => event.stopPropagation());

  function capture(current: HTMLElement): void {
    const selected = selectContainedRange(current, [
      readSelectionRange(selectionForNode(current)),
      readActiveEditorRange(),
      readSelectionRange(window.getSelection()),
    ]);
    if (!selected) {
      element.hidden = true;
      return;
    }
    cell = current;
    range = selected.cloneRange();
    unlink.disabled = findSelectedLinks(current, selected).length === 0;
    element.hidden = false;
    positionToolbar(element, selected);
  }

  function scheduleCapture(current: HTMLElement): void {
    if (captureFrame !== undefined) window.cancelAnimationFrame(captureFrame);
    captureFrame = window.requestAnimationFrame(() => {
      captureFrame = undefined;
      capture(current);
    });
  }

  function applyColor(value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    apply('span', 'slash-text-color', (span) => {
      span.dataset.slashTextColor = value.toLowerCase();
      span.style.color = value;
    });
  }

  function applyPageLink(page: DocumentationPageLink): void {
    applyLink(`slash-doc://page/${encodeURIComponent(page.id)}`, 'slash-page-link', { pageId: page.id });
  }

  function applyLink(
    href: string,
    className: 'slash-page-link' | 'slash-external-link',
    attributes: { pageId?: string; rel?: string; target?: string },
  ): void {
    if (!range || range.collapsed || !cell?.contains(range.commonAncestorContainer)) return;
    const selectedLinks = findSelectedLinks(cell, range);
    const existing = selectedLinks.find((candidate) => isRangeInside(range as Range, candidate));
    const anchor = existing ?? document.createElement('a');
    configureLink(anchor, href, className, attributes);
    if (!existing) {
      const contents = range.extractContents();
      for (const nested of Array.from(contents.querySelectorAll<HTMLAnchorElement>('a[href]'))) unwrapAnchor(nested);
      anchor.append(contents);
      range.insertNode(anchor);
    }
    selectNode(anchor);
    finishCellChange();
  }

  function removeSelectedLinks(): void {
    if (!range || !cell) return;
    const links = findSelectedLinks(cell, range);
    if (links.length === 0) return;
    for (const anchor of links) unwrapAnchor(anchor);
    finishCellChange();
  }

  async function pasteExternalLink(): Promise<void> {
    try {
      const text = await readClipboardText();
      if (!text) return;
      externalInput.value = text.trim();
      externalInput.setCustomValidity('');
      externalInput.focus();
      externalInput.select();
    } catch {
      externalInput.setCustomValidity('Не удалось прочитать буфер обмена');
      externalInput.reportValidity();
    }
  }

  function finishCellChange(): void {
    cell?.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    closePanels();
    range = undefined;
    element.hidden = true;
  }

  function togglePanel(panel: HTMLElement): void {
    const open = panel.hidden;
    closePanels();
    panel.hidden = !open;
    if (open && range) positionToolbar(element, range);
  }

  function closePanels(): void {
    pageSelect.hidden = true;
    externalPanel.hidden = true;
    pageSelect.value = '';
  }

  return {
    element,
    bindCell(current) {
      current.addEventListener('mouseup', () => scheduleCapture(current));
      current.addEventListener('keyup', () => scheduleCapture(current));
      current.addEventListener('focus', () => capture(current));
    },
  };
}

function configureLink(
  anchor: HTMLAnchorElement,
  href: string,
  className: 'slash-page-link' | 'slash-external-link',
  attributes: { pageId?: string; rel?: string; target?: string },
): void {
  anchor.classList.remove('slash-page-link', 'slash-external-link');
  anchor.classList.add(className);
  anchor.href = href;
  if (attributes.pageId) anchor.dataset.pageId = attributes.pageId;
  else delete anchor.dataset.pageId;
  if (attributes.target) anchor.target = attributes.target;
  else anchor.removeAttribute('target');
  if (attributes.rel) anchor.rel = attributes.rel;
  else anchor.removeAttribute('rel');
}

function findSelectedLinks(cell: HTMLElement, range: Range): HTMLAnchorElement[] {
  return Array.from(cell.querySelectorAll<HTMLAnchorElement>('a[href]')).filter((anchor) =>
    range.intersectsNode(anchor),
  );
}

function isRangeInside(range: Range, element: HTMLElement): boolean {
  return element.contains(range.startContainer) && element.contains(range.endContainer);
}

function unwrapAnchor(anchor: HTMLAnchorElement): void {
  const parent = anchor.parentNode;
  if (!parent) return;
  while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
  anchor.remove();
}

async function readClipboardText(): Promise<string> {
  if (window.__SLASH_DOC_READ_CLIPBOARD__) return window.__SLASH_DOC_READ_CLIPBOARD__();
  return navigator.clipboard.readText();
}

function createButton(title: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = icon;
  button.addEventListener('pointerdown', (event) => event.preventDefault());
  return button;
}

function populatePageOptions(
  select: HTMLSelectElement,
  pages: DocumentationPageLink[],
  currentPageId: string | undefined,
): void {
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = pages.length > 0 ? 'Выберите страницу…' : 'Нет доступных страниц';
  select.append(placeholder);
  for (const page of pages) {
    const option = document.createElement('option');
    option.value = page.id;
    option.textContent = `${'\u00a0'.repeat(page.depth * 2)}${page.title}${page.id === currentPageId ? ' (текущая)' : ''}`;
    select.append(option);
  }
}

export function calculateToolbarPosition(
  selection: Pick<DOMRect, 'bottom' | 'left' | 'top' | 'width'>,
  toolbar: Pick<DOMRect, 'height' | 'width'>,
  viewport: { height: number; width: number },
): { left: number; top: number } {
  const gap = 8;
  const left = Math.max(
    gap,
    Math.min(selection.left + selection.width / 2 - toolbar.width / 2, viewport.width - toolbar.width - gap),
  );
  const above = selection.top - toolbar.height - gap;
  const top = above >= gap ? above : Math.min(selection.bottom + gap, viewport.height - toolbar.height - gap);
  return { left, top: Math.max(gap, top) };
}

function positionToolbar(toolbar: HTMLElement, range: Range): void {
  const selectionRect = range.getBoundingClientRect();
  const toolbarRect = toolbar.getBoundingClientRect();
  const position = calculateToolbarPosition(selectionRect, toolbarRect, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  toolbar.style.left = `${position.left}px`;
  toolbar.style.top = `${position.top}px`;
}

export function selectContainedRange(container: Node, candidates: Array<Range | undefined>): Range | undefined {
  return candidates.find((candidate): candidate is Range =>
    Boolean(candidate && !candidate.collapsed && container.contains(candidate.commonAncestorContainer)),
  );
}

function readSelectionRange(selection: Selection | null): Range | undefined {
  return selection?.rangeCount ? selection.getRangeAt(0) : undefined;
}

function selectNode(node: Node): void {
  const root = node.getRootNode() as SelectionRoot;
  const selection = root.getSelection?.() ?? window.getSelection();
  const selected = document.createRange();
  selected.selectNodeContents(node);
  selection?.removeAllRanges();
  selection?.addRange(selected);
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
