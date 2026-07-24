import switchStyles from './styled-switch.shadow.css?raw';
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
    style.textContent = switchStyles;
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
