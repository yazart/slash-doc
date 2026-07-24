import { highlightSource, type CodeLanguage } from '../shared/syntax-highlighter';

export type HighlightedLanguage = CodeLanguage | 'diff';

export class HighlightedCodeEditor {
  readonly root: HTMLDivElement;
  readonly textarea: HTMLTextAreaElement;
  private readonly highlight: HTMLElement;
  private language: HighlightedLanguage;

  constructor(source: string, language: HighlightedLanguage, label: string) {
    this.language = language;
    this.root = document.createElement('div');
    this.root.className = 'slash-highlight-editor';
    this.highlight = document.createElement('pre');
    this.highlight.className = 'slash-highlight-layer';
    this.highlight.setAttribute('aria-hidden', 'true');
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'slash-highlight-input';
    this.textarea.value = source;
    this.textarea.wrap = 'off';
    this.textarea.spellcheck = false;
    this.textarea.setAttribute('aria-label', label);
    this.textarea.addEventListener('input', () => this.renderHighlight());
    this.textarea.addEventListener('scroll', () => this.syncScroll());
    this.textarea.addEventListener('keydown', (event) => this.handleKeydown(event));
    this.root.append(this.highlight, this.textarea);
    this.renderHighlight();
  }

  get value(): string {
    return this.textarea.value;
  }

  setLanguage(language: HighlightedLanguage): void {
    this.language = language;
    this.renderHighlight();
  }

  private renderHighlight(): void {
    const source = this.textarea.value;
    this.highlight.innerHTML = `${highlightSource(source, this.language)}${source.endsWith('\n') ? ' ' : ''}`;
    this.syncScroll();
  }

  private syncScroll(): void {
    this.highlight.scrollTop = this.textarea.scrollTop;
    this.highlight.scrollLeft = this.textarea.scrollLeft;
  }

  private handleKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    this.textarea.setRangeText('  ', start, end, 'end');
    this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
