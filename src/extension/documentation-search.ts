import * as vscode from 'vscode';
import { flattenMenuPages, readMenu, readPageContent } from './pages';
import { isRecord, stripHtml } from './utils';

export type DocumentationSearchResult = {
  pageId: string;
  title: string;
  snippet: string;
};

export async function searchDocumentation(
  workspaceRoot: vscode.Uri,
  query: string,
): Promise<DocumentationSearchResult[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return [];
  const terms = normalizedQuery.split(' ').filter(Boolean);
  const pages = flattenMenuPages((await readMenu(workspaceRoot)).items);
  const results = await Promise.all(
    pages.map(async (page) => {
      try {
        const data = await readPageContent(workspaceRoot, page.id, page.title);
        const content = getDocumentationSearchText(data);
        const normalizedTitle = normalizeSearchText(page.title);
        const normalizedContent = normalizeSearchText(content);
        if (!terms.every((term) => normalizedTitle.includes(term) || normalizedContent.includes(term)))
          return undefined;
        const titleScore =
          normalizedTitle === normalizedQuery ? 120 : normalizedTitle.includes(normalizedQuery) ? 80 : 0;
        const phraseIndex = normalizedContent.indexOf(normalizedQuery);
        const contentIndex = phraseIndex >= 0 ? phraseIndex : firstTermIndex(normalizedContent, terms);
        return {
          pageId: page.id,
          title: page.title,
          snippet: createSnippet(content, contentIndex, normalizedQuery.length),
          score: titleScore + (phraseIndex >= 0 ? 30 : 10) - Math.max(contentIndex, 0) / 10_000,
        };
      } catch {
        return undefined;
      }
    }),
  );

  return results
    .filter((result): result is NonNullable<typeof result> => Boolean(result))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'ru'))
    .slice(0, 50)
    .map(({ pageId, title, snippet }) => ({ pageId, title, snippet }));
}

export function getDocumentationSearchText(data: unknown): string {
  return normalizeContentText(collectText(data));
}

function collectText(value: unknown): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('data:') || value.length > 200_000) return [];
    return [stripHtml(value)];
  }
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, item]) =>
    /^(id|type|version|time|dataUrl|icon|svg)$/i.test(key) ? [] : collectText(item),
  );
}

function normalizeContentText(parts: string[]): string {
  return parts.join(' ').replaceAll(/\s+/g, ' ').trim();
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase('ru').replaceAll(/\s+/g, ' ').trim();
}

function firstTermIndex(content: string, terms: string[]): number {
  const indexes = terms.map((term) => content.indexOf(term)).filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : 0;
}

function createSnippet(content: string, index: number, matchLength: number): string {
  if (!content) return 'Совпадение в названии страницы';
  const radius = 70;
  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + Math.max(matchLength, 1) + radius);
  return `${start > 0 ? '…' : ''}${content.slice(start, end).trim()}${end < content.length ? '…' : ''}`;
}
