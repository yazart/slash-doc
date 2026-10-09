import { parse, stringify } from 'yaml';

type RecordValue = Record<string, unknown>;
type ResourceReader = (fileName: string) => Promise<Uint8Array>;

export function createBrowserPageStorage(readResource: ResourceReader) {
  let document: RecordValue = {};
  const references = new Map<string, string>();
  const cache = new Map<string, Promise<string>>();

  async function restoreString(value: string): Promise<string> {
    const diagram = /^\.\/((?:svg|bpmn)-[0-9a-f]{16}\.(?:svg|bpmn))$/i.exec(value);
    if (diagram) {
      const restored = await restoreString(new TextDecoder().decode(await readResource(diagram[1])));
      references.set(restored, value);
      return restored;
    }
    let result = value;
    for (const match of value.matchAll(/\.\/(image-[0-9a-f]{16}\.([a-z0-9+.-]+))/gi)) {
      if (!cache.has(match[1])) {
        cache.set(
          match[1],
          readResource(match[1]).then((bytes) => {
            const extension = match[2].toLowerCase();
            const mime = extension === 'svg' ? 'svg+xml' : extension === 'jpg' ? 'jpeg' : extension;
            return `data:image/${mime};base64,${toBase64(bytes)}`;
          }),
        );
      }
      const restored = await cache.get(match[1])!;
      references.set(restored, match[0]);
      result = result.replaceAll(match[0], restored);
    }
    return result;
  }

  async function restore(value: unknown): Promise<unknown> {
    if (typeof value === 'string') return restoreString(value);
    if (Array.isArray(value)) return Promise.all(value.map(restore));
    if (!isRecord(value)) return value;
    return Object.fromEntries(
      await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await restore(item)])),
    );
  }

  function encode(value: unknown): unknown {
    if (typeof value === 'string') {
      if (references.has(value)) return references.get(value);
      return [...references].reduce((text, [restored, reference]) => text.replaceAll(restored, reference), value);
    }
    if (Array.isArray(value)) return value.map(encode);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  }

  return {
    async decode(source: string): Promise<unknown> {
      const parsed: unknown = parse(source);
      if (
        !isRecord(parsed) ||
        !isRecord(parsed.storage) ||
        parsed.storage.format !== 'slash-doc-page' ||
        !isRecord(parsed.editor) ||
        !Array.isArray(parsed.editor.blocks)
      ) {
        throw new Error('Файл не содержит YAML-страницу Slash Doc.');
      }
      document = parsed;
      references.clear();
      cache.clear();
      return restore(parsed.editor);
    },
    encode(data: RecordValue): string {
      const editor = { ...data };
      delete editor.time;
      return stringify({ ...document, editor: encode(editor) }, { lineWidth: 0, blockQuote: 'literal' });
    },
  };
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
