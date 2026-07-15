import * as vscode from 'vscode';
import { exportPageContent } from './document-export';
import { readMenu, readPageContent } from './pages';
import { readSettings } from './settings-store';
import type { SlashDocMenuItem } from './types';
import { escapeAttribute, escapeHtml } from './utils';

export type CompiledDocumentation = {
  indexUri: vscode.Uri;
  pageCount: number;
};

export async function compileDocumentationSite(
  extensionUri: vscode.Uri,
  workspaceRoot: vscode.Uri,
  outputRoot: vscode.Uri
): Promise<CompiledDocumentation> {
  const menu = await readMenu(workspaceRoot);
  const settings = await readSettings(workspaceRoot);
  const pages = flattenPages(menu.items);
  const pageIds = new Set(pages.map((page) => page.id));
  const pagesRoot = vscode.Uri.joinPath(outputRoot, 'pages');
  await vscode.workspace.fs.createDirectory(outputRoot);
  await vscode.workspace.fs.createDirectory(pagesRoot);

  for (const page of pages) {
    const data = await readPageContent(workspaceRoot, page.id, page.title);
    const exported = await exportPageContent(data, 'html', settings, extensionUri, workspaceRoot);
    const html = prepareCompiledPage(exported, page.id, pageIds);
    await writeText(vscode.Uri.joinPath(pagesRoot, `${page.id}.html`), html);
  }

  const projectName = workspaceRoot.path.split('/').filter(Boolean).at(-1) ?? 'Documentation';
  const indexUri = vscode.Uri.joinPath(outputRoot, 'index.html');
  await writeText(indexUri, renderHostHtml(projectName, menu.items, pages[0]?.id));
  return { indexUri, pageCount: pages.length };
}

function flattenPages(items: SlashDocMenuItem[]): SlashDocMenuItem[] {
  return items.flatMap((item) => [item, ...flattenPages(item.children)]);
}

function prepareCompiledPage(html: string, pageId: string, pageIds: Set<string>): string {
  const withLinks = rewriteDocumentationLinks(html, pageIds);
  const additions = `<meta name="slash-doc-page-id" content="${escapeAttribute(pageId)}">
  <style>${PAGE_STYLES}</style>`;
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
      const suffix = readLinkSuffix(href);
      const cleaned = removeAttributes(attributes, ['href', 'target', 'rel']);
      return `<a${cleaned} href="${escapeAttribute(`${pageId}.html${suffix}`)}">`;
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
    // Keep the original value when it contains malformed URI escapes.
  }
  const slashDoc = /^slash-doc:\/\/(?:page\/)?([^?#/]+)/i.exec(decoded)?.[1]
    ?? /^slash-doc:page\/([^?#/]+)/i.exec(decoded)?.[1];
  if (slashDoc && pageIds.has(slashDoc)) return slashDoc;

  const path = decoded.split(/[?#]/, 1)[0]
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

function renderHostHtml(projectName: string, items: SlashDocMenuItem[], firstPageId: string | undefined): string {
  const firstPage = firstPageId ? `pages/${firstPageId}.html` : 'about:blank';
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <style>${HOST_STYLES}</style>
</head>
<body>
  <aside class="sidebar">
    <header class="sidebar-title">${escapeHtml(projectName)}</header>
    <nav class="navigation" aria-label="Страницы документации">${renderHostMenu(items)}</nav>
  </aside>
  <iframe class="content" name="content" title="Документация" src="${escapeAttribute(firstPage)}"></iframe>
  <script>
    const links = Array.from(document.querySelectorAll('.page-link'));
    links.forEach((link) => link.addEventListener('click', () => {
      links.forEach((item) => item.classList.toggle('active', item === link));
    }));
    if (links[0]) links[0].classList.add('active');
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

async function writeText(uri: vscode.Uri, text: string): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
}

const HOST_STYLES = `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#fff}
*{box-sizing:border-box}body{display:grid;grid-template-columns:280px minmax(0,1fr);height:100vh;margin:0;overflow:hidden}
.sidebar{display:grid;grid-template-rows:auto 1fr;min-width:0;border-right:1px solid #dfe3ea;background:#f7f8fa}
.sidebar-title{padding:18px 16px 14px;border-bottom:1px solid #dfe3ea;font-size:16px;font-weight:700}
.navigation{overflow:auto;padding:10px 8px 24px}.navigation ul{display:grid;gap:2px;margin:0;padding:0;list-style:none}.navigation ul ul{margin-left:14px;padding-top:2px}
.navigation summary{list-style-position:outside;margin-left:18px}.navigation summary::marker{color:#7b8495}.page-link{display:block;padding:6px 8px;color:#263247;border-radius:5px;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.leaf{padding-left:18px}.page-link:hover{background:#e9edf3}.page-link.active{color:#fff;background:#2563eb}.content{width:100%;height:100%;border:0;background:#fff}.empty{padding:8px;color:#6b7280}
@media(max-width:760px){body{grid-template-columns:210px minmax(0,1fr)}}`;

const PAGE_STYLES = `
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#fff;line-height:1.55}
*{box-sizing:border-box}body{max-width:980px;margin:0 auto;padding:32px 40px 64px}h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.35em 0 .55em}p,ul,ol,pre,table,figure{margin:0 0 1em}a{color:#2563eb}img,svg{max-width:100%;height:auto}figure{margin-left:0;margin-right:0}figcaption{color:#667085;font-size:.9em}
table{width:100%;border-spacing:0;border-collapse:collapse;overflow:auto}th,td{padding:8px 10px;border:1px solid #d7dce4;text-align:left;vertical-align:top}th{background:#f4f6f8}pre{overflow:auto;padding:14px;border:1px solid #e1e5eb;border-radius:6px;background:#f7f8fa}code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}
@media(max-width:700px){body{padding:22px 18px 48px}}`;
