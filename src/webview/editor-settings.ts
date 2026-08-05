import type { AutoSaveSettings } from '../shared/autosave';

export type SlashDocWebviewSettings = {
  autoSave?: Partial<AutoSaveSettings>;
  editorAddons?: {
    header?: boolean;
    list?: boolean;
    confluenceTable?: boolean;
    image?: boolean;
    marker?: boolean;
    inlineCode?: boolean;
    underline?: boolean;
    textColor?: boolean;
    mermaid?: boolean;
    flowDesigner?: boolean;
    networkCanvas?: boolean;
    imageAnnotation?: boolean;
    apiEndpoint?: boolean;
    fileProcessor?: boolean;
    taskTable?: boolean;
    codeBlock?: boolean;
    diffBlock?: boolean;
    bpmnModeler?: boolean;
    bpmnPreview?: boolean;
    userMention?: boolean;
  };
};
