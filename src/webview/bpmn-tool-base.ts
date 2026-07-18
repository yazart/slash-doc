import type { BpmnData, BpmnToolArgs } from './bpmn-tool-types';

export abstract class BpmnToolBase {
  protected data: BpmnData;
  protected root?: HTMLDivElement;
  protected canvas?: HTMLDivElement;
  protected status?: HTMLDivElement;

  constructor({ data }: BpmnToolArgs) {
    this.data = {
      xml: typeof data?.xml === 'string' ? data.xml : '',
      svg: typeof data?.svg === 'string' ? data.svg : '',
      fileName: typeof data?.fileName === 'string' ? data.fileName : undefined,
    };
  }

  protected createRoot(className: string, titleText: string): HTMLDivElement {
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
    this.root = root;
    return root;
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
