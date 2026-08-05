import { posix } from 'node:path';
import type { SlashDocMenuItem } from '../extension/types';

export type DocumentationTreePage = {
  page: SlashDocMenuItem;
  directories: string[];
};

export function createDocumentationTree(items: SlashDocMenuItem[]): DocumentationTreePage[] {
  return collectPages(items, []);
}

export function renderMarkdownContents(items: SlashDocMenuItem[], pages: DocumentationTreePage[]): string {
  const paths = new Map(pages.map(({ page, directories }) => [page.id, [...directories, 'content.md']]));
  const lines = ['# Содержание', '', ...renderItems(items, paths, 0)];
  return `${lines.join('\n')}\n`;
}

export function rewriteMarkdownPageLinks(
  markdown: string,
  currentPage: DocumentationTreePage,
  pages: DocumentationTreePage[],
): string {
  const targets = new Map(pages.map((item) => [item.page.id, [...item.directories, 'content.md']]));
  const rewrite = (href: string) => {
    const reference = readPageReference(href);
    const target = reference ? targets.get(reference.pageId) : undefined;
    if (!reference || !target) return href;
    const relative = posix.relative(currentPage.directories.join('/'), target.join('/')) || 'content.md';
    return `${encodePath(relative)}${reference.suffix}`;
  };
  return markdown
    .replaceAll(/(\]\()([^\s)]+)(\))/g, (_match, before: string, href: string, after: string) => {
      return `${before}${rewrite(href)}${after}`;
    })
    .replaceAll(/(<a\b[^>]*\bhref=["'])([^"']+)(["'])/gi, (_match, before: string, href: string, after: string) => {
      return `${before}${rewrite(href)}${after}`;
    });
}

function collectPages(items: SlashDocMenuItem[], parents: string[]): DocumentationTreePage[] {
  const used = new Set<string>();
  return items.flatMap((page) => {
    const directory = uniqueDirectoryName(page.title, used);
    const directories = [...parents, directory];
    return [{ page, directories }, ...collectPages(page.children, directories)];
  });
}

function renderItems(items: SlashDocMenuItem[], paths: Map<string, string[]>, depth: number): string[] {
  return items.flatMap((item) => {
    const path = paths.get(item.id) ?? ['content.md'];
    const line = `${'  '.repeat(depth)}- [${escapeMarkdownLabel(item.title)}](${encodePath(path.join('/'))})`;
    return [line, ...renderItems(item.children, paths, depth + 1)];
  });
}

function uniqueDirectoryName(title: string, used: Set<string>): string {
  const base = sanitizeDirectoryName(title);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) candidate = `${base} (${suffix++})`;
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}

function sanitizeDirectoryName(value: string): string {
  const normalized = value
    .normalize('NFC')
    .replaceAll(/[\u0000-\u001f<>:"/\\|?*]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/^[ .]+|[ .]+$/g, '')
    .trim();
  const safe = normalized && !/^\.+$/.test(normalized) ? normalized : 'Страница';
  const portable = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe) ? `_${safe}` : safe;
  return (
    Array.from(portable)
      .slice(0, 120)
      .join('')
      .replaceAll(/[ .]+$/g, '') || 'Страница'
  );
}

function readPageReference(href: string): { pageId: string; suffix: string } | undefined {
  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    // Keep malformed URI escapes unchanged.
  }
  const match = /^slash-doc:\/\/(?:page\/)?([^?#/]+)([?#].*)?$/i.exec(decoded);
  return match ? { pageId: match[1], suffix: match[2] ?? '' } : undefined;
}

function encodePath(value: string): string {
  return value
    .split('/')
    .map((part) => (part === '..' || part === '.' ? part : encodeURIComponent(part)))
    .join('/');
}

function escapeMarkdownLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}
