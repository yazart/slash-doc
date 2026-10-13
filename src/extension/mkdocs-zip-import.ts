import * as path from 'node:path';
import * as vscode from 'vscode';
import { unzipSync } from 'fflate';
import { parse } from 'yaml';
import { importDocumentContent } from './document-import';
import { addChildToMenu, createDefaultPageContent, readMenu, writeMenu } from './pages';
import { saveStoredPageContent } from './page-storage';
import type { SlashDocMenuItem } from './types';
import { createPageId, isRecord } from './utils';

type ZipFiles = Map<string, Uint8Array>;
type ImportedPage = { item: SlashDocMenuItem; content: unknown; pages: ImportedPage[] };
type FolderNode = { name: string; indexPath?: string; files: string[]; folders: Map<string, FolderNode> };

export type MkDocsZipImportResult = { firstPageId?: string; pageCount: number };

export async function importMkDocsZip(
  workspaceRoot: vscode.Uri,
  archive: Uint8Array,
  parentId?: string,
): Promise<MkDocsZipImportResult> {
  if (archive.byteLength > 100 * 1024 * 1024) {
    throw new Error('ZIP-архив превышает допустимый размер 100 МБ.');
  }
  const files = readZipFiles(archive);
  const configurationPath = findMkDocsConfiguration(files);
  const configuration = readConfiguration(files, configurationPath);
  const projectRoot = configurationPath ? path.posix.dirname(configurationPath) : findCommonProjectRoot(files);
  const docsRoot = resolveDocsRoot(files, projectRoot, configuration);
  const markdownPaths = [...files.keys()]
    .filter((file) => isMarkdownFile(file) && isInside(file, docsRoot))
    .sort(compareMarkdownPaths);
  if (markdownPaths.length === 0) throw new Error('В архиве не найдены Markdown-файлы документации.');

  const used = new Set<string>();
  const nav = Array.isArray(configuration.nav) ? buildNavPages(configuration.nav, docsRoot, files, used) : [];
  const remaining = markdownPaths.filter((file) => !used.has(file));
  const pages = [...nav, ...buildFolderPages(remaining, docsRoot, files)];
  const menu = await readMenu(workspaceRoot);
  const items = pages.map((page) => page.item);
  if (parentId) {
    const added = items.map((item) => addChildToMenu(menu.items, parentId, item));
    if (added.some((value) => !value)) menu.items.push(...items.filter((_item, index) => !added[index]));
  } else {
    menu.items.push(...items);
  }
  await Promise.all(
    flattenImportedPages(pages).map((page) => saveStoredPageContent(workspaceRoot, page.item.id, page.content)),
  );
  await writeMenu(workspaceRoot, menu);
  return { firstPageId: items[0]?.id, pageCount: flattenImportedPages(pages).length };
}

function readZipFiles(archive: Uint8Array): ZipFiles {
  const unpacked = unzipSync(archive);
  const entries = Object.entries(unpacked);
  if (entries.length > 5000) throw new Error('ZIP-архив содержит более 5000 файлов.');
  if (entries.reduce((total, [, data]) => total + data.byteLength, 0) > 500 * 1024 * 1024) {
    throw new Error('Распакованный проект превышает допустимый размер 500 МБ.');
  }
  const files = new Map<string, Uint8Array>();
  for (const [rawPath, data] of entries) {
    const normalized = normalizeArchivePath(rawPath);
    if (!normalized || rawPath.endsWith('/') || isIgnoredPath(normalized)) continue;
    files.set(normalized, data);
  }
  return files;
}

function findMkDocsConfiguration(files: ZipFiles): string | undefined {
  return [...files.keys()]
    .filter((file) => /(?:^|\/)mkdocs\.ya?ml$/i.test(file))
    .sort((left, right) => left.split('/').length - right.split('/').length)[0];
}

function findCommonProjectRoot(files: ZipFiles): string {
  const paths = [...files.keys()];
  if (paths.length === 0) return '';
  const firstSegments = new Set(paths.map((file) => file.split('/')[0]));
  return firstSegments.size === 1 && paths.some((file) => file.includes('/')) ? paths[0].split('/')[0] : '';
}

