import mermaid from 'mermaid';
import { LUCIDE_ICONS } from './lucide-icons';
import styles from './mermaid-tool.shadow.css?raw';
import { createToolSurface } from './tool-surface';

type MermaidToolData = {
  code?: string;
  caption?: string;
  svg?: string;
};

const mermaidTools = new Set<MermaidTool>();

export default class MermaidTool {
  private readonly data: MermaidToolData;
  private wrapper?: HTMLDivElement;
  private textarea?: HTMLTextAreaElement;
  private caption?: HTMLInputElement;
  private preview?: HTMLDivElement;
  private renderTimer?: ReturnType<typeof setTimeout>;
  private renderedCode = '';
  private renderedSvg = '';

  static get toolbox() {
    return { title: 'Диаграмма Mermaid', icon: LUCIDE_ICONS.chart };
  }

  constructor({ data }: { data?: MermaidToolData }) {
    this.data = {
      code: data?.code ?? 'flowchart TD\n  A[Начало] --> B[Диаграмма Mermaid]',
      caption: data?.caption ?? '',
      svg: data?.svg ?? '',
    };
    this.renderedCode = this.data.svg ? (this.data.code ?? '') : '';
    this.renderedSvg = this.data.svg ?? '';
    mermaidTools.add(this);
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'slash-mermaid-surface');
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
    if (this.renderedSvg) this.preview.innerHTML = this.renderedSvg;
    this.textarea.addEventListener('input', () => this.scheduleRender());
    this.caption.addEventListener('input', () => this.scheduleRender());
    this.wrapper.append(this.textarea, this.caption, this.preview);
    this.scheduleRender();
    surface.content.append(this.wrapper);
    return surface;
  }

  save(): MermaidToolData {
    return {
      code: this.textarea?.value ?? '',
      caption: this.caption?.value ?? '',
      svg: this.renderedSvg,
    };
  }

  destroy(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    mermaidTools.delete(this);
  }

  async renderForSave(): Promise<void> {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = undefined;
    }
    const code = this.textarea?.value.trim() ?? '';
    if (code !== this.renderedCode || (!this.renderedSvg && code)) {
      await this.renderPreview();
    }
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
      this.renderedCode = '';
      this.renderedSvg = '';
      return;
    }
    try {
      const id = `slash-mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      this.renderedSvg = await renderMermaid(id, code);
      this.renderedCode = code;
      this.preview.innerHTML = this.renderedSvg;
    } catch (error) {
      this.renderedCode = code;
      this.renderedSvg = '';
      this.preview.textContent = error instanceof Error ? error.message : 'Ошибка отрисовки Mermaid';
    }
  }
}

export async function renderPendingMermaidDiagrams(): Promise<void> {
  await Promise.all([...mermaidTools].map((tool) => tool.renderForSave()));
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
