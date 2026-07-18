const TOOLTIP_STYLES = `
  :host { position: relative; display: inline-flex; min-width: 0; }
  [part="body"] {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 6px);
    z-index: 100;
    width: max-content;
    max-width: 220px;
    padding: 4px 7px;
    color: var(--vscode-editorHoverWidget-foreground, var(--vscode-foreground));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-panel-border));
    border-radius: 3px;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editorWidget-background));
    box-shadow: 0 3px 10px color-mix(in srgb, #000 28%, transparent);
    font-size: 11px;
    line-height: 1.3;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 2px);
    transition: opacity 100ms ease, transform 100ms ease;
  }
  :host(:hover) [part="body"], :host(:focus-within) [part="body"] { opacity: 1; transform: translate(-50%, 0); }
`;

export class SlashTooltipElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['content'];
  }

  private readonly body: HTMLSpanElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = TOOLTIP_STYLES;
    const slot = document.createElement('slot');
    this.body = document.createElement('span');
    this.body.part.add('body');
    this.body.setAttribute('role', 'tooltip');
    root.append(style, slot, this.body);
  }

  connectedCallback(): void {
    this.syncContent();
  }

  attributeChangedCallback(): void {
    this.syncContent();
  }

  private syncContent(): void {
    this.body.textContent = this.getAttribute('content') ?? '';
  }
}

if (!customElements.get('slash-tooltip')) customElements.define('slash-tooltip', SlashTooltipElement);
