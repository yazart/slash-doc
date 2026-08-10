import { describe, expect, it, vi } from 'vitest';
import { findPasteActionInPath, insertTextIntoControl } from '../src/webview/editor-paste-handlers';

describe('Editor paste routing', () => {
  it('routes paste to a regular Editor.js list item', () => {
    const listItem = elementMatching('.cdx-list__item');

    expect(findPasteActionInPath([listItem])).toBeTypeOf('function');
  });

  it.each(['.ce-paragraph', '.ce-header'])('routes paste to Editor.js text element %s', (selector) => {
    expect(findPasteActionInPath([elementMatching(selector)])).toBeTypeOf('function');
  });

  it('routes paste to the Mermaid source textarea', () => {
    const textarea = Object.assign(elementMatching('.slash-mermaid-code'), { selectionStart: 2, selectionEnd: 4 });

    expect(findPasteActionInPath([textarea])).toBeTypeOf('function');
  });

  it('routes paste to the highlighted Code and Diff textarea', () => {
    const textarea = Object.assign(elementMatching('.slash-highlight-input'), { selectionStart: 2, selectionEnd: 4 });

    expect(findPasteActionInPath([textarea])).toBeTypeOf('function');
  });

  it('routes paste only when the event path contains a Confluence Table cell', () => {
    const paste = vi.fn();
    const tableCell = Object.assign(elementMatching('.ct-cell'), { __slashDocPasteTable: paste });
    const action = findPasteActionInPath([tableCell]);

    action?.('one\ttwo', '');
    expect(paste).toHaveBeenCalledWith('one\ttwo', '');
  });

  it('routes text paste to a textarea inside Image Annotation', () => {
    const textarea = Object.assign(elementMatching('textarea'), { selectionStart: 1, selectionEnd: 2 });
    const annotation = elementMatching('slash-image-annotation');

    expect(findPasteActionInPath([textarea, annotation])).toBeTypeOf('function');
  });

  it('replaces the selected textarea range and emits an input event', () => {
    const events: Event[] = [];
    const textarea = {
      selectionStart: 1,
      selectionEnd: 3,
      focus: vi.fn(),
      setRangeText: vi.fn(),
      dispatchEvent: (event: Event) => {
        events.push(event);
        return true;
      },
    } as unknown as HTMLTextAreaElement;

    insertTextIntoControl(textarea, 'new');

    expect(textarea.setRangeText).toHaveBeenCalledWith('new', 1, 3, 'end');
    expect(events[0]).toMatchObject({ type: 'input', bubbles: true, composed: true });
  });
});

function elementMatching(selector: string): EventTarget {
  return { matches: (value: string) => value === selector } as unknown as EventTarget;
}
