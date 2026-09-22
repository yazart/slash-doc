import type { OutputData } from '@editorjs/editorjs';
import { migrateApprovalTableData } from '../shared/approval-table-migration';
import { removePageTime } from '../shared/page-content';
import { normalizeParagraphText } from './persistent-paragraph-tool';
import { readListItems } from './nested-list-tool';

export function normalizeEditorData(value: unknown): OutputData {
  const source = isRecord(value) ? value : {};
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  return removePageTime({
    ...source,
    blocks: blocks.filter(isRecord).map(migrateTableBlock),
  }) as OutputData;
}

function migrateTableBlock(block: Record<string, unknown>): Record<string, unknown> {
  if (block.type === 'approvalTable') {
    return { ...block, type: 'confluenceTable', data: migrateApprovalTableData(block.data) };
  }
  if (block.type !== 'table') return block;
  return {
    ...block,
    type: 'confluenceTable',
    data: isRecord(block.data)
      ? {
          rows: Array.isArray(block.data.content) ? block.data.content : [],
          headerRow: block.data.withHeadings === true,
          headerColumn: false,
        }
      : { rows: [['']], headerRow: false, headerColumn: false },
  };
}

export function preserveInlineMarkup(data: OutputData): OutputData {
  const blockElements = Array.from(document.querySelectorAll<HTMLElement>('#editor .ce-block'));
  data.blocks.forEach((block, index) => {
    const element = blockElements[index];
    if (!element || !isRecord(block.data)) return;
    if (block.type === 'paragraph' || block.type === 'header') {
      const editable = element.querySelector<HTMLElement>('.ce-paragraph, .ce-header, [contenteditable="true"]');
      if (editable) {
        block.data.text = block.type === 'paragraph' ? normalizeParagraphText(editable.innerHTML) : editable.innerHTML;
      }
      return;
    }
    if (block.type === 'list') {
      const list = element.querySelector<HTMLElement>('.cdx-list');
      const items = list ? readListItems(list) : [];
      if (items.length > 0) block.data.items = items;
    }
  });
  return removePageTime(data) as OutputData;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
