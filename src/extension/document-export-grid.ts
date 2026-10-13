import { normalizeMkDocsGrid } from '../shared/mkdocs-grid';
import { renderEditableContent } from '../shared/editable-content';
import gridStyles from './styles/mkdocs-grid-export.embedded.css?raw';

export function exportMkDocsGrid(data: Record<string, unknown>, format: 'html' | 'md'): string {
  const grid = normalizeMkDocsGrid(data);
  const state = Buffer.from(JSON.stringify(grid), 'utf8').toString('base64');
  if (format === 'md') {
    const items = grid.items
      .map(
        (item) =>
          `<div${grid.cards ? ' class="card"' : ''} markdown>\n\n${renderEditableContent(item.content, true)}\n\n</div>`,
      )
      .join('\n\n');
    return `<div class="grid" markdown data-slash-doc-mkdocs-grid="${state}">\n\n${items}\n\n</div>`;
  }
  const items = grid.items
    .map(
      (item) =>
        `<div class="slash-mkdocs-grid-item${grid.cards ? ' card' : ''}">${renderEditableContent(item.content, true)}</div>`,
    )
    .join('');
  return `<style>${gridStyles}</style><section class="grid slash-mkdocs-grid${grid.cards ? ' cards' : ''}" data-slash-doc-mkdocs-grid="${state}">${items}</section>`;
}
