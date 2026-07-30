import * as vscode from 'vscode';
import { pathToFileURL } from 'node:url';
import { getCustomAddonUri } from './filesystem';
import type { CustomBlockExporter } from './document-export';
import { isRecord } from './utils';

export function createCustomBlockExporter(extensionUri: vscode.Uri, workspaceRoot: vscode.Uri): CustomBlockExporter {
  return async (block, format, settings) => {
    const type = typeof block.type === 'string' ? block.type : '';
    const addon = settings.customEditorAddons.find((item) => item.enabled && item.toolName === type);
    if (!addon) return undefined;

    const addonPath = getCustomAddonUri(extensionUri, workspaceRoot, addon).fsPath;
    const moduleUrl = `${pathToFileURL(addonPath).href}?v=${Date.now()}`;
    const adapterModule = (await import(/* @vite-ignore */ moduleUrl)) as Record<string, unknown>;
    const adapters = isRecord(adapterModule.adapters) ? adapterModule.adapters : {};
    const adapter =
      format === 'html'
        ? (adapterModule.toHtml ?? adapters.html)
        : (adapterModule.toMarkdown ?? adapters.md ?? adapters.markdown);

    if (typeof adapter !== 'function') return undefined;
    return String(await adapter(block.data, { block, settings, format }));
  };
}
