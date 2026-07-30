import type { SlashDocMenuItem } from './types';
import { escapeAttribute, escapeHtml, escapeScriptJson } from './utils';
import hostStyles from './styles/site-host.embedded.css?raw';
import pageStyles from './styles/site-page.embedded.css?raw';

type SearchIndexItem = { pageId: string; title: string; text: string };

export function flattenPages(items: SlashDocMenuItem[]): SlashDocMenuItem[] {
  return items.flatMap((item) => [item, ...flattenPages(item.children)]);
}

export function prepareCompiledPage(html: string, pageId: string, pageIds: Set<string>): string {
  const withLinks = rewriteDocumentationLinks(html, pageIds);
  const additions = `<meta name="slash-doc-page-id" content="${escapeAttribute(pageId)}">
  <style>${pageStyles}</style>`;
  return withLinks.replace('</head>', `${additions}\n  </head>`);
}

function rewriteDocumentationLinks(html: string, pageIds: Set<string>): string {
  return html.replaceAll(/<a\b([^>]*)>/gi, (opening: string, attributes: string) => {
    const href = readAttribute(attributes, 'href');
    if (!href) return opening;
    if (/^\s*(javascript|vbscript):/i.test(href)) {
      return `<a${removeAttributes(attributes, ['href', 'target', 'rel'])}>`;
    }

    const pageId = readAttribute(attributes, 'data-page-id') || resolvePageId(href, pageIds);
    if (pageId && pageIds.has(pageId)) {
      const cleaned = removeAttributes(attributes, ['href', 'target', 'rel']);
      return `<a${cleaned} href="${escapeAttribute(`${pageId}.html${readLinkSuffix(href)}`)}">`;
    }

    if (isExternalLink(href)) {
      const cleaned = removeAttributes(attributes, ['target', 'rel']);
      return `<a${cleaned} target="_blank" rel="noopener noreferrer">`;
    }
    return opening;
  });
}

function resolvePageId(href: string, pageIds: Set<string>): string | undefined {
  let decoded = href.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep malformed URI escapes unchanged.
  }
  const slashDoc =
    /^slash-doc:\/\/(?:page\/)?([^?#/]+)/i.exec(decoded)?.[1] ?? /^slash-doc:page\/([^?#/]+)/i.exec(decoded)?.[1];
  if (slashDoc && pageIds.has(slashDoc)) return slashDoc;
  const path = decoded
    .split(/[?#]/, 1)[0]
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/^pages\//, '')
    .replace(/\.html?$/i, '');
  if (pageIds.has(path)) return path;
  if (decoded.startsWith('#') && pageIds.has(decoded.slice(1))) return decoded.slice(1);
  return undefined;
}

function readLinkSuffix(href: string): string {
  const hash = href.indexOf('#');
  return hash >= 0 && !href.startsWith('#') ? href.slice(hash) : '';
}

function isExternalLink(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) && !/^slash-doc:/i.test(href);
}

function readAttribute(attributes: string, name: string): string {
  const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function removeAttributes(attributes: string, names: string[]): string {
  return names.reduce((value, name) => {
    const escaped = name.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return value.replace(new RegExp(`\\s+${escaped}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'), '');
  }, attributes);
}

export function renderHostHtml(
  projectName: string,
  items: SlashDocMenuItem[],
  firstPageId: string | undefined,
  searchIndex: SearchIndexItem[],
): string {
  const firstPage = firstPageId ? `pages/${firstPageId}.html` : 'about:blank';
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <style>${hostStyles}</style>
</head>
<body>
  <aside class="sidebar">
    <header class="sidebar-title">${escapeHtml(projectName)}</header>
    <div class="documentation-search"><input type="search" placeholder="Поиск по документации" aria-label="Поиск по документации"></div>
    <nav class="navigation" aria-label="Страницы документации">${renderHostMenu(items)}</nav>
    <div class="search-results" hidden></div>
  </aside>
  <iframe class="content" name="content" title="Документация" src="${escapeAttribute(firstPage)}"></iframe>
  <script>
    const links = Array.from(document.querySelectorAll('.page-link'));
    links.forEach((link) => link.addEventListener('click', () => {
      links.forEach((item) => item.classList.toggle('active', item === link));
    }));
    if (links[0]) links[0].classList.add('active');
    const searchIndex = ${escapeScriptJson(searchIndex)};
    const search = document.querySelector('.documentation-search input');
    const navigation = document.querySelector('.navigation');
    const results = document.querySelector('.search-results');
    search.addEventListener('input', () => {
      const query = search.value.toLocaleLowerCase('ru').trim();
      navigation.hidden = query.length > 0;
      results.hidden = query.length === 0;
      results.replaceChildren();
      if (!query) return;
      if (query.length < 2) {
        results.textContent = 'Введите не менее двух символов';
        return;
      }
      const terms = query.split(/\\s+/).filter(Boolean);
      const found = searchIndex
        .map((page) => {
          const title = page.title.toLocaleLowerCase('ru');
          const text = page.text.toLocaleLowerCase('ru');
          if (!terms.every((term) => title.includes(term) || text.includes(term))) return null;
          const index = Math.max(0, text.indexOf(query));
          return { ...page, index, score: title.includes(query) ? 2 : text.includes(query) ? 1 : 0 };
        })
        .filter(Boolean)
        .sort((left, right) => right.score - left.score)
        .slice(0, 50);
      if (found.length === 0) {
        results.textContent = 'Ничего не найдено';
        return;
      }
      found.forEach((page) => {
        const link = document.createElement('a');
        link.className = 'search-result';
        link.href = 'pages/' + encodeURIComponent(page.pageId) + '.html';
        link.target = 'content';
        const title = document.createElement('strong');
        title.textContent = page.title;
        const snippet = document.createElement('span');
        const start = Math.max(0, page.index - 60);
        const end = Math.min(page.text.length, page.index + query.length + 80);
        snippet.textContent = (start ? '…' : '') + page.text.slice(start, end).trim() + (end < page.text.length ? '…' : '');
        link.append(title, snippet);
        results.append(link);
      });
    });
  </script>
</body>
</html>\n`;
}

function renderHostMenu(items: SlashDocMenuItem[]): string {
  if (items.length === 0) return '<p class="empty">Страниц пока нет</p>';
  return `<ul>${items.map(renderHostMenuItem).join('')}</ul>`;
}

function renderHostMenuItem(item: SlashDocMenuItem): string {
  const link = `<a class="page-link" href="pages/${escapeAttribute(item.id)}.html" target="content">${escapeHtml(item.title)}</a>`;
  if (item.children.length === 0) return `<li class="leaf">${link}</li>`;
  return `<li><details open><summary>${link}</summary>${renderHostMenu(item.children)}</details></li>`;
}
