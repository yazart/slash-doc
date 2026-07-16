import { highlightSource, type CodeLanguage } from '../shared/syntax-highlighter';

export type HighlightedLanguage = CodeLanguage | 'diff';

export class HighlightedCodeEditor {
  readonly root: HTMLDivElement;
  readonly textarea: HTMLTextAreaElement;
  private readonly highlight: HTMLElement;
  private language: HighlightedLanguage;

  constructor(source: string, language: HighlightedLanguage, label: string) {
    ensureStyles();
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

function ensureStyles(): void {
  if (document.querySelector('#slash-highlight-editor-styles')) return;
  const style = document.createElement('style');
  style.id = 'slash-highlight-editor-styles';
  style.textContent = `
    .slash-code-tool{box-sizing:border-box;width:100%;overflow:hidden;border:1px solid var(--vscode-panel-border);border-radius:5px;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground)}
    .slash-code-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 9px;border-bottom:1px solid var(--vscode-panel-border);background:var(--vscode-editorWidget-background)}
    .slash-code-title{font-weight:600}.slash-code-language{min-width:150px;padding:4px 7px;color:var(--vscode-dropdown-foreground);border:1px solid var(--vscode-dropdown-border,var(--vscode-panel-border));border-radius:3px;background:var(--vscode-dropdown-background)}
    .slash-highlight-editor{position:relative;display:grid;min-height:220px;overflow:hidden;background:var(--vscode-textCodeBlock-background,var(--vscode-editor-background))}
    .slash-highlight-editor:focus-within{outline:1px solid var(--vscode-focusBorder);outline-offset:-1px}
    .slash-highlight-layer,.slash-highlight-input{grid-area:1/1;box-sizing:border-box;width:100%;min-height:220px;margin:0;padding:12px;border:0;outline:0;font:12px/1.55 var(--vscode-editor-font-family,monospace);tab-size:2;white-space:pre;overflow:auto}
    .slash-highlight-layer{position:absolute;inset:0;pointer-events:none;color:var(--vscode-editor-foreground);background:transparent}
    .slash-highlight-input{position:relative;z-index:1;color:transparent;caret-color:var(--vscode-editor-foreground);background:transparent;resize:vertical;-webkit-text-fill-color:transparent}
    .slash-highlight-input::selection{color:#fff;background:var(--vscode-editor-selectionBackground);-webkit-text-fill-color:#fff}
    .hljs-comment,.hljs-quote{color:var(--vscode-descriptionForeground,#6a9955);font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-section,.hljs-link{color:#c586c0}.hljs-string,.hljs-title,.hljs-name,.hljs-type,.hljs-attribute,.hljs-symbol,.hljs-bullet,.hljs-addition{color:#ce9178}.hljs-number,.hljs-meta,.hljs-built_in,.hljs-builtin-name,.hljs-params{color:#b5cea8}.hljs-variable,.hljs-template-variable,.hljs-selector-id,.hljs-selector-class{color:#9cdcfe}.hljs-regexp,.hljs-deletion{color:#d16969}.hljs-addition{background:color-mix(in srgb,#2ea043 18%,transparent)}.hljs-deletion{background:color-mix(in srgb,#f85149 18%,transparent)}.hljs-strong{font-weight:700}.hljs-emphasis{font-style:italic}
  `;
  document.head.append(style);
}
