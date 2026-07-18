import { css } from 'lit';

export const IMAGE_ANNOTATION_STYLES = css`
  :host {
    display: block;
    width: 100%;
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, sans-serif);
    outline: none;
  }
  * {
    box-sizing: border-box;
  }
  button,
  input,
  textarea {
    font: inherit;
  }
  .empty {
    display: grid;
    place-items: center;
    min-height: 260px;
    padding: 28px;
    border: 2px dashed var(--vscode-panel-border, #555);
    border-radius: 6px;
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    text-align: center;
    transition: 0.15s;
  }
  .empty.dragging {
    border-color: var(--vscode-focusBorder, #007fd4);
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
  }
  .empty-icon {
    font-size: 42px;
    opacity: 0.65;
  }
  .empty h3 {
    margin: 12px 0 5px;
    font-size: 14px;
  }
  .empty p {
    margin: 0 0 15px;
    color: var(--vscode-descriptionForeground, #999);
    font-size: 12px;
    line-height: 1.5;
  }
  .button {
    padding: 6px 12px;
    color: var(--vscode-button-foreground, #fff);
    border: 0;
    border-radius: 3px;
    background: var(--vscode-button-background, #0e639c);
    cursor: pointer;
  }
  .button:hover {
    background: var(--vscode-button-hoverBackground, #1177bb);
  }
  .editor {
    display: grid;
    gap: 9px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .toolbar p {
    margin: 0;
    color: var(--vscode-descriptionForeground, #999);
    font-size: 11px;
  }
  .replace {
    padding: 4px 8px;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #555);
    border-radius: 3px;
    background: var(--vscode-editorWidget-background);
    cursor: pointer;
  }
  .frame {
    position: relative;
    width: 100%;
    overflow: hidden;
    border: 1px solid var(--vscode-panel-border, #555);
    border-radius: 4px;
    background: repeating-conic-gradient(#8882 0 25%, transparent 0 50%) 0/16px 16px;
    line-height: 0;
    user-select: none;
  }
  .frame img {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
  }
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }
  .region {
    fill: rgba(255, 188, 0, 0.12);
    stroke: #ffbc00;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    cursor: pointer;
  }
  .region:hover,
  .region.active {
    fill: rgba(255, 188, 0, 0.24);
    stroke: #ffd24a;
  }
  .region-number-bg {
    position: absolute;
    z-index: 2;
    display: grid;
    width: 18px;
    height: 18px;
    place-items: center;
    color: #1f1f1f;
    border-radius: 50%;
    background: #ffbc00;
    font: 700 10px/1 sans-serif;
    pointer-events: none;
    transform: translate(4px, 4px);
  }
  .draft {
    fill: rgba(0, 127, 212, 0.12);
    stroke: var(--vscode-focusBorder, #007fd4);
    stroke-width: 2;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
  }
  .popup {
    position: absolute;
    z-index: 5;
    right: 10px;
    top: 10px;
    width: min(330px, calc(100% - 20px));
    padding: 11px;
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 5px;
    background: var(--vscode-editorWidget-background, #252526);
    box-shadow: 0 7px 24px #0006;
    line-height: normal;
  }
  .popup-title {
    margin: 0 0 7px;
    font-size: 12px;
  }
  .popup textarea {
    width: 100%;
    min-height: 90px;
    padding: 7px;
    resize: vertical;
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    outline: 0;
    background: var(--vscode-input-background);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .popup textarea:focus {
    border-color: var(--vscode-focusBorder);
  }
  .popup-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 8px;
  }
  .delete {
    padding: 5px 9px;
    color: var(--vscode-errorForeground, #f48771);
    border: 1px solid currentColor;
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
  }
  .send-back {
    margin-right: auto;
    padding: 5px 9px;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border, #555);
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
  }
  .send-back:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.08));
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th,
  td {
    padding: 7px 9px;
    border: 1px solid var(--vscode-panel-border, #555);
    text-align: left;
    vertical-align: top;
  }
  th:first-child,
  td:first-child {
    width: 48px;
    text-align: center;
  }
  th {
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editorWidget-background);
    font-size: 10px;
    text-transform: uppercase;
  }
  .description {
    line-height: 1.45;
  }
  .description p {
    margin: 0 0 5px;
  }
  .description p:last-child {
    margin-bottom: 0;
  }
  .description code {
    padding: 1px 3px;
    background: var(--vscode-textCodeBlock-background);
  }
  .description a {
    color: var(--vscode-textLink-foreground);
  }
`;
