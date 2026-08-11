import { describe, expect, it } from 'vitest';
import { EDITOR_TEXT_INLINE_TARGETS } from '../src/webview/editor-text-inline-toolbar';

describe('shared text inline toolbar', () => {
  it('binds paragraph, header, and list item editors', () => {
    expect(EDITOR_TEXT_INLINE_TARGETS).toEqual([
      '.ce-paragraph[contenteditable="true"]',
      '.ce-header[contenteditable="true"]',
      '.cdx-list__item',
    ]);
  });
});
