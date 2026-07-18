import mermaid from 'mermaid';
import { LUCIDE_ICONS } from './lucide-icons';

type MermaidToolData = {
  code?: string;
  caption?: string;
};

export default class MermaidTool {
  private readonly data: MermaidToolData;
  private wrapper?: HTMLDivElement;
  private textarea?: HTMLTextAreaElement;
  private caption?: HTMLInputElement;
  private preview?: HTMLDivElement;
  private renderTimer?: ReturnType<typeof setTimeout>;

  static get toolbox() {
    return { title: 'Диаграмма Mermaid', icon: LUCIDE_ICONS.chart };
  }

  constructor({ data }: { data?: MermaidToolData }) {
    this.data = {
      code: data?.code ?? 'flowchart TD\n  A[Начало] --> B[Диаграмма Mermaid]',
      caption: data?.caption ?? '',
    };
  }

  render(): HTMLElement {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'slash-mermaid-tool';
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'slash-mermaid-code';
    this.textarea.spellcheck = false;
    this.textarea.value = this.data.code ?? '';
    this.caption = document.createElement('input');
    this.caption.className = 'slash-mermaid-caption';
    this.caption.placeholder = 'Подпись';
    this.caption.value = this.data.caption ?? '';
    this.preview = document.createElement('div');
    this.preview.className = 'slash-mermaid-preview';
    this.textarea.addEventListener('input', () => this.scheduleRender());
    this.caption.addEventListener('input', () => this.scheduleRender());
    this.wrapper.append(this.textarea, this.caption, this.preview);
    this.scheduleRender();
    return this.wrapper;
  }

  save(): MermaidToolData {
    return { code: this.textarea?.value ?? '', caption: this.caption?.value ?? '' };
  }

  private scheduleRender(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => void this.renderPreview(), 150);
  }

  private async renderPreview(): Promise<void> {
    if (!this.preview) return;
    const code = this.textarea?.value.trim() ?? '';
    if (!code) {
      this.preview.textContent = '';
      return;
    }
    try {
      const id = `slash-mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      this.preview.innerHTML = await renderMermaid(id, code);
    } catch (error) {
      this.preview.textContent = error instanceof Error ? error.message : 'Ошибка отрисовки Mermaid';
    }
  }
}

function renderMermaid(id: string, code: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      mermaid.render(id, code, resolve);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
