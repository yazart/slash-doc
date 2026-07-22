export function getEditorWebviewStylesA(iconUri: string): string {
  return `      :root {
        --surface: var(--vscode-sideBar-background, var(--vscode-editor-background));
        --surface-raised: var(--vscode-editorWidget-background, var(--vscode-editor-background));
        --border: var(--vscode-panel-border, color-mix(in srgb, var(--vscode-editor-foreground) 16%, transparent));
        --focus-ring: var(--vscode-focusBorder, var(--vscode-button-background));

        --color-border: var(--border);
        --color-bg-main: var(--vscode-editor-background);
        --color-bg-secondary: var(--vscode-editorWidget-background, var(--vscode-editor-background));
        --color-text-main: var(--vscode-editor-foreground);
        --color-text-secondary: var(--vscode-descriptionForeground);
      }

      body {
        overflow: auto;
        min-height: 100vh;
        margin: 0;
        color: var(--vscode-editor-foreground);
        background: var(--vscode-editor-background);
        font-family: var(--vscode-font-family);
      }

      .shell {
        min-height: 100vh;
      }

      .toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 12px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border);
        background: var(--surface);
      }

      .title {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .title-icon {
        display: inline-block;
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        background: var(--vscode-icon-foreground, var(--vscode-editor-foreground));
        -webkit-mask: url("${iconUri}") center / contain no-repeat;
        mask: url("${iconUri}") center / contain no-repeat;
      }

      .export-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
      }

      .save-status {
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        white-space: nowrap;
      }

      .save-status[data-status="error"] {
        color: var(--vscode-errorForeground);
      }

      .save-button {
        display: inline-grid;
        width: 24px;
        padding: 0;
        place-items: center;
      }

      .header-inline-tools {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: 10px;
      }

      .header-inline-tool {
        position: relative;
      }

      .header-inline-tool-button {
        display: grid;
        width: 26px;
        height: 26px;
        padding: 3px;
        place-items: center;
        color: var(--vscode-icon-foreground, var(--vscode-foreground));
        border: 1px solid transparent;
        border-radius: 3px;
        background: transparent;
        cursor: pointer;
      }

      .header-inline-tool-button:hover,
      .header-inline-tool-button[aria-expanded="true"] {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
        background: var(--vscode-list-hoverBackground);
      }

      .header-inline-tool-button:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .header-inline-tool-button svg {
        width: 19px;
        height: 19px;
      }

      .header-inline-tool-button svg [fill="none"],
      .ce-toolbar svg [fill="none"],
      .ce-toolbox__button svg [fill="none"],
      .ce-inline-toolbar svg [fill="none"],
      .ce-popover svg [fill="none"],
      .ce-conversion-toolbar svg [fill="none"],
      .ce-settings svg [fill="none"] {
        fill: none !important;
        stroke: currentColor;
      }

      .header-inline-tool-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        z-index: 50;
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-dropdown-border, var(--border));
        border-radius: 4px;
        background: var(--vscode-dropdown-background, var(--surface-raised));
        box-shadow: 0 6px 18px color-mix(in srgb, #000 32%, transparent);
      }

      .header-inline-tool-panel[hidden] {
        display: none;
      }

      .export-button {
        box-sizing: border-box;
        height: 24px;
        padding: 0 10px;
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--vscode-button-border, var(--vscode-input-border, transparent));
        border-radius: 2px;
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
        font: inherit;
        cursor: pointer;
      }

      .export-button:hover {
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      .export-button:focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: 2px;
      }

      #editor {
        box-sizing: border-box;
        width: calc(100% - 24px);
        min-width: 960px;
        min-height: calc(100vh - 72px);
        margin: 48px 12px 24px;
        padding: 20px 12px 48px;
        border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 7%, transparent);
        border-radius: 6px;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 35%, var(--vscode-editor-background));
      }

      .ce-block__content,
      .ce-toolbar__content {
        width: 100%;
        max-width: none;
      }

      .codex-editor,
      .codex-editor__redactor {
        color: var(--vscode-editor-foreground);
      }

      .ce-paragraph,
      .ce-header,
      .cdx-list,
      .tc-table {
        color: var(--vscode-editor-foreground);
      }

      .ce-toolbar__plus,
      .ce-toolbar__settings-btn,
      .ce-inline-toolbar__button,
      .ce-popover__item,
      .ce-popover-item,
      .ce-inline-tool,
      .ce-conversion-tool,
      .ce-settings__button,
      .cdx-settings-button {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground)) !important;
        background: transparent !important;
      }

      .ce-toolbar__plus:hover,
      .ce-toolbar__settings-btn:hover,
      .ce-inline-toolbar__button:hover,
      .ce-inline-toolbar__button--active,
      .ce-popover__item:hover,
      .ce-popover-item:hover,
      .ce-popover-item--focused,
      .ce-popover-item--active,
      .ce-inline-tool:hover,
      .ce-inline-tool--active,
      .ce-conversion-tool:hover,
      .ce-conversion-tool--focused,
      .ce-settings__button:hover,
      .cdx-settings-button:hover,
      .cdx-settings-button--active {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground)) !important;
        background: var(--vscode-list-hoverBackground) !important;
      }

      .ce-popover,
      .ce-popover__container,
      .ce-popover__items,
      .ce-inline-toolbar,
      .ce-inline-toolbar__dropdown,
      .ce-inline-toolbar__toggler-and-button-wrapper,
      .ce-conversion-toolbar,
      .ce-conversion-toolbar__tools,
      .ce-settings,
      .cdx-settings {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground)) !important;`;
}
