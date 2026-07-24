import { describe, expect, it } from 'vitest';
import { eventPathContains, findEventPathTarget } from '../src/webview/confluence-table-interactions';
import { insertTableColumn, insertTableRow, normalizeTable } from '../src/webview/confluence-table-data';

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
