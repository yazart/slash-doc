export type MkDocsGridItem = { id: string; content: string };
export type MkDocsGridData = { cards: boolean; items: MkDocsGridItem[] };

export function normalizeMkDocsGrid(value: unknown): MkDocsGridData {
  const data = isRecord(value) ? value : {};
  const ids = new Set<string>();
  const items = Array.isArray(data.items)
    ? data.items.filter(isRecord).map((item, index) => {
        let id = typeof item.id === 'string' && item.id ? item.id : `grid-${index + 1}`;
        while (ids.has(id)) id += '-copy';
        ids.add(id);
        return { id, content: typeof item.content === 'string' ? item.content : '' };
      })
    : [];
  return { cards: data.cards !== false, items };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
