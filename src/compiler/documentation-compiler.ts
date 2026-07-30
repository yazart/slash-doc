import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createFileSystemCustomBlockExporter } from './custom-addon-exporter';
import { exportPageContent, type CustomBlockExporter } from '../extension/document-export';
import { getDocumentationSearchText } from '../extension/documentation-search-text';
import { getDefaultSettings, normalizeSettings } from '../extension/settings';
import { flattenPages, prepareCompiledPage, renderHostHtml } from '../extension/site-renderer';
import type { SlashDocMenuItem } from '../extension/types';
import { isRecord } from '../extension/utils';

export type DocumentationCompilerOptions = {
  projectRoot: string;
  outputRoot?: string;
  addonsRoot?: string;
  projectName?: string;
};

export type DocumentationCompilerResult = {
  indexPath: string;
  outputRoot: string;
  pageCount: number;
};

export async function compileDocumentation(
  options: DocumentationCompilerOptions,
): Promise<DocumentationCompilerResult> {
  const projectRoot = resolve(options.projectRoot);
  const outputRoot = resolve(options.outputRoot ?? resolve(projectRoot, 'slash-doc-site'));
  const docsRoot = resolve(projectRoot, '.slash-doc', 'docs');
  const menu = await readJson(resolve(docsRoot, 'menu.json'), 'Не найдено меню Slash Doc');
  const items = normalizeMenuItems(isRecord(menu) ? menu.items : undefined);
  const pages = flattenPages(items);
  const pageIds = new Set(pages.map((page) => page.id));
  const settings = await readCompilerSettings(projectRoot);
  const customExporter = options.addonsRoot
    ? createFileSystemCustomBlockExporter(resolve(options.addonsRoot))
    : undefined;
  const searchIndex: Array<{ pageId: string; title: string; text: string }> = [];
  const pagesOutputRoot = resolve(outputRoot, 'pages');

  await rm(pagesOutputRoot, { recursive: true, force: true });
  await mkdir(pagesOutputRoot, { recursive: true });
  for (const page of pages) {
    const data = await readPage(docsRoot, page);
    searchIndex.push({ pageId: page.id, title: page.title, text: getDocumentationSearchText(data) });
    await writeCompiledPage(outputRoot, page, pageIds, data, settings, customExporter);
  }

  const indexPath = resolve(outputRoot, 'index.html');
  const projectName = options.projectName?.trim() || basename(projectRoot) || 'Документация';
  await writeFile(indexPath, renderHostHtml(projectName, items, pages[0]?.id, searchIndex), 'utf8');
  return { indexPath, outputRoot, pageCount: pages.length };
}

async function writeCompiledPage(
  outputRoot: string,
  page: SlashDocMenuItem,
  pageIds: Set<string>,
  data: unknown,
  settings: ReturnType<typeof getDefaultSettings>,
  customExporter: CustomBlockExporter | undefined,
): Promise<void> {
  const exported = await exportPageContent(data, 'html', settings, customExporter);
  const outputPath = resolveInside(resolve(outputRoot, 'pages'), `${page.id}.html`);
  await writeFile(outputPath, prepareCompiledPage(exported, page.id, pageIds), 'utf8');
}

async function readPage(docsRoot: string, page: SlashDocMenuItem): Promise<unknown> {
  const contentPath = resolveInside(resolve(docsRoot, 'pages'), page.file);
  try {
    return JSON.parse(await readFile(contentPath, 'utf8')) as unknown;
  } catch (error) {
    if (isMissingFile(error)) {
      return {
        time: Date.now(),
        blocks: [{ type: 'header', data: { text: page.title, level: 2 } }],
        version: '2.23.2',
      };
    }
    throw error;
  }
}

async function readCompilerSettings(projectRoot: string): Promise<ReturnType<typeof getDefaultSettings>> {
  try {
    return normalizeSettings(JSON.parse(await readFile(resolve(projectRoot, '.slash-doc', 'sdsettings.json'), 'utf8')));
  } catch (error) {
    if (isMissingFile(error)) return getDefaultSettings();
    throw error;
  }
}

async function readJson(filePath: string, missingMessage: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    if (isMissingFile(error)) throw new Error(`${missingMessage}: ${filePath}`);
    throw error;
  }
}

function normalizeMenuItems(value: unknown): SlashDocMenuItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => {
    const id = typeof item.id === 'string' && item.id.trim() ? item.id : '';
    if (!id || /[\\/]/.test(id)) throw new Error(`Некорректный идентификатор страницы: ${id || '(пусто)'}`);
    return {
      id,
      title: typeof item.title === 'string' ? item.title : 'Без названия',
      file: typeof item.file === 'string' ? item.file : `${id}/content.json`,
      children: normalizeMenuItems(item.children),
    };
  });
}

function resolveInside(root: string, relativePath: string): string {
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, relativePath);
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}/`)) {
    throw new Error(`Путь выходит за пределы документации: ${relativePath}`);
  }
  return candidate;
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
