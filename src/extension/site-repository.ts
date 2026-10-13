import { escapeAttribute } from './utils';

export type RepositoryLinkOptions = {
  showRepositoryLink?: boolean;
  repositoryUrl?: string;
};

export function renderRepositoryLink(options: RepositoryLinkOptions): string {
  const url = options.repositoryUrl?.trim();
  if (!options.showRepositoryLink || !url) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
  } catch {
    return '';
  }
  return `<a class="documentation-repository" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">Репозиторий</a>`;
}
