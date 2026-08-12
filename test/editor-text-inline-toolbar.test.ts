import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_TEXT_INLINE_TARGETS } from '../src/webview/editor-text-inline-toolbar';

describe('shared text inline toolbar', () => {
  it('binds paragraph, header, and list item editors', () => {
    expect(EDITOR_TEXT_INLINE_TARGETS).toEqual([
      '.ce-paragraph[contenteditable="true"]',
      '.ce-header[contenteditable="true"]',
      '.cdx-list__item',
    ]);
  });

  it('does not render the removed header toolbar', async () => {
    const template = await readFile(join(process.cwd(), 'src/extension/editor-webview.ts'), 'utf8');
    const registry = await readFile(join(process.cwd(), 'src/webview/editor-tool-registry.ts'), 'utf8');

    expect(template).not.toContain('header-inline-tools');
    expect(registry).not.toContain('setupHeaderInlineTools');
  });

  it('renders the single-page HTML export as an accessible Lucide icon button', async () => {
    const template = await readFile(join(process.cwd(), 'src/extension/editor-webview.ts'), 'utf8');

    expect(template).toContain('id="export-html"');
    expect(template).toContain(
      'id="export-html" title="Сохранить HTML в корень проекта" aria-label="Экспортировать HTML"',
    );
    expect(template).not.toContain('id="export-html" title="Сохранить HTML в корень проекта">HTML</button>');
    expect(template).toContain('m9 18 3-3-3-3');
  });
});
