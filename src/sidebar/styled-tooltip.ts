import tooltipStyles from './styled-tooltip.shadow.css?raw';
export class SlashTooltipElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['content'];
  }

  private readonly body: HTMLSpanElement;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = tooltipStyles;
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
