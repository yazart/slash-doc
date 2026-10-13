import { describe, expect, it } from 'vitest';
import { renderEditableContent } from '../src/shared/editable-content';
import { sanitizeTableCellHtml, tableCellHtmlToText } from '../src/shared/table-cell-html';
import {
  exportMkDocsAdmonitionToHtml,
  exportMkDocsAdmonitionToMarkdown,
} from '../src/extension/document-export-mkdocs';

describe('rich content inside blocks', () => {
  it('keeps nested lists and safe links while removing executable attributes', () => {
    const html = sanitizeTableCellHtml(
      '<ul onclick="bad()"><li>One<ol><li><a href="https://example.com" onclick="bad()">Two</a></li></ol></li></ul>',
    );
    expect(html).toContain('<ul><li>One<ol><li><a');
    expect(html).not.toContain('onclick');
    expect(tableCellHtmlToText(html)).toContain('Two\n');
  });
  it('keeps encoded link attributes stable across save/render cycles', () => {
    const link = '<a href="https://example.com/?a=1&amp;b=2">Link</a>';
    const safe = sanitizeTableCellHtml(link);
    expect(sanitizeTableCellHtml(safe)).toBe(safe);
    expect(safe).toContain('?a=1&amp;b=2');
  });
  it('renders old Markdown and new HTML in MkDocs bodies', () => {
    expect(renderEditableContent('**Important**\n\n- One')).toContain('<strong>Important</strong>');
    expect(renderEditableContent('<ul><li><strong>One</strong></li></ul>')).toBe(
      '<ul><li><strong>One</strong></li></ul>',
    );
  });
  it('exports editable MkDocs lists as live HTML without escaping or losing links', () => {
    const data = { content: '<ul><li><a href="https://example.com">One</a></li></ul>' };
    for (const exported of [exportMkDocsAdmonitionToHtml(data), exportMkDocsAdmonitionToMarkdown(data)]) {
      expect(exported).toContain('<ul><li><a');
      expect(exported).not.toContain('&lt;ul');
    }
  });
});
