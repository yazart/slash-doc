import { describe, expect, it } from 'vitest';
import { replaceClipboardRange } from '../src/webview/bpmn-preview-clipboard';

describe('BPMN Preview clipboard insertion', () => {
  it('replaces the selected XML range and moves the caret', () => {
    expect(replaceClipboardRange('<old/>', '<bpmn/>', 1, 5)).toEqual({
      value: '<<bpmn/>>',
      caret: 8,
    });
  });

  it('appends clipboard text when no selection is available', () => {
    expect(replaceClipboardRange('<xml/>', '\n<!-- pasted -->', null, null)).toEqual({
      value: '<xml/>\n<!-- pasted -->',
      caret: 22,
    });
  });
});
