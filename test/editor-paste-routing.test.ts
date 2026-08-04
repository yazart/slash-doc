import { describe, expect, it, vi } from 'vitest';
import { findPasteActionInPath } from '../src/webview/editor-paste-handlers';

describe('Editor paste routing', () => {
  it('does not intercept paste in a regular Editor.js list item', () => {
    const listItem = elementMatching('.cdx-list__item');

    expect(findPasteActionInPath([listItem])).toBeUndefined();
  });

  it('routes paste only when the event path contains a Confluence Table cell', () => {
    const paste = vi.fn();
    const tableCell = Object.assign(elementMatching('.ct-cell'), { __slashDocPasteTable: paste });
    const action = findPasteActionInPath([tableCell]);

    action?.('one\ttwo', '');
    expect(paste).toHaveBeenCalledWith('one\ttwo', '');
  });
});

function elementMatching(selector: string): EventTarget {
  return { matches: (value: string) => value === selector } as unknown as EventTarget;
}
