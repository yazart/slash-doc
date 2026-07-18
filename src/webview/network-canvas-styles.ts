import { css } from 'lit';

export const NETWORK_CANVAS_STYLES = css`
  :host {
    --nc-bg: var(--vscode-editor-background, #1e1e1e);
    --nc-card: var(--vscode-editorWidget-background, #252526);
    --nc-fg: var(--vscode-editor-foreground, #ccc);
    --nc-muted: var(--vscode-descriptionForeground, #999);
    --nc-border: var(--vscode-panel-border, #454545);
    --nc-primary: var(--vscode-charts-cyan, #06b6d4);
    display: block;
    width: 100%;
    color: var(--nc-fg);
    font-family: var(--vscode-font-family, sans-serif);
  }
  * {
    box-sizing: border-box;
  }
  button,
  input,
  select {
    font: inherit;
  }
  .editor {
    display: grid;
    grid-template-columns: 150px minmax(0, 1fr);
    height: 540px;
    overflow: hidden;
    border: 1px solid var(--nc-border);
    border-radius: 4px;
    background: var(--nc-bg);
  }
  .sidebar {
    z-index: 5;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--nc-border);
    background: var(--nc-card);
  }
  .heading {
    margin: 0;
    padding: 12px;
    border-bottom: 1px solid var(--nc-border);
    color: var(--nc-muted);
    font: 600 11px/1.2 var(--vscode-editor-font-family, monospace);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .items {
    display: grid;
    gap: 6px;
    padding: 9px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px;
    color: var(--nc-fg);
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: grab;
    text-align: left;
  }
  .item:hover {
    border-color: var(--nc-border);
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.06));
  }
  .item .icon {
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    color: var(--item-color);
    border: 1px solid currentColor;
    border-radius: 4px;
    font: 700 14px monospace;
  }
  .item span:last-child {
    font: 500 11px var(--vscode-editor-font-family, monospace);
  }
  .separator {
    height: 1px;
    margin: 3px 0;
    background: var(--nc-border);
  }
  .help {
    margin-top: auto;
    padding: 12px;
    color: var(--nc-muted);
    border-top: 1px solid var(--nc-border);
    font: 9px/1.5 var(--vscode-editor-font-family, monospace);
  }
  .stage {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }
  .canvas {
    position: absolute;
    inset: 0;
    overflow: hidden;
    cursor: grab;
    background-color: var(--nc-bg);
    background-image:
      linear-gradient(color-mix(in srgb, var(--nc-muted) 18%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--nc-muted) 18%, transparent) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .content {
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
  .connection {
    pointer-events: stroke;
    cursor: pointer;
  }
  .connection-label {
    font: 10px var(--vscode-editor-font-family, monospace);
    fill: var(--nc-muted);
    text-anchor: middle;
    pointer-events: auto;
    cursor: pointer;
  }
  .vlan {
    position: absolute;
    z-index: 1;
    border: 2px dashed var(--vlan-color);
    border-radius: 8px;
    background: color-mix(in srgb, var(--vlan-color) 8%, transparent);
    cursor: move;
    user-select: none;
  }
  .vlan.selected {
    outline: 2px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 2px;
  }
  .vlan-label {
    display: inline-block;
    padding: 3px 8px;
    color: var(--vlan-color);
    border-radius: 0 0 6px 0;
    background: color-mix(in srgb, var(--vlan-color) 20%, transparent);
    font: 600 10px var(--vscode-editor-font-family, monospace);
    letter-spacing: 0.06em;
  }
  .network-node {
    position: absolute;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 100px;
    color: var(--node-color);
    transform: translate(-50%, -50%);
    cursor: grab;
    user-select: none;
  }
  .node-card {
    display: grid;
    place-items: center;
    width: 54px;
    height: 48px;
    border: 1px solid currentColor;
    border-radius: 8px;
    background: var(--nc-card);
    box-shadow: 0 0 12px color-mix(in srgb, var(--node-color) 30%, transparent);
    font: 700 25px monospace;
  }
  .network-node.selected .node-card {
    outline: 2px solid var(--vscode-focusBorder, #007fd4);
    transform: scale(1.08);
  }
  .node-label {
    max-width: 100px;
    overflow: hidden;
    color: var(--nc-muted);
    font: 10px var(--vscode-editor-font-family, monospace);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .server {
    --node-color: var(--vscode-charts-cyan, #06b6d4);
    --item-color: var(--node-color);
  }
  .database {
    --node-color: var(--vscode-charts-purple, #8b5cf6);
    --item-color: var(--node-color);
  }
  .workstation {
    --node-color: var(--vscode-charts-green, #10b981);
    --item-color: var(--node-color);
  }
  .balancer {
    --node-color: var(--vscode-charts-orange, #f97316);
    --item-color: var(--node-color);
  }
  .vlan-item {
    --item-color: #06b6d4;
  }
  .hint {
    position: absolute;
    z-index: 8;
    top: 10px;
    left: 50%;
    padding: 5px 10px;
    color: var(--nc-primary);
    border: 1px solid color-mix(in srgb, var(--nc-primary) 50%, transparent);
    border-radius: 999px;
    background: var(--nc-card);
    transform: translateX(-50%);
    font-size: 10px;
  }
  .toolbar {
    position: absolute;
    z-index: 8;
    bottom: 10px;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 5px;
    border: 1px solid var(--nc-border);
    border-radius: 6px;
    background: color-mix(in srgb, var(--nc-card) 92%, transparent);
    transform: translateX(-50%);
  }
  .toolbar button {
    min-width: 28px;
    height: 27px;
    color: var(--nc-fg);
    border: 0;
    border-radius: 3px;
    background: transparent;
    cursor: pointer;
  }
  .toolbar button:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(255, 255, 255, 0.08));
  }
  .zoom {
    width: 45px;
    color: var(--nc-muted);
    font-size: 10px;
    text-align: center;
  }
  .properties {
    position: absolute;
    z-index: 9;
    top: 0;
    right: 0;
    bottom: 0;
    width: 220px;
    padding: 14px;
    border-left: 1px solid var(--nc-border);
    background: var(--nc-card);
    box-shadow: -5px 0 14px rgba(0, 0, 0, 0.14);
  }
  .properties-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .properties h3 {
    margin: 0;
    font-size: 12px;
  }
  .close {
    color: var(--nc-muted);
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  label {
    display: grid;
    gap: 5px;
    margin-bottom: 12px;
    color: var(--nc-muted);
    font-size: 10px;
  }
  input,
  select {
    width: 100%;
    padding: 6px;
    color: var(--vscode-input-foreground, var(--nc-fg));
    border: 1px solid var(--vscode-input-border, var(--nc-border));
    border-radius: 2px;
    outline: 0;
    background: var(--vscode-input-background, var(--nc-bg));
  }
  .delete {
    width: 100%;
    padding: 6px;
    color: var(--vscode-button-foreground, #fff);
    border: 0;
    border-radius: 2px;
    background: var(--vscode-inputValidation-errorBorder, #be1100);
    cursor: pointer;
  }
  @media (max-width: 700px) {
    .editor {
      grid-template-columns: 58px minmax(0, 1fr);
    }
    .heading,
    .item span:last-child,
    .help {
      display: none;
    }
    .item {
      justify-content: center;
      padding: 7px;
    }
  }
`;
