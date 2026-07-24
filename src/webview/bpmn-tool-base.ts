import type { BpmnData, BpmnToolArgs } from './bpmn-tool-types';
import styles from './bpmn-tool.shadow.css?raw';
import { createToolSurface, type ToolSurfaceElement } from './tool-surface';

export abstract class BpmnToolBase {
  protected data: BpmnData;
  protected root?: HTMLDivElement;
  protected canvas?: HTMLDivElement;
  protected status?: HTMLDivElement;
  protected surface?: ToolSurfaceElement;

  constructor({ data }: BpmnToolArgs) {
    this.data = {
      xml: typeof data?.xml === 'string' ? data.xml : '',
      svg: typeof data?.svg === 'string' ? data.svg : '',
      fileName: typeof data?.fileName === 'string' ? data.fileName : undefined,
    };
  }

  protected createRoot(className: string, titleText: string): HTMLDivElement {
    this.surface = createToolSurface(styles, 'slash-bpmn-surface', true);
    const root = document.createElement('div');
    root.className = `slash-bpmn-tool ${className}`;
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' || (event.key === 'Enter' && event.target instanceof HTMLTextAreaElement)) {
        event.stopPropagation();
      }
    });

    const header = document.createElement('div');
    header.className = 'slash-bpmn-header';
    const title = document.createElement('strong');
    title.textContent = titleText;
    this.status = document.createElement('div');
    this.status.className = 'slash-bpmn-status';
    header.append(title, this.status);

    this.canvas = document.createElement('div');
    this.canvas.className = 'slash-bpmn-canvas';
    root.append(header, this.canvas);
    this.surface.content.append(root);
    this.root = root;
    return root;
  }

  protected renderedSurface(fallback: HTMLElement): HTMLElement {
    return this.surface ?? fallback;
  }

  protected setStatus(message = '', error = false): void {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.classList.toggle('slash-bpmn-status-error', error);
  }

  protected changed(): void {
    this.root?.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
