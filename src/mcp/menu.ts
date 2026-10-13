export type McpMenuItem = {
  id: string;
  title: string;
  file: string;
  children: McpMenuItem[];
};

export type FlatMcpPage = { id: string; title: string; depth: number; path: string[] };
export type MovePosition = 'before' | 'inside' | 'after' | 'root';

export function normalizeMcpMenu(value: unknown): McpMenuItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => {
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id || /[\\/]/.test(id)) throw new Error(`Некорректный идентификатор страницы: ${id || '(пусто)'}`);
    return {
      id,
      title: typeof item.title === 'string' ? item.title : 'Без названия',
      file: `${id}/content.yaml`,
      children: normalizeMcpMenu(item.children),
    };
  });
}

export function flattenMcpMenu(items: McpMenuItem[], parents: string[] = []): FlatMcpPage[] {
  return items.flatMap((item) => {
    const path = [...parents, item.title];
    return [{ id: item.id, title: item.title, depth: parents.length, path }, ...flattenMcpMenu(item.children, path)];
  });
}

export function findMcpPage(items: McpMenuItem[], pageId: string): McpMenuItem | undefined {
  for (const item of items) {
    if (item.id === pageId) return item;
    const child = findMcpPage(item.children, pageId);
    if (child) return child;
  }
  return undefined;
}

export function addMcpPage(items: McpMenuItem[], page: McpMenuItem, parentId?: string): void {
  if (!parentId) {
    items.push(page);
    return;
  }
  const parent = findMcpPage(items, parentId);
  if (!parent) throw new Error(`Родительская страница не найдена: ${parentId}`);
  parent.children.push(page);
}

export function removeMcpPage(items: McpMenuItem[], pageId: string): McpMenuItem | undefined {
  const index = items.findIndex((item) => item.id === pageId);
  if (index >= 0) return items.splice(index, 1)[0];
  for (const item of items) {
    const removed = removeMcpPage(item.children, pageId);
    if (removed) return removed;
  }
  return undefined;
}

export function moveMcpPage(
  items: McpMenuItem[],
  pageId: string,
  targetId: string | undefined,
  position: MovePosition,
): void {
  const page = findMcpPage(items, pageId);
  if (!page) throw new Error(`Страница не найдена: ${pageId}`);
  if (targetId === pageId || (targetId && findMcpPage(page.children, targetId))) {
    throw new Error('Нельзя переместить страницу внутрь самой себя или её потомка.');
  }
  const removed = removeMcpPage(items, pageId);
  if (!removed) throw new Error(`Страница не найдена: ${pageId}`);
  try {
    if (position === 'root') {
      items.push(removed);
      return;
    }
    if (!targetId) throw new Error(`Для позиции ${position} требуется targetId.`);
    if (position === 'inside') {
      const target = findMcpPage(items, targetId);
      if (!target) throw new Error(`Целевая страница не найдена: ${targetId}`);
      target.children.push(removed);
      return;
    }
    const location = findLocation(items, targetId);
    if (!location) throw new Error(`Целевая страница не найдена: ${targetId}`);
    location.items.splice(location.index + (position === 'after' ? 1 : 0), 0, removed);
  } catch (error) {
    items.push(removed);
    throw error;
  }
}

export function collectMcpPageIds(page: McpMenuItem): string[] {
  return [page.id, ...page.children.flatMap(collectMcpPageIds)];
}

function findLocation(items: McpMenuItem[], pageId: string): { items: McpMenuItem[]; index: number } | undefined {
  const index = items.findIndex((item) => item.id === pageId);
  if (index >= 0) return { items, index };
  for (const item of items) {
    const result = findLocation(item.children, pageId);
    if (result) return result;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
