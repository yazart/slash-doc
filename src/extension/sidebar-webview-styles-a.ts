export const SIDEBAR_WEBVIEW_STYLES_A = `    :root {
      --focus-ring: var(--vscode-focusBorder, var(--vscode-button-background));
    }

    body {
      min-height: 100vh;
      margin: 0;
      color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .panel {
      box-sizing: border-box;
      min-height: 100vh;
      padding: 0;
    }

    .panel-empty {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .panel-ready {
      display: grid;
      grid-template-rows: minmax(120px, 1fr) auto;
      gap: 12px;
    }

    .panel-settings {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
    }

      .menu-panel {
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
      min-height: 0;
      gap: 10px;
      }

      .documentation-search {
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr) 24px;
        align-items: center;
        min-width: 0;
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
        border-radius: 3px;
        background: var(--vscode-input-background);
      }

      .documentation-search:focus-within {
        border-color: var(--vscode-focusBorder);
      }

      .documentation-search svg {
        width: 14px;
        height: 14px;
        margin-left: 5px;
        fill: none;
        stroke: var(--vscode-descriptionForeground);
        stroke-width: 1.6;
        stroke-linecap: round;
      }

      #documentation-search {
        min-width: 0;
        height: 27px;
        padding: 3px 5px;
        color: inherit;
        border: 0;
        outline: 0;
        background: transparent;
        font: inherit;
      }

      #documentation-search::-webkit-search-cancel-button {
        display: none;
      }

      #clear-documentation-search {
        width: 22px;
        height: 22px;
        padding: 0;
        color: var(--vscode-descriptionForeground);
        border: 0;
        border-radius: 2px;
        background: transparent;
        cursor: pointer;
      }

      #clear-documentation-search:hover {
        color: var(--vscode-foreground);
        background: var(--vscode-list-hoverBackground);
      }

      .menu-content {
        min-height: 0;
        overflow: hidden;
      }

      .documentation-search-results {
        display: grid;
        align-content: start;
        gap: 3px;
        height: 100%;
        overflow: auto;
      }

      .documentation-search-results[hidden],
      .tree[hidden] {
        display: none;
      }

      .documentation-search-result {
        display: grid;
        gap: 3px;
        width: 100%;
        padding: 7px;
        color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
        border: 0;
        border-radius: 3px;
        background: transparent;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .documentation-search-result:hover,
      .documentation-search-result:focus-visible {
        outline: none;
        background: var(--vscode-list-hoverBackground);
      }

      .documentation-search-result-title {
        overflow: hidden;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .documentation-search-result-snippet {
        display: -webkit-box;
        overflow: hidden;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        line-height: 1.35;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }

      .documentation-search-status {
        padding: 8px 6px;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
      }

    .actions-row {
      display: flex;
      gap: 6px;
      min-width: 0;
    }

    .actions-row #create-page {
      flex: 1 1 90%;
    }

    .import-tooltip,
    .compile-tooltip {
      flex: 0 0 28px;
      width: 28px;
    }

    .import-tooltip #import-page,
    .compile-tooltip #compile-site {
      width: 100%;
      min-width: 28px;
    }

    .import-tooltip #import-page::part(base),
    .compile-tooltip #compile-site::part(base) {
      justify-content: center;
      padding: 4px;
    }

    .import-icon,
    .compile-icon {
      display: block;
      width: 15px;
      height: 15px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .settings-button-row {
      display: flex;
      gap: 6px;
      min-width: 0;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
    }

    .empty-text {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }

    slash-button {
      flex: 1;
      max-width: 100%;
    }

    slash-button::part(base) {
      min-width: 0;
      min-height: 24px;
      padding: 4px 10px;
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      font-weight: 400;
      line-height: normal;
      box-shadow: none;
      transition: none;
    }

    slash-button::part(label) {
      overflow: hidden;
      padding: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    slash-button[variant="primary"]::part(base) {
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
    }

    slash-button[variant="primary"]::part(base):hover {
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-border, transparent);
      background: var(--vscode-button-hoverBackground);
    }

    slash-button[variant="default"]::part(base) {
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
      background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
    }

    slash-button[variant="default"]::part(base):hover {
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
      background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
    }

    slash-button::part(base):focus-visible {
      outline: 1px solid var(--focus-ring);
      outline-offset: 2px;
    }

    .tree {
      height: 100%;
      min-width: 0;
      overflow: auto;
    }

    .tree-root-drop {
      display: none;
      margin-bottom: 4px;
      padding: 5px 6px;
      color: var(--vscode-descriptionForeground);
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 3px;
      font-size: 11px;
      text-align: center;
    }

    body.page-dragging .tree-root-drop {
      display: block;
    }

    body.page-dragging {
      cursor: grabbing;
      user-select: none;
    }

    .tree-root-drop.drop-target {
      color: var(--vscode-list-activeSelectionForeground, #fff);
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }

    .tree-list {
      display: grid;
      gap: 1px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tree-list .tree-list {
      margin-left: 12px;
    }

    .tree-node {
      min-width: 0;
    }

    .tree-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 2px;`;
