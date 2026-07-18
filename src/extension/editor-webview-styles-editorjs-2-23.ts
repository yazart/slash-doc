/** Theme overrides for the DOM and state classes used by Editor.js 2.23.x. */
export const EDITORJS_2_23_THEME_STYLES = `
      .header-inline-tool-button:hover,
      .header-inline-tool-button[aria-expanded="true"] {
        color: var(--vscode-list-hoverForeground, var(--vscode-icon-foreground, var(--vscode-foreground))) !important;
        background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground, var(--vscode-editorWidget-background))) !important;
        outline: 1px solid var(--vscode-toolbar-hoverOutline, transparent);
        outline-offset: -1px;
      }

      .codex-editor {
        --slash-toolbar-foreground: var(--vscode-icon-foreground, var(--vscode-editor-foreground));
        --slash-popup-foreground: var(--vscode-dropdown-foreground, var(--vscode-editor-foreground));
        --slash-hover-foreground: var(--vscode-list-hoverForeground, var(--slash-toolbar-foreground));
        --slash-hover-background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground, var(--vscode-editorWidget-background)));
        --slash-active-foreground: var(--vscode-list-activeSelectionForeground, var(--slash-hover-foreground));
        --slash-active-background: var(--vscode-list-activeSelectionBackground, var(--slash-hover-background));
        --slash-popup-background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background, var(--vscode-editor-background)));
        --slash-popup-border: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border)));
      }

      .ce-toolbar__plus,
      .ce-toolbar__settings-btn {
        color: var(--slash-toolbar-foreground) !important;
        background: transparent !important;
      }

      .ce-toolbar__plus:hover,
      .ce-toolbar__plus--active,
      .ce-toolbar__settings-btn:hover,
      .ce-toolbar__settings-btn--active {
        color: var(--slash-hover-foreground) !important;
        background: var(--slash-hover-background) !important;
        outline: 1px solid var(--vscode-toolbar-hoverOutline, transparent);
        outline-offset: -1px;
      }

      .ce-toolbox,
      .ce-inline-toolbar,
      .ce-conversion-toolbar,
      .ce-settings {
        color: var(--slash-popup-foreground) !important;
        border-color: var(--slash-popup-border) !important;
        background: var(--slash-popup-background) !important;
        box-shadow: 0 4px 12px color-mix(in srgb, var(--vscode-editor-background) 45%, transparent) !important;
      }

      .ce-toolbox {
        border: 1px solid var(--slash-popup-border);
        border-radius: 6px;
      }

      .ce-toolbox__button,
      .ce-inline-tool,
      .ce-conversion-tool,
      .ce-settings__button,
      .cdx-settings-button {
        color: var(--slash-popup-foreground) !important;
        background: transparent !important;
      }

      .ce-toolbox__button:hover,
      .ce-toolbox__button--active,
      .ce-inline-toolbar__dropdown:hover,
      .ce-inline-tool:hover,
      .ce-inline-tool--focused,
      .ce-conversion-tool:hover,
      .ce-conversion-tool--focused,
      .ce-settings__button:hover,
      .ce-settings__button--focused,
      .cdx-settings-button--focused,
      .cdx-settings-button:hover {
        color: var(--slash-hover-foreground) !important;
        background: var(--slash-hover-background) !important;
      }

      .ce-toolbox__button--active,
      .ce-inline-tool--active,
      .ce-conversion-tool--active,
      .ce-settings__button--active,
      .ce-settings__button--selected,
      .cdx-settings-button--active {
        color: var(--slash-active-foreground) !important;
        background: var(--slash-active-background) !important;
      }

      .ce-inline-toolbar__toggler-and-button-wrapper {
        color: inherit !important;
        border: 0 !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .ce-inline-toolbar__dropdown {
        color: var(--slash-popup-foreground) !important;
        border-color: var(--slash-popup-border) !important;
        background: transparent !important;
      }

      .ce-inline-tool-input {
        color: var(--vscode-input-foreground) !important;
        border-color: var(--vscode-input-border, var(--slash-popup-border)) !important;
        background: var(--vscode-input-background) !important;
      }

      .ce-inline-tool-input::placeholder,
      .ce-conversion-toolbar__label {
        color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground)) !important;
      }

      .ce-conversion-tool__icon {
        color: inherit !important;
        border-color: var(--slash-popup-border) !important;
        background: var(--vscode-input-background) !important;
      }

      .ce-settings__button--confirm,
      .ce-settings__button--confirm:hover {
        color: var(--vscode-button-foreground, #fff) !important;
        background: var(--vscode-errorForeground, #d54a4a) !important;
      }

      :is(
          .header-inline-tool-button,
          .ce-toolbar__plus,
          .ce-toolbar__settings-btn,
          .ce-toolbox__button,
          .ce-inline-toolbar__dropdown,
          .ce-inline-tool,
          .ce-conversion-tool,
          .ce-settings__button,
          .cdx-settings-button
        ) svg {
        color: inherit !important;
        fill: currentColor;
      }

      :is(
          .header-inline-tool-button,
          .ce-toolbar__plus,
          .ce-toolbar__settings-btn,
          .ce-toolbox__button,
          .ce-inline-toolbar__dropdown,
          .ce-inline-tool,
          .ce-conversion-tool,
          .ce-settings__button,
          .cdx-settings-button
        ) svg[fill="none"],
      :is(
          .header-inline-tool-button,
          .ce-toolbar__plus,
          .ce-toolbar__settings-btn,
          .ce-toolbox__button,
          .ce-inline-toolbar__dropdown,
          .ce-inline-tool,
          .ce-conversion-tool,
          .ce-settings__button,
          .cdx-settings-button
        ) svg [fill="none"] {
        fill: none !important;
      }

      :is(
          .header-inline-tool-button,
          .ce-toolbox__button,
          .ce-inline-tool,
          .ce-settings__button
        ) svg [stroke]:not([stroke="none"]) {
        stroke: currentColor !important;
      }
`;
