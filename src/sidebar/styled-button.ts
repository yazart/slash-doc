import buttonStyles from './styled-button.shadow.css?raw';
export class SlashButtonElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['aria-label', 'disabled', 'type'];
  }

  private readonly button: HTMLButtonElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = buttonStyles;
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
