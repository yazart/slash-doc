import { describe, expect, it } from 'vitest';
import PersistentParagraphTool, { normalizeParagraphText } from '../src/webview/persistent-paragraph-tool';

describe('Persistent paragraph tool', () => {
  it('normalizes browser placeholders to an empty string', () => {
    expect(normalizeParagraphText('')).toBe('');
    expect(normalizeParagraphText('<br>')).toBe('');
    expect(normalizeParagraphText('<div>&nbsp;</div><div><br></div>')).toBe('');
  });

  it('preserves non-empty inline markup', () => {
    const text = '<strong>Text</strong> <span style="color:red">value</span>';
    expect(normalizeParagraphText(text)).toBe(text);
  });

  it('validates empty data so Editor.js keeps the block in JSON', () => {
    const tool = new PersistentParagraphTool({ data: { text: '' }, readOnly: false } as never);
    expect(tool.validate()).toBe(true);
    expect(tool.save({ innerHTML: '<br>' } as HTMLElement)).toEqual({ text: '' });
  });
});
