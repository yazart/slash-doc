import { CODE_LANGUAGES, normalizeCodeLanguage, type CodeLanguage } from '../shared/syntax-highlighter';
import { HighlightedCodeEditor } from './highlighted-code-editor';
import { LUCIDE_ICONS } from './lucide-icons';
import styles from './code-block-tool.shadow.css?raw';
import { createToolSurface } from './tool-surface';

export type CodeBlockData = {
  language: CodeLanguage;
  code: string;
};

type ToolArgs = { data?: Partial<CodeBlockData> };

export default class CodeBlockTool {
  private language: CodeLanguage;
  private readonly source: string;
  private editor?: HighlightedCodeEditor;

  static get toolbox() {
    return {
      title: 'Код',
      icon: LUCIDE_ICONS.code,
    };
  }

  constructor({ data }: ToolArgs) {
    this.language = normalizeCodeLanguage(data?.language);
    this.source = typeof data?.code === 'string' ? data.code : '';
  }

  render(): HTMLElement {
    const surface = createToolSurface(styles, 'slash-code-surface');
    const root = document.createElement('div');
    root.className = 'slash-code-tool';
    const toolbar = document.createElement('div');
    toolbar.className = 'slash-code-toolbar';
    const title = document.createElement('span');
    title.className = 'slash-code-title';
    title.textContent = 'Код';
    const language = document.createElement('select');
    language.className = 'slash-code-language';
    language.setAttribute('aria-label', 'Язык программирования');
    for (const item of CODE_LANGUAGES) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      option.selected = item.id === this.language;
      language.append(option);
    }
    this.editor = new HighlightedCodeEditor(this.source, this.language, 'Исходный код');
    language.addEventListener('change', () => {
      this.language = normalizeCodeLanguage(language.value);
      this.editor?.setLanguage(this.language);
      language.dispatchEvent(new Event('input', { bubbles: true }));
    });
    toolbar.append(title, language);
    root.append(toolbar, this.editor.root);
    surface.content.append(root);
    return surface;
  }

  save(): CodeBlockData {
    return {
      language: this.language,
      code: this.editor?.value ?? this.source,
    };
  }
}
