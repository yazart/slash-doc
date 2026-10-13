import type { BlockToolConstructorOptions } from './block-editor-types';
import { sanitizeTableCellHtml } from '../shared/table-cell-html';
import { LUCIDE_ICONS } from './lucide-icons';
import { normalizeParagraphText } from './persistent-paragraph-tool';

export default class QuoteTool {
  private readonly text: string;
  private readonly readOnly: boolean;
  static get toolbox() {
    return { title: 'Цитата', icon: LUCIDE_ICONS.quote };
  }
  static get conversionConfig() {
    return { export: 'text', import: 'text' };
  }
  constructor({ data, readOnly }: BlockToolConstructorOptions) {
    this.text = typeof data.text === 'string' ? data.text : '';
    this.readOnly = readOnly;
  }
  render(): HTMLElement {
    const element = document.createElement('blockquote');
    element.className = 'ce-quote';
    element.contentEditable = String(!this.readOnly);
    element.dataset.placeholder = 'Введите цитату';
    element.innerHTML = sanitizeTableCellHtml(this.text);
    return element;
  }
  save(element: HTMLElement) {
    return { text: normalizeParagraphText(element.innerHTML) };
  }
}
