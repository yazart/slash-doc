import * as vscode from 'vscode';
import { getCustomAddonWebviewModules } from './filesystem';
import type { DocumentationPageLink, SlashDocSettings } from './types';
import { escapeScriptJson, getNonce } from './utils';

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri | undefined,
  initialData: unknown,
  settings: SlashDocSettings,
  pages: DocumentationPageLink[],
  currentPageId: string | undefined,
  focusEditor: boolean,
): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'slash-doc.svg'));
  const nonce = getNonce();
  const initialDataJson = escapeScriptJson(initialData);
  const settingsJson = escapeScriptJson(settings);
  const pagesJson = escapeScriptJson(pages);
  const currentPageIdJson = escapeScriptJson(currentPageId ?? null);
  const focusEditorJson = escapeScriptJson(focusEditor);
  const customAddonsJson = escapeScriptJson(
    getCustomAddonWebviewModules(webview, extensionUri, workspaceRoot, settings),
  );

  return /* html */ `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource};">
    <link rel="stylesheet" href="${styleUri}">
    <title>Slash Doc</title>
    <style>
      :root {
        --surface: var(--vscode-sideBar-background, var(--vscode-editor-background));
        --surface-raised: var(--vscode-editorWidget-background, var(--vscode-editor-background));
        --border: var(--vscode-panel-border, color-mix(in srgb, var(--vscode-editor-foreground) 16%, transparent));
        --focus-ring: var(--vscode-focusBorder, var(--vscode-button-background));

        --sl-font-sans: var(--vscode-font-family);
        --sl-font-size-small: var(--vscode-font-size);
        --sl-font-size-medium: var(--vscode-font-size);
        --sl-font-weight-normal: 400;
        --sl-font-weight-semibold: 600;
        --sl-input-height-small: 26px;
        --sl-line-height-small: 1;
        --sl-line-height-normal: 1;
        --sl-spacing-2x-small: 4px;
        --sl-spacing-x-small: 6px;
        --sl-spacing-small: 8px;
        --sl-border-radius-small: 2px;
        --sl-border-radius-medium: 2px;
        --sl-focus-ring-color: var(--focus-ring);
        --sl-focus-ring-width: 1px;
        --sl-focus-ring-offset: 1px;

        --sl-color-primary-600: var(--vscode-button-background);
        --sl-color-primary-700: var(--vscode-button-hoverBackground, var(--vscode-button-background));
        --sl-color-primary-500: var(--vscode-button-background);
        --sl-color-neutral-0: var(--vscode-button-foreground);
        --sl-color-neutral-50: var(--vscode-input-background, var(--surface-raised));
        --sl-color-neutral-100: var(--vscode-input-background, var(--surface-raised));
        --sl-color-neutral-200: var(--vscode-input-border, var(--border));
        --sl-color-neutral-300: var(--vscode-input-border, var(--border));
        --sl-color-neutral-600: var(--vscode-foreground);
        --sl-color-neutral-700: var(--vscode-foreground);
        --sl-color-neutral-800: var(--vscode-foreground);
        --sl-color-neutral-900: var(--vscode-foreground);

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

      sl-button::part(base) {
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

      sl-button::part(label) {
        padding: 0;
      }

      sl-button[variant="default"]::part(base) {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      sl-button[variant="default"]::part(base):hover {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      sl-button[variant="primary"]::part(base) {
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
      }

      sl-button[variant="default"]::part(base) {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      sl-button[variant="default"]::part(base):hover {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      sl-button[variant="primary"]::part(base):hover {
        color: var(--vscode-button-foreground);
        border-color: var(--vscode-button-border, transparent);
        background: var(--vscode-button-hoverBackground);
      }

      sl-button[variant="default"]::part(base) {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryBackground, var(--vscode-input-background));
      }

      sl-button[variant="default"]::part(base):hover {
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border-color: var(--vscode-button-border, var(--vscode-input-border, transparent));
        background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground));
      }

      sl-button::part(base):focus-visible {
        outline: 1px solid var(--focus-ring);
        outline-offset: 2px;
      }

      #editor {
        box-sizing: content-box;
        width: min(860px, calc(100vw - 24px));
        min-height: calc(100vh - 72px);
        margin: 48px auto 24px;
        padding: 20px 12px 48px;
        border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 7%, transparent);
        border-radius: 6px;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 35%, var(--vscode-editor-background));
      }

      .ce-block__content,
      .ce-toolbar__content {
        max-width: 760px;
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
        color: var(--vscode-dropdown-foreground, var(--vscode-foreground)) !important;
        border-color: var(--vscode-dropdown-border, var(--vscode-panel-border, var(--border))) !important;
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
        cursor: pointer;
      }

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
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="toolbar">
        <h1 class="title">
          <span class="title-icon" aria-hidden="true"></span>
          <span>Slash Doc</span>
        </h1>
        <div class="header-inline-tools" id="header-inline-tools" aria-label="Инструменты форматирования"></div>
        <div class="export-actions">
          <button class="export-button" type="button" id="export-html">HTML</button>
          <button class="export-button" type="button" id="export-md">MD</button>
        </div>
      </header>
      <section id="editor" aria-label="Редактор документа"></section>
    </main>
    <script nonce="${nonce}">
      window.__SLASH_DOC_INITIAL_DATA__ = ${initialDataJson};
      window.__SLASH_DOC_SETTINGS__ = ${settingsJson};
      window.__SLASH_DOC_CUSTOM_ADDONS__ = ${customAddonsJson};
      window.__SLASH_DOC_PAGES__ = ${pagesJson};
      window.__SLASH_DOC_CURRENT_PAGE_ID__ = ${currentPageIdJson};
      window.__SLASH_DOC_FOCUS_EDITOR__ = ${focusEditorJson};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
