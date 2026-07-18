import { css } from 'lit';

export const API_ENDPOINT_STYLES = css`
  :host {
    display: block;
    width: 100%;
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, sans-serif);
  }
  * {
    box-sizing: border-box;
  }
  button,
  input,
  select,
  textarea {
    font: inherit;
  }
  .shell {
    overflow: hidden;
    border: 1px solid var(--vscode-panel-border, #555);
    border-radius: 5px;
    background: var(--vscode-editor-background);
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border, #555);
    background: var(--vscode-editorWidget-background);
  }
  .tabs button {
    padding: 8px 14px;
    color: var(--vscode-descriptionForeground);
    border: 0;
    border-right: 1px solid var(--vscode-panel-border);
    background: transparent;
    cursor: pointer;
    font-size: 11px;
  }
  .tabs button.active {
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    box-shadow: inset 0 2px var(--vscode-focusBorder);
  }
  .content {
    padding: 12px;
  }
  .endpoint {
    display: grid;
    grid-template-columns: 105px minmax(0, 1fr);
    gap: 7px;
  }
  .field {
    display: grid;
    gap: 4px;
  }
  .field > span,
  .section-label {
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    text-transform: uppercase;
  }
  input,
  select,
  textarea {
    width: 100%;
    padding: 6px;
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
    border-radius: 2px;
    outline: 0;
    background: var(--vscode-input-background);
  }
  input:focus,
  select:focus,
  textarea:focus {
    border-color: var(--vscode-focusBorder);
  }
  textarea {
    min-height: 58px;
    resize: vertical;
  }
  .wide {
    grid-column: 1/-1;
  }
  .uri {
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .section {
    margin-top: 14px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 9px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background: var(--vscode-editorWidget-background);
  }
  .section-head h4 {
    margin: 0;
    font-size: 11px;
  }
  .parameter {
    display: grid;
    grid-template-columns: 110px 70px 90px 65px minmax(100px, 1fr) minmax(100px, 1fr);
    gap: 5px;
    align-items: center;
    padding: 6px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 65%, transparent);
    font-size: 11px;
  }
  .parameter:last-child {
    border-bottom: 0;
  }
  .badge {
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--vscode-symbolIcon-variableForeground, #75beff);
  }
  .required {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--vscode-descriptionForeground);
  }
  .required input {
    width: auto;
  }
  .payload-head {
    display: grid;
    grid-template-columns: 1fr 130px 90px;
    gap: 7px;
    padding: 8px;
  }
  .schema-tabs {
    display: flex;
    border-top: 1px solid var(--vscode-panel-border);
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .schema-tabs button {
    padding: 6px 10px;
    color: var(--vscode-descriptionForeground);
    border: 0;
    border-right: 1px solid var(--vscode-panel-border);
    background: transparent;
    cursor: pointer;
    font-size: 10px;
  }
  .schema-tabs button.active {
    color: var(--vscode-foreground);
    background: var(--vscode-list-hoverBackground);
  }
  .schema {
    padding: 5px 0;
  }
  .schema-row {
    display: grid;
    grid-template-columns: minmax(90px, 150px) 90px 58px minmax(100px, 1fr) 52px;
    gap: 5px;
    align-items: center;
    padding: 4px 8px;
    font-size: 10px;
  }
  .schema-row:hover {
    background: var(--vscode-list-hoverBackground);
  }
  .schema-actions {
    display: flex;
    gap: 2px;
  }
  .icon-button {
    padding: 3px 5px;
    color: var(--vscode-descriptionForeground);
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .icon-button:hover {
    color: var(--vscode-foreground);
  }
  .add {
    margin: 4px 8px 8px;
    padding: 4px 8px;
    color: var(--vscode-textLink-foreground);
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: 10px;
  }
  .preview-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }
  .preview-tabs button {
    padding: 5px 9px;
    color: var(--vscode-descriptionForeground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    background: var(--vscode-editorWidget-background);
    cursor: pointer;
    font-size: 10px;
  }
  .preview-tabs button.active {
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
    background: var(--vscode-button-background);
  }
  pre {
    max-height: 560px;
    overflow: auto;
    margin: 0;
    padding: 12px;
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    background: var(--vscode-textCodeBlock-background);
    font: 11px/1.5 var(--vscode-editor-font-family, monospace);
    white-space: pre;
  }
  .syntax-keyword {
    color: var(--vscode-debugTokenExpression-name, #c586c0);
  }
  .syntax-string {
    color: var(--vscode-debugTokenExpression-string, #ce9178);
  }
  .syntax-number {
    color: var(--vscode-debugTokenExpression-number, #b5cea8);
  }
  .syntax-comment {
    color: var(--vscode-descriptionForeground, #6a9955);
    font-style: italic;
  }
  .syntax-property {
    color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe);
  }
  .syntax-punctuation {
    color: var(--vscode-symbolIcon-operatorForeground, #d4d4d4);
  }
  .html-preview {
    padding: 14px;
    color: #202124;
    border-radius: 3px;
    background: #fff;
  }
  .html-preview .api-endpoint-doc header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .html-preview .api-method {
    padding: 4px 7px;
    color: white;
    border-radius: 3px;
    background: #3979c6;
    font: bold 11px monospace;
  }
  .html-preview .api-method-post {
    background: #2e9b57;
  }
  .html-preview .api-method-delete {
    background: #c43b3b;
  }
  .html-preview .api-uri {
    font-size: 13px;
  }
  .html-preview h2 {
    font-size: 18px;
  }
  .html-preview h3 {
    margin-top: 16px;
    font-size: 14px;
  }
  .html-preview table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .html-preview th,
  .html-preview td {
    padding: 5px;
    border: 1px solid #ccc;
    text-align: left;
  }
  @media (max-width: 760px) {
    .parameter {
      grid-template-columns: 1fr 80px 70px;
    }
    .parameter input:nth-last-child(-n + 2) {
      grid-column: span 3;
    }
    .endpoint {
      grid-template-columns: 90px 1fr;
    }
    .schema-row {
      grid-template-columns: 1fr 80px 50px;
    }
    .schema-row input:nth-of-type(2),
    .schema-actions {
      grid-column: span 1;
    }
  }
`;
