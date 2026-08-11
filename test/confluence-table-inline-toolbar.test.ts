import { describe, expect, it } from 'vitest';
import { calculateToolbarPosition, selectContainedRange } from '../src/webview/confluence-table-inline-toolbar';

describe('Confluence table inline toolbar', () => {
  it('prefers a range contained in the active cell over an outside stale range', () => {
    const insideNode = {} as Node;
    const outsideNode = {} as Node;
    const outside = { collapsed: false, commonAncestorContainer: outsideNode } as Range;
    const inside = { collapsed: false, commonAncestorContainer: insideNode } as Range;
    const container = { contains: (node: Node) => node === insideNode } as Node;

    expect(selectContainedRange(container, [outside, inside])).toBe(inside);
  });

  it('ignores collapsed ranges', () => {
    const node = {} as Node;
    const collapsed = { collapsed: true, commonAncestorContainer: node } as Range;
    const container = { contains: () => true } as unknown as Node;

    expect(selectContainedRange(container, [collapsed])).toBeUndefined();
  });

  it('positions the toolbar above and centered on the selected text', () => {
    expect(
      calculateToolbarPosition(
        { left: 300, top: 200, bottom: 220, width: 100 },
        { width: 200, height: 40 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 250, top: 152 });
  });

  it('moves the toolbar below a selection near the top edge', () => {
    expect(
      calculateToolbarPosition(
        { left: 10, top: 5, bottom: 25, width: 40 },
        { width: 120, height: 40 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ left: 8, top: 33 });
  });
});
