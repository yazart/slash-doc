import type { SlashDocMenuItem } from './types';
import type { PageRevisionMetadata } from '../shared/page-revision';
import { escapeAttribute, escapeHtml, escapeScriptJson } from './utils';
import hostStyles from './styles/site-host.embedded.css?raw';
import pageStyles from './styles/site-page.embedded.css?raw';

type SearchIndexItem = { pageId: string; title: string; text: string };

export function flattenPages(items: SlashDocMenuItem[]): SlashDocMenuItem[] {
  return items.flatMap((item) => [item, ...flattenPages(item.children)]);
}

export function prepareCompiledPage(
  html: string,
  pageId: string,
  pageIds: Set<string>,
  revision?: PageRevisionMetadata,
): string {
  const withLinks = injectPageRevision(rewriteDocumentationLinks(html, pageIds), revision);
  const additions = `<meta name="slash-doc-page-id" content="${escapeAttribute(pageId)}">
  <style>${pageStyles}</style>
  <script>try{const theme=window.parent.document.documentElement.dataset.slashDocTheme;if(theme)document.documentElement.dataset.slashDocTheme=theme}catch{}window.parent.postMessage({type:'slash-doc-page',pageId:${escapeScriptJson(pageId)}}, '*');</script>`;
  const prepared = withLinks.replace('</head>', `${additions}\n  </head>`);
  const copyControl = `<button class="slash-doc-copy-html" type="button" data-slash-doc-copy-control aria-label="Скопировать HTML страницы" title="Скопировать HTML страницы">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
    <span>Скопировать HTML</span>
  </button>
  <script data-slash-doc-copy-script>${getCopyPageScript()}</script>`;
  return prepared.replace('</body>', `${copyControl}\n  </body>`);
}

function injectPageRevision(html: string, revision: PageRevisionMetadata | undefined): string {
  if (!revision) return html;
  const date = formatRevisionDate(revision.changedAt);
  const editLink =
    revision.editUrl && /^https?:\/\//i.test(revision.editUrl)
      ? ` <a href="${escapeAttribute(revision.editUrl)}" target="_blank" rel="noopener noreferrer">Редактировать</a>`
      : '';
  const metadata = `<p class="slash-doc-page-revision">Изменено: <time datetime="${escapeAttribute(revision.changedAt)}">${escapeHtml(date)}</time> <span class="slash-doc-page-revision-user">${escapeHtml(revision.user)}</span>${editLink}</p>`;
  const heading = /<h([1-6])\b[^>]*>[\s\S]*?<\/h\1\s*>/i;
  if (heading.test(html)) return html.replace(heading, (value) => `${value}\n${metadata}`);
  return html.replace(/<body\b[^>]*>/i, (value) => `${value}\n${metadata}`);
}

function formatRevisionDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function getCopyPageScript(): string {
  return `(() => {
    const button = document.querySelector('[data-slash-doc-copy-control]');
    if (!button) return;
    const writeClipboard = async (value) => {
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(value); return true; } catch {}
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(textarea);
      textarea.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      textarea.remove();
      return copied;
    };
    button.addEventListener('click', async () => {
      const clone = document.documentElement.cloneNode(true);
      clone.removeAttribute('data-slash-doc-theme');
      clone.querySelectorAll('[data-slash-doc-copy-control],script[data-slash-doc-copy-script]').forEach((item) => item.remove());
      const source = '<!DOCTYPE html>\\n' + clone.outerHTML;
      const copied = await writeClipboard(source);
      const label = button.querySelector('span');
      const original = 'Скопировать HTML';
      if (label) label.textContent = copied ? 'Скопировано' : 'Не удалось скопировать';
      button.classList.toggle('copied', copied);
      window.setTimeout(() => {
        if (label) label.textContent = original;
        button.classList.remove('copied');
      }, 1800);
    });
  })();`;
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
    <header class="sidebar-title"><span>${escapeHtml(projectName)}</span><button class="theme-toggle" type="button" aria-label="Включить тёмную тему" title="Включить тёмную тему">☾</button></header>
    <div class="documentation-search"><input type="search" placeholder="Поиск по документации" aria-label="Поиск по документации"></div>
    <nav class="navigation" aria-label="Страницы документации">${renderHostMenu(items)}</nav>
    <div class="search-results" hidden></div>
  </aside>
  <div class="sidebar-resizer" role="separator" aria-label="Изменить ширину меню" aria-orientation="vertical" aria-valuemin="180" aria-valuemax="600" tabindex="0"></div>
  <iframe class="content" name="content" title="Документация" src="${escapeAttribute(firstPage)}"></iframe>
  <script>
    const links = Array.from(document.querySelectorAll('.page-link'));
    const content = document.querySelector('.content');
    const themeToggle = document.querySelector('.theme-toggle');
    const themeStorageKey = 'slash-doc-theme';
    let currentTheme = 'light';
    try { currentTheme = localStorage.getItem(themeStorageKey) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch {}
    const applyTheme = (theme) => {
      currentTheme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.slashDocTheme = currentTheme;
      themeToggle.textContent = currentTheme === 'dark' ? '☀' : '☾';
      const label = currentTheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
      themeToggle.setAttribute('aria-label', label);
      themeToggle.title = label;
      try { content.contentDocument.documentElement.dataset.slashDocTheme = currentTheme; } catch {}
    };
    applyTheme(currentTheme);
    themeToggle.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(themeStorageKey, currentTheme); } catch {}
    });
    const pageLinks = new Map(links.map((link) => [link.dataset.pageId, link]));
    let activePageId = '';
    let expectedPageId = '';
    const pageHash = (pageId) => '#page/' + encodeURIComponent(pageId);
    const readPageHash = () => {
      const value = location.hash.startsWith('#page/') ? location.hash.slice(6) : location.hash.slice(1);
      try { return decodeURIComponent(value); } catch { return value; }
    };
    const selectPage = (pageId, loadPage, updateHash) => {
      const link = pageLinks.get(pageId);
      if (!link) return false;
      links.forEach((item) => item.classList.toggle('active', item === link));
      link.scrollIntoView({ block: 'nearest' });
      if (loadPage && activePageId !== pageId) {
        expectedPageId = pageId;
        content.src = link.href;
      }
      activePageId = pageId;
      if (updateHash && location.hash !== pageHash(pageId)) location.hash = pageHash(pageId);
      return true;
    };
    const acceptLoadedPage = (pageId) => {
      if (expectedPageId && pageId !== expectedPageId) return;
      expectedPageId = '';
      selectPage(pageId, false, true);
    };
    content.addEventListener('load', () => {
      try {
        content.contentDocument.documentElement.dataset.slashDocTheme = currentTheme;
        const pageId = content.contentDocument?.querySelector('meta[name="slash-doc-page-id"]')?.content;
        if (pageId) acceptLoadedPage(pageId);
      } catch {}
    });
    window.addEventListener('message', (event) => {
      if (event.source !== content.contentWindow || event.data?.type !== 'slash-doc-page') return;
      acceptLoadedPage(String(event.data.pageId || ''));
    });
    links.forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      selectPage(link.dataset.pageId, true, true);
    }));
    const requestedPage = readPageHash();
    if (!selectPage(requestedPage, true, false) && links[0]) {
      selectPage(links[0].dataset.pageId, true, false);
      history.replaceState(null, '', pageHash(links[0].dataset.pageId));
    }
    window.addEventListener('hashchange', () => selectPage(readPageHash(), true, false));

    const resizer = document.querySelector('.sidebar-resizer');
    const sidebarStorageKey = 'slash-doc-sidebar-width';
    const maximumSidebarWidth = () => Math.max(180, Math.min(600, window.innerWidth - 240));
    const setSidebarWidth = (width) => {
      const normalized = Math.max(180, Math.min(maximumSidebarWidth(), Math.round(width)));
      document.body.style.setProperty('--sidebar-width', normalized + 'px');
      resizer.setAttribute('aria-valuenow', String(normalized));
      return normalized;
    };
    try {
      const storedWidth = Number(localStorage.getItem(sidebarStorageKey));
      if (Number.isFinite(storedWidth) && storedWidth > 0) setSidebarWidth(storedWidth);
    } catch {}
    let resizing = false;
    resizer.addEventListener('pointerdown', (event) => {
      resizing = true;
      resizer.setPointerCapture(event.pointerId);
      document.body.classList.add('resizing-sidebar');
      event.preventDefault();
    });
    resizer.addEventListener('pointermove', (event) => {
      if (resizing) setSidebarWidth(event.clientX);
    });
    const finishResize = (event) => {
      if (!resizing) return;
      resizing = false;
      document.body.classList.remove('resizing-sidebar');
      const width = parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar-width'), 10);
      try { localStorage.setItem(sidebarStorageKey, String(width)); } catch {}
      if (resizer.hasPointerCapture(event.pointerId)) resizer.releasePointerCapture(event.pointerId);
    };
    resizer.addEventListener('pointerup', finishResize);
    resizer.addEventListener('pointercancel', finishResize);
    resizer.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const current = parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar-width'), 10) || 280;
      const width = setSidebarWidth(current + (event.key === 'ArrowRight' ? 16 : -16));
      try { localStorage.setItem(sidebarStorageKey, String(width)); } catch {}
    });
    window.addEventListener('resize', () => setSidebarWidth(parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar-width'), 10) || 280));

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
        link.dataset.pageId = page.pageId;
        link.addEventListener('click', (event) => {
          event.preventDefault();
          selectPage(page.pageId, true, true);
        });
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
  const link = `<a class="page-link" data-page-id="${escapeAttribute(item.id)}" href="pages/${escapeAttribute(item.id)}.html" target="content">${escapeHtml(item.title)}</a>`;
  if (item.children.length === 0) return `<li class="leaf">${link}</li>`;
  return `<li><details open><summary>${link}</summary>${renderHostMenu(item.children)}</details></li>`;
}
