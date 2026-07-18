const SWITCH_STYLES = `
  :host { display: inline-flex; align-items: center; vertical-align: middle; }
  button { display: inline-flex; align-items: center; gap: 7px; padding: 0; border: 0; background: none; font: inherit; cursor: pointer; }
  [part="control"] {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    width: 28px;
    height: 16px;
    padding: 2px;
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 999px;
    background: var(--vscode-input-background);
    transition: background-color 100ms ease;
  }
  [part="control"]::after {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vscode-foreground);
    content: '';
    transition: transform 100ms ease;
  }
  :host([checked]) [part="control"] { border-color: var(--vscode-button-background); background: var(--vscode-button-background); }
  :host([checked]) [part="control"]::after { background: var(--vscode-button-foreground); transform: translateX(12px); }
  button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
  button:disabled { opacity: .55; cursor: default; }
`;

export class SlashSwitchElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['checked', 'disabled', 'aria-label'];
  }

  private readonly button: HTMLButtonElement;

  get checked(): boolean {
    return this.hasAttribute('checked');
  }

  set checked(value: boolean) {
    this.toggleAttribute('checked', value);
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SWITCH_STYLES;
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.part.add('base');
    const control = document.createElement('span');
    control.part.add('control');
    const label = document.createElement('span');
    label.part.add('label');
    label.append(document.createElement('slot'));
    this.button.append(control, label);
    this.button.addEventListener('click', () => {
      if (this.hasAttribute('disabled')) return;
      this.checked = !this.checked;
      this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    });
    root.append(style, this.button);
  }

  connectedCallback(): void {
    this.syncAttributes();
  }

  attributeChangedCallback(): void {
    this.syncAttributes();
  }

  private syncAttributes(): void {
    this.button.disabled = this.hasAttribute('disabled');
    this.button.setAttribute('role', 'switch');
    this.button.setAttribute('aria-checked', String(this.checked));
    const label = this.getAttribute('aria-label');
    if (label) this.button.setAttribute('aria-label', label);
    else this.button.removeAttribute('aria-label');
  }
}

if (!customElements.get('slash-switch')) customElements.define('slash-switch', SlashSwitchElement);
