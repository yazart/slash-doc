import { describe, expect, it } from 'vitest';
import { removePageTime } from '../src/shared/page-content';
import { normalizeEditorData } from '../src/webview/editor-data';

describe('page content timestamps', () => {
  it('removes the top-level Editor.js time without mutating source data', () => {
    const source = { time: 123, version: '2.23.2', blocks: [], metadata: { time: 456 } };
    const result = removePageTime(source);

    expect(result).toEqual({ version: '2.23.2', blocks: [], metadata: { time: 456 } });
    expect(source.time).toBe(123);
  });

  it('drops a legacy time value while normalizing content for the editor', () => {
    const result = normalizeEditorData({
      time: 123,
      version: '2.23.2',
      blocks: [{ type: 'paragraph', data: { text: 'Text' } }],
    }) as unknown as Record<string, unknown>;

    expect(result.time).toBeUndefined();
    expect(result.blocks).toHaveLength(1);
  });
});
