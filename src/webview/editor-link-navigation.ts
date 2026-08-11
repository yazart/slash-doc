export function findEventAnchor(event: Event): HTMLAnchorElement | undefined {
  const pathAnchor = event.composedPath().find(isAnchor);
  if (pathAnchor) return pathAnchor;
  if (isAnchor(event.target)) return event.target;
  if (typeof Element === 'undefined' || !(event.target instanceof Element)) return undefined;
  return event.target.closest<HTMLAnchorElement>('a[href]') ?? undefined;
}

export function getDocumentationPageId(
  anchor: Pick<HTMLAnchorElement, 'dataset' | 'getAttribute'>,
): string | undefined {
  const explicitPageId = anchor.dataset.pageId;
  if (explicitPageId) return explicitPageId;
  const href = anchor.getAttribute('href')?.trim() ?? '';
  const encodedPageId =
    /^slash-doc:\/\/(?:page\/)?([^/?#]+)/i.exec(href)?.[1] ?? /^slash-doc:page\/([^/?#]+)/i.exec(href)?.[1];
  if (!encodedPageId) return undefined;
  try {
    return decodeURIComponent(encodedPageId);
  } catch {
    return encodedPageId;
  }
}

export function getExternalUrl(anchor: Pick<HTMLAnchorElement, 'getAttribute'>): string | undefined {
  const href = anchor.getAttribute('href')?.trim();
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isAnchor(target: EventTarget | null): target is HTMLAnchorElement {
  if (!target || typeof target !== 'object') return false;
  const element = target as Partial<HTMLAnchorElement>;
  return (
    element.tagName?.toUpperCase() === 'A' &&
    typeof element.getAttribute === 'function' &&
    element.hasAttribute?.('href') === true
  );
}
