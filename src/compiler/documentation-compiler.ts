import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  createDocumentationTree,
  getMarkdownPagePath,
  renderMarkdownContents,
  rewriteMarkdownPageLinks,
} from '../shared/documentation-tree';
import { extractEmbeddedImages } from '../shared/embedded-images';
import { decodeStoredPage } from '../shared/page-storage-format';
import { createFileSystemCustomBlockExporter } from './custom-addon-exporter';
import { exportPageContent, type CustomBlockExporter } from '../extension/document-export';
import { getDocumentationSearchText } from '../extension/documentation-search-text';
import { getDefaultSettings, normalizeSettings } from '../extension/settings';
import { flattenPages, prepareCompiledPage, renderHostHtml } from '../extension/site-renderer';
import type { SlashDocMenuItem } from '../extension/types';
import { isRecord } from '../extension/utils';
import { readPageRevisionMetadata, resolvePageRevisionFile, resolvePageYamlFile } from '../shared/page-revision';

export type DocumentationCompilerOptions = {
  projectRoot: string;
  outputRoot?: string;
  addonsRoot?: string;
  projectName?: string;
  format?: 'html' | 'md';
  repositoryUrl?: string;
  defaultBranch?: string;
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
  const format = options.format ?? 'html';
  const defaultDirectory = format === 'html' ? 'slash-doc-site' : 'slash-doc-markdown';
  const outputRoot = resolve(options.outputRoot ?? resolve(projectRoot, defaultDirectory));
  const docsRoot = resolve(projectRoot, '.slash-doc', 'docs');
  const menu = await readJson(resolve(docsRoot, 'menu.json'), 'Не найдено меню Slash Doc');
  const items = normalizeMenuItems(isRecord(menu) ? menu.items : undefined);
  const pages = flattenPages(items);
  const settings = await readCompilerSettings(projectRoot);
  const customExporter = options.addonsRoot
    ? createFileSystemCustomBlockExporter(resolve(options.addonsRoot))
    : undefined;
  if (format === 'md') {
    return compileMarkdownDocumentation(outputRoot, docsRoot, items, settings, customExporter);
  }

  const pageIds = new Set(pages.map((page) => page.id));
  const searchIndex: Array<{ pageId: string; title: string; text: string }> = [];
  const pagesOutputRoot = resolve(outputRoot, 'pages');

  await rm(pagesOutputRoot, { recursive: true, force: true });
  await mkdir(pagesOutputRoot, { recursive: true });
  for (const page of pages) {
    const data = await readPage(docsRoot, page);
    const revisionFile = await resolvePageRevisionFile(projectRoot, page.id);
    const revision = await readPageRevisionMetadata(
      projectRoot,
      revisionFile,
      options.repositoryUrl ?? settings.exportOptions.repositoryUrl,
      resolvePageYamlFile(projectRoot, page.id),
      options.defaultBranch ?? settings.exportOptions.defaultBranch,
    );
    searchIndex.push({ pageId: page.id, title: page.title, text: getDocumentationSearchText(data) });
    await writeCompiledPage(outputRoot, page, pageIds, data, settings, customExporter, revision);
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
  revision: Awaited<ReturnType<typeof readPageRevisionMetadata>>,
): Promise<void> {
  const exported = await exportPageContent(data, 'html', settings, customExporter);
  const outputPath = resolveInside(resolve(outputRoot, 'pages'), `${page.id}.html`);
  const html = prepareCompiledPage(exported, page.id, pageIds, revision);
  const result = settings.exportOptions.separateFiles
    ? extractEmbeddedImages(html, `${page.id}-image`)
    : { content: html, images: [] };
  await writeFile(outputPath, result.content, 'utf8');
  await Promise.all(
    result.images.map((image) => writeFile(resolveInside(resolve(outputRoot, 'pages'), image.fileName), image.data)),
  );
}

async function compileMarkdownDocumentation(
  outputRoot: string,
  docsRoot: string,
  items: SlashDocMenuItem[],
  settings: ReturnType<typeof getDefaultSettings>,
  customExporter: CustomBlockExporter | undefined,
): Promise<DocumentationCompilerResult> {
  const pages = createDocumentationTree(items);
  await mkdir(outputRoot, { recursive: true });
  for (const current of pages) {
    const pageRoot = resolveInside(outputRoot, current.directories.join('/'));
    await mkdir(pageRoot, { recursive: true });
    const data = await readPage(docsRoot, current.page);
    const markdown = rewriteMarkdownPageLinks(
      await exportPageContent(data, 'md', settings, customExporter),
      current,
      pages,
    );
    const result = settings.exportOptions.separateFiles
      ? extractEmbeddedImages(markdown)
      : { content: markdown, images: [] };
    const pageFileName = getMarkdownPagePath(current).at(-1) ?? 'Страница.md';
    await writeFile(resolve(pageRoot, pageFileName), result.content, 'utf8');
    await Promise.all(result.images.map((image) => writeFile(resolve(pageRoot, image.fileName), image.data)));
  }
  const indexPath = resolve(outputRoot, settings.exportOptions.markdownRootFileName);
  await writeFile(indexPath, renderMarkdownContents(items, pages), 'utf8');
  return { indexPath, outputRoot, pageCount: pages.length };
}

async function readPage(docsRoot: string, page: SlashDocMenuItem): Promise<unknown> {
  const pagesRoot = resolve(docsRoot, 'pages');
  const pageRoot = resolveInside(pagesRoot, page.id);
  let storageError: unknown;
  try {
    return await decodeStoredPage(await readFile(resolveInside(pageRoot, 'content.yaml'), 'utf8'), (fileName) =>
      readFile(resolveInside(pageRoot, fileName)),
    );
  } catch (error) {
    storageError = error;
  }
  const legacyFile = page.file.endsWith('.json') ? page.file : `${page.id}/content.json`;
  try {
    return JSON.parse(await readFile(resolveInside(pagesRoot, legacyFile), 'utf8')) as unknown;
  } catch (legacyError) {
    if (!isMissingFile(legacyError)) throw legacyError;
    if (!isMissingFile(storageError)) throw storageError;
    return {
      blocks: [{ type: 'header', data: { text: page.title, level: 2 } }],
      version: '2.23.2',
    };
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
      file: typeof item.file === 'string' ? item.file : `${id}/content.yaml`,
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
