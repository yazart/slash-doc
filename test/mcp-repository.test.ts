import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SlashDocRepository } from '../src/mcp/repository';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Slash Doc MCP repository', () => {
  it('creates, reads, searches, moves, renames, and deletes pages', async () => {
    const projectRoot = await temporaryProject();
    const repository = new SlashDocRepository(projectRoot);
    const parent = await repository.createPage('Архитектура');
    const child = await repository.createPage('API', parent.pageId);

    await repository.appendBlocks(child.pageId, [
      { type: 'paragraph', data: { text: 'Контракт пользовательского сервиса' } },
    ]);
    expect((await repository.search('пользовательского'))[0]).toMatchObject({ pageId: child.pageId, title: 'API' });

    await repository.renamePage(child.pageId, 'REST API');
    await repository.movePage(child.pageId, undefined, 'root');
    const pages = await repository.listPages();
    expect(pages.map((page) => page.title)).toEqual(['Архитектура', 'REST API']);
    expect((await repository.readPage(child.pageId)).content).toMatchObject({ blocks: expect.any(Array) });

    expect(await repository.deletePage(parent.pageId)).toEqual({ deletedPageIds: [parent.pageId] });
    expect(await repository.listPages()).toHaveLength(1);
  });

  it('round-trips embedded resources through YAML page storage', async () => {
    const projectRoot = await temporaryProject();
    const repository = new SlashDocRepository(projectRoot);
    const image = 'data:image/png;base64,aGVsbG8=';
    const created = await repository.createPage('Изображение', undefined, {
      version: '2.23.2',
      blocks: [{ type: 'image', data: { file: { url: image } } }],
    });
    const page = await repository.readPage(created.pageId);
    expect(page.content).toMatchObject({ blocks: [{ data: { file: { url: image } } }] });

    await repository.replacePage(created.pageId, page.content);
    const pageRoot = join(projectRoot, '.slash-doc', 'docs', 'pages', created.pageId);
    expect((await readdir(pageRoot)).some((name) => /^image-[a-f0-9]{16}\.png$/.test(name))).toBe(true);
    expect(await readFile(join(pageRoot, 'content.yaml'), 'utf8')).toContain('storage:');
  });
});

async function temporaryProject(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'slash-doc-mcp-'));
  directories.push(directory);
  return directory;
}
