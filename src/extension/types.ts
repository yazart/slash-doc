export type SlashDocMenu = {
  items: SlashDocMenuItem[];
};

export type SlashDocMenuItem = {
  id: string;
  title: string;
  file: string;
  children: SlashDocMenuItem[];
};

export type ApiService = {
  id: string;
  name: string;
  file: string;
};

export type CustomEditorAddon = {
  id: string;
  name: string;
  toolName: string;
  file: string;
  enabled: boolean;
};

export type SettingsVariable = {
  key: string;
  value: string;
};

export type SlashDocSettings = {
  version: 1;
  editorAddons: {
    header: boolean;
    list: boolean;
    confluenceTable: boolean;
    image: boolean;
    marker: boolean;
    inlineCode: boolean;
    underline: boolean;
    mermaid: boolean;
    flowDesigner: boolean;
    networkCanvas: boolean;
    imageAnnotation: boolean;
    apiEndpoint: boolean;
    fileProcessor: boolean;
    taskTable: boolean;
  };
  customEditorAddons: CustomEditorAddon[];
  apiPrefix: string;
  apiPort: number;
  apiServices: ApiService[];
  variables: SettingsVariable[];
};

export type EditorAddonDefinition = {
  id: keyof SlashDocSettings['editorAddons'];
  label: string;
  icon: string;
};

export type ImportedDocument = {
  title: string;
  content: unknown;
};

export type CustomAddonWebviewModule = {
  id: string;
  toolName: string;
  uri: string;
};
