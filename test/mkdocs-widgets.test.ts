import { describe, expect, it } from 'vitest';
import { exportPageContent } from '../src/extension/document-export';
import { importMarkdownBlocks } from '../src/extension/document-import-markdown';
import { importHtmlBlocks } from '../src/extension/document-import-html';
import { getDefaultSettings } from '../src/extension/settings';

describe('MkDocs widgets', () => {
  it('imports admonitions and content tabs as structured blocks', () => {
    const blocks = importMarkdownBlocks(`!!! warning "Important"

    **Keep** this setting.

=== "Python"

    \`print('ok')\`

=== "TypeScript"

    \`console.log('ok')\`

- [x] Done
    - [ ] Nested
`);

    expect(blocks[0]).toMatchObject({
      type: 'mkdocsAdmonition',
      data: { kind: 'warning', title: 'Important', content: '**Keep** this setting.', collapsible: false },
    });
    expect(blocks[1]).toMatchObject({
      type: 'mkdocsTabs',
      data: {
        tabs: [
          { title: 'Python', content: "`print('ok')`" },
          { title: 'TypeScript', content: "`console.log('ok')`" },
        ],
      },
    });
    expect(blocks[2]).toMatchObject({
      type: 'mkdocsChecklist',
      data: {
        items: [
          { text: 'Done', checked: true, level: 0 },
          { text: 'Nested', checked: false, level: 1 },
        ],
      },
    });
  });

  it('exports interactive HTML and native MkDocs Markdown syntax', async () => {
    const data = {
      blocks: [
        {
          type: 'mkdocsAdmonition',
          data: { kind: 'tip', title: 'Hint', content: '**Markdown** body', collapsible: true, open: true },
        },
        {
          type: 'mkdocsTabs',
          data: { tabs: [{ id: 'one', title: 'One', content: '# Tab body' }] },
        },
        { type: 'mkdocsDetails', data: { summary: 'More', content: 'Details body', open: false } },
        {
          type: 'mkdocsChecklist',
          data: {
            items: [
              { id: 'done', text: '**Done**', checked: true, level: 0 },
              { id: 'nested', text: 'Nested', checked: false, level: 1 },
            ],
          },
        },
      ],
    };
    const settings = getDefaultSettings();
    const html = await exportPageContent(data, 'html', settings);
    const markdown = await exportPageContent(data, 'md', settings);

    expect(html).toContain('data-slash-doc-mkdocs-admonition=');
    expect(html).toContain('<strong>Markdown</strong>');
    expect(html).toContain('class="slash-mkdocs-tabs"');
    expect(html).toContain('data-slash-doc-mkdocs-details=');
    expect(markdown).toContain('???+ tip "Hint"');
    expect(markdown).toContain('=== "One"');
    expect(markdown).toContain('<details data-slash-doc-mkdocs-details=');
    expect(markdown).toContain('- [x] **Done**\n    - [ ] Nested');
    expect(html).toContain('data-slash-doc-mkdocs-checklist=');
    expect(importMarkdownBlocks(markdown).map((block) => block.type)).toEqual([
      'mkdocsAdmonition',
      'mkdocsTabs',
      'mkdocsDetails',
      'mkdocsChecklist',
    ]);
    expect(importHtmlBlocks(html).map((block) => block.type)).toEqual([
      'mkdocsAdmonition',
      'mkdocsTabs',
      'mkdocsDetails',
      'mkdocsChecklist',
    ]);
  });
});
