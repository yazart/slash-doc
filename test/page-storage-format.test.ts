import { describe, expect, it } from 'vitest';
import { decodeStoredPage, encodeStoredPage, isManagedPageResource } from '../src/shared/page-storage-format';

const image = 'data:image/png;base64,aGVsbG8=';

describe('YAML page storage', () => {
  it('extracts static data to stable files and restores Editor.js state', async () => {
    const data = {
      blocks: [
        { type: 'image', data: { file: { url: image } } },
        { type: 'networkCanvas', data: { svg: '<svg><image href="data:image/png;base64,aGVsbG8="/></svg>' } },
        { type: 'bpmnPreview', data: { xml: '<?xml version="1.0"?><bpmn:definitions />' } },
      ],
      version: '2.23.2',
    };
    const stored = encodeStoredPage(data);
    const resources = new Map(stored.resources.map((resource) => [resource.fileName, resource.data]));
    const restored = await decodeStoredPage(stored.yaml, async (fileName) => {
      const resource = resources.get(fileName);
      if (!resource) throw new Error(`Missing resource: ${fileName}`);
      return resource;
    });

    expect(stored.yaml).toContain('format: slash-doc-page');
    expect(stored.yaml).not.toContain('data:image/png;base64');
    expect(stored.resources).toHaveLength(3);
    expect(stored.resources.every((resource) => isManagedPageResource(resource.fileName))).toBe(true);
    expect(restored).toEqual(data);
  });

  it('rejects the removed Markdown front matter storage format', async () => {
    const source = '---\nslashDoc:\n  format: slash-doc-page\n  version: 1\neditor:\n  blocks: []\n---\n\n# Page\n';

    await expect(decodeStoredPage(source, async () => new Uint8Array())).rejects.toBeDefined();
  });
});
