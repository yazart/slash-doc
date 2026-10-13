export const MKDOCS_ADMONITION_KINDS = [
  'note',
  'abstract',
  'info',
  'tip',
  'success',
  'question',
  'warning',
  'failure',
  'danger',
  'bug',
  'example',
  'quote',
] as const;

export type MkDocsAdmonitionKind = (typeof MKDOCS_ADMONITION_KINDS)[number];

export type MkDocsAdmonitionData = {
  kind: MkDocsAdmonitionKind;
  title: string;
  content: string;
  collapsible: boolean;
  open: boolean;
};

export type MkDocsTab = {
  id: string;
  title: string;
  content: string;
};

export type MkDocsTabsData = {
  tabs: MkDocsTab[];
};

export type MkDocsDetailsData = {
  summary: string;
  content: string;
  open: boolean;
};

export type MkDocsChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  level: number;
};

export type MkDocsChecklistData = {
  items: MkDocsChecklistItem[];
};

export function createMkDocsTab(title = 'Вкладка'): MkDocsTab {
  return {
    id: `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    content: '',
  };
}

export function createMkDocsChecklistItem(text = '', level = 0): MkDocsChecklistItem {
  return {
    id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    checked: false,
    level,
  };
}
