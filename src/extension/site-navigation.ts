import type { SlashDocMenuItem, SlashDocSettings } from './types';
import { escapeAttribute, escapeHtml } from './utils';

export type CompiledPageOptions = {
  showCopyHtmlButton?: boolean;
  previousPage?: Pick<SlashDocMenuItem, 'id' | 'title'>;
  nextPage?: Pick<SlashDocMenuItem, 'id' | 'title'>;
};

export function compiledPageOptions(
  pages: SlashDocMenuItem[],
  pageId: string,
  settings: SlashDocSettings['exportOptions'],
): CompiledPageOptions {
  const index = pages.findIndex((page) => page.id === pageId);
  return {
    showCopyHtmlButton: settings.showCopyHtmlButton,
    previousPage: settings.showPageNavigation && index > 0 ? pages[index - 1] : undefined,
    nextPage: settings.showPageNavigation && index >= 0 ? pages[index + 1] : undefined,
  };
}

export function renderPageNavigation(options: CompiledPageOptions): string {
  if (!options.previousPage && !options.nextPage) return '';
  const link = (page: CompiledPageOptions['previousPage'], relation: 'prev' | 'next', label: string) =>
    page
      ? `<a href="${escapeAttribute(`${encodeURIComponent(page.id)}.html`)}" rel="${relation}"><span>${label}</span><strong>${escapeHtml(page.title)}</strong></a>`
      : `<span class="disabled" aria-disabled="true">${label}</span>`;
  return `<nav class="slash-doc-page-navigation" data-slash-doc-page-navigation aria-label="Переходы между документами">
    ${link(options.previousPage, 'prev', '← Назад')}
    ${link(options.nextPage, 'next', 'Вперёд →')}
  </nav>`;
}

export function getNavigationToggleScript(): string {
  return `
    const navigationToggle = document.querySelector('.navigation-toggle');
    const sidebar = document.querySelector('.sidebar');
    const navigationStorageKey = 'slash-doc-navigation-hidden';
    const setNavigationHidden = (hidden) => {
      document.body.classList.toggle('navigation-hidden', hidden);
      sidebar.hidden = hidden;
      navigationToggle.setAttribute('aria-expanded', String(!hidden));
      const label = hidden ? 'Показать навигацию' : 'Скрыть навигацию';
      navigationToggle.title = label;
      navigationToggle.setAttribute('aria-label', label);
      navigationToggle.textContent = hidden ? '☰' : '‹';
    };
    let navigationHidden = false;
    try { navigationHidden = localStorage.getItem(navigationStorageKey) === 'true'; } catch {}
    setNavigationHidden(navigationHidden);
    navigationToggle.addEventListener('click', () => {
      navigationHidden = !navigationHidden;
      setNavigationHidden(navigationHidden);
      try { localStorage.setItem(navigationStorageKey, String(navigationHidden)); } catch {}
    });`;
}
