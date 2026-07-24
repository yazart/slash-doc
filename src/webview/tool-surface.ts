import surfaceStyles from './tool-surface.shadow.css?raw';

export class ToolSurfaceElement extends HTMLElement {
  readonly content: HTMLDivElement;
  private readonly styleElement: HTMLStyleElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    this.styleElement = document.createElement('style');
    this.content = document.createElement('div');
    this.content.className = 'tool-content';
    shadow.append(this.styleElement, this.content);
    shadow.addEventListener('input', (event) => {
      if (event.composed) return;
      this.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    });
  }

  configure(styles: string, className: string, includeDocumentStyles = false): void {
    this.content.className = `tool-content ${className}`.trim();
    this.styleElement.textContent = `${surfaceStyles}\n${styles}`;
    if (includeDocumentStyles) this.attachDocumentStylesheet();
  }

  private attachDocumentStylesheet(): void {
    const href = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"][href*="webview.css"]')?.href;
    if (!href || !this.shadowRoot || this.shadowRoot.querySelector(`link[href="${CSS.escape(href)}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    this.shadowRoot.prepend(link);
  }
}

if (!customElements.get('slash-tool-surface')) {
  customElements.define('slash-tool-surface', ToolSurfaceElement);
}

export function createToolSurface(
  styles: string,
  className: string,
  includeDocumentStyles = false,
): ToolSurfaceElement {
  const surface = document.createElement('slash-tool-surface') as ToolSurfaceElement;
  surface.configure(styles, className, includeDocumentStyles);
  return surface;
}
