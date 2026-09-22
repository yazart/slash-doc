import { describe, expect, it } from 'vitest';
import { normalizeNestedListItems } from '../src/webview/nested-list-tool';

describe('nested list tool', () => {
  it('migrates legacy flat list items without losing inline markup', () => {
    expect(normalizeNestedListItems(['Первый', '<b>Второй</b>'])).toEqual([
      { content: 'Первый', items: [] },
      { content: '<b>Второй</b>', items: [] },
    ]);
  });

  it('preserves multiple nested levels', () => {
    const items = [{ content: 'Первый', items: [{ content: 'Дочерний', items: [{ content: 'Третий', items: [] }] }] }];
    expect(normalizeNestedListItems(items)).toEqual(items);
  });
});
