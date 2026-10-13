import { describe, expect, it } from 'vitest';
import { findEventAnchor, getDocumentationPageId, getExternalUrl } from '../src/webview/editor-link-navigation';

describe('Editor link navigation', () => {
  it('finds a Confluence Table link inside a retargeted Shadow DOM event', () => {
    const anchor = fakeAnchor('slash-doc://page/rfc-003', 'rfc-003');
    const host = {} as EventTarget;
    const event = { target: host, composedPath: () => [{}, anchor, host] } as unknown as Event;

    expect(findEventAnchor(event)).toBe(anchor);
    expect(getDocumentationPageId(anchor)).toBe('rfc-003');
  });

  it('reads an encoded internal page id from href', () => {
    const anchor = fakeAnchor('slash-doc://page/API%20contracts');

    expect(getDocumentationPageId(anchor)).toBe('API contracts');
  });

  it('allows only HTTP external links', () => {
    expect(getExternalUrl(fakeAnchor('https://example.com/docs'))).toBe('https://example.com/docs');
    expect(getExternalUrl(fakeAnchor('javascript:alert(1)'))).toBeUndefined();
  });
});

function fakeAnchor(href: string, pageId?: string): HTMLAnchorElement {
  return {
    tagName: 'A',
    dataset: pageId ? { pageId } : {},
    getAttribute: (name: string) => (name === 'href' ? href : null),
    hasAttribute: (name: string) => name === 'href',
  } as unknown as HTMLAnchorElement;
}
