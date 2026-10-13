import { sanitizeTableCellHtml } from '../shared/table-cell-html';
import type { BlockToolConstructorOptions } from './block-editor-types';
import { LUCIDE_ICONS } from './lucide-icons';
import { textHeadingLevel } from '../shared/text-block';

export type ParagraphData = { text: string; level?: number };

export default class PersistentParagraphTool {
  private readonly readOnly: boolean;
  private readonly text: string;
  private element?: HTMLElement;
  private level: number;
  private readonly allowHeadings: boolean;
  private readonly block: BlockToolConstructorOptions['block'];
  private readonly api: BlockToolConstructorOptions['api'];

  static get toolbox() {
    return { title: 'Текст', icon: LUCIDE_ICONS.pilcrow };
  }

  static get isReadOnlySupported(): boolean {
    return true;
  }

  static get conversionConfig() {
    return {
      export: (data: ParagraphData) => data.text,
      import: (text: string) => ({ text }),
    };
  }

  static get sanitize() {
    return {
      text: {
        a: { href: true, class: true, target: true, rel: true, 'data-page-id': true },
        b: true,
        br: true,
        code: true,
        em: true,
        i: true,
        mark: true,
        span: { class: true, style: true, 'data-slash-text-color': true, 'data-slash-text-background': true },
        strong: true,
        u: true,
      },
    };
  }

  constructor({ data, readOnly, config, block, api }: BlockToolConstructorOptions<ParagraphData>) {
    this.text = typeof data?.text === 'string' ? data.text : '';
    this.readOnly = readOnly;
    this.level = textHeadingLevel({ type: 'paragraph', data });
    this.allowHeadings = config?.allowHeadings !== false;
    this.block = block;
    this.api = api;
  }

  render(): HTMLElement {
    this.element = document.createElement(this.level ? `h${this.level}` : 'div');
    this.element.className = this.level ? 'ce-header cdx-block' : 'ce-paragraph cdx-block';
    this.element.contentEditable = String(!this.readOnly);
    this.element.dataset.placeholder = 'Введите текст';
    this.element.innerHTML = sanitizeTableCellHtml(this.text);
    return this.element;
  }

  save(block: HTMLElement): ParagraphData {
    return { text: normalizeParagraphText(block.innerHTML), ...(this.level ? { level: this.level } : {}) };
  }

  renderHeaderControls(): HTMLElement {
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Стиль текста');
    for (let level = 0; level <= 6; level++) {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = level ? `Заголовок ${level}` : 'Абзац';
      option.selected = this.level === level;
      option.disabled = level > 0 && !this.allowHeadings && level !== this.level;
      select.append(option);
    }
    select.addEventListener('change', () => {
      if (!this.element || this.readOnly) return;
      const text = this.element.innerHTML;
      const previous = this.element;
      this.level = Number(select.value);
      const replacement = this.render();
      replacement.innerHTML = text;
      previous.replaceWith(replacement);
      this.api.caret.setToBlock(this.block.id, 'end');
      this.block.dispatchChange();
    });
    return select;
  }

  validate(): boolean {
    return true;
  }

  merge(data: ParagraphData): void {
    if (!this.element) return;
    this.element.innerHTML += typeof data.text === 'string' ? data.text : '';
  }
}

export function normalizeParagraphText(value: string): string {
  const visibleText = value
    .replaceAll(/<br\s*\/?>/gi, '')
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replaceAll(/[\s\u200B-\u200D\uFEFF]/g, '');
  return visibleText ? value : '';
}
