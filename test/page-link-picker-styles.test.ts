import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Page link picker styles', () => {
  it('scrolls a large page list without shrinking options', () => {
    const layout = readFileSync('src/webview/editor-layout.css', 'utf8');
    const components = readFileSync('src/webview/editor-components.css', 'utf8');

    expect(layout).toMatch(/\.slash-page-link-list\s*\{[^}]*overflow-y:\s*auto/s);
    expect(layout).toMatch(/\.slash-page-link-picker\s*\{[^}]*max-height:/s);
    expect(components).toMatch(/\.slash-page-link-option,[^{]+\{[^}]*flex:\s*0 0 auto/s);
  });
});
