import { createMkDocsContent } from './mkdocs-content';
import { LUCIDE_ICONS } from './lucide-icons';
import type { MkDocsDetailsData } from './mkdocs-widget-types';
import styles from './mkdocs-widgets.shadow.css?raw';
import { createToolSurface } from './tool-surface';

type ToolArgs = { data?: Partial<MkDocsDetailsData> };

export default class MkDocsDetailsTool {
  private headerControls?: HTMLElement;
  private summary: string;
  private content: string;
  private open: boolean;

  static get toolbox() {
    return { title: 'Раскрываемый блок', icon: LUCIDE_ICONS.chevronsUpDown };
  }

  constructor({ data }: ToolArgs) {
    this.summary = typeof data?.summary === 'string' ? data.summary : 'Подробнее';
    this.content = typeof data?.content === 'string' ? data.content : '';
    this.open = data?.open === true;
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'mkdocs-widget-surface');
    const root = document.createElement('section');
    root.className = 'mkdocs-widget';
    const header = document.createElement('span');
    header.className = 'mkdocs-header-controls';
    this.headerControls = header;
    const row = document.createElement('div');
    row.className = 'mkdocs-widget-row';
    const summary = document.createElement('input');
    summary.type = 'text';
    summary.value = this.summary;
    summary.placeholder = 'Заголовок';
    summary.addEventListener('input', () => (this.summary = summary.value));
    const openLabel = document.createElement('label');
    openLabel.className = 'mkdocs-widget-check';
    const open = document.createElement('input');
    open.type = 'checkbox';
    open.checked = this.open;
    open.addEventListener('change', () => (this.open = open.checked));
    openLabel.append(open, document.createTextNode('Открыт по умолчанию'));
    row.append(summary, openLabel);
    const content = createMkDocsContent(
      this.content,
      'Содержимое раскрываемого блока',
      (html) => (this.content = html),
    );
    header.append(row);
    root.append(content);
    surface.content.append(root);
    return surface;
  }

  renderHeaderControls(): HTMLElement {
    return this.headerControls ?? document.createElement('span');
  }

  save(): MkDocsDetailsData {
    return { summary: this.summary.trim(), content: this.content, open: this.open };
  }
}
