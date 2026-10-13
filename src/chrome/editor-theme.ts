export function installEditorTextStyles(): void {
  // Shared tools use VS Code theme tokens. Supply their browser equivalents.
  const tokens: Record<string, string> = {
    'editor-background': '#ffffff',
    'editor-foreground': '#333238',
    foreground: '#333238',
    'sideBar-background': '#f6f6f8',
    'editorWidget-background': '#f6f6f8',
    'panel-border': '#dcdcde',
    focusBorder: '#7759c2',
    'font-family': 'system-ui, sans-serif',
    'input-background': '#ffffff',
    'input-foreground': '#333238',
    'input-border': '#89888d',
    descriptionForeground: '#626168',
    'dropdown-background': '#ffffff',
    'dropdown-foreground': '#333238',
    'dropdown-border': '#dcdcde',
    'list-hoverBackground': '#ececef',
    'list-hoverForeground': '#333238',
    'button-background': '#6750a4',
    'button-foreground': '#ffffff',
    'button-secondaryBackground': '#ececef',
    'button-secondaryForeground': '#333238',
    'textLink-foreground': '#5943b6',
    'editor-selectionBackground': '#d7c8f4',
    errorForeground: '#c91c00',
    'icon-foreground': '#626168',
    'toolbar-hoverBackground': '#ececef',
  };
  for (const [key, value] of Object.entries(tokens))
    document.documentElement.style.setProperty(`--vscode-${key}`, value);
}