function readConfiguration(files: ZipFiles, configurationPath: string | undefined): Record<string, unknown> {
  if (!configurationPath) return {};
  try {
    const value = parse(new TextDecoder().decode(files.get(configurationPath)));
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function resolveDocsRoot(files: ZipFiles, projectRoot: string, configuration: Record<string, unknown>): string {
  const configured = typeof configuration.docs_dir === 'string' ? configuration.docs_dir : 'docs';
  const candidate = joinArchivePath(projectRoot, configured);
  if ([...files.keys()].some((file) => isMarkdownFile(file) && isInside(file, candidate))) return candidate;
  const docsCandidate = joinArchivePath(projectRoot, 'docs');
  if ([...files.keys()].some((file) => isMarkdownFile(file) && isInside(file, docsCandidate))) return docsCandidate;
  return projectRoot;
}

function buildNavPages(nav: unknown[], docsRoot: string, files: ZipFiles, used: Set<string>): ImportedPage[] {
  return nav.flatMap((entry) => {
    if (typeof entry === 'string') {
      const file = resolveNavPath(entry, docsRoot, files);
      if (!file) return [];
      used.add(file);
      return [createFilePage(file, undefined, files)];
    }
    if (!isRecord(entry)) return [];
    return Object.entries(entry).flatMap(([title, value]) => {
      if (typeof value === 'string') {
        const file = resolveNavPath(value, docsRoot, files);
        if (!file) return [];
        used.add(file);
        return [createFilePage(file, title, files)];
      }
      if (Array.isArray(value)) {
        const children = buildNavPages(value, docsRoot, files, used);
        return children.length > 0 ? [createGroupPage(title, children)] : [];
      }
      return [];
    });
  });
}

function buildFolderPages(markdownPaths: string[], docsRoot: string, files: ZipFiles): ImportedPage[] {
  const root: FolderNode = { name: '', files: [], folders: new Map() };
  for (const file of markdownPaths) {
    const relative = relativeArchivePath(docsRoot, file);
    const parts = relative.split('/');
    const fileName = parts.pop() ?? relative;
    let folder = root;
    for (const part of parts) {
      let child = folder.folders.get(part);
      if (!child) {
        child = { name: part, files: [], folders: new Map() };
        folder.folders.set(part, child);
      }
      folder = child;
    }
    if (/^(index|readme)\.md$/i.test(fileName)) folder.indexPath = file;
    else folder.files.push(file);
  }
  return renderFolder(root, files, true);
}

function renderFolder(folder: FolderNode, files: ZipFiles, root = false): ImportedPage[] {
  const children = [
    ...folder.files.sort(compareMarkdownPaths).map((file) => createFilePage(file, undefined, files)),
    ...[...folder.folders.values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
      .flatMap((child) => renderFolder(child, files)),
  ];
  if (root) return [...(folder.indexPath ? [createFilePage(folder.indexPath, undefined, files)] : []), ...children];
  const title = humanizeFileName(folder.name);
  const page = folder.indexPath ? createFilePage(folder.indexPath, title, files) : createGroupPage(title, []);
  page.item.children.push(...children.map((child) => child.item));
  page.pages.push(...children);
  return [page];
}

function createFilePage(file: string, title: string | undefined, files: ZipFiles): ImportedPage {
  const source = replaceLocalImages(stripFrontMatter(new TextDecoder().decode(files.get(file))), file, files);
  const virtualUri = vscode.Uri.file(`/${file}`);
  const imported = importDocumentContent(source, virtualUri);
  const pageTitle =
    title?.trim() || imported.title || humanizeFileName(path.posix.basename(file, path.posix.extname(file)));
  const id = createPageId();
  return {
    item: { id, title: pageTitle, file: `${id}/content.yaml`, children: [] },
    content: imported.content,
    pages: [],
  };
}

function createGroupPage(title: string, children: ImportedPage[]): ImportedPage {
  const id = createPageId();
  return {
    item: { id, title, file: `${id}/content.yaml`, children: children.map((child) => child.item) },
    content: createDefaultPageContent(title),
    pages: children,
  };
}

function flattenImportedPages(pages: ImportedPage[]): ImportedPage[] {
  const output: ImportedPage[] = [];
  const visit = (page: ImportedPage) => {
    output.push(page);
    page.pages.forEach(visit);
  };
  pages.forEach(visit);
  return output;
}

function replaceLocalImages(markdown: string, sourcePath: string, files: ZipFiles): string {
  return markdown.replaceAll(/(!\[[^\]]*\]\()([^\s)]+)((?:\s+["'][^"']*["'])?\))/g, (full, prefix, target, suffix) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) return full;
    const cleanTarget = decodeUriPath(String(target).split(/[?#]/, 1)[0]);
    const resourcePath = normalizeArchivePath(path.posix.join(path.posix.dirname(sourcePath), cleanTarget));
    const resource = files.get(resourcePath);
    if (!resource) return full;
    const mime = imageMimeType(resourcePath);
    if (!mime) return full;
    return `${prefix}data:${mime};base64,${Buffer.from(resource).toString('base64')}${suffix}`;
  });
}

function resolveNavPath(value: string, docsRoot: string, files: ZipFiles): string | undefined {
  const resolved = normalizeArchivePath(joinArchivePath(docsRoot, decodeUriPath(value.split(/[?#]/, 1)[0])));
  return files.has(resolved) && isMarkdownFile(resolved) ? resolved : undefined;
}

function stripFrontMatter(source: string): string {
  return source.replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, '');
}

function normalizeArchivePath(value: string): string {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\//, '').replace(/^\/+/, '');
  return normalized === '..' || normalized.startsWith('../') ? '' : normalized;
}

function joinArchivePath(...parts: string[]): string {
  return normalizeArchivePath(path.posix.join(...parts.filter(Boolean)));
}

function relativeArchivePath(root: string, file: string): string {
  return root ? path.posix.relative(root, file) : file;
}

function isInside(file: string, root: string): boolean {
  return !root || file === root || file.startsWith(`${root}/`);
}

function isMarkdownFile(file: string): boolean {
  return /\.(?:md|markdown)$/i.test(file);
}

function isIgnoredPath(file: string): boolean {
  return file.split('/').some((part) => part === '__MACOSX' || part.startsWith('.') || part === 'site');
}

function compareMarkdownPaths(left: string, right: string): number {
  const leftIndex = /\/(?:index|readme)\.md$/i.test(`/${left}`) ? 0 : 1;
  const rightIndex = /\/(?:index|readme)\.md$/i.test(`/${right}`) ? 0 : 1;
  return leftIndex - rightIndex || left.localeCompare(right, 'ru');
}

function humanizeFileName(value: string): string {
  const decoded = decodeUriPath(value).replaceAll(/[-_]+/g, ' ').trim();
  return decoded ? decoded.charAt(0).toLocaleUpperCase('ru') + decoded.slice(1) : 'Импортированная страница';
}

function decodeUriPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function imageMimeType(file: string): string | undefined {
  const extension = path.posix.extname(file).toLowerCase();
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
  }[extension];
}
