import { describe, expect, it } from 'vitest';
import {
  cloneClipboardBlocks,
  decodeBlockClipboard,
  encodeBlockClipboard,
  BLOCK_CLIPBOARD_PREFIX,
} from '../src/webview/block-clipboard';

describe('block clipboard', () => {
  it('round-trips a heterogeneous selection including nested content and tunes', () => {
    const blocks = [
      {
        id: 'a',
        type: 'confluenceTable',
        data: { rows: [['<ul><li><a href="https://example.com">Ссылка</a></li></ul>']] },
      },
      { id: 'b', type: 'custom', data: { nested: { value: 'данные' } }, tunes: { alignment: 'center' } },
    ];
    expect(decodeBlockClipboard(encodeBlockClipboard(blocks))).toEqual(blocks);
  });
  it('ignores ordinary text, unrelated JSON and malformed block payloads', () => {
    for (const text of [
      'text',
      '{"blocks":[]}',
      BLOCK_CLIPBOARD_PREFIX + '{',
      BLOCK_CLIPBOARD_PREFIX + '{"version":2,"blocks":[]}',
      BLOCK_CLIPBOARD_PREFIX + '{"version":1,"blocks":[{"type":"paragraph","data":null}]}',
    ]) {
      expect(decodeBlockClipboard(text)).toBeUndefined();
    }
  });
  it('assigns new IDs without modifying source data or block order', () => {
    const source = [{ id: 'source', type: 'paragraph', data: { text: 'original' } }];
    const copy = cloneClipboardBlocks(source, () => 'new');
    expect(copy[0].id).toBe('new');
    copy[0].data.text = 'edited';
    expect(source[0]).toEqual({ id: 'source', type: 'paragraph', data: { text: 'original' } });
  });
});
