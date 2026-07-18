export const SIDEBAR_WEBVIEW_STYLES_B = `      min-width: 0;
    }

    .tree-toggle,
    .tree-toggle-spacer {
      flex: 0 0 18px;
      width: 18px;
      height: 22px;
    }

    .tree-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      color: var(--vscode-descriptionForeground);
      border: 0;
      border-radius: 2px;
      background: transparent;
      cursor: pointer;
    }

    .tree-toggle:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }

    .tree-toggle:focus-visible {
      outline: 1px solid var(--focus-ring);
      outline-offset: -1px;
    }

    .tree-toggle svg {
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      transform: rotate(90deg);
      transition: transform .12s ease;
    }

    .tree-node.collapsed > .tree-row .tree-toggle svg {
      transform: rotate(0deg);
    }

    .tree-node.collapsed > .tree-list {
      display: none;
    }

    .tree-row.dragging {
      opacity: .4;
    }

    .page-drag-ghost {
      position: fixed;
      z-index: 1000;
      max-width: 180px;
      padding: 4px 7px;
      overflow: hidden;
      color: var(--vscode-list-activeSelectionForeground, #fff);
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 3px;
      background: var(--vscode-list-activeSelectionBackground);
      box-shadow: 0 3px 10px rgba(0,0,0,.25);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    }

    .tree-row.drop-inside {
      border-radius: 2px;
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
      background: color-mix(in srgb, var(--vscode-focusBorder) 18%, transparent);
    }

    .tree-row.drop-before::before,
    .tree-row.drop-after::after {
      position: absolute;
      z-index: 2;
      right: 0;
      left: 0;
      height: 2px;
      border-radius: 1px;
      background: var(--vscode-focusBorder);
      content: '';
    }

    .tree-row.drop-before::before { top: -1px; }
    .tree-row.drop-after::after { bottom: -1px; }

    .tree-item {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 22px;
      padding: 2px 6px;
      color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
      border: 0;
      border-radius: 2px;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: grab;
      touch-action: none;
    }

    .tree-item:active {
      cursor: grabbing;
    }

    .tree-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .tree-item:focus-visible {
      outline: 1px solid var(--focus-ring);
      outline-offset: -1px;
    }

    .tree-item[aria-selected="true"] {
      color: var(--vscode-list-activeSelectionForeground, var(--vscode-sideBar-foreground));
      background: var(--vscode-list-activeSelectionBackground);
    }

    .tree-rename,
    .tree-delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 22px;
      width: 22px;
      height: 22px;
      padding: 0;
      color: var(--vscode-descriptionForeground);
      border: 0;
      border-radius: 2px;
      background: transparent;
      cursor: pointer;
      opacity: 0;
    }

    .tree-row:hover .tree-rename,
    .tree-row:hover .tree-delete,
    .tree-rename:focus-visible,
    .tree-delete:focus-visible {
      opacity: 1;
    }

    .tree-rename:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }

    .tree-delete:hover {
      color: var(--vscode-errorForeground, var(--vscode-foreground));
      background: var(--vscode-list-hoverBackground);
    }

    .tree-rename:focus-visible,
    .tree-delete:focus-visible {
      outline: 1px solid var(--focus-ring);
      outline-offset: -1px;
    }

    .tree-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tree-empty {
      margin: 4px 0 0;
      color: var(--vscode-descriptionForeground);
    }

    .settings-panel {
      display: grid;
      align-items: start;
      gap: 12px;
      min-width: 0;
      overflow: auto;
    }

    .settings-panel slash-button {
      justify-self: start;
    }

    .settings-header {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .settings-header slash-button {
      flex: 0 0 auto;
    }

    .settings-title {
      margin: 0;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-sideBar-foreground));
      font-size: var(--vscode-font-size);
      font-weight: 600;
    }

    .settings-group {
      display: grid;
      align-items: start;
      gap: 6px;
      min-width: 0;
    }

    .settings-list {
      display: grid;
      align-items: start;
      gap: 6px;
    }

    .settings-group-title {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-transform: uppercase;
    }

    .addon-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 24px;
    }

    .addon-info {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .addon-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      color: var(--vscode-icon-foreground, currentColor);
      flex: 0 0 auto;
    }

    .addon-icon svg {
      width: 16px;
      height: 16px;
    }

    .addon-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .settings-row {
      display: grid;
      align-items: start;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 6px;
    }

    .service-row {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto;
    }

    .custom-addon-row {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) auto auto;
    }

    .api-settings-row {
      grid-template-columns: minmax(0, 1fr) 72px;
    }

    .settings-input {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      height: 24px;
      padding: 2px 6px;
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      background: var(--vscode-input-background);
      font: inherit;
    }

    .settings-input:focus {
      outline: 1px solid var(--focus-ring);
      outline-offset: -1px;
    }

    .settings-open-button {
      box-sizing: border-box;
      height: 24px;
      padding: 0 8px;
      color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
      border: 1px solid var(--vscode-button-border, var(--vscode-input-border, transparent));
      border-radius: 2px;
      background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      font: inherit;
      cursor: pointer;
    }

    .settings-open-button:hover {
      background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
    }

    .service-actions {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      min-width: 0;
    }

    .service-actions slash-button {
      flex: 0 1 auto;
    }

    slash-switch::part(base) {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    slash-switch::part(control) {
      border-color: var(--vscode-input-border, transparent);
      background: var(--vscode-input-background);
    }

    slash-switch[checked]::part(control) {
      border-color: var(--vscode-button-background);
      background: var(--vscode-button-background);
    }
`;
