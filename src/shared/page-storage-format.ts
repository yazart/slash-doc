import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';

export type PageResource = {
  fileName: string;
  data: Uint8Array;
};

type ResourceReader = (fileName: string) => Promise<Uint8Array>;

export function encodeStoredPage(data: unknown): { yaml: string; resources: PageResource[] } {
  const resources = new Map<string, PageResource>();
  const editor = externalizeValue(data, '', resources);
  const yaml = stringify(
    { storage: { format: 'slash-doc-page', version: 1 }, editor },
    { lineWidth: 0, blockQuote: 'literal' },
  );
  return { yaml, resources: [...resources.values()] };
}

export async function decodeStoredPage(source: string, readResource: ResourceReader): Promise<unknown> {
  const parsed = parse(source) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.editor)) throw new Error('В странице отсутствует состояние Editor.js.');
  const metadata = parsed.storage;
  if (!isRecord(metadata) || metadata.format !== 'slash-doc-page') {
    throw new Error('Неизвестный формат страницы Slash Doc.');
  }
  return restoreValue(parsed.editor, readResource);
}

export function isManagedPageResource(fileName: string): boolean {
  return /^(?:image|svg|bpmn)-[0-9a-f]{16}\.[a-z0-9+.-]+$/i.test(fileName);
}

function externalizeValue(value: unknown, key: string, resources: Map<string, PageResource>): unknown {
  if (typeof value === 'string') return externalizeString(value, key, resources);
  if (Array.isArray(value)) return value.map((item) => externalizeValue(item, key, resources));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([name, item]) => [name, externalizeValue(item, name, resources)]),
  );
}

function externalizeString(value: string, key: string, resources: Map<string, PageResource>): string {
  const withImages = value.replaceAll(
    /data:(image\/[^;,\s]+)(?:;[^,\s]*)?;base64,([a-z0-9+/=]+)/gi,
    (_source: string, mimeType: string, payload: string) => {
      const data = Buffer.from(payload, 'base64');
      return `./${addResource('image', extensionForMime(mimeType), data, resources)}`;
    },
  );
  const trimmed = withImages.trim();
  if (key === 'svg' && /^(?:<\?xml\b[\s\S]*?>\s*)?<svg\b[\s\S]*<\/svg>$/i.test(trimmed)) {
    return `./${addResource('svg', 'svg', Buffer.from(withImages, 'utf8'), resources)}`;
  }
  if (key === 'xml' && /^(?:<\?xml\b[\s\S]*?>\s*)?<[^>]*definitions\b/i.test(trimmed)) {
    return `./${addResource('bpmn', 'bpmn', Buffer.from(withImages, 'utf8'), resources)}`;
  }
  return withImages;
}

function addResource(
  kind: 'image' | 'svg' | 'bpmn',
  extension: string,
  data: Uint8Array,
  resources: Map<string, PageResource>,
): string {
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  const fileName = `${kind}-${hash}.${extension}`;
  resources.set(fileName, { fileName, data });
  return fileName;
}

async function restoreValue(value: unknown, readResource: ResourceReader): Promise<unknown> {
  if (typeof value === 'string') return restoreString(value, readResource);
  if (Array.isArray(value)) return Promise.all(value.map((item) => restoreValue(item, readResource)));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    await Promise.all(
      Object.entries(value).map(async ([name, item]) => [name, await restoreValue(item, readResource)]),
    ),
  );
}

async function restoreString(value: string, readResource: ResourceReader): Promise<string> {
  const document = /^\.\/((?:svg|bpmn)-[0-9a-f]{16}\.(?:svg|bpmn))$/i.exec(value);
  if (document) return restoreString(Buffer.from(await readResource(document[1])).toString('utf8'), readResource);
  const matches = [...value.matchAll(/\.\/(image-[0-9a-f]{16}\.([a-z0-9+.-]+))/gi)];
  if (matches.length === 0) return value;
  const replacements = new Map<string, string>();
  await Promise.all(
    matches.map(async (match) => {
      const reference = match[0];
      if (replacements.has(reference)) return;
      const data = await readResource(match[1]);
      replacements.set(reference, `data:${mimeForExtension(match[2])};base64,${Buffer.from(data).toString('base64')}`);
    }),
  );
  return [...replacements].reduce((result, [reference, uri]) => result.replaceAll(reference, uri), value);
}

function extensionForMime(mimeType: string): string {
  const subtype = mimeType.toLowerCase().replace(/^image\//, '');
  if (subtype === 'svg+xml') return 'svg';
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'vnd.microsoft.icon' || subtype === 'x-icon') return 'ico';
  return /^[a-z0-9+.-]+$/.test(subtype) ? subtype : 'bin';
}

function mimeForExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  if (normalized === 'svg') return 'image/svg+xml';
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg';
  if (normalized === 'ico') return 'image/x-icon';
  return `image/${normalized}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
