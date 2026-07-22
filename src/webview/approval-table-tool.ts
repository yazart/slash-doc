import type { SlashDocUser } from '../shared/users';
import { createUserOption } from './user-directory';
import { LUCIDE_ICONS } from './lucide-icons';

type ApprovalRow = {
  id: string;
  stage: string;
  responsibles: SlashDocUser[];
  result: string;
};

type ApprovalTableData = {
  rows: ApprovalRow[];
};

export default class ApprovalTableTool {
  private readonly data: ApprovalTableData;
  private root?: HTMLElement;
  private readonly userMenuCleanups: Array<() => void> = [];

  static get toolbox() {
    return {
      title: 'Таблица согласования',
      icon: LUCIDE_ICONS.clipboardCheck,
    };
  }

  constructor({ data }: { data?: Partial<ApprovalTableData> }) {
    this.data = { rows: normalizeRows(data?.rows) };
  }

  render(): HTMLElement {
    this.root = document.createElement('div');
    this.root.className = 'slash-approval-table-tool';
    this.root.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' || event.key === 'Delete') event.stopPropagation();
    });
    this.renderTable();
    return this.root;
  }

  save(): ApprovalTableData {
    return {
      rows: this.data.rows.map((row) => ({ ...row, responsibles: row.responsibles.map((user) => ({ ...user })) })),
    };
  }

  destroy(): void {
    this.clearUserMenus();
  }

  private renderTable(): void {
    if (!this.root) return;
    this.clearUserMenus();
    this.root.replaceChildren();
    const table = document.createElement('table');
    table.className = 'slash-approval-table';
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th>Этап</th><th>Ответственные</th><th>Результат</th><th aria-label="Действия"></th></tr>';
    const body = document.createElement('tbody');
    this.data.rows.forEach((row) => body.append(this.renderRow(row)));
    table.append(head, body);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'slash-approval-add-row';
    add.textContent = '+ Добавить строку';
    add.addEventListener('click', () => {
      this.data.rows.push(createRow());
      this.renderTable();
      this.notifyChange();
    });
    this.root.append(table, add);
  }

  private renderRow(row: ApprovalRow): HTMLTableRowElement {
    const tr = document.createElement('tr');
    const stageCell = document.createElement('td');
    const stage = document.createElement('textarea');
    stage.rows = 1;
    stage.placeholder = 'Название этапа';
    stage.value = row.stage;
    stage.addEventListener('input', () => {
      row.stage = stage.value;
      this.notifyChange();
    });
    stageCell.append(stage);

    const responsibleCell = document.createElement('td');
    responsibleCell.append(this.renderResponsibles(row));

    const resultCell = document.createElement('td');
    const result = document.createElement('textarea');
    result.rows = 1;
    result.placeholder = 'Результат согласования';
    result.value = row.result;
    result.addEventListener('input', () => {
      row.result = result.value;
      this.notifyChange();
    });
    resultCell.append(result);

    const actions = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'slash-approval-remove-row';
    remove.title = 'Удалить строку';
    remove.setAttribute('aria-label', 'Удалить строку');
    remove.textContent = '×';
    remove.disabled = this.data.rows.length === 1;
    remove.addEventListener('click', () => {
      if (this.data.rows.length === 1) return;
      this.data.rows.splice(this.data.rows.indexOf(row), 1);
      this.renderTable();
      this.notifyChange();
    });
    actions.append(remove);
    tr.append(stageCell, responsibleCell, resultCell, actions);
    return tr;
  }

  private renderResponsibles(row: ApprovalRow): HTMLElement {
    const field = document.createElement('div');
    field.className = 'slash-approval-users';
    const chips = document.createElement('div');
    chips.className = 'slash-approval-chips';
    const renderChips = () => {
      chips.replaceChildren();
      row.responsibles.forEach((user) => {
        const chip = document.createElement('span');
        chip.className = 'slash-approval-user-chip';
        const image = document.createElement('img');
        image.src = user.photo;
        image.alt = '';
        const label = document.createElement('span');
        label.textContent = user.fullName;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.title = `Убрать ${user.fullName}`;
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          row.responsibles = row.responsibles.filter((item) => item.id !== user.id);
          renderChips();
          this.notifyChange();
        });
        chip.append(image, label, remove);
        chips.append(chip);
      });
    };
    renderChips();

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Введите имя или email';
    const menu = document.createElement('div');
    menu.className = 'slash-approval-user-menu';
    menu.hidden = true;
    document.body.append(menu);
    const positionMenu = () => {
      if (menu.hidden || !field.isConnected) return;
      const rect = search.getBoundingClientRect();
      const gap = 4;
      const viewportPadding = 8;
      const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
      const spaceAbove = rect.top - gap - viewportPadding;
      const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(80, Math.min(210, openAbove ? spaceAbove : spaceBelow));
      const width = Math.min(Math.max(rect.width, 260), window.innerWidth - viewportPadding * 2);
      const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
      menu.style.left = `${left}px`;
      menu.style.width = `${width}px`;
      menu.style.maxHeight = `${availableHeight}px`;
      menu.style.top = openAbove ? 'auto' : `${rect.bottom + gap}px`;
      menu.style.bottom = openAbove ? `${window.innerHeight - rect.top + gap}px` : 'auto';
    };
    const handleViewportChange = () => positionMenu();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    this.userMenuCleanups.push(() => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
      menu.remove();
    });
    let sequence = 0;
    const runSearch = async () => {
      const current = ++sequence;
      const users = (await window.__SLASH_DOC_USER_DIRECTORY__?.search(search.value)) ?? [];
      if (current !== sequence || !field.isConnected) return;
      menu.replaceChildren();
      for (const user of users.filter((item) => !row.responsibles.some((selected) => selected.id === item.id))) {
        const option = createUserOption(user);
        option.addEventListener('pointerdown', (event) => event.preventDefault());
        option.addEventListener('click', () => {
          row.responsibles.push(user);
          search.value = '';
          menu.hidden = true;
          renderChips();
          this.notifyChange();
        });
        menu.append(option);
      }
      menu.hidden = menu.childElementCount === 0;
      positionMenu();
    };
    search.addEventListener('focus', () => void runSearch());
    search.addEventListener('input', () => void runSearch());
    search.addEventListener('blur', () => setTimeout(() => (menu.hidden = true), 120));
    field.append(chips, search);
    return field;
  }

  private clearUserMenus(): void {
    this.userMenuCleanups.splice(0).forEach((cleanup) => cleanup());
  }

  private notifyChange(): void {
    this.root?.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function normalizeRows(value: unknown): ApprovalRow[] {
  if (!Array.isArray(value) || value.length === 0) return [createRow()];
  return value.map((item) => {
    const source = isRecord(item) ? item : {};
    return {
      id: typeof source.id === 'string' ? source.id : createId(),
      stage: typeof source.stage === 'string' ? source.stage : '',
      responsibles: Array.isArray(source.responsibles)
        ? source.responsibles.filter(isUser).map((user) => ({ ...user }))
        : [],
      result: typeof source.result === 'string' ? source.result : '',
    };
  });
}

function createRow(): ApprovalRow {
  return { id: createId(), stage: '', responsibles: [], result: '' };
}

function createId(): string {
  return `approval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUser(value: unknown): value is SlashDocUser {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.email === 'string' &&
    typeof value.photo === 'string' &&
    typeof value.link === 'string'
  );
}
