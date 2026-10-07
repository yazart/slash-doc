import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeStoredPage, encodeStoredPage, isManagedPageResource } from '../shared/page-storage-format';
import { removePageTime } from '../shared/page-content';
import { getDocumentationSearchText } from '../extension/documentation-search-text';
import {
  addMcpPage,
  collectMcpPageIds,
  findMcpPage,
  flattenMcpMenu,
  moveMcpPage,
  normalizeMcpMenu,
  removeMcpPage,
  type McpMenuItem,
  type MovePosition,
} from './menu';

export class SlashDocRepository {
  readonly projectRoot: string;
  private readonly docsRoot: string;
  private mutation = Promise.resolve();

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot);
    this.docsRoot = resolve(this.projectRoot, '.slash-doc', 'docs');
  }

  async listPages(): Promise<McpMenuItem[]> {
    return (await this.readMenu()).items;
  }

  async readPage(pageId: string): Promise<{ page: McpMenuItem; content: unknown }> {
    const menu = await this.readMenu();
    const page = findMcpPage(menu.items, pageId);
    if (!page) throw new Error(`Страница не найдена: ${pageId}`);
    return { page, content: await this.readPageContent(page) };
  }

  async search(
    query: string,
    limit = 20,
  ): Promise<Array<{ pageId: string; title: string; path: string; snippet: string }>> {
    const needle = normalizeText(query);
    if (needle.length < 2) throw new Error('Поисковый запрос должен содержать не менее двух символов.');
    const menu = await this.readMenu();
    const pages = flattenMcpMenu(menu.items);
    const results = await Promise.all(
      pages.map(async (page) => {
        const content = getDocumentationSearchText((await this.readPage(page.id)).content);
        const haystack = normalizeText(`${page.title} ${content}`);
        const index = haystack.indexOf(needle);
        if (index < 0) return undefined;
        return {
          pageId: page.id,
          title: page.title,
          path: page.path.join(' / '),
          snippet: createSnippet(content, Math.max(0, normalizeText(content).indexOf(needle)), needle.length),
          score: normalizeText(page.title).includes(needle) ? 2 : 1,
        };
      }),
    );
    return results
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'ru'))
      .slice(0, Math.max(1, Math.min(limit, 50)))
      .map(({ score: _score, ...item }) => item);
  }

  createPage(title: string, parentId?: string, content?: unknown): Promise<{ pageId: string }> {
    return this.mutate(async () => {
      const normalizedTitle = requireTitle(title);
      const menu = await this.readMenu();
      const pageId = `page-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
      const page: McpMenuItem = { id: pageId, title: normalizedTitle, file: `${pageId}/content.yaml`, children: [] };
      addMcpPage(menu.items, page, parentId);
      await this.savePageContent(pageId, content ?? createPageContent(normalizedTitle));
      await this.writeMenu(menu);
      return { pageId };
    });
  }

  replacePage(pageId: string, content: unknown): Promise<void> {
    return this.mutate(async () => {
      await this.requirePage(pageId);
      validateEditorContent(content);
      await this.savePageContent(pageId, content);
    });
  }

  appendBlocks(pageId: string, blocks: unknown[]): Promise<{ blockCount: number }> {
    return this.mutate(async () => {
      const current = await this.readPage(pageId);
      if (!isRecord(current.content) || !Array.isArray(current.content.blocks)) {
        throw new Error('Страница не содержит корректный массив Editor.js blocks.');
      }
      blocks.forEach(validateBlock);
      const content = { ...current.content, blocks: [...current.content.blocks, ...blocks] };
      await this.savePageContent(pageId, content);
      return { blockCount: content.blocks.length };
    });
  }

  renamePage(pageId: string, title: string): Promise<void> {
    return this.mutate(async () => {
      const normalizedTitle = requireTitle(title);
      const menu = await this.readMenu();
      const page = findMcpPage(menu.items, pageId);
      if (!page) throw new Error(`Страница не найдена: ${pageId}`);
      page.title = normalizedTitle;
      const stored = await this.readPageContent(page);
      await this.savePageContent(pageId, updateFirstHeader(stored, normalizedTitle));
      await this.writeMenu(menu);
    });
  }

  movePage(pageId: string, targetId: string | undefined, position: MovePosition): Promise<void> {
    return this.mutate(async () => {
      const menu = await this.readMenu();
      moveMcpPage(menu.items, pageId, targetId, position);
      await this.writeMenu(menu);
    });
  }

  deletePage(pageId: string): Promise<{ deletedPageIds: string[] }> {
    return this.mutate(async () => {
      const menu = await this.readMenu();
      const removed = removeMcpPage(menu.items, pageId);
      if (!removed) throw new Error(`Страница не найдена: ${pageId}`);
      const deletedPageIds = collectMcpPageIds(removed);
      await this.writeMenu(menu);
      await Promise.all(deletedPageIds.map((id) => rm(this.pageRoot(id), { recursive: true, force: true })));
      return { deletedPageIds };
    });
  }

  private async requirePage(pageId: string): Promise<void> {
    const menu = await this.readMenu();
    if (!findMcpPage(menu.items, pageId)) throw new Error(`Страница не найдена: ${pageId}`);
  }

  private async readMenu(): Promise<{ items: McpMenuItem[] }> {
    try {
      const value = JSON.parse(await readFile(resolve(this.docsRoot, 'menu.json'), 'utf8')) as unknown;
      return { items: normalizeMcpMenu(isRecord(value) ? value.items : undefined) };
    } catch (error) {
      if (isMissing(error)) return { items: [] };
      throw error;
    }
  }

  private async writeMenu(menu: { items: McpMenuItem[] }): Promise<void> {
    await mkdir(this.docsRoot, { recursive: true });
    await atomicWrite(resolve(this.docsRoot, 'menu.json'), `${JSON.stringify(menu, null, 2)}\n`);
  }

  private async readPageContent(page: McpMenuItem): Promise<unknown> {
    const root = this.pageRoot(page.id);
    try {
      const source = await readFile(resolve(root, 'content.yaml'), 'utf8');
      return removePageTime(await decodeStoredPage(source, (name) => readFile(resolveInside(root, name))));
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    try {
      return removePageTime(JSON.parse(await readFile(resolve(root, 'content.json'), 'utf8')));
    } catch (error) {
      if (!isMissing(error)) throw error;
      return createPageContent(page.title);
    }
  }

  private async savePageContent(pageId: string, content: unknown): Promise<void> {
    validateEditorContent(content);
    const root = this.pageRoot(pageId);
    const stored = encodeStoredPage(removePageTime(content));
    await mkdir(root, { recursive: true });
    await Promise.all(stored.resources.map((item) => writeFile(resolve(root, item.fileName), item.data)));
    await atomicWrite(resolve(root, 'content.yaml'), stored.yaml);
    await rm(resolve(root, 'content.json'), { force: true });
    const used = new Set(stored.resources.map((item) => item.fileName));
    const entries = await readdir(root, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && isManagedPageResource(entry.name) && !used.has(entry.name))
        .map((entry) => rm(resolve(root, entry.name), { force: true })),
    );
  }

  private pageRoot(pageId: string): string {
    if (!/^page-[a-z0-9-]+$/i.test(pageId)) throw new Error(`Некорректный идентификатор страницы: ${pageId}`);
    return resolveInside(resolve(this.docsRoot, 'pages'), pageId);
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutation.then(operation, operation);
    this.mutation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function createPageContent(title: string): unknown {
  return {
    version: '2.23.2',
    blocks: [
      { type: 'header', data: { text: escapeHtml(title), level: 2 } },
      { type: 'paragraph', data: { text: '' } },
    ],
  };
}

function updateFirstHeader(content: unknown, title: string): unknown {
  if (!isRecord(content) || !Array.isArray(content.blocks)) return createPageContent(title);
  const blocks = [...content.blocks];
  const first = blocks[0];
  const header = { type: 'header', data: { text: escapeHtml(title), level: 2 } };
  blocks[0] =
    isRecord(first) && first.type === 'header' && isRecord(first.data)
      ? { ...first, data: { ...first.data, text: escapeHtml(title) } }
      : header;
  if (blocks[0] === header && first) blocks.splice(1, 0, first);
  return { ...content, blocks };
}

function validateEditorContent(content: unknown): void {
  if (!isRecord(content) || !Array.isArray(content.blocks)) {
    throw new Error('content должен быть объектом Editor.js с массивом blocks.');
  }
  content.blocks.forEach(validateBlock);
}

function validateBlock(block: unknown): void {
  if (!isRecord(block) || typeof block.type !== 'string' || !isRecord(block.data)) {
    throw new Error('Каждый блок должен содержать строковый type и объект data.');
  }
}

function requireTitle(title: string): string {
  const value = title.trim();
  if (!value) throw new Error('Название страницы не может быть пустым.');
  return value;
}

function resolveInside(root: string, child: string): string {
  const resolvedRoot = resolve(root);
  const result = resolve(resolvedRoot, child);
  if (result !== resolvedRoot && !result.startsWith(`${resolvedRoot}/`)) throw new Error(`Недопустимый путь: ${child}`);
  return result;
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, filePath);
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase('ru').replaceAll(/\s+/g, ' ').trim();
}

function createSnippet(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 80);
  const end = Math.min(content.length, index + Math.max(length, 1) + 80);
  return `${start ? '…' : ''}${content.slice(start, end).trim()}${end < content.length ? '…' : ''}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isMissing(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
