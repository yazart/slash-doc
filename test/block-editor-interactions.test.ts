import { describe, expect, it } from 'vitest';
import { reorderBlockIds } from '../src/webview/block-editor-drag';
import { convertedBlockData } from '../src/webview/block-editor-conversion';

describe('block movement', () => {
  it('inserts below the drop target and adjusts for removal of the source', () => {
    expect(reorderBlockIds(['a', 'b', 'c', 'd'], ['a'], 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderBlockIds(['a', 'b', 'c', 'd'], ['d'], 0)).toEqual(['d', 'a', 'b', 'c']);
  });
  it('keeps a group in document order, including nonadjacent blocks', () => {
    expect(reorderBlockIds(['a', 'b', 'c', 'd', 'e'], ['c', 'a'], 5)).toEqual(['b', 'd', 'e', 'a', 'c']);
    expect(reorderBlockIds(['a', 'b', 'c', 'd'], ['b', 'c'], 2)).toEqual(['a', 'b', 'c', 'd']);
  });
});
describe('block conversion', () => {
  it('preserves formatted cell text and links when converting a table to text', () => {
    const data = convertedBlockData('paragraph', {
      rows: [['<strong>Title</strong>', '<a href="https://example.com">Link</a>']],
    });
    expect(data.text).toContain('<strong>Title</strong>');
    expect(data.text).toContain('href="https://example.com"');
  });
  it('converts text to editable bodies and code while keeping line breaks', () => {
    expect(convertedBlockData('mkdocsDetails', { text: '<strong>Text</strong>' }).content).toBe(
      '<strong>Text</strong>',
    );
    expect(convertedBlockData('codeBlock', { text: 'One<br>Two' }).code).toBe('One\nTwo');
  });
});
