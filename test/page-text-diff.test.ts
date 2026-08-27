import { describe, expect, it } from 'vitest';
import { diffText } from '../src/webview/page-text-diff';

describe('page text Git diff', () => {
  it('marks changed words while preserving surrounding text', () => {
    expect(diffText('Старый текст блока', 'Новый текст блока')).toEqual([
      { value: 'Старый', kind: 'removed' },
      { value: 'Новый', kind: 'added' },
      { value: ' текст блока', kind: 'equal' },
    ]);
  });

  it('marks text inserted inside a block', () => {
    expect(diffText('Один блок', 'Один новый блок')).toEqual([
      { value: 'Один', kind: 'equal' },
      { value: ' новый', kind: 'added' },
      { value: ' блок', kind: 'equal' },
    ]);
  });
});
