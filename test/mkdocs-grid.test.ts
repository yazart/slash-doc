import { describe, expect, it } from 'vitest';
import { exportPageContent } from '../src/extension/document-export';
import { importMarkdownBlocks } from '../src/extension/document-import-markdown';
import { importHtmlBlocks } from '../src/extension/document-import-html';
import { getDefaultSettings, normalizeSettings } from '../src/extension/settings';
import { normalizeMkDocsGrid } from '../src/shared/mkdocs-grid';
import { renderEditableContent } from '../src/shared/editable-content';
import { getDocumentationSearchText } from '../src/extension/documentation-search-text';

const data = {
  cards: true,
  items: [
    { id: 'first', content: '## First\n\n**Description**\n\n---\n\n[Documentation](https://example.com/docs)' },
    {
      id: 'second',
      content: '<h3>Second</h3><p><b>Body</b></p><ul><li><a href="slash-doc://page/details">Details</a></li></ul>',
    },
  ],
};

describe('MkDocs grids', () => {
  it('round-trips cards and generic grids through HTML and Material-compatible Markdown without duplicating nested content', async () => {
    for (const cards of [true, false]) {
      const grid = { ...data, cards };
      const page = {
        blocks: [
          { type: 'paragraph', data: { text: 'Before' } },
          { type: 'mkdocsGrid', data: grid },
          { type: 'paragraph', data: { text: 'After' } },
        ],
      };
      const html = await exportPageContent(page, 'html', getDefaultSettings());
      const markdown = await exportPageContent(page, 'md', getDefaultSettings());
      expect(html).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))');
      expect(html).toContain('<h2>First</h2>');
      expect(html).toContain('<hr>');
      expect(html).toContain('href="slash-doc://page/details"');
      expect(markdown).toContain('<div class="grid" markdown data-slash-doc-mkdocs-grid=');
      expect(markdown.includes('<div class="card" markdown>')).toBe(cards);
      for (const imported of [importHtmlBlocks(html), importMarkdownBlocks(markdown)]) {
        expect(imported.map((block) => block.type)).toEqual(['paragraph', 'mkdocsGrid', 'paragraph']);
        expect(imported[1].data).toEqual(grid);
        expect(imported[2]).toMatchObject({ data: { text: 'After' } });
      }
      expect(getDocumentationSearchText(page)).toContain('Description');
    }
  });

  it('imports native Material card lists with multiline content and nested lists', () => {
    const markdown = `<div class="grid cards" markdown>

-   **First**

    ---

    [Read](https://example.com)

    - Nested one
    - Nested two

-   **Second**

    Second description

</div>

After`;
    const blocks = importMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.type)).toEqual(['mkdocsGrid', 'paragraph']);
    expect(blocks[0]).toMatchObject({
      data: {
        cards: true,
        items: [
          { content: '**First**\n\n---\n\n[Read](https://example.com)\n\n- Nested one\n- Nested two' },
          { content: '**Second**\n\nSecond description' },
        ],
      },
    });
  });

  it('imports native block grids and balanced HTML cards with nested wrappers', () => {
    expect(
      importMarkdownBlocks('<div class="grid" markdown>\n\n**First**\n{ .card }\n\n**Second**\n{ .card }\n\n</div>')[0],
    ).toMatchObject({
      type: 'mkdocsGrid',
      data: { cards: true, items: [{ content: '**First**' }, { content: '**Second**' }] },
    });
    const html =
      '<div class="grid cards"><ul><li><b>First</b><ul><li>Nested</li></ul></li><li>Second</li></ul></div><p>After</p>';
    expect(importHtmlBlocks(html)).toMatchObject([
      {
        type: 'mkdocsGrid',
        data: { cards: true, items: [{ content: '<b>First</b><ul><li>Nested</li></ul>' }, { content: 'Second' }] },
      },
      { type: 'paragraph', data: { text: 'After' } },
    ]);
    const generic =
      '<div class="grid" markdown>\n<div markdown>\n```html\n</div>\n```\n</div>\n<div markdown>Second</div>\n</div>\nAfter';
    expect(importMarkdownBlocks(generic).map((block) => block.type)).toEqual(['mkdocsGrid', 'paragraph']);
    expect(importMarkdownBlocks(generic)[0]).toMatchObject({
      data: { cards: false, items: [{ content: '```html\n</div>\n```' }, { content: 'Second' }] },
    });
  });

  it('keeps safe block formatting while neutralizing executable markup and link attributes', () => {
    const html = renderEditableContent(
      '<h2 onclick="alert(1)">Title</h2><hr><p style="position:fixed">Body</p><a href="javascript:alert(1)">Bad</a><img src="x" onerror="alert(1)">',
      true,
    );
    expect(html).toContain('<h2>Title</h2><hr><p>Body</p>');
    expect(html).not.toMatch(/<[^>]*onclick|<[^>]*onerror|<[^>]*javascript:|<img|<[^>]*position:fixed/);
    expect(renderEditableContent('<b>Legacy</b><div>Text</div>')).toBe('<b>Legacy</b><br>Text');
    expect(renderEditableContent('---')).toBe('<br>---');
    expect(renderEditableContent('[Details](slash-doc://page/details)', true)).toContain(
      'class="slash-page-link" href="slash-doc://page/details"',
    );
    expect(renderEditableContent('[Section](#section) [Root](/) [Page](../details.html)', true)).toBe(
      '<p><a href="#section">Section</a> <a href="/">Root</a> <a href="../details.html">Page</a></p>',
    );
  });

  it('normalizes malformed items, deduplicates IDs and allows disabling the addon', () => {
    expect(
      normalizeMkDocsGrid({ cards: false, items: [null, { id: 'one', content: 'A' }, { id: 'one', content: 42 }] }),
    ).toEqual({
      cards: false,
      items: [
        { id: 'one', content: 'A' },
        { id: 'one-copy', content: '' },
      ],
    });
    expect(getDefaultSettings().editorAddons.mkdocsGrid).toBe(true);
    expect(normalizeSettings({ editorAddons: { mkdocsGrid: false } }).editorAddons.mkdocsGrid).toBe(false);
  });
});
