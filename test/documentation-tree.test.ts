import { describe, expect, it } from 'vitest';
import { createDocumentationTree, renderMarkdownContents } from '../src/shared/documentation-tree';
import type { SlashDocMenuItem } from '../src/extension/types';

describe('Markdown documentation tree', () => {
  it('creates safe unique directories for sibling pages', () => {
    const items: SlashDocMenuItem[] = [page('one', 'API / Intro'), page('two', 'API / Intro'), page('three', '..')];
    const pages = createDocumentationTree(items);

    expect(pages.map((item) => item.directories)).toEqual([['API - Intro'], ['API - Intro (2)'], ['Страница']]);
    expect(renderMarkdownContents(items, pages)).toContain('[API / Intro](API%20-%20Intro/API%20-%20Intro.md)');
  });
});

function page(id: string, title: string): SlashDocMenuItem {
  return { id, title, file: `${id}/content.json`, children: [] };
}
