import { LUCIDE_ICONS } from './lucide-icons';
import styles from './mkdocs-widgets.shadow.css?raw';
import { MKDOCS_ADMONITION_KINDS, type MkDocsAdmonitionData, type MkDocsAdmonitionKind } from './mkdocs-widget-types';
import { createToolSurface } from './tool-surface';

type ToolArgs = { data?: Partial<MkDocsAdmonitionData> };

export default class MkDocsAdmonitionTool {
  private kind: MkDocsAdmonitionKind;
  private title: string;
  private content: string;
  private collapsible: boolean;
  private open: boolean;

  static get toolbox() {
    return { title: 'Примечание MkDocs', icon: LUCIDE_ICONS.messageSquareWarning };
  }

  constructor({ data }: ToolArgs) {
    this.kind = MKDOCS_ADMONITION_KINDS.includes(data?.kind as MkDocsAdmonitionKind)
      ? (data?.kind as MkDocsAdmonitionKind)
      : 'note';
    this.title = typeof data?.title === 'string' ? data.title : 'Примечание';
    this.content = typeof data?.content === 'string' ? data.content : '';
    this.collapsible = data?.collapsible === true;
    this.open = data?.open !== false;
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'mkdocs-widget-surface');
    const root = document.createElement('section');
    root.className = 'mkdocs-widget';
    const header = document.createElement('header');
    header.className = 'mkdocs-widget-header';
    header.textContent = 'Примечание MkDocs';
    const row = document.createElement('div');
    row.className = 'mkdocs-widget-row';
    const kind = document.createElement('select');
    kind.setAttribute('aria-label', 'Тип примечания');
    for (const value of MKDOCS_ADMONITION_KINDS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = value === this.kind;
      kind.append(option);
    }
    kind.addEventListener('change', () => {
      this.kind = kind.value as MkDocsAdmonitionKind;
    });
    const title = document.createElement('input');
    title.type = 'text';
    title.value = this.title;
    title.placeholder = 'Заголовок';
    title.addEventListener('input', () => (this.title = title.value));
    const collapsible = this.createCheck('Сворачиваемое', this.collapsible, (checked) => {
      this.collapsible = checked;
      open.hidden = !checked;
    });
    const open = this.createCheck('Открыто', this.open, (checked) => (this.open = checked));
    open.hidden = !this.collapsible;
    row.append(kind, title, collapsible, open);
    const content = document.createElement('textarea');
    content.value = this.content;
    content.placeholder = 'Описание в Markdown…';
    content.setAttribute('aria-label', 'Текст примечания в Markdown');
    content.addEventListener('input', () => (this.content = content.value));
    root.append(header, row, content);
    surface.content.append(root);
    return surface;
  }

  save(): MkDocsAdmonitionData {
    return {
      kind: this.kind,
      title: this.title.trim(),
      content: this.content,
      collapsible: this.collapsible,
      open: this.open,
    };
  }

  private createCheck(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'mkdocs-widget-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrapper.append(input, document.createTextNode(label));
    return wrapper;
  }
}
