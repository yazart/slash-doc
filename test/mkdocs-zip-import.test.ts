import { mkdtemp, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => {
  class Uri {
    readonly path: string;
    readonly fsPath: string;

    constructor(value: string) {
      this.fsPath = value;
      this.path = value;
    }

    static file(value: string) {
      return new Uri(value);
    }

    static joinPath(base: Uri, ...parts: string[]) {
      return new Uri(path.join(base.fsPath, ...parts));
    }

    with(change: { path: string }) {
      return new Uri(change.path);
    }
  }

  return {
    Uri,
    FileType: { File: 1, Directory: 2 },
    workspace: {
      fs: {
        createDirectory: (uri: Uri) => mkdir(uri.fsPath, { recursive: true }),
        readFile: (uri: Uri) => readFile(uri.fsPath),
        writeFile: (uri: Uri, data: Uint8Array) => writeFile(uri.fsPath, data),
        rename: (source: Uri, target: Uri) => rename(source.fsPath, target.fsPath),
        delete: (uri: Uri, options?: { recursive?: boolean }) =>
          options?.recursive ? rm(uri.fsPath, { recursive: true, force: true }) : unlink(uri.fsPath),
        stat: (uri: Uri) => stat(uri.fsPath),
        readDirectory: async (uri: Uri) =>
          Promise.all(
            (await readdir(uri.fsPath, { withFileTypes: true })).map(async (entry) => [
              entry.name,
              entry.isDirectory() ? 2 : 1,
            ]),
          ),
      },
    },
  };
});

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('MkDocs ZIP import', () => {
  it('uses mkdocs nav, preserves nesting and stores image resources beside YAML pages', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'slash-doc-mkdocs-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(path.join(projectRoot, '.slash-doc', 'docs', 'pages'), { recursive: true });
    await writeFile(path.join(projectRoot, '.slash-doc', 'docs', 'menu.json'), '{"items":[]}');
    const archive = zipSync({
      'sample/mkdocs.yml': new TextEncoder().encode(
        'site_name: Sample\nnav:\n  - Home: index.md\n  - Guide:\n      - Overview: guide/index.md\n      - Setup: guide/setup.md\n',
      ),
      'sample/docs/index.md': new TextEncoder().encode('# Home\n\n![Logo](images/logo.png)'),
      'sample/docs/images/logo.png': new TextEncoder().encode('png-image'),
      'sample/docs/guide/index.md': new TextEncoder().encode('# Overview'),
      'sample/docs/guide/setup.md': new TextEncoder().encode(
        '!!! warning "Careful"\n\n    Keep this.\n\n- [x] Installed\n- [ ] Configured',
      ),
    });
    const vscode = await import('vscode');
    const { importMkDocsZip } = await import('../src/extension/mkdocs-zip-import');
    const result = await importMkDocsZip(vscode.Uri.file(projectRoot), archive);
    const menu = JSON.parse(await readFile(path.join(projectRoot, '.slash-doc', 'docs', 'menu.json'), 'utf8'));

    expect(result.pageCount).toBe(4);
    expect(menu.items.map((item: { title: string }) => item.title)).toEqual(['Home', 'Guide']);
    expect(menu.items[1].children.map((item: { title: string }) => item.title)).toEqual(['Overview', 'Setup']);
    const homeRoot = path.join(projectRoot, '.slash-doc', 'docs', 'pages', menu.items[0].id);
    const homeFiles = await readdir(homeRoot);
    expect(homeFiles).toContain('content.yaml');
    expect(homeFiles.some((file) => /^image-[0-9a-f]{16}\.png$/.test(file))).toBe(true);
    const setupYaml = await readFile(
      path.join(projectRoot, '.slash-doc', 'docs', 'pages', menu.items[1].children[1].id, 'content.yaml'),
      'utf8',
    );
    expect(setupYaml).toContain('type: mkdocsAdmonition');
    expect(setupYaml).toContain('type: mkdocsChecklist');
  });
});
