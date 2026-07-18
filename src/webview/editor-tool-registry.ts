import type { EditorConfig } from '@editorjs/editorjs/types/configs';
import type { InlineToolConstructable, ToolConstructable } from '@editorjs/editorjs/types/tools';
import Header from '@editorjs/header';
import ImageTool from '@editorjs/image';
import List from '@editorjs/list';
import mermaid from 'mermaid';
import ApiEndpointTool from './api-endpoint-tool';
import ApprovalTableTool from './approval-table-tool';
import { BpmnModelerTool, BpmnPreviewTool } from './bpmn-tools';
import CodeBlockTool from './code-block-tool';
import ConfluenceTableTool from './confluence-table-tool';
import DiffBlockTool from './diff-block-tool';
import type { SlashDocWebviewSettings } from './editor-settings';
import FileProcessorTool from './file-processor-tool';
import FlowDesignerTool from './flow-designer-tool';
import { setupHeaderInlineTools } from './header-inline-tools';
import ImageAnnotationTool from './image-annotation-tool';
import { LUCIDE_ICONS } from './lucide-icons';
import LucideInlineCode from './lucide-inline-code';
import LucideMarker from './lucide-marker';
import LucideUnderline from './lucide-underline';
import MermaidTool from './mermaid-tool';
import NetworkCanvasTool from './network-canvas-tool';
import PageLinkTool from './page-link-tool';
import TaskTableTool from './task-table-tool';
import TextColorTool from './text-color-tool';
import { setupUserMentions, type UserDirectoryBridge } from './user-directory';

export type EditorTools = NonNullable<EditorConfig['tools']>;

export function createEditorTools(
  settings: SlashDocWebviewSettings,
  userDirectory: UserDirectoryBridge,
): { tools: EditorTools; inlineToolbarTools: string[] } {
  initializeMermaid();
  const tools: EditorTools = {};
  const addons = settings.editorAddons;
  if (addons?.header !== false) {
    tools.header = {
      class: Header as unknown as ToolConstructable,
      toolbox: { title: 'Заголовок', icon: LUCIDE_ICONS.heading },
    };
  }
  if (addons?.list !== false) {
    tools.list = { class: List as unknown as ToolConstructable, toolbox: { title: 'Список', icon: LUCIDE_ICONS.list } };
  }
  if (addons?.confluenceTable !== false) tools.confluenceTable = ConfluenceTableTool;
  if (addons?.image !== false) {
    tools.image = {
      class: ImageTool as unknown as ToolConstructable,
      toolbox: { title: 'Изображение', icon: LUCIDE_ICONS.image },
      config: {
        uploader: {
          uploadByFile: async (file: File) => ({ success: 1, file: { url: await readFileAsDataUrl(file) } }),
        },
      },
    };
  }
  if (addons?.marker !== false) tools.marker = { class: LucideMarker, toolbox: { title: 'Маркер' } };
  if (addons?.inlineCode !== false) {
    tools.inlineCode = { class: LucideInlineCode, toolbox: { title: 'Встроенный код' } };
  }
  if (addons?.underline !== false) {
    tools.underline = { class: LucideUnderline, toolbox: { title: 'Подчёркивание' } };
  }
  if (addons?.textColor !== false) tools.textColor = TextColorTool as unknown as InlineToolConstructable;
  if (addons?.approvalTable !== false) tools.approvalTable = ApprovalTableTool;
  tools.pageLink = {
    class: PageLinkTool as unknown as InlineToolConstructable,
    config: {
      pages: window.__SLASH_DOC_PAGES__ ?? [],
      currentPageId: window.__SLASH_DOC_CURRENT_PAGE_ID__ ?? undefined,
    },
  };
  setupHeaderInlineTools({
    pages: window.__SLASH_DOC_PAGES__ ?? [],
    currentPageId: window.__SLASH_DOC_CURRENT_PAGE_ID__ ?? undefined,
    textColorEnabled: addons?.textColor !== false,
  });
  if (addons?.userMention !== false) setupUserMentions(userDirectory);
  if (addons?.mermaid !== false) tools.mermaid = MermaidTool;
  if (addons?.flowDesigner !== false) tools.flowDesigner = FlowDesignerTool;
  if (addons?.networkCanvas !== false) tools.networkCanvas = NetworkCanvasTool;
  if (addons?.imageAnnotation !== false) tools.imageAnnotation = ImageAnnotationTool;
  if (addons?.apiEndpoint !== false) tools.apiEndpoint = ApiEndpointTool;
  if (addons?.fileProcessor !== false) tools.fileProcessor = FileProcessorTool;
  if (addons?.taskTable !== false) tools.taskTable = TaskTableTool;
  if (addons?.codeBlock !== false) tools.codeBlock = CodeBlockTool;
  if (addons?.diffBlock !== false) tools.diffBlock = DiffBlockTool;
  if (addons?.bpmnModeler !== false) tools.bpmnModeler = BpmnModelerTool;
  if (addons?.bpmnPreview !== false) tools.bpmnPreview = BpmnPreviewTool;
  return {
    tools,
    inlineToolbarTools: [
      'bold',
      'italic',
      'link',
      ...(addons?.marker !== false ? ['marker'] : []),
      ...(addons?.inlineCode !== false ? ['inlineCode'] : []),
      ...(addons?.underline !== false ? ['underline'] : []),
    ],
  };
}

function initializeMermaid(): void {
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
      tertiaryColor: getCssVariable('--vscode-input-background', '#3c3c3c'),
    },
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function getCssVariable(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
