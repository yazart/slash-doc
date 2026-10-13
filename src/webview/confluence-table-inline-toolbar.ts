import {
  configureLink,
  findSelectedLinks,
  isRangeInside,
  unwrapAnchor,
  readClipboardText,
  createButton,
  populatePageOptions,
  positionToolbar,
  selectNode,
  normalizeExternalUrl,
  matchesTags,
  matchesCode,
  matchesTextColor,
} from './confluence-table-inline-utils';
export { calculateToolbarPosition, selectContainedRange } from './confluence-table-inline-utils';
import { toggleRichTextList } from './rich-text-list';
import { LUCIDE_ICONS } from './lucide-icons';
import { selectRangeForNode } from './editor-selection';
import { toggleInlineFormat, removeInlineFormat, type InlineFormatMatcher } from './inline-format-toggle';
import { createBackgroundControls } from './inline-background-controls';
import type { DocumentationPageLink } from './page-link-tool';
import { installInlineToolbarSelection, readInlineToolbarRange } from './inline-toolbar-selection';

export type TextInlineToolbar = {
  element: HTMLElement;
  close(): void;
  destroy(): void;
  bindCell(cell: HTMLElement): void;
  captureSelection(cell: HTMLElement): void;
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
  const selection = installInlineToolbarSelection(element, {
    current: () => (cell ? { cell, range } : undefined),
    remember: (selected) => {
      range = selected;
    },
    close,
  });

  const tools: Array<{ title: string; icon: string; action: () => void }> = [
    { title: 'Маркированный список', icon: LUCIDE_ICONS.list, action: () => applyList(false) },
    { title: 'Нумерованный список', icon: LUCIDE_ICONS.listOrdered, action: () => applyList(true) },
    { title: 'Полужирный', icon: LUCIDE_ICONS.bold, action: () => toggleFormat(matchesTags('b', 'strong'), 'strong') },
    { title: 'Курсив', icon: LUCIDE_ICONS.italic, action: () => toggleFormat(matchesTags('em', 'i'), 'em') },
    { title: 'Подчёркивание', icon: LUCIDE_ICONS.underline, action: () => toggleFormat(matchesTags('u'), 'u') },
    { title: 'Маркер', icon: LUCIDE_ICONS.highlighter, action: () => toggleFormat(matchesTags('mark'), 'mark') },
    { title: 'Встроенный код', icon: LUCIDE_ICONS.code, action: () => toggleFormat(matchesCode, 'code') },
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
  const backgrounds = createBackgroundControls(element, applyBackground, clearBackground);
  element.addEventListener('pointerdown', (event) => event.stopPropagation());
  element.addEventListener('click', (event) => event.stopPropagation());

  function capture(current: HTMLElement): void {
    if (!current.isConnected || !current.isContentEditable) {
      element.hidden = true;
      return;
    }
    const selected = readInlineToolbarRange(current);
    if (!selected && cell === current && range && !range.collapsed && selection.isInteracting()) return;
    if (!selected && cell && cell !== current && readInlineToolbarRange(cell)) return;
    if (!selected) {
      close();
      return;
    }
    cell = current;
    range = selected?.cloneRange();
    element
      .querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button, input, select')
      .forEach((control) => {
        control.disabled = !selected;
      });
    unlink.disabled = !selected || findSelectedLinks(current, selected).length === 0;
    if (!selected) closePanels();
    backgrounds.update(Boolean(selected));
    element.hidden = false;
    positionToolbar(element, selected ?? current);
  }

  function scheduleCapture(current: HTMLElement): void {
    if (captureFrame !== undefined) window.cancelAnimationFrame(captureFrame);
    captureFrame = window.requestAnimationFrame(() => {
      captureFrame = undefined;
      capture(current);
    });
  }

  function applyList(ordered: boolean): void {
    if (!range || !cell) return;
    range = toggleRichTextList(cell, range, ordered);
  }

  function applyColor(value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    const normalized = value.toLowerCase();
    toggleFormat(
      (element) => matchesTextColor(element) && element.getAttribute('data-slash-text-color') === normalized,
      'span',
      (span) => {
        span.className = 'slash-text-color';
        span.dataset.slashTextColor = normalized;
        span.style.color = value;
      },
      matchesTextColor,
    );
  }

  function toggleFormat(
    matcher: InlineFormatMatcher,
    tag: keyof HTMLElementTagNameMap,
    configure?: (element: HTMLElement) => void,
    normalizeMatcher?: InlineFormatMatcher,
  ): void {
    if (!range || !cell?.isConnected || !cell.isContentEditable) return;
    range = toggleInlineFormat(cell, range, {
      matcher,
      normalizeMatcher,
      create: () => {
        const span = document.createElement(tag);
        configure?.(span);
        return span;
      },
    });
    selectRangeForNode(cell, range);
    cell.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  function applyBackground(value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    const normalized = value.toLowerCase();
    toggleFormat(
      (element) => matchesBackground(element) && element.getAttribute('data-slash-text-background') === normalized,
      'span',
      (span) => {
        span.className = 'slash-text-background';
        span.dataset.slashTextBackground = normalized;
        span.style.backgroundColor = normalized;
      },
      matchesBackground,
    );
  }

  function clearBackground(): void {
    if (!range || !cell?.isConnected || !cell.isContentEditable) return;
    range = removeInlineFormat(cell, range, matchesBackground);
    selectRangeForNode(cell, range);
    cell.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
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
    range = cell ? readInlineToolbarRange(cell)?.cloneRange() : undefined;
    if (!range) close();
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
  function close(): void {
    selection.reset();
    if (captureFrame !== undefined) window.cancelAnimationFrame(captureFrame);
    captureFrame = undefined;
    range = undefined;
    cell = undefined;
    element.hidden = true;
    closePanels();
  }

  return {
    element,
    close,
    destroy() {
      close();
      selection.destroy();
    },
    captureSelection: scheduleCapture,
    bindCell(current) {
      current.addEventListener('mouseup', () => scheduleCapture(current));
      current.addEventListener('keyup', () => scheduleCapture(current));
      current.addEventListener('focus', () => capture(current));
    },
  };
}

function matchesBackground(element: Element): boolean {
  return element.classList.contains('slash-text-background') || element.hasAttribute('data-slash-text-background');
}
