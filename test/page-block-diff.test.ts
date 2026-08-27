import { describe, expect, it } from 'vitest';
import { diffPageBlocks } from '../src/webview/page-block-diff';

describe('page block Git diff', () => {
  it('classifies added, modified, removed, and unchanged blocks', () => {
    const previous = {
      blocks: [
        { id: 'header', type: 'header', data: { text: 'Title' } },
        { id: 'changed', type: 'paragraph', data: { text: 'Before' } },
        { id: 'removed', type: 'paragraph', data: { text: 'Removed' } },
      ],
    };
    const next = {
      blocks: [
        { id: 'header', type: 'header', data: { text: 'Title' } },
        { id: 'changed', type: 'paragraph', data: { text: 'After' } },
        { id: 'added', type: 'codeBlock', data: { code: 'new' } },
      ],
    };

    expect(diffPageBlocks(previous, next).map(({ block, status }) => [block.id, status])).toEqual([
      ['header', 'unchanged'],
      ['changed', 'modified'],
      ['removed', 'removed'],
      ['added', 'added'],
    ]);
    expect(diffPageBlocks(previous, next).find(({ status }) => status === 'modified')?.previousBlock?.id).toBe(
      'changed',
    );
  });

  it('matches legacy blocks without ids by type and position', () => {
    const previous = { blocks: [{ type: 'paragraph', data: { text: 'Before' } }] };
    const next = { blocks: [{ type: 'paragraph', data: { text: 'After' } }] };

    expect(diffPageBlocks(previous, next)[0].status).toBe('modified');
  });
});
