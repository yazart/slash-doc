import { describe, expect, it } from 'vitest';
import { exportPageContent } from '../src/extension/document-export';
import { importMarkdownBlocks } from '../src/extension/document-import-markdown';
import { importHtmlBlocks } from '../src/extension/document-import-html';
import { getDefaultSettings } from '../src/extension/settings';
import { textHeadingLevel } from '../src/shared/text-block';

describe('text headings and quotes', () => {
  it('keeps old and unified headings equivalent in HTML, Markdown and document title', async () => {
    const settings = getDefaultSettings();
    for (const type of ['header', 'paragraph']) {
      const data = { blocks: [{ type, data: { text: '<b>Title</b>', level: 3 } }] };
      const html = await exportPageContent(data, 'html', settings);
      expect(html).toContain('<title>Title</title>');
      expect(html).toContain('<h3><b>Title</b></h3>');
      expect(await exportPageContent(data, 'md', settings)).toBe('### **Title**\n');
    }
    expect(textHeadingLevel({ type: 'paragraph', data: { level: 0 } })).toBe(0);
    expect(textHeadingLevel({ type: 'paragraph', data: { level: 7 } })).toBe(0);
    expect(textHeadingLevel({ type: 'header', data: {} })).toBe(2);
  });
  it('imports headings into the unified text block', () => {
    expect(importHtmlBlocks('<h2>Title</h2><p>Body</p>')).toMatchObject([
      { type: 'paragraph', data: { text: 'Title', level: 2 } },
      { type: 'paragraph', data: { text: 'Body' } },
    ]);
    expect(importMarkdownBlocks('# Title\n\nBody')).toMatchObject([
      { type: 'paragraph', data: { text: 'Title', level: 1 } },
      { type: 'paragraph', data: { text: 'Body' } },
    ]);
  });
  it('round-trips multiline quotes with formatting and links in HTML and Markdown', async () => {
    const quote = { type: 'quote', data: { text: '<b>First</b><br><a href="https://example.com">Second</a>' } };
    const html = await exportPageContent({ blocks: [quote] }, 'html', getDefaultSettings());
    expect(html).toContain(`<blockquote>${quote.data.text}</blockquote>`);
    expect(importHtmlBlocks(html)).toMatchObject([quote]);
    const markdown = await exportPageContent({ blocks: [quote] }, 'md', getDefaultSettings());
    expect(markdown).toBe('> **First**\n> [Second](https://example.com)\n');
    expect(importMarkdownBlocks(markdown)).toMatchObject([quote]);
  });
});
