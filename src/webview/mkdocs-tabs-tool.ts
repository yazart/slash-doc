import { iconButton } from './block-editor-view';
import { createMkDocsContent } from './mkdocs-content';
import { LUCIDE_ICONS } from './lucide-icons';
import styles from './mkdocs-widgets.shadow.css?raw';
import { createMkDocsTab, type MkDocsTab, type MkDocsTabsData } from './mkdocs-widget-types';
import { createToolSurface } from './tool-surface';

type ToolArgs = { data?: Partial<MkDocsTabsData> };

export default class MkDocsTabsTool {
  private headerControls?: HTMLElement;
  private tabs: MkDocsTab[];
  private activeId: string;
  private tabsList?: HTMLDivElement;
  private editor?: HTMLDivElement;
  private controls?: HTMLElement;

  static get toolbox() {
    return { title: 'Вкладки MkDocs', icon: LUCIDE_ICONS.panelsTopLeft };
  }

  constructor({ data }: ToolArgs) {
    const sourceTabs = data?.tabs;
    this.tabs = Array.isArray(sourceTabs)
      ? sourceTabs
          .filter((tab): tab is MkDocsTab => Boolean(tab && typeof tab.title === 'string'))
          .map((tab) => ({ id: tab.id || createMkDocsTab().id, title: tab.title, content: tab.content || '' }))
      : [];
    if (this.tabs.length === 0) this.tabs = [createMkDocsTab('Вкладка 1'), createMkDocsTab('Вкладка 2')];
    this.activeId = this.tabs[0].id;
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'mkdocs-widget-surface');
    const root = document.createElement('section');
    root.className = 'mkdocs-widget';
    const header = document.createElement('span');
    header.className = 'mkdocs-header-controls';
    this.headerControls = header;
    this.controls = document.createElement('div');
    this.controls.className = 'mkdocs-widget-row';
    const add = iconButton('Добавить вкладку', LUCIDE_ICONS.plus);
    add.addEventListener('click', () => {
      const tab = createMkDocsTab(`Вкладка ${this.tabs.length + 1}`);
      this.tabs.push(tab);
      this.activeId = tab.id;
      this.refresh();
      root.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    });
    header.append(add, this.controls);
    this.tabsList = document.createElement('div');
    this.tabsList.className = 'mkdocs-tabs-list';
    this.editor = document.createElement('div');
    this.editor.className = 'mkdocs-tab-editor';
    header.append(this.tabsList);
    root.append(this.editor);
    surface.content.append(root);
    this.refresh();
    return surface;
  }

  renderHeaderControls(): HTMLElement {
    return this.headerControls ?? document.createElement('span');
  }

  save(): MkDocsTabsData {
    return { tabs: this.tabs.map((tab) => ({ ...tab, title: tab.title.trim() || 'Вкладка' })) };
  }

  private refresh(): void {
    if (!this.tabsList || !this.editor) return;
    this.tabsList.replaceChildren();
    for (const tab of this.tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = tab.title || 'Вкладка';
      button.setAttribute('aria-selected', String(tab.id === this.activeId));
      button.addEventListener('click', () => {
        this.activeId = tab.id;
        this.refresh();
      });
      this.tabsList.append(button);
    }
    const tab = this.tabs.find((item) => item.id === this.activeId) ?? this.tabs[0];
    if (!tab) return;
    this.activeId = tab.id;
    this.editor.replaceChildren();
    const title = document.createElement('input');
    title.type = 'text';
    title.value = tab.title;
    title.placeholder = 'Название вкладки';
    title.addEventListener('input', () => {
      tab.title = title.value;
      this.refreshTabLabels();
    });
    const content = createMkDocsContent(tab.content, 'Содержимое вкладки', (html) => (tab.content = html));
    const actions = document.createElement('div');
    actions.className = 'mkdocs-tab-actions';
    const remove = iconButton('Удалить вкладку', LUCIDE_ICONS.trash2);
    remove.classList.add('mkdocs-danger-button');
    remove.disabled = this.tabs.length === 1;
    remove.addEventListener('click', () => {
      const index = this.tabs.indexOf(tab);
      this.tabs.splice(index, 1);
      this.activeId = this.tabs[Math.max(0, index - 1)]?.id ?? this.tabs[0].id;
      this.refresh();
      this.editor?.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    });
    actions.append(remove);
    this.controls?.replaceChildren(title, actions);
    this.editor.append(content);
  }

  private refreshTabLabels(): void {
    if (!this.tabsList) return;
    Array.from(this.tabsList.children).forEach((item, index) => {
      item.textContent = this.tabs[index]?.title || 'Вкладка';
    });
  }
}
