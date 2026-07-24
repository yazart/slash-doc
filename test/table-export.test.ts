import { describe, expect, it } from 'vitest';
import { exportTableToHtml } from '../src/extension/document-export-table';

describe('Confluence table HTML export', () => {
  it('wraps the table in an accessible scroll region and preserves dimensions', () => {
    const html = exportTableToHtml('confluenceTable', {
      headerRow: true,
      headerColumn: true,
      rows: [
        ['Этап', 'Ответственный'],
        ['Проверка', 'Иван'],
      ],
      columnWidths: [240, 320],
      rowHeights: [48, 64],
    });

    expect(html).toContain('class="slash-confluence-table-scroll"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<tr style="height:48px">');
    expect(html).toContain('<th style="width:240px">Этап</th>');
    expect(html).toContain('<td style="width:320px">Иван</td>');
  });

  it('keeps the built-in table without the Confluence scroll wrapper', () => {
    const html = exportTableToHtml('table', {
      withHeadings: true,
      content: [
        ['Name', 'Value'],
        ['A', '<unsafe>'],
      ],
    });

    expect(html).not.toContain('slash-confluence-table-scroll');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('&lt;unsafe&gt;');
  });
});
