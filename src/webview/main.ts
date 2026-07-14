import EditorJS from '@editorjs/editorjs';
import type { EditorConfig } from '@editorjs/editorjs/types/configs';
import type { OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Table from '@editorjs/table';
import ImageTool from '@editorjs/image';
import Marker from '@editorjs/marker';
import InlineCode from '@editorjs/inline-code';
import Underline from '@editorjs/underline';
import mermaid from 'mermaid';
import FlowDesignerTool from './flow-designer-tool';
import NetworkCanvasTool from './network-canvas-tool';

type VSCodeApi = {
  postMessage(message: unknown): void;
};

declare const acquireVsCodeApi: () => VSCodeApi;
declare global {
  interface Window {
    __SLASH_DOC_INITIAL_DATA__?: unknown;
    __SLASH_DOC_SETTINGS__?: SlashDocSettings;
    __SLASH_DOC_CUSTOM_ADDONS__?: CustomAddonModule[];
  }
}

type SlashDocSettings = {
  editorAddons?: {
    header?: boolean;
    list?: boolean;
    table?: boolean;
    image?: boolean;
    marker?: boolean;
    inlineCode?: boolean;
    underline?: boolean;
    mermaid?: boolean;
    flowDesigner?: boolean;
    networkCanvas?: boolean;
  };
};

type MermaidToolData = {
  code?: string;
  caption?: string;
};

type MermaidToolConstructorArgs = {
  data?: MermaidToolData;
};

type CustomAddonModule = {
  id: string;
  toolName: string;
  uri: string;
};

const vscode = acquireVsCodeApi();
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
let editor: EditorJS;
const settings = window.__SLASH_DOC_SETTINGS__ ?? {};
const tools: NonNullable<EditorConfig['tools']> = {};

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  themeVariables: {
    background: getCssVariable('--vscode-editor-background', '#1e1e1e'),
    primaryColor: getCssVariable('--vscode-editorWidget-background', '#252526'),
    primaryTextColor: getCssVariable('--vscode-editor-foreground', '#cccccc'),
    primaryBorderColor: getCssVariable('--vscode-panel-border', '#3c3c3c'),
    lineColor: getCssVariable('--vscode-descriptionForeground', '#8f8f8f'),
    textColor: getCssVariable('--vscode-editor-foreground', '#cccccc'),
    secondaryColor: getCssVariable('--vscode-list-hoverBackground', '#2a2d2e'),
    tertiaryColor: getCssVariable('--vscode-input-background', '#3c3c3c')
  }
});

if (settings.editorAddons?.header !== false) {
  tools.header = Header;
}

if (settings.editorAddons?.list !== false) {
  tools.list = List;
}

if (settings.editorAddons?.table !== false) {
  tools.table = Table;
}

if (settings.editorAddons?.image !== false) {
  tools.image = {
    class: ImageTool,
    config: {
      uploader: {
        uploadByFile: async (file: File) => ({
          success: 1,
          file: {
            url: await readFileAsDataUrl(file)
          }
        })
      }
    }
  };
}

if (settings.editorAddons?.marker !== false) {
  tools.marker = Marker;
}

if (settings.editorAddons?.inlineCode !== false) {
  tools.inlineCode = InlineCode;
}

if (settings.editorAddons?.underline !== false) {
  tools.underline = Underline;
}

class MermaidTool {
  private readonly data: MermaidToolData;
  private wrapper?: HTMLDivElement;
  private textarea?: HTMLTextAreaElement;
  private caption?: HTMLInputElement;
  private preview?: HTMLDivElement;
  private renderTimer?: ReturnType<typeof setTimeout>;

  static get toolbox() {
    return {
      title: 'Mermaid',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="15" fill="none" viewBox="0 0 17 15"><path stroke="currentColor" stroke-linecap="round" stroke-width="1.6" d="M4 3H13M4 7.5H13M4 12H13"/><path stroke="currentColor" stroke-linecap="round" stroke-width="1.6" d="M1.5 3H1.51M1.5 7.5H1.51M1.5 12H1.51"/></svg>'
    };
  }

  constructor({ data }: MermaidToolConstructorArgs) {
    this.data = {
      code: data?.code ?? 'flowchart TD\n  A[Start] --> B[Mermaid diagram]',
      caption: data?.caption ?? ''
    };
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'slash-mermaid-tool';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'slash-mermaid-code';
    this.textarea.spellcheck = false;
    this.textarea.value = this.data.code ?? '';

    this.caption = document.createElement('input');
    this.caption.className = 'slash-mermaid-caption';
    this.caption.placeholder = 'Caption';
    this.caption.value = this.data.caption ?? '';

    this.preview = document.createElement('div');
    this.preview.className = 'slash-mermaid-preview';

    this.textarea.addEventListener('input', () => this.scheduleRender());
    this.caption.addEventListener('input', () => this.scheduleRender());

    this.wrapper.append(this.textarea, this.caption, this.preview);
    this.scheduleRender();

    return this.wrapper;
  }

  save() {
    return {
      code: this.textarea?.value ?? '',
      caption: this.caption?.value ?? ''
    };
  }

  private scheduleRender() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }

    this.renderTimer = setTimeout(() => {
      void this.renderPreview();
    }, 150);
  }

  private async renderPreview() {
    if (!this.preview) {
      return;
    }

    const code = this.textarea?.value.trim() ?? '';

    if (!code) {
      this.preview.textContent = '';
      return;
    }

    try {
      const id = `slash-mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await mermaid.render(id, code);
      this.preview.innerHTML = result.svg;
    } catch (error) {
      this.preview.textContent = error instanceof Error ? error.message : 'Mermaid render error';
    }
  }
}

if (settings.editorAddons?.mermaid !== false) {
  tools.mermaid = MermaidTool;
}

if (settings.editorAddons?.flowDesigner !== false) {
  tools.flowDesigner = FlowDesignerTool;
}

if (settings.editorAddons?.networkCanvas !== false) {
  tools.networkCanvas = NetworkCanvasTool;
}

function scheduleAutosave() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
  }

  autosaveTimer = setTimeout(() => {
    void savePage('auto');
  }, 300);
}

async function savePage(source: 'auto' | 'manual') {
  const data = await editor.save();
  vscode.postMessage({
    type: 'save',
    source,
    data
  });
}

async function exportPage(format: 'html' | 'md') {
  const data = await editor.save();
  vscode.postMessage({
    type: 'export',
    format,
    data
  });
}

void initEditor();

async function initEditor() {
  await loadCustomTools();

  editor = new EditorJS({
    holder: 'editor',
    autofocus: true,
    placeholder: 'Start writing with Editor.js...',
    inlineToolbar: true,
    tools,
    data: window.__SLASH_DOC_INITIAL_DATA__ as OutputData,
    onChange: scheduleAutosave
  });
}

async function loadCustomTools() {
  await Promise.all((window.__SLASH_DOC_CUSTOM_ADDONS__ ?? []).map(async (addon) => {
    const module = await import(addon.uri);
    const tool = module.default ?? module.tool;

    if (tool) {
      tools[addon.toolName] = tool;
    }
  }));
}

document.querySelector('#export-html')?.addEventListener('click', () => {
  void exportPage('html');
});

document.querySelector('#export-md')?.addEventListener('click', () => {
  void exportPage('md');
});

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function getCssVariable(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
