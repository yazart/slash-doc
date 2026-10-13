import type { InlineFormatMatcher } from './inline-format-toggle';
import type { DocumentationPageLink } from './page-link-tool';

type SelectionRoot = ShadowRoot & { getSelection?: () => Selection | null };

export function configureLink(
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

export function findSelectedLinks(cell: HTMLElement, range: Range): HTMLAnchorElement[] {
  return Array.from(cell.querySelectorAll<HTMLAnchorElement>('a[href]')).filter((anchor) =>
    range.intersectsNode(anchor),
  );
}

export function isRangeInside(range: Range, element: HTMLElement): boolean {
  return element.contains(range.startContainer) && element.contains(range.endContainer);
}

export function unwrapAnchor(anchor: HTMLAnchorElement): void {
  const parent = anchor.parentNode;
  if (!parent) return;
  while (anchor.firstChild) parent.insertBefore(anchor.firstChild, anchor);
  anchor.remove();
}

export async function readClipboardText(): Promise<string> {
  if (window.__SLASH_DOC_READ_CLIPBOARD__) return window.__SLASH_DOC_READ_CLIPBOARD__();
  return navigator.clipboard.readText();
}

export function createButton(title: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = icon;
  button.addEventListener('pointerdown', (event) => event.preventDefault());
  return button;
}

export function populatePageOptions(
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

export function positionToolbar(toolbar: HTMLElement, range: Pick<Range, 'getBoundingClientRect'>): void {
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

export function readSelectionRange(selection: Selection | null): Range | undefined {
  return selection?.rangeCount ? selection.getRangeAt(0) : undefined;
}

export function selectNode(node: Node): void {
  const root = node.getRootNode() as SelectionRoot;
  const selection = root.getSelection?.() ?? window.getSelection();
  const selected = document.createRange();
  selected.selectNodeContents(node);
  selection?.removeAllRanges();
  selection?.addRange(selected);
}

export function normalizeExternalUrl(value: string): string | undefined {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function matchesTags(...tags: string[]): InlineFormatMatcher {
  const normalized = new Set(tags.map((tag) => tag.toUpperCase()));
  return (element) => normalized.has(element.tagName);
}

export function matchesCode(element: Element): boolean {
  return element.tagName === 'CODE' || element.classList.contains('inline-code');
}

export function matchesTextColor(element: Element): boolean {
  return element.classList.contains('slash-text-color') || element.hasAttribute('data-slash-text-color');
}
