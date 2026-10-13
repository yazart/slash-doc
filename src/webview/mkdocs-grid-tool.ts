import type { BlockToolConstructorOptions } from './block-editor-types';
import { iconButton } from './block-editor-view';
import { normalizeMkDocsGrid, type MkDocsGridData, type MkDocsGridItem } from '../shared/mkdocs-grid';
import { createMkDocsContent } from './mkdocs-content';
import { LUCIDE_ICONS } from './lucide-icons';
import styles from './mkdocs-widgets.shadow.css?raw';
import gridStyles from './mkdocs-grid.shadow.css?raw';
import { createToolSurface } from './tool-surface';

export default class MkDocsGridTool {
  private data: MkDocsGridData;
  private grid?: HTMLElement;
  private activeId: string;
  private selection?: HTMLSelectElement;
  private remove?: HTMLButtonElement;

  static get toolbox() {
    return { title: 'Сетка MkDocs', icon: LUCIDE_ICONS.grid };
  }
  constructor(private readonly options: BlockToolConstructorOptions) {
    this.data = normalizeMkDocsGrid(options.data);
    if (!this.data.items.length) this.data.items = [this.newItem(), this.newItem()];
    this.activeId = this.data.items[0].id;
  }
  render(): HTMLElement {
    const surface = createToolSurface(`${styles}\n${gridStyles}`, 'mkdocs-widget-surface');
    this.grid = document.createElement('div');
    this.grid.className = 'mkdocs-grid';
    surface.content.append(this.grid);
    this.refresh();
    return surface;
  }
  renderHeaderControls(): HTMLElement {
    const controls = document.createElement('span');
    const add = iconButton('Добавить элемент сетки', LUCIDE_ICONS.plus);
    add.addEventListener('click', () => {
      const item = this.newItem();
      this.data.items.push(item);
      this.activeId = item.id;
      this.refresh(true);
      this.options.block.dispatchChange();
    });
    this.remove = iconButton('Удалить элемент сетки', LUCIDE_ICONS.trash2);
    this.remove.addEventListener('click', () => {
      if (this.data.items.length <= 1) return;
      const index = this.data.items.findIndex((item) => item.id === this.activeId);
      this.data.items.splice(index, 1);
      this.activeId = this.data.items[Math.max(0, index - 1)].id;
      this.refresh(true);
      this.options.block.dispatchChange();
    });
    this.selection = document.createElement('select');
    this.selection.setAttribute('aria-label', 'Элемент сетки');
    this.selection.addEventListener('change', () => {
      this.activeId = this.selection!.value;
      this.refreshSelection(true);
    });
    const label = document.createElement('label');
    const cards = document.createElement('input');
    cards.type = 'checkbox';
    cards.checked = this.data.cards;
    cards.addEventListener('change', () => {
      this.data.cards = cards.checked;
      this.grid?.classList.toggle('mkdocs-grid--cards', this.data.cards);
    });
    label.append(cards, 'Карточки');
    controls.append(add, this.remove, this.selection, label);
    this.refreshSelection();
    return controls;
  }
  save(): MkDocsGridData {
    return structuredClone(this.data);
  }
  private newItem(): MkDocsGridItem {
    return { id: crypto.randomUUID(), content: '' };
  }
  private refresh(focus = false): void {
    if (!this.grid) return;
    this.grid.classList.toggle('mkdocs-grid--cards', this.data.cards);
    this.grid.replaceChildren(
      ...this.data.items.map((item, index) => {
        const card = document.createElement('div');
        card.className = 'mkdocs-grid-item';
        card.dataset.gridId = item.id;
        const content = createMkDocsContent(
          item.content,
          `Содержимое элемента ${index + 1}`,
          (html) => {
            item.content = html;
          },
          this.options.readOnly,
          true,
        );
        content.addEventListener('focus', () => {
          this.activeId = item.id;
          this.refreshSelection();
        });
        card.append(content);
        return card;
      }),
    );
    this.refreshSelection(focus);
  }
  private refreshSelection(focus = false): void {
    if (this.selection) {
      this.selection.replaceChildren(
        ...this.data.items.map((item, index) => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = `Элемент ${index + 1}`;
          return option;
        }),
      );
      this.selection.value = this.activeId;
    }
    if (this.remove) this.remove.disabled = this.data.items.length <= 1;
    if (focus)
      this.grid?.querySelector<HTMLElement>(`[data-grid-id="${CSS.escape(this.activeId)}"] .mkdocs-content`)?.focus();
  }
}
