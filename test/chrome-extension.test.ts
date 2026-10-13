import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { getGitLabPageLocation, getRawFileUrl } from '../src/chrome/gitlab-location';
import { createBrowserPageStorage } from '../src/chrome/browser-page-storage';

describe('GitLab Chrome extension', () => {
  it('activates only on a Slash Doc YAML single-file edit URL', () => {
    const prefix = 'https://gitlab.example/group/project/-/';
    const target = 'feature%2Fdocs/.slash-doc/docs/pages/api/content.yaml';
    expect(getGitLabPageLocation(`${prefix}edit/${target}`)).toMatchObject({ ref: 'feature/docs', pageId: 'api' });
    expect(getGitLabPageLocation(`${prefix}blob/${target}`)).toBeUndefined();
    expect(getGitLabPageLocation(`${prefix}edit/main/other/content.yaml`)).toBeUndefined();
    expect(getGitLabPageLocation(`${prefix}edit/main/.slash-doc/docs/pages/api/content.json`)).toBeUndefined();
    expect(getGitLabPageLocation(`${prefix}edit/main/.slash-doc/docs/pages/api/content.yaml.bak`)).toBeUndefined();
    expect(getGitLabPageLocation('not a URL')).toBeUndefined();
  });

  it('preserves nested GitLab installations, ref names and resource paths', () => {
    const location = getGitLabPageLocation(
      'https://gitlab.example/gitlab/group/project/-/edit/feature%2Fdocs/.slash-doc/docs/pages/api/content.yaml',
    )!;
    expect(getRawFileUrl(location, '.slash-doc/docs/pages/api/image-1234567890abcdef.png')).toBe(
      'https://gitlab.example/gitlab/group/project/-/raw/feature%2Fdocs/.slash-doc/docs/pages/api/image-1234567890abcdef.png',
    );
  });

  it('round-trips existing resource references and stores new resources in the single YAML file', async () => {
    const files: Record<string, string> = {
      'image-1234567890abcdef.png': 'picture',
      'svg-1234567890abcdef.svg':
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="./image-1234567890abcdef.png"/></svg>',
    };
    const storage = createBrowserPageStorage(async (name) => new TextEncoder().encode(files[name]));
    const source = `storage:\n  format: slash-doc-page\n  version: 1\ncustom: preserved\neditor:\n  blocks:\n    - type: image\n      data:\n        file:\n          url: ./image-1234567890abcdef.png\n    - type: mermaid\n      data:\n        svg: ./svg-1234567890abcdef.svg\n`;
    const editor = (await storage.decode(source)) as { blocks: any[]; time?: number };
    expect(editor.blocks[0].data.file.url).toBe('data:image/png;base64,cGljdHVyZQ==');
    expect(editor.blocks[1].data.svg).toContain('data:image/png;base64,cGljdHVyZQ==');
    editor.time = 123;
    editor.blocks.push({ type: 'image', data: { file: { url: 'data:image/png;base64,bmV3' } } });
    const output = parse(storage.encode(editor));
    expect(output.custom).toBe('preserved');
    expect(output.editor.time).toBeUndefined();
    expect(output.editor.blocks[0].data.file.url).toBe('./image-1234567890abcdef.png');
    expect(output.editor.blocks[1].data.svg).toBe('./svg-1234567890abcdef.svg');
    expect(output.editor.blocks[2].data.file.url).toBe('data:image/png;base64,bmV3');
  });

  it('rejects unrelated YAML and missing resources without producing replacement data', async () => {
    const storage = createBrowserPageStorage(async () => {
      throw new Error('Resource missing');
    });
    await expect(storage.decode('other: value')).rejects.toThrow('YAML-страницу');
    await expect(
      storage.decode(
        'storage: {format: slash-doc-page}\neditor:\n  blocks: [{data: {svg: ./svg-1234567890abcdef.svg}}]',
      ),
    ).rejects.toThrow('Resource missing');
  });
});
