import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CustomBlockExporter } from '../extension/document-export';
import { isRecord } from '../extension/utils';

export function createFileSystemCustomBlockExporter(addonsRoot: string): CustomBlockExporter {
  return async (block, format, settings) => {
    const type = typeof block.type === 'string' ? block.type : '';
    const addon = settings.customEditorAddons.find((item) => item.enabled && item.toolName === type);
    if (!addon) return undefined;

    const addonPath = resolveInside(addonsRoot, addon.file);
    await access(addonPath);
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

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, relativePath);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}/`)) {
    throw new Error(`Путь аддона выходит за пределы каталога: ${relativePath}`);
  }
  return candidate;
}
