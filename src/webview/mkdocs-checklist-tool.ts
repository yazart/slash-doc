import { LUCIDE_ICONS } from './lucide-icons';
import { createMkDocsChecklistItem, type MkDocsChecklistData, type MkDocsChecklistItem } from './mkdocs-widget-types';
import styles from './mkdocs-widgets.shadow.css?raw';
import { createToolSurface } from './tool-surface';

type ToolArgs = { data?: Partial<MkDocsChecklistData> };

export default class MkDocsChecklistTool {
  private items: MkDocsChecklistItem[];
  private list?: HTMLDivElement;

  static get toolbox() {
    return { title: 'Чеклист MkDocs', icon: LUCIDE_ICONS.listChecks };
  }

  constructor({ data }: ToolArgs) {
    this.items = normalizeItems(data?.items);
    if (this.items.length === 0) this.items = [createMkDocsChecklistItem()];
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'mkdocs-widget-surface');
    const root = document.createElement('section');
    root.className = 'mkdocs-widget';
    const header = document.createElement('header');
    header.className = 'mkdocs-widget-header';
    header.textContent = 'Чеклист MkDocs';
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = '+ Пункт';
    add.addEventListener('click', () => this.addItem(this.items.length));
    header.append(add);
    this.list = document.createElement('div');
    this.list.className = 'mkdocs-checklist';
    root.append(header, this.list);
    surface.content.append(root);
    this.refresh();
    return surface;
  }

  save(): MkDocsChecklistData {
    return { items: this.items.map((item) => ({ ...item, level: Math.max(0, Math.floor(item.level)) })) };
  }

  private refresh(focusId?: string): void {
    if (!this.list) return;
    this.list.replaceChildren(...this.items.map((item, index) => this.renderItem(item, index)));
    if (focusId) this.list.querySelector<HTMLInputElement>(`[data-checklist-id="${CSS.escape(focusId)}"]`)?.focus();
  }

  private renderItem(item: MkDocsChecklistItem, index: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'mkdocs-checklist-row';
    row.style.setProperty('--checklist-level', String(item.level));
    const checked = document.createElement('input');
    checked.type = 'checkbox';
    checked.checked = item.checked;
    checked.setAttribute('aria-label', `Отметить пункт ${index + 1}`);
    checked.addEventListener('change', () => {
      item.checked = checked.checked;
      this.changed();
    });
    const text = document.createElement('input');
    text.type = 'text';
    text.value = item.text;
    text.placeholder = 'Текст пункта в Markdown';
    text.dataset.checklistId = item.id;
    text.addEventListener('input', () => {
      item.text = text.value;
      this.changed();
    });
    text.addEventListener('keydown', (event) => this.handleTextKeydown(event, index));
    row.append(
      checked,
      text,
      this.iconButton('Уменьшить отступ', LUCIDE_ICONS.indentDecrease, () => this.changeLevel(index, -1)),
      this.iconButton('Увеличить отступ', LUCIDE_ICONS.indentIncrease, () => this.changeLevel(index, 1)),
      this.iconButton('Удалить пункт', LUCIDE_ICONS.trash2, () => this.removeItem(index), true),
    );
    return row;
  }

  private iconButton(label: string, icon: string, action: () => void, danger = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mkdocs-icon-button${danger ? ' mkdocs-danger-button' : ''}`;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = icon;
    button.addEventListener('click', action);
    return button;
  }

  private handleTextKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      this.changeLevel(index, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      this.addItem(index + 1, this.items[index]?.level ?? 0);
    }
  }

  private addItem(index: number, level = 0): void {
    const item = createMkDocsChecklistItem('', level);
    this.items.splice(index, 0, item);
    this.refresh(item.id);
    this.changed();
  }

  private removeItem(index: number): void {
    const next = this.items[index + 1]?.id ?? this.items[index - 1]?.id;
    const removed = this.items.splice(index, 1)[0];
    if (removed) {
      for (let cursor = index; cursor < this.items.length && this.items[cursor].level > removed.level; cursor += 1) {
        this.items[cursor].level -= 1;
      }
    }
    if (this.items.length === 0) this.items.push(createMkDocsChecklistItem());
    this.refresh(next ?? this.items[0].id);
    this.changed();
  }

  private changeLevel(index: number, direction: -1 | 1): void {
    const item = this.items[index];
    if (!item) return;
    const maximum = index === 0 ? 0 : this.items[index - 1].level + 1;
    const previousLevel = item.level;
    item.level = Math.max(0, Math.min(maximum, item.level + direction));
    const delta = item.level - previousLevel;
    for (
      let cursor = index + 1;
      delta !== 0 && cursor < this.items.length && this.items[cursor].level > previousLevel;
      cursor += 1
    ) {
      this.items[cursor].level = Math.max(0, this.items[cursor].level + delta);
    }
    this.refresh(item.id);
    this.changed();
  }

  private changed(): void {
    this.list?.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }
}

function normalizeItems(value: unknown): MkDocsChecklistItem[] {
  if (!Array.isArray(value)) return [];
  let previousLevel = 0;
  return value.flatMap((candidate, index) => {
    if (!isRecord(candidate)) return [];
    const requested = typeof candidate.level === 'number' ? Math.max(0, Math.floor(candidate.level)) : 0;
    const level = index === 0 ? 0 : Math.min(requested, previousLevel + 1);
    previousLevel = level;
    return [
      {
        id: typeof candidate.id === 'string' ? candidate.id : createMkDocsChecklistItem().id,
        text: typeof candidate.text === 'string' ? candidate.text : '',
        checked: candidate.checked === true,
        level,
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
