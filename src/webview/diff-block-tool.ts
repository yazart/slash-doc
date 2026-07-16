import { HighlightedCodeEditor } from './highlighted-code-editor';

export type DiffBlockData = {
  diff: string;
};

type ToolArgs = { data?: Partial<DiffBlockData> };

export default class DiffBlockTool {
  private readonly source: string;
  private editor?: HighlightedCodeEditor;

  static get toolbox() {
    return {
      title: 'Diff',
      icon: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5h6M6 2v6M11 12h4M3 14.5h5M11 5h4M3 10.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    };
  }

  constructor({ data }: ToolArgs) {
    this.source = typeof data?.diff === 'string' ? data.diff : '';
  }

  render(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'slash-code-tool slash-diff-tool';
    const toolbar = document.createElement('div');
    toolbar.className = 'slash-code-toolbar';
    const title = document.createElement('span');
    title.className = 'slash-code-title';
    title.textContent = 'Diff';
    toolbar.append(title);
    this.editor = new HighlightedCodeEditor(this.source, 'diff', 'Изменения в формате diff');
    root.append(toolbar, this.editor.root);
    return root;
  }

  save(): DiffBlockData {
    return { diff: this.editor?.value ?? this.source };
  }
}
