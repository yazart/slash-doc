const BUTTON_STYLES = `
  :host { display: inline-flex; min-width: 0; vertical-align: middle; }
  button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 0;
    min-height: 24px;
    padding: 4px 10px;
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border: 1px solid var(--vscode-button-border, var(--vscode-input-border, transparent));
    border-radius: 2px;
    background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
    font: inherit;
    line-height: normal;
    cursor: pointer;
  }
  :host([variant="primary"]) button {
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-border, transparent);
    background: var(--vscode-button-background);
  }
  button:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground)); }
  :host([variant="primary"]) button:hover { background: var(--vscode-button-hoverBackground); }
  button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  button:disabled { opacity: .55; cursor: default; }
  [part="label"] { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

export class SlashButtonElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['aria-label', 'disabled', 'type'];
  }

  private readonly button: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = BUTTON_STYLES;
    this.button = document.createElement('button');
    this.button.part.add('base');
    const label = document.createElement('span');
    label.part.add('label');
    label.append(document.createElement('slot'));
    this.button.append(label);
    root.append(style, this.button);
  }

  connectedCallback(): void {
    this.syncAttributes();
  }

  attributeChangedCallback(): void {
    this.syncAttributes();
  }

  focus(options?: FocusOptions): void {
    this.button.focus(options);
  }

  private syncAttributes(): void {
    this.button.type = this.getAttribute('type') === 'submit' ? 'submit' : 'button';
    this.button.disabled = this.hasAttribute('disabled');
    const label = this.getAttribute('aria-label');
    if (label) this.button.setAttribute('aria-label', label);
    else this.button.removeAttribute('aria-label');
  }
}

if (!customElements.get('slash-button')) customElements.define('slash-button', SlashButtonElement);
