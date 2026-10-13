import type { BlockEditorElement } from './block-editor-element';
import type { OutputBlockData } from './block-editor-types';
import { createBlockView, toolSettings } from './block-editor-view';
import { sanitizeTableCellHtml, tableCellHtmlToText } from '../shared/table-cell-html';
import { createTableRows } from './confluence-table-data';

export function blockContent(data: Record<string, any>): string {
  if (typeof data.text === 'string') return data.text;
  if (typeof data.content === 'string') return data.content;
  if (typeof data.code === 'string') return escapeText(data.code).replaceAll('\n', '<br>');
  if (Array.isArray(data.rows)) return data.rows.map((row: string[]) => row.join(' · ')).join('<br>');
  if (Array.isArray(data.tabs)) return data.tabs.map((tab: any) => tab.content ?? '').join('<br>');
  if (Array.isArray(data.items))
    return data.items
      .map((item: any) =>
        typeof item === 'string'
          ? item
          : `${item.content ?? item.text ?? ''}${item.items?.length ? `<br>${blockContent({ items: item.items })}` : ''}`,
      )
      .join('<br>');
  return typeof data.caption === 'string' ? data.caption : '';
}
export function convertedBlockData(
  type: string,
  data: Record<string, any>,
  content = blockContent(data),
): Record<string, any> {
  const text = sanitizeTableCellHtml(content);
  switch (type) {
    case 'paragraph':
    case 'quote':
      return { text };
    case 'header':
      return { text, level: data.level ?? 2 };
    case 'list':
      return { style: data.style === 'ordered' ? 'ordered' : 'unordered', items: [{ content: text, items: [] }] };
    case 'confluenceTable':
      return { rows: createTableRows(text), headerRow: false, headerColumn: false };
    case 'mkdocsAdmonition':
      return { content: text, title: data.title ?? 'Примечание', kind: 'note' };
    case 'mkdocsDetails':
      return { content: text, summary: data.title ?? 'Подробнее', open: true };
    case 'mkdocsTabs':
      return { tabs: [{ title: 'Вкладка', content: text }] };
    case 'mkdocsChecklist':
      return { items: [{ text, checked: false, level: 0 }] };
    case 'mkdocsGrid':
      return { cards: true, items: [{ content: text }] };
    case 'codeBlock':
      return { code: tableCellHtmlToText(text), language: data.language ?? 'plaintext' };
    case 'mermaid':
      return data.code ? { code: data.code, caption: data.caption ?? '' } : { caption: tableCellHtmlToText(text) };
    case 'image':
      return { ...data, caption: text };
    default:
      return { ...data, text, content: text };
  }
}
export async function convertBlockType(editor: BlockEditorElement, id: string, type: string): Promise<void> {
  const source = editor.views.find((view) => view.output.id === id);
  const target = toolSettings(editor.config.tools ?? {}, type);
  if (!source || !target || target.class.isInline || source.output.type === type || editor.readOnly) return;
  const saved = await source.api.save();
  let content = blockContent(saved.data);
  const exporter = toolSettings(editor.config.tools ?? {}, saved.type)?.class.conversionConfig?.export;
  if (typeof exporter === 'function') content = exporter(saved.data);
  else if (exporter && typeof saved.data[exporter] === 'string') content = saved.data[exporter];
  const importer = target.class.conversionConfig?.import;
  const data =
    typeof importer === 'function'
      ? importer(content)
      : importer
        ? { [importer]: content }
        : convertedBlockData(type, saved.data, content);
  // Resolve again after an asynchronous addon save; the block may have moved or been removed.
  const index = editor.views.indexOf(source);
  if (index < 0 || editor.readOnly) return;
  const output: OutputBlockData = { ...saved, type, data };
  const replacement = createBlockView(editor, output);
  source.tool?.removed?.();
  source.dispose?.();
  source.tool?.destroy?.();
  source.holder.replaceWith(replacement.holder);
  editor.views[index] = replacement;
  replacement.tool?.rendered?.();
  editor.api.caret.setToBlock(index, 'start');
  editor.refreshSelection();
  editor.changed(replacement);
}
function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
