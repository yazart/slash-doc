import { DEFAULT_FAVICON, normalizeFavicon } from '../shared/favicon';
import { escapeAttribute } from './utils';

export function renderFavicon(favicon = ''): string {
  return `<link rel="icon" href="${escapeAttribute(normalizeFavicon(favicon) || DEFAULT_FAVICON)}">`;
}

export function withCompiledFavicon(html: string, favicon = ''): string {
  return html.replace('</head>', `${renderFavicon(favicon)}\n</head>`);
}
