import { iconButton } from './block-editor-view';
import { LUCIDE_ICONS } from './lucide-icons';
import { readClipboardText } from './confluence-table-inline-utils';
import { selectionForNode, selectRangeForNode } from './editor-selection';

type HeaderActions = {
  cell(): HTMLElement | undefined;
  color(): string;
  fill(color: string): void;
  addColumn(): void;
  deleteColumn(): void;
  addRow(): void;
  deleteRow(): void;
  paste(cell: HTMLElement, text: string): void;
};

export function createTableHeaderControls(actions: HeaderActions): { element: HTMLElement; update(): void } {
  const element = document.createElement('span');
  element.className = 'ct-header-controls';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Управление таблицей');
  const color = document.createElement('input');
  color.type = 'color';
  color.title = 'Фон ячеек';
  color.setAttribute('aria-label', color.title);
  color.addEventListener('change', () => actions.fill(color.value));
  element.append(color);
  for (const [title, icon, action] of [
    ['Убрать фон ячеек', LUCIDE_ICONS.x, () => actions.fill('')],
    ['Добавить столбец', LUCIDE_ICONS.columnPlus, actions.addColumn],
    ['Удалить столбец', LUCIDE_ICONS.columnMinus, actions.deleteColumn],
    ['Добавить строку', LUCIDE_ICONS.rowPlus, actions.addRow],
    ['Удалить строку', LUCIDE_ICONS.rowMinus, actions.deleteRow],
    ['Вставить из буфера', LUCIDE_ICONS.clipboardPaste, () => pasteTableCellFromClipboard(actions.cell, actions.paste)],
  ] as const) {
    const control = iconButton(title, icon);
    control.addEventListener('pointerdown', (event) => event.preventDefault());
    control.addEventListener('click', () => {
      if (actions.cell()?.isContentEditable) action();
    });
    element.append(control);
  }
  const update = () => {
    color.value = actions.color() || '#fef08a';
    const editable = actions.cell()?.contentEditable === 'true';
    element.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach((control) => {
      control.disabled = !editable;
    });
  };
  update();
  return { element, update };
}

export async function pasteTableCellFromClipboard(
  current: () => HTMLElement | undefined,
  paste: (cell: HTMLElement, text: string) => void,
): Promise<void> {
  const cell = current();
  if (!cell?.isContentEditable) return;
  const before = cell.innerHTML;
  const selection = selectionForNode(cell);
  const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined;
  try {
    const text = await readClipboardText();
    if (!text || !cell.isConnected || !cell.isContentEditable || current() !== cell || cell.innerHTML !== before)
      return;
    cell.focus();
    if (range && cell.contains(range.commonAncestorContainer)) selectRangeForNode(cell, range);
    paste(cell, text);
  } catch {
    /* The host/browser clipboard may be unavailable. */
  }
}
