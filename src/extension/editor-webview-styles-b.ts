export const EDITOR_WEBVIEW_STYLES_B = `        border-color: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border))) !important;
        background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background, var(--vscode-editor-background))) !important;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--vscode-editor-background) 45%, transparent);
      }

      .ce-popover__search,
      .ce-popover__nothing-found-message,
      .ce-conversion-toolbar__label {
        color: var(--vscode-descriptionForeground) !important;
        background: var(--vscode-input-background) !important;
      }

      .ce-popover__search input,
      .ce-popover__search input::placeholder {
        color: var(--vscode-input-foreground) !important;
      }

      .ce-block--selected .ce-block__content,
      .ce-block--focused .ce-block__content {
        background: var(--vscode-editor-selectionBackground);
      }

      .tc-table,
      .tc-row,
      .tc-cell {
        border-color: var(--vscode-panel-border, var(--border));
      }

      .tc-wrap {
        --color-background: var(--vscode-list-hoverBackground);
        --color-text-secondary: var(--vscode-descriptionForeground);
        --color-border: var(--vscode-panel-border, var(--border));
        color: var(--vscode-editor-foreground);
      }

      .tc-table--heading .tc-row:first-child,
      .tc-add-column svg {
        background: var(--vscode-editor-background);
      }

      .tc-add-column,
      .tc-add-row,
      .tc-toolbox__toggler {
        color: var(--vscode-descriptionForeground);
      }

      .tc-add-column:hover,
      .tc-add-column:hover svg,
      .tc-add-column:focus-within,
      .tc-add-column:focus-within svg,
      .tc-add-row:hover,
      .tc-add-row:hover svg,
      .tc-add-row:focus-within,
      .tc-add-row:focus-within svg,
      .tc-add-row:hover::before,
      .tc-row--selected,
      .tc-row--selected::after {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground)) !important;
        background: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground, var(--vscode-editorWidget-background))) !important;
        background-color: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground, var(--vscode-editorWidget-background))) !important;
      }

      .tc-add-column:hover,
      .tc-add-column:hover svg,
      .tc-add-column:focus-within,
      .tc-add-column:focus-within svg {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground)) !important;
        background-color: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground, var(--vscode-editorWidget-background))) !important;
      }

      .tc-cell--selected,
      .tc-cell--selected::after {
        background: var(--vscode-editor-selectionBackground);
      }

      .tc-popover {
        --color-background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background, var(--vscode-editor-background)));
        --color-background-hover: var(--vscode-list-hoverBackground);
        --color-border: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border)));
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
        border-color: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border))) !important;
        background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background, var(--vscode-editor-background))) !important;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--vscode-editor-background) 45%, transparent);
      }

      .tc-popover__item {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
      }

      .tc-popover__item:hover {
        color: var(--vscode-list-hoverForeground, var(--vscode-foreground));
        background: var(--vscode-list-hoverBackground) !important;
      }

      .tc-popover__item-icon {
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
        border-color: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border)));
        background: var(--vscode-input-background);
      }

      .image-tool__image,
      .image-tool__caption,
      .cdx-input {
        color: var(--vscode-input-foreground);
        border-color: var(--vscode-input-border, var(--border));
        background: var(--vscode-input-background);
        box-shadow: none;
      }

      .slash-mermaid-tool {
        display: grid;
        gap: 8px;
        color: var(--vscode-editor-foreground);
      }

      .slash-mermaid-code,
      .slash-mermaid-caption {
        box-sizing: border-box;
        width: 100%;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--border));
        border-radius: 2px;
        background: var(--vscode-input-background);
        font: inherit;
      }

      .slash-mermaid-code {
        min-height: 140px;
        padding: 8px;
        resize: vertical;
        font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
      }

      .slash-mermaid-caption {
        height: 24px;
        padding: 2px 6px;
      }

      .slash-mermaid-code:focus,
      .slash-mermaid-caption:focus {
        outline: 1px solid var(--focus-ring);
        outline-offset: -1px;
      }

      .slash-mermaid-preview {
        min-height: 40px;
        overflow: auto;
        padding: 8px;
        color: var(--vscode-editor-foreground);
        border: 1px solid var(--vscode-panel-border, var(--border));
        border-radius: 2px;
        background: var(--vscode-editor-background);
      }

      .slash-mermaid-preview svg {
        max-width: 100%;
        height: auto;
      }

      .slash-flow-designer-tool,
      .slash-network-canvas-tool,
      .slash-image-annotation-tool,
      .slash-api-endpoint-tool,
      .slash-file-processor-tool,
      .slash-task-table-tool,
      .slash-confluence-table-tool {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        margin: 12px 0;
        overflow: hidden;
      }

      .slash-bpmn-tool {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        margin: 12px 0;
        overflow: hidden;
        color: var(--vscode-editor-foreground);
        border: 1px solid var(--border);
        border-radius: 5px;
        background: var(--vscode-editor-background);
      }

      .slash-bpmn-header {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 6px 8px;
        border-bottom: 1px solid var(--border);
        background: var(--surface-raised);
      }

      .slash-bpmn-header strong {
        margin-right: auto;
      }

      .slash-bpmn-status {
        min-width: 0;
        overflow: hidden;
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .slash-bpmn-status-error {
        color: var(--vscode-errorForeground);
      }

      .slash-bpmn-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        min-height: 26px;
        padding: 4px 9px;
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--vscode-button-border, var(--border));
        border-radius: 3px;
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
        font: inherit;
        cursor: pointer;
      }

      .slash-bpmn-button:hover {
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      .slash-bpmn-canvas {
        width: 100%;
        height: 480px;
        overflow: hidden;
        background: #fff;
      }

      .slash-bpmn-preview-controls {
        display: grid;
        gap: 8px;
        padding: 8px;
        border-bottom: 1px solid var(--border);
      }

      .slash-bpmn-preview-controls .slash-bpmn-button {
        justify-self: start;
      }

      .slash-bpmn-xml {
        box-sizing: border-box;
        width: 100%;
        min-height: 150px;
        resize: vertical;
        padding: 8px;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--border));
        outline: none;
        background: var(--vscode-input-background);
        font: 12px/1.45 var(--vscode-editor-font-family, monospace);
        white-space: pre;
      }

      .slash-bpmn-xml:focus {
        border-color: var(--vscode-focusBorder);
      }

      .slash-flow-designer-tool > *,
      .slash-network-canvas-tool > *,
      .slash-image-annotation-tool > *,
      .slash-api-endpoint-tool > *,
      .slash-file-processor-tool > *,
      .slash-task-table-tool > *,
      .slash-confluence-table-tool > * {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        max-width: 100%;
      }

      .cdx-marker {
        color: var(--vscode-editor-foreground);
        background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #ffcc00) 28%, transparent);
      }

      .slash-text-color-icon {
        width: 20px;
        height: 20px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .slash-text-color-icon .color-line {
        stroke: #3b82f6;
        stroke-width: 2.5;
      }

      .slash-text-color-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px;
      }

      .slash-text-color-swatch {
        width: 18px;
        height: 18px;
        padding: 0;
        border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 35%, transparent);
        border-radius: 50%;
        cursor: pointer;`;
