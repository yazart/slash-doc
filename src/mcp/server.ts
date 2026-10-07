import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';
import { compileDocumentation } from '../compiler/documentation-compiler';
import { flattenMcpMenu, type MovePosition } from './menu';
import { SlashDocRepository } from './repository';

const pageId = z.string().min(1).describe('Идентификатор страницы из list_pages');
const editorContent = z
  .object({ blocks: z.array(z.record(z.string(), z.unknown())) })
  .passthrough()
  .describe('Полное состояние Editor.js');
const editorBlock = z.object({ type: z.string().min(1), data: z.record(z.string(), z.unknown()) }).passthrough();

export function createSlashDocMcpServer(repository: SlashDocRepository): McpServer {
  const server = new McpServer({ name: 'slash-doc', version: '0.0.1' });
  registerResources(server, repository);
  registerReadTools(server, repository);
  registerWriteTools(server, repository);
  registerCompileTool(server, repository);
  return server;
}

function registerResources(server: McpServer, repository: SlashDocRepository): void {
  server.registerResource(
    'slash-doc-menu',
    'slash-doc://menu',
    { title: 'Дерево документации Slash Doc', mimeType: 'application/json' },
    async (uri) => resource(uri, await repository.listPages()),
  );

  server.registerResource(
    'slash-doc-page',
    new ResourceTemplate('slash-doc://pages/{pageId}', {
      list: async () => ({
        resources: flattenMcpMenu(await repository.listPages()).map((page) => ({
          uri: `slash-doc://pages/${encodeURIComponent(page.id)}`,
          name: page.title,
          title: page.path.join(' / '),
          mimeType: 'application/json',
        })),
      }),
      complete: {
        pageId: async (value) =>
          flattenMcpMenu(await repository.listPages())
            .filter(
              (page) =>
                page.id.includes(value) || page.title.toLocaleLowerCase('ru').includes(value.toLocaleLowerCase('ru')),
            )
            .slice(0, 50)
            .map((page) => page.id),
      },
    }),
    { title: 'Страница Slash Doc', mimeType: 'application/json' },
    async (uri, variables) => resource(uri, await repository.readPage(String(variables.pageId))),
  );
}

function registerReadTools(server: McpServer, repository: SlashDocRepository): void {
  server.registerTool(
    'list_pages',
    {
      title: 'Список страниц Slash Doc',
      description: 'Возвращает иерархию страниц и плоский список с путями.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const tree = await repository.listPages();
      return toolResult({ tree, pages: flattenMcpMenu(tree) });
    },
  );

  server.registerTool(
    'read_page',
    {
      title: 'Прочитать страницу Slash Doc',
      description: 'Возвращает метаданные страницы и полное состояние Editor.js, включая восстановленные ресурсы.',
      inputSchema: z.object({ pageId }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ pageId: id }) => toolResult(await repository.readPage(id)),
  );

  server.registerTool(
    'search_pages',
    {
      title: 'Поиск по Slash Doc',
      description: 'Ищет текст в названиях и содержимом всех страниц.',
      inputSchema: z.object({
        query: z.string().min(2),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, limit }) => toolResult({ results: await repository.search(query, limit) }),
  );
}

function registerWriteTools(server: McpServer, repository: SlashDocRepository): void {
  server.registerTool(
    'create_page',
    {
      title: 'Создать страницу Slash Doc',
      description: 'Создаёт корневую или дочернюю страницу. Без content создаётся заголовок и пустой paragraph.',
      inputSchema: z.object({
        title: z.string().min(1),
        parentId: pageId.optional(),
        content: editorContent.optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ title, parentId, content }) => toolResult(await repository.createPage(title, parentId, content)),
  );

  server.registerTool(
    'replace_page',
    {
      title: 'Заменить содержимое страницы Slash Doc',
      description: 'Полностью заменяет состояние Editor.js указанной страницы.',
      inputSchema: z.object({ pageId, content: editorContent }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ pageId: id, content }) => {
      await repository.replacePage(id, content);
      return toolResult({ pageId: id, updated: true });
    },
  );

  server.registerTool(
    'append_blocks',
    {
      title: 'Добавить блоки на страницу Slash Doc',
      description: 'Добавляет Editor.js-блоки в конец существующей страницы.',
      inputSchema: z.object({ pageId, blocks: z.array(editorBlock).min(1) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ pageId: id, blocks }) => toolResult({ pageId: id, ...(await repository.appendBlocks(id, blocks)) }),
  );

  server.registerTool(
    'rename_page',
    {
      title: 'Переименовать страницу Slash Doc',
      description: 'Меняет название в меню и первый header страницы.',
      inputSchema: z.object({ pageId, title: z.string().min(1) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ pageId: id, title }) => {
      await repository.renamePage(id, title);
      return toolResult({ pageId: id, title });
    },
  );

  server.registerTool(
    'move_page',
    {
      title: 'Переместить страницу Slash Doc',
      description: 'Перемещает страницу в корень, внутрь другой страницы, до или после неё.',
      inputSchema: z.object({
        pageId,
        targetId: pageId.optional(),
        position: z.enum(['before', 'inside', 'after', 'root']),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ pageId: id, targetId, position }) => {
      await repository.movePage(id, targetId, position as MovePosition);
      return toolResult({ pageId: id, targetId, position });
    },
  );

  server.registerTool(
    'delete_page',
    {
      title: 'Удалить страницу Slash Doc',
      description: 'Удаляет страницу, все дочерние страницы и их файлы.',
      inputSchema: z.object({ pageId }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ pageId: id }) => toolResult(await repository.deletePage(id)),
  );
}

function registerCompileTool(server: McpServer, repository: SlashDocRepository): void {
  server.registerTool(
    'compile_documentation',
    {
      title: 'Собрать документацию Slash Doc',
      description: 'Компилирует всю документацию в статический HTML-сайт или иерархию Markdown.',
      inputSchema: z.object({
        format: z.enum(['html', 'md']).default('html'),
        outputRoot: z.string().optional(),
        projectName: z.string().optional(),
        addonsRoot: z.string().optional(),
        repositoryUrl: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ format, outputRoot, projectName, addonsRoot, repositoryUrl }) =>
      toolResult(
        await compileDocumentation({
          projectRoot: repository.projectRoot,
          format,
          outputRoot,
          projectName,
          addonsRoot,
          repositoryUrl,
        }),
      ),
  );
}

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function resource(uri: URL, value: unknown) {
  return {
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }],
  };
}
