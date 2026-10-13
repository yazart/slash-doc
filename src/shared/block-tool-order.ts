const BLOCK_TOOL_ORDER = [
  'paragraph',
  'header',
  'quote',
  'list',
  'confluenceTable',
  'table',
  'image',
  'mkdocsAdmonition',
  'mkdocsDetails',
  'mkdocsTabs',
  'mkdocsChecklist',
  'mkdocsGrid',
  'codeBlock',
  'diffBlock',
  'mermaid',
  'imageAnnotation',
  'taskTable',
  'flowDesigner',
  'networkCanvas',
  'apiEndpoint',
  'fileProcessor',
];

/** Menu order is independent of registration order, including custom addons. */
export function orderedBlockTypes(names: string[]): string[] {
  const rank = (name: string) => {
    if (name === 'bpmnPreview') return 1001;
    if (name === 'bpmnModeler') return 1002;
    const index = BLOCK_TOOL_ORDER.indexOf(name);
    return index < 0 ? 1000 : index;
  };
  return [...names].sort((left, right) => rank(left) - rank(right));
}
