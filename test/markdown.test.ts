import { describe, expect, it } from 'vitest';
import { renderSafeMarkdown } from '../src/shared/markdown';

describe('renderSafeMarkdown', () => {
  it('renders common inline Markdown and safe links', () => {
    const html = renderSafeMarkdown('**жирный** *курсив* `const x = 1` ~~удалён~~ [ссылка](https://example.com)');

    expect(html).toBe(
      '<p><strong>жирный</strong> <em>курсив</em> <code>const x = 1</code> <del>удалён</del> <a href="https://example.com">ссылка</a></p>',
    );
  });

  it('renders block structures and escapes code', () => {
    const html = renderSafeMarkdown(
      '# Заголовок\n\n> цитата\n\n- один\n- два\n\n```html\n<script>alert(1)</script>\n```',
    );

    expect(html).toContain('<h1>Заголовок</h1>');
    expect(html).toContain('<blockquote>цитата</blockquote>');
    expect(html).toContain('<ul><li>один</li><li>два</li></ul>');
    expect(html).toContain('<pre><code class="language-html">&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>');
  });

  it('does not create unsafe links or pass raw HTML through', () => {
    const html = renderSafeMarkdown('[опасно](javascript:alert(1)) <img src=x onerror=alert(1)>');

    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
