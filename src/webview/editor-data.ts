import type { OutputData } from '@editorjs/editorjs';

export function normalizeEditorData(value: unknown): OutputData {
  const source = isRecord(value) ? value : {};
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  return {
    ...source,
    blocks: blocks.filter(isRecord).map((block) =>
      block.type === 'table'
        ? {
            ...block,
            type: 'confluenceTable',
            data: isRecord(block.data)
              ? {
                  rows: Array.isArray(block.data.content) ? block.data.content : [],
                  headerRow: block.data.withHeadings === true,
                  headerColumn: false,
                }
              : { rows: [['']], headerRow: false, headerColumn: false },
          }
        : block,
    ),
  } as unknown as OutputData;
}

export function preserveInlineMarkup(data: OutputData): OutputData {
  const blockElements = Array.from(document.querySelectorAll<HTMLElement>('#editor .ce-block'));
  data.blocks.forEach((block, index) => {
    const element = blockElements[index];
    if (!element || !isRecord(block.data)) return;
    if (block.type === 'paragraph' || block.type === 'header') {
      const editable = element.querySelector<HTMLElement>('.ce-paragraph, .ce-header, [contenteditable="true"]');
      if (editable) block.data.text = editable.innerHTML;
      return;
    }
    if (block.type === 'list') {
      const items = Array.from(element.querySelectorAll<HTMLElement>('.cdx-list__item')).map((item) => item.innerHTML);
      if (items.length > 0) block.data.items = items;
    }
  });
  return data;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
