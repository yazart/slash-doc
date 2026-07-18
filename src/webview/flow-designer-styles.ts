import { css } from 'lit';

export const FLOW_DESIGNER_STYLES = css`
  :host {
    --fd-bg: var(--vscode-editor-background, #1e1e1e);
    --fd-card: var(--vscode-editorWidget-background, #252526);
    --fd-fg: var(--vscode-editor-foreground, #ccc);
    --fd-muted: var(--vscode-descriptionForeground, #999);
    --fd-border: var(--vscode-panel-border, #454545);
    --fd-focus: var(--vscode-focusBorder, #007fd4);
    display: block;
    width: 100%;
    color: var(--fd-fg);
    font-family: var(--vscode-font-family, sans-serif);
  }
  * {
    box-sizing: border-box;
  }
  .editor {
    display: grid;
    grid-template-columns: 148px minmax(0, 1fr);
    height: 520px;
    overflow: hidden;
    border: 1px solid var(--fd-border);
    border-radius: 4px;
    background: var(--fd-bg);
  }
  .palette {
    z-index: 3;
    border-right: 1px solid var(--fd-border);
    background: var(--fd-card);
  }
  .heading {
    margin: 0;
    padding: 12px;
    border-bottom: 1px solid var(--fd-border);
    color: var(--fd-muted);
    font: 600 11px/1.2 var(--vscode-editor-font-family, monospace);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .palette-list {
    display: grid;
    gap: 6px;
    padding: 8px;
  }
  .palette-item {
    display: grid;
    grid-template-columns: 9px 1fr;
    gap: 8px;
    width: 100%;
    padding: 8px;
    color: var(--fd-fg);
    text-align: left;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: grab;
  }
  .palette-item:hover,
  .palette-item.active {
    border-color: var(--fd-border);
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.06));
  }
  .dot {
    width: 9px;
    height: 9px;
    margin-top: 2px;
    border-radius: 50%;
    background: var(--node-color);
  }
  .palette-name {
    display: block;
    font: 600 11px/1.2 var(--vscode-editor-font-family, monospace);
    text-transform: capitalize;
  }
  .palette-desc {
    display: block;
    margin-top: 3px;
    color: var(--fd-muted);
    font-size: 10px;
  }
  .workspace {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }
  .canvas {
    position: absolute;
    inset: 0;
    overflow: hidden;
    cursor: grab;
    background-image: radial-gradient(
      circle,
      color-mix(in srgb, var(--fd-muted) 38%, transparent) 1px,
      transparent 1px
    );
    background-size: 20px 20px;
  }
  .canvas.pending {
    cursor: crosshair;
  }
  .scene {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
  }
  .connections {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }
  path {
    fill: none;
    stroke: var(--vscode-charts-blue, #3794ff);
    stroke-width: 2;
    pointer-events: stroke;
    cursor: pointer;
  }
  path:hover {
    stroke: var(--vscode-errorForeground, #f48771);
    stroke-width: 3;
  }
  path.connecting {
    stroke-dasharray: 5 5;
    pointer-events: none;
  }
  .node {
    position: absolute;
    width: 130px;
    min-height: 62px;
    padding: 11px 13px;
    color: var(--fd-fg);
    border: 2px solid var(--node-color);
    border-radius: 7px;
    background: color-mix(in srgb, var(--node-color) 12%, var(--fd-card));
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
    cursor: move;
    user-select: none;
  }
  .node.selected {
    outline: 2px solid var(--fd-focus);
    outline-offset: 2px;
  }
  .node-title {
    overflow: hidden;
    font: 600 12px/1.3 var(--vscode-editor-font-family, monospace);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .node-description {
    margin-top: 5px;
    color: var(--fd-muted);
    font-size: 10px;
  }
  .port {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    border: 2px solid var(--node-color);
    border-radius: 50%;
    background: var(--fd-bg);
    transform: translateY(-50%);
    cursor: crosshair;
  }
  .port.input {
    left: -7px;
  }
  .port.output {
    right: -7px;
  }
  .port:hover {
    background: var(--node-color);
  }
  .controls {
    position: absolute;
    right: 10px;
    bottom: 10px;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 3px;
  }
  button.control {
    min-width: 28px;
    height: 27px;
    padding: 0 6px;
    color: var(--fd-fg);
    border: 1px solid var(--fd-border);
    border-radius: 3px;
    background: var(--fd-card);
    cursor: pointer;
  }
  .zoom {
    padding: 0 5px;
    color: var(--fd-muted);
    font-size: 10px;
  }
  .properties {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    width: 210px;
    padding: 14px;
    border-left: 1px solid var(--fd-border);
    background: var(--fd-card);
    box-shadow: -5px 0 14px rgba(0, 0, 0, 0.12);
  }
  .properties-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .properties-title {
    margin: 0;
    font-size: 12px;
  }
  .close {
    color: var(--fd-muted);
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  label {
    display: grid;
    gap: 5px;
    margin: 0 0 12px;
    color: var(--fd-muted);
    font-size: 10px;
  }
  input,
  textarea {
    width: 100%;
    padding: 6px;
    color: var(--vscode-input-foreground, var(--fd-fg));
    border: 1px solid var(--vscode-input-border, var(--fd-border));
    border-radius: 2px;
    outline: 0;
    background: var(--vscode-input-background, var(--fd-bg));
    font: inherit;
  }
  textarea {
    min-height: 70px;
    resize: vertical;
  }
  input:focus,
  textarea:focus {
    border-color: var(--fd-focus);
  }
  .delete {
    width: 100%;
    padding: 6px;
    color: var(--vscode-button-foreground, white);
    border: 0;
    border-radius: 2px;
    background: var(--vscode-inputValidation-errorBorder, #be1100);
    cursor: pointer;
  }
  .trigger {
    --node-color: var(--vscode-charts-green, #89d185);
  }
  .action {
    --node-color: var(--vscode-charts-blue, #3794ff);
  }
  .condition {
    --node-color: var(--vscode-charts-yellow, #cca700);
  }
  .transform {
    --node-color: var(--vscode-charts-purple, #b180d7);
  }
  .output {
    --node-color: var(--vscode-charts-orange, #d18616);
  }
  @media (max-width: 700px) {
    .editor {
      grid-template-columns: 112px minmax(0, 1fr);
    }
    .palette-desc {
      display: none;
    }
  }
`;
