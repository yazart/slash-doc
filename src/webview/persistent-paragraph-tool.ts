import type { BlockToolConstructorOptions } from '@editorjs/editorjs/types/tools';
import { LUCIDE_ICONS } from './lucide-icons';

export type ParagraphData = { text: string };

export default class PersistentParagraphTool {
  private readonly readOnly: boolean;
  private readonly text: string;
  private element?: HTMLDivElement;

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
        span: { class: true, style: true, 'data-slash-text-color': true },
        strong: true,
        u: true,
      },
    };
  }

  constructor({ data, readOnly }: BlockToolConstructorOptions<ParagraphData>) {
    this.text = typeof data?.text === 'string' ? data.text : '';
    this.readOnly = readOnly;
  }

  render(): HTMLElement {
    this.element = document.createElement('div');
    this.element.className = 'ce-paragraph cdx-block';
    this.element.contentEditable = String(!this.readOnly);
    this.element.dataset.placeholder = 'Введите текст';
    this.element.innerHTML = this.text;
    return this.element;
  }

  save(block: HTMLElement): ParagraphData {
    return { text: normalizeParagraphText(block.innerHTML) };
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
