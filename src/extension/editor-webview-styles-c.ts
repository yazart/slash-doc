export const EDITOR_WEBVIEW_STYLES_C = `      }

      .slash-text-color-swatch:hover,
      .slash-text-color-swatch:focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 1px;
      }

      .slash-text-color-picker {
        width: 24px;
        height: 22px;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
      }

      .slash-page-link,
      .slash-external-link {
        color: var(--vscode-textLink-foreground);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }

      .slash-page-link-picker {
        display: grid;
        gap: 6px;
        width: min(320px, 75vw);
        padding: 7px;
      }

      .slash-page-link-search {
        box-sizing: border-box;
        width: 100%;
        padding: 5px 7px;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--border));
        outline: none;
        background: var(--vscode-input-background);
      }

      .slash-page-link-search:focus {
        border-color: var(--vscode-focusBorder);
      }

      .slash-page-link-list {
        display: grid;
        max-height: 230px;
        overflow: auto;
      }

      .slash-page-link-option,
      .slash-page-link-remove {
        overflow: hidden;
        padding: 6px 8px;
        color: var(--vscode-foreground);
        border: 0;
        border-radius: 2px;
        background: transparent;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }

      .slash-page-link-option:hover,
      .slash-page-link-option:focus-visible,
      .slash-page-link-remove:hover,
      .slash-page-link-remove:focus-visible {
        color: var(--vscode-list-hoverForeground);
        outline: none;
        background: var(--vscode-list-hoverBackground);
      }

      .slash-page-link-current::after {
        content: " · текущая";
        color: var(--vscode-descriptionForeground);
      }

      .slash-page-link-empty {
        padding: 7px 8px;
        color: var(--vscode-descriptionForeground);
      }

      .slash-page-link-remove {
        color: var(--vscode-errorForeground);
        border-top: 1px solid var(--border);
      }

      .slash-external-link-picker {
        display: grid;
        gap: 8px;
        width: min(340px, 78vw);
        padding: 9px;
      }

      .slash-external-link-input {
        box-sizing: border-box;
        width: 100%;
        padding: 6px 8px;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--border));
        outline: none;
        background: var(--vscode-input-background);
      }

      .slash-external-link-input:focus {
        border-color: var(--vscode-focusBorder);
      }

      .slash-external-link-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      .slash-external-link-save,
      .slash-external-link-remove {
        padding: 5px 9px;
        color: var(--vscode-button-foreground);
        border: 1px solid var(--vscode-button-border, transparent);
        border-radius: 3px;
        background: var(--vscode-button-background);
        cursor: pointer;
      }

      .slash-external-link-remove {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      .slash-user-mention {
        display: inline-flex;
        align-items: center;
        padding: 1px 5px;
        color: var(--vscode-textLink-foreground);
        border-radius: 9px;
        background: color-mix(in srgb, var(--vscode-textLink-foreground) 15%, transparent);
        text-decoration: none;
        white-space: nowrap;
      }

      .slash-user-search-popup {
        position: fixed;
        z-index: 100;
        display: grid;
        width: min(320px, 80vw);
        max-height: 240px;
        overflow: auto;
        padding: 5px;
        border: 1px solid var(--vscode-dropdown-border, var(--border));
        border-radius: 5px;
        background: var(--vscode-dropdown-background, var(--surface-raised));
        box-shadow: 0 8px 24px color-mix(in srgb, #000 34%, transparent);
      }

      .slash-user-search-popup[hidden] {
        display: none;
      }

      .slash-user-search-option {
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        padding: 6px;
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground));
        border: 0;
        border-radius: 3px;
        background: transparent;
        text-align: left;
        cursor: pointer;
      }

      .slash-user-search-option:hover,
      .slash-user-search-option.active {
        color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
        background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
      }

      .slash-user-search-option img {
        width: 30px;
        height: 30px;
        border-radius: 50%;
      }

      .slash-user-search-option span,
      .slash-user-search-option strong,
      .slash-user-search-option small {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .slash-user-search-option small,
      .slash-user-search-empty {
        color: var(--vscode-descriptionForeground);
      }

      .slash-user-search-empty {
        padding: 8px;
      }

      .slash-approval-table-tool {
        overflow-x: auto;
        margin: 10px 0;
      }

      .slash-approval-table {
        width: 100%;
        min-width: 720px;
        border-collapse: collapse;
      }

      .slash-approval-table th,
      .slash-approval-table td {
        padding: 7px;
        border: 1px solid var(--border);
        text-align: left;
        vertical-align: top;
      }

      .slash-approval-table th:last-child,
      .slash-approval-table td:last-child {
        width: 28px;
      }

      .slash-approval-table textarea,
      .slash-approval-table input {
        box-sizing: border-box;
        width: 100%;
        padding: 6px 7px;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--border));
        outline: none;
        background: var(--vscode-input-background);
        font: inherit;
      }

      .slash-approval-table textarea {
        min-height: 34px;
        resize: vertical;
      }

      .slash-approval-users {
        position: relative;
        display: grid;
        gap: 5px;
      }

      .slash-approval-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .slash-approval-user-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        max-width: 220px;
        padding: 2px 4px 2px 2px;
        border-radius: 13px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
      }

      .slash-approval-user-chip img {
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }

      .slash-approval-user-chip button,
      .slash-approval-remove-row {
        color: inherit;
        border: 0;
        background: transparent;
        cursor: pointer;
      }

      .slash-approval-user-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 5;
        display: grid;
        max-height: 210px;
        overflow: auto;
        padding: 4px;
        border: 1px solid var(--vscode-dropdown-border, var(--border));
        background: var(--vscode-dropdown-background, var(--surface-raised));
        box-shadow: 0 5px 16px color-mix(in srgb, #000 30%, transparent);
      }

      .slash-approval-user-menu[hidden] {
        display: none;
      }

      .slash-approval-add-row {
        margin-top: 7px;
        padding: 5px 9px;
        color: var(--vscode-button-foreground);
        border: 0;
        border-radius: 3px;
        background: var(--vscode-button-background);
        cursor: pointer;
      }
`;
