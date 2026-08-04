import { describe, expect, it } from 'vitest';
import { eventPathContains, findEventPathTarget } from '../src/webview/confluence-table-interactions';
import {
  insertTableColumn,
  insertTableRow,
  normalizeTable,
  serializeClipboardText,
} from '../src/webview/confluence-table-data';

describe('Confluence table structure operations', () => {
  it('inserts a row and keeps row heights aligned', () => {
    const data = normalizeTable({
      rows: [
        ['A', 'B'],
        ['C', 'D'],
      ],
      rowHeights: [40, 50],
    });

    expect(insertTableRow(data, 1)).toBe(1);
    expect(data.rows).toEqual([
      ['A', 'B'],
      ['', ''],
      ['C', 'D'],
    ]);
    expect(data.rowHeights).toEqual([40, 0, 50]);
  });

  it('inserts a column and keeps column widths aligned', () => {
    const data = normalizeTable({
      rows: [
        ['A', 'B'],
        ['C', 'D'],
      ],
      columnWidths: [120, 180],
    });

    expect(insertTableColumn(data, 1)).toBe(1);
    expect(data.rows).toEqual([
      ['A', '', 'B'],
      ['C', '', 'D'],
    ]);
    expect(data.columnWidths).toEqual([120, 0, 180]);
  });

  it('preserves safe inline formatting and copies cells as plain text', () => {
    const data = normalizeTable({ rows: [['<strong>Важно</strong> <code>value</code>']] });

    expect(data.rows[0][0]).toBe('<strong>Важно</strong> <code>value</code>');
    expect(serializeClipboardText(data.rows)).toBe('Важно value');
  });

  it('neutralizes executable markup in cell data', () => {
    const data = normalizeTable({ rows: [['<img src=x onerror=alert(1)><script>alert(2)</script>']] });

    expect(data.rows[0][0]).not.toContain('<img');
    expect(data.rows[0][0]).not.toContain('<script>');
    expect(data.rows[0][0]).toContain('&lt;script&gt;');
  });

  it('preserves user mentions as safe inline links', () => {
    const mention =
      '<a class="slash-user-mention" data-user-id="42" data-user-name="Иван" data-user-email="ivan@example.com" href="https://example.com/users/42">@Иван</a>';
    const data = normalizeTable({ rows: [[mention]] });

    expect(data.rows[0][0]).toContain('class="slash-user-mention"');
    expect(data.rows[0][0]).toContain('data-user-id="42"');
    expect(data.rows[0][0]).toContain('target="_blank"');
  });
});

describe('Confluence table context menu', () => {
  it('recognizes a menu click through a retargeted Shadow DOM event', () => {
    const menu = {} as EventTarget;
    const shadowHost = {} as EventTarget;
    const event = {
      target: shadowHost,
      composedPath: () => [{}, menu, shadowHost],
    } as unknown as Event;

    expect(eventPathContains(event, menu)).toBe(true);
    expect(eventPathContains(event, {} as EventTarget)).toBe(false);
  });

  it('finds an inner cell in a composed Shadow DOM event path', () => {
    const cell = { kind: 'cell' } as unknown as EventTarget;
    const event = {
      composedPath: () => [{}, cell, {}],
    } as unknown as Event;

    expect(
      findEventPathTarget(
        event,
        (target): target is EventTarget & { kind: string } =>
          (target as EventTarget & { kind?: string }).kind === 'cell',
      ),
    ).toBe(cell);
  });
});
