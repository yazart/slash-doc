import { describe, expect, it } from 'vitest';
import { shouldExitList } from '../src/webview/list-exit-handler';

describe('Editor.js list exit', () => {
  it('exits only from the last empty item after another list item', () => {
    const first = item('Text');
    const empty = item('  \u200b');

    expect(shouldExitList(empty, [first, empty])).toBe(true);
    expect(shouldExitList(first, [first, empty])).toBe(false);
  });

  it('does not exit from a single empty or non-empty item', () => {
    const empty = item('');
    const text = item('Text');

    expect(shouldExitList(empty, [empty])).toBe(false);
    expect(shouldExitList(text, [empty, text])).toBe(false);
  });
});

function item(textContent: string): Pick<HTMLElement, 'textContent'> {
  return { textContent };
}
