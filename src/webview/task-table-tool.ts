import { LUCIDE_ICONS } from './lucide-icons';
import styles from './task-table-tool.shadow.css?raw';
import { createToolSurface } from './tool-surface';
import { TASK_TABLE_TEMPLATE } from './task-table-template';

export type TaskCard = {
  id: string;
  title: string;
  description: string;
};

export type TaskColumn = {
  id: string;
  title: string;
  cards: TaskCard[];
};

export type TaskTableData = {
  title: string;
  columns: TaskColumn[];
};

type ToolArgs = { data?: Partial<TaskTableData> };

export default class TaskTableTool {
  private data: TaskTableData;
  private wrapper?: HTMLDivElement;
  private dragged?: { cardId: string; columnId: string };
  private draggedColumnId?: string;

  static get toolbox() {
    return {
      title: 'Доска задач',
      icon: LUCIDE_ICONS.kanban,
    };
  }

  constructor({ data }: ToolArgs) {
    this.data = normalizeTaskTable(data);
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'slash-task-table-surface');
    const wrapper = document.createElement('div');
    wrapper.className = 'slash-task-table-tool';
    wrapper.innerHTML = TASK_TABLE_TEMPLATE;
    this.wrapper = wrapper;
    const title = wrapper.querySelector<HTMLInputElement>('.tt-board-title');
    if (title) {
      title.value = this.data.title;
      title.addEventListener('input', () => {
        this.data.title = title.value;
        this.changed();
      });
    }
    wrapper.querySelector('.tt-add-column')?.addEventListener('click', () => this.addColumn());
    wrapper.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        event.stopPropagation();
      }
    });
    this.renderColumns();
    surface.content.append(wrapper);
    return surface;
  }

  save(): TaskTableData {
    return structuredClone(this.data);
  }

  private renderColumns(): void {
    const board = this.wrapper?.querySelector<HTMLElement>('.tt-board');
    if (!board) return;
    board.replaceChildren();
    for (const column of this.data.columns) {
      board.append(this.createColumn(column));
    }
  }

  private createColumn(column: TaskColumn): HTMLElement {
    const element = document.createElement('div');
    element.className = 'tt-column';
    element.dataset.columnId = column.id;
    const head = document.createElement('div');
    head.className = 'tt-column-head';
    const dragHandle = this.dragHandle('Перетащить колонку');
    dragHandle.addEventListener('dragstart', (event) => {
      this.draggedColumnId = column.id;
      element.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', column.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    dragHandle.addEventListener('dragend', () => {
      element.classList.remove('dragging');
      this.wrapper?.querySelectorAll('.drag-over').forEach((item) => item.classList.remove('drag-over'));
      this.draggedColumnId = undefined;
    });
    const title = document.createElement('input');
    title.className = 'tt-column-title';
    title.value = column.title;
    title.setAttribute('aria-label', 'Название колонки');
    title.addEventListener('input', () => {
      column.title = title.value;
      this.changed();
    });
    const remove = this.deleteButton('Удалить колонку', () => {
      if (column.cards.length > 0 && !window.confirm('Удалить колонку вместе с карточками?')) return;
      this.data.columns = this.data.columns.filter((item) => item.id !== column.id);
      this.changed();
      this.renderColumns();
    });
    head.append(dragHandle, title, remove);
    const cards = document.createElement('div');
    cards.className = 'tt-cards';
    if (column.cards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tt-empty';
      empty.textContent = 'Перетащите карточку сюда';
      cards.append(empty);
    } else {
      for (const card of column.cards) cards.append(this.createCard(column, card));
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tt-add-card';
    add.textContent = '＋ Добавить карточку';
    add.addEventListener('click', () => this.addCard(column.id));
    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      element.classList.add('drag-over');
    });
    element.addEventListener('dragleave', (event) => {
      if (!element.contains(event.relatedTarget as Node | null)) element.classList.remove('drag-over');
    });
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      element.classList.remove('drag-over');
      if (this.draggedColumnId) {
        this.moveDraggedColumn(column.id);
      } else {
        this.moveDraggedCard(column.id);
      }
    });
    element.append(head, cards, add);
    return element;
  }

  private createCard(column: TaskColumn, card: TaskCard): HTMLElement {
    const element = document.createElement('article');
    element.className = 'tt-card';
    element.dataset.cardId = card.id;
    const head = document.createElement('div');
    head.className = 'tt-card-head';
    const dragHandle = this.dragHandle('Перетащить карточку');
    const title = document.createElement('input');
    title.className = 'tt-card-title';
    title.value = card.title;
    title.setAttribute('aria-label', 'Заголовок карточки');
    title.addEventListener('input', () => {
      card.title = title.value;
      this.changed();
    });
    const remove = this.deleteButton('Удалить карточку', () => {
      column.cards = column.cards.filter((item) => item.id !== card.id);
      this.changed();
      this.renderColumns();
    });
    const description = document.createElement('textarea');
    description.className = 'tt-card-description';
    description.placeholder = 'Описание задачи';
    description.value = card.description;
    description.addEventListener('input', () => {
      card.description = description.value;
      this.changed();
    });
    dragHandle.addEventListener('dragstart', (event) => {
      this.dragged = { cardId: card.id, columnId: column.id };
      element.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', card.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    dragHandle.addEventListener('dragend', () => {
      element.classList.remove('dragging');
      this.wrapper?.querySelectorAll('.drag-over').forEach((item) => item.classList.remove('drag-over'));
      this.dragged = undefined;
    });
    head.append(dragHandle, title, remove);
    element.append(head, description);
    return element;
  }

  private addColumn(): void {
    this.data.columns.push({ id: createId('column'), title: 'Новая колонка', cards: [] });
    this.changed();
    this.renderColumns();
  }

  private addCard(columnId: string): void {
    const column = this.data.columns.find((item) => item.id === columnId);
    if (!column) return;
    column.cards.push({ id: createId('card'), title: 'Новая задача', description: '' });
    this.changed();
    this.renderColumns();
  }

  private moveDraggedCard(targetColumnId: string): void {
    if (!this.dragged) return;
    const source = this.data.columns.find((item) => item.id === this.dragged?.columnId);
    const target = this.data.columns.find((item) => item.id === targetColumnId);
    const card = source?.cards.find((item) => item.id === this.dragged?.cardId);
    if (!source || !target || !card) return;
    source.cards = source.cards.filter((item) => item.id !== card.id);
    target.cards.push(card);
    this.dragged = undefined;
    this.changed();
    this.renderColumns();
  }

  private moveDraggedColumn(targetColumnId: string): void {
    if (!this.draggedColumnId || this.draggedColumnId === targetColumnId) return;
    const sourceIndex = this.data.columns.findIndex((item) => item.id === this.draggedColumnId);
    const targetIndex = this.data.columns.findIndex((item) => item.id === targetColumnId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [column] = this.data.columns.splice(sourceIndex, 1);
    this.data.columns.splice(targetIndex, 0, column);
    this.draggedColumnId = undefined;
    this.changed();
    this.renderColumns();
  }

  private dragHandle(label: string): HTMLButtonElement {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'tt-drag-handle';
    handle.draggable = true;
    handle.title = label;
    handle.setAttribute('aria-label', label);
    handle.textContent = '⠿';
    return handle;
  }

  private deleteButton(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tt-button tt-delete';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.textContent = '×';
    button.addEventListener('click', action);
    return button;
  }

  private changed(): void {
    this.wrapper?.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }
}

function normalizeTaskTable(value: Partial<TaskTableData> | undefined): TaskTableData {
  const columnValues = value?.columns;
  const columns = Array.isArray(columnValues)
    ? columnValues.flatMap((column) => {
        if (!column || typeof column !== 'object') return [];
        return [
          {
            id: typeof column.id === 'string' ? column.id : createId('column'),
            title: typeof column.title === 'string' ? column.title : 'Колонка',
            cards: Array.isArray(column.cards)
              ? column.cards.flatMap((card) =>
                  card && typeof card === 'object'
                    ? [
                        {
                          id: typeof card.id === 'string' ? card.id : createId('card'),
                          title: typeof card.title === 'string' ? card.title : 'Задача',
                          description: typeof card.description === 'string' ? card.description : '',
                        },
                      ]
                    : [],
                )
              : [],
          },
        ];
      })
    : [];
  return {
    title: typeof value?.title === 'string' ? value.title : 'Задачи',
    columns:
      columns.length > 0
        ? columns
        : [
            { id: createId('column'), title: 'К выполнению', cards: [] },
            { id: createId('column'), title: 'В работе', cards: [] },
            { id: createId('column'), title: 'Готово', cards: [] },
          ],
  };
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
