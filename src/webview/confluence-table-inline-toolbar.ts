import { LUCIDE_ICONS } from './lucide-icons';

type SelectionRoot = ShadowRoot & { getSelection?: () => Selection | null };

export type TableInlineToolbar = {
  element: HTMLElement;
  bindCell(cell: HTMLElement): void;
};

export function createTableInlineToolbar(): TableInlineToolbar {
  const element = document.createElement('div');
  element.className = 'ct-inline-toolbar';
  element.hidden = true;
  let range: Range | undefined;
  let cell: HTMLElement | undefined;

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
    { title: 'Внешняя ссылка', icon: LUCIDE_ICONS.externalLink, action: () => applyExternalLink() },
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

  const color = document.createElement('input');
  color.type = 'color';
  color.value = '#3b82f6';
  color.title = 'Цвет текста';
  color.setAttribute('aria-label', 'Цвет текста');
  color.addEventListener('change', () => applyColor(color.value));
  element.append(color);

  function capture(current: HTMLElement): void {
    const selection = getSelection(current);
    const selected = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
    if (!selected || selected.collapsed || !current.contains(selected.commonAncestorContainer)) {
      element.hidden = true;
      return;
    }
    cell = current;
    range = selected.cloneRange();
    element.hidden = false;
  }

  function applyColor(value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    apply('span', 'slash-text-color', (span) => {
      span.dataset.slashTextColor = value.toLowerCase();
      span.style.color = value;
    });
  }

  function applyExternalLink(): void {
    if (!range || range.collapsed || !cell) return;
    const input = window.prompt('Внешний адрес', 'https://');
    if (!input) return;
    const href = normalizeExternalUrl(input);
    if (!href) return;
    const anchor = document.createElement('a');
    anchor.className = 'slash-external-link';
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.append(range.extractContents());
    range.insertNode(anchor);
    selectNode(anchor);
    cell.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  return {
    element,
    bindCell(current) {
      current.addEventListener('mouseup', () => capture(current));
      current.addEventListener('keyup', () => capture(current));
      current.addEventListener('focus', () => capture(current));
    },
  };
}

function getSelection(cell: HTMLElement): Selection | null {
  const root = cell.getRootNode() as SelectionRoot;
  return root.getSelection?.() ?? window.getSelection();
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
