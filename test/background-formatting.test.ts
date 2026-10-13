import { describe, expect, it } from 'vitest';
import { sanitizeTableCellHtml } from '../src/shared/table-cell-html';
import { readInlineColors } from '../src/shared/inline-colors';
import { normalizeTable, insertTableRow, insertTableColumn } from '../src/webview/confluence-table-data';
import { insertTableData } from '../src/webview/confluence-table-interactions';
import { exportPageContent } from '../src/extension/document-export';
import { importHtmlBlocks } from '../src/extension/document-import-html';
import { importMarkdownBlocks } from '../src/extension/document-import-markdown';
import { getDefaultSettings } from '../src/extension/settings';
import { htmlToMarkdownInline } from '../src/extension/document-export-common';

describe('background formatting', () => {
  it('keeps background separate from text color and sanitizes unrelated CSS', () => {
    expect(readInlineColors('style="background-color:#FEF08A"')).toEqual({ color: '', background: '#fef08a' });
    const html = sanitizeTableCellHtml(
      '<span style="background-color:#FEF08A;color:#112233;position:fixed;background-image:url(bad)">Text</span>',
    );
    expect(html).toContain('data-slash-text-background="#fef08a"');
    expect(html).toContain('data-slash-text-color="#112233"');
    expect(html).not.toContain('position:');
    expect(html).not.toContain('url(');
    expect(sanitizeTableCellHtml(html)).toBe(html);
  });
  it('retains nested text and background colors in Markdown', () => {
    const markdown = htmlToMarkdownInline(
      '<span data-slash-text-background="#fef08a"><span data-slash-text-color="#112233">Text</span></span>',
    );
    expect(markdown).toBe('<span style="background-color:#fef08a"><span style="color:#112233">Text</span></span>');
  });
  it('keeps row fills aligned when inserting and pasting rows', () => {
    const data = normalizeTable({ rows: [['A'], ['B']], rowBackgrounds: ['#FEF08A', 'url(bad)'] });
    expect(data.rowBackgrounds).toEqual(['#fef08a', '']);
    insertTableRow(data, 1);
    expect(data.rowBackgrounds).toEqual(['#fef08a', '', '']);
    insertTableData(data, [['C']], 3, 0);
    expect(data.rowBackgrounds).toEqual(['#fef08a', '', '', '']);
  });
  it('keeps cell colors aligned through structural edits and normalizes invalid colors', () => {
    const data = normalizeTable({
      rows: [
        ['A', 'B'],
        ['C', 'D'],
      ],
      cellBackgrounds: [
        ['#FEF08A', 'url(bad)'],
        ['', '#22C55E'],
      ],
    });
    expect(data.cellBackgrounds).toEqual([
      ['#fef08a', ''],
      ['', '#22c55e'],
    ]);
    insertTableRow(data, 1);
    insertTableColumn(data, 1);
    expect(data.cellBackgrounds).toEqual([
      ['#fef08a', '', ''],
      ['', '', ''],
      ['', '', '#22c55e'],
    ]);
    insertTableData(data, [['New']], 3, 3);
    expect(data.cellBackgrounds).toEqual([
      ['#fef08a', '', '', ''],
      ['', '', '', ''],
      ['', '', '#22c55e', ''],
      ['', '', '', ''],
    ]);
  });
  it('round-trips independent cell fills and explicit overrides equal to the row color', async () => {
    const data = {
      rows: [
        ['Title', 'Value'],
        ['A', 'B'],
      ],
      headerRow: true,
      rowBackgrounds: ['#fef08a', ''],
      cellBackgrounds: [
        ['#fef08a', '#22c55e'],
        ['', '#fecaca'],
      ],
    };
    for (const format of ['html', 'md'] as const) {
      const output = await exportPageContent(
        { blocks: [{ type: 'confluenceTable', data }] },
        format,
        getDefaultSettings(),
      );
      expect(output).toContain('background-color:#22c55e');
      expect(output).toContain('data-slash-cell-background="#fef08a"');
      expect((format === 'html' ? importHtmlBlocks(output) : importMarkdownBlocks(output))[0]).toMatchObject({
        type: 'confluenceTable',
        data,
      });
    }
    const cellOnly = await exportPageContent(
      { blocks: [{ type: 'confluenceTable', data: { ...data, rowBackgrounds: [] } }] },
      'md',
      getDefaultSettings(),
    );
    expect(cellOnly).toContain('<table>');
    expect(cellOnly).toContain('data-slash-cell-background="#fecaca"');
  });
  it('preserves filled headers and rows in HTML and Markdown round-trips', async () => {
    const data = {
      rows: [
        ['Title', 'Value'],
        ['A', 'B'],
      ],
      headerRow: true,
      rowBackgrounds: ['#fef08a', '#22c55e'],
    };
    for (const format of ['html', 'md'] as const) {
      const output = await exportPageContent(
        { blocks: [{ type: 'confluenceTable', data }] },
        format,
        getDefaultSettings(),
      );
      expect(output).toContain('<th style="background-color:#fef08a">Title</th>');
      expect(output).toContain('<td style="background-color:#22c55e">B</td>');
      expect((format === 'html' ? importHtmlBlocks(output) : importMarkdownBlocks(output))[0]).toMatchObject({
        type: 'confluenceTable',
        data,
      });
    }
  });
});
