import { HighlightedCodeEditor } from './highlighted-code-editor';
import { LUCIDE_ICONS } from './lucide-icons';

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
      icon: LUCIDE_ICONS.fileDiff,
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
