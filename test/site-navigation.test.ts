import { describe, expect, it } from 'vitest';
import { compiledPageOptions, renderPageNavigation } from '../src/extension/site-navigation';
import { flattenPages } from '../src/extension/site-renderer';
import { getDefaultSettings } from '../src/extension/settings';

describe('compiled page navigation', () => {
  const pages = flattenPages([
    { id: 'parent', title: 'Parent', file: '', children: [{ id: 'child', title: 'Child', file: '', children: [] }] },
    { id: 'last', title: '<Last>', file: '', children: [] },
  ]);
  it('follows menu order across nested pages and escapes document titles', () => {
    const settings = { ...getDefaultSettings().exportOptions, showPageNavigation: true };
    const middle = compiledPageOptions(pages, 'child', settings);
    expect(middle.previousPage?.id).toBe('parent');
    expect(middle.nextPage?.id).toBe('last');
    expect(renderPageNavigation(middle)).toContain('&lt;Last&gt;');
    expect(compiledPageOptions(pages, 'parent', settings).previousPage).toBeUndefined();
    expect(compiledPageOptions(pages, 'last', settings).nextPage).toBeUndefined();
  });
  it('omits navigation when disabled or a page is missing from the menu', () => {
    expect(renderPageNavigation(compiledPageOptions(pages, 'child', getDefaultSettings().exportOptions))).toBe('');
    expect(
      renderPageNavigation(
        compiledPageOptions(pages, 'missing', { ...getDefaultSettings().exportOptions, showPageNavigation: true }),
      ),
    ).toBe('');
  });
});
