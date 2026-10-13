type PageDropPosition = 'before' | 'inside' | 'after';
type PageDropTarget = { targetId?: string; position: PageDropPosition | 'root' };

export function setupPageTree(
  collapsedPageIds: Set<string>,
  postMessage: (message: unknown) => void,
  saveState: () => void,
): void {
  const setCollapsed = (pageId: string, collapsed: boolean, persist = true) => {
    const node = document.querySelector<HTMLElement>(`[data-tree-node-id="${CSS.escape(pageId)}"]`);
    const toggle = node?.querySelector<HTMLButtonElement>(':scope > .tree-row [data-toggle-page-id]');
    node?.classList.toggle('collapsed', collapsed);
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', collapsed ? 'Развернуть дочерние страницы' : 'Свернуть дочерние страницы');
    if (collapsed) collapsedPageIds.add(pageId);
    else collapsedPageIds.delete(pageId);
    if (persist) saveState();
  };

  document.querySelectorAll<HTMLButtonElement>('[data-toggle-page-id]').forEach((button) => {
    const pageId = button.dataset.togglePageId;
    if (!pageId) return;
    setCollapsed(pageId, collapsedPageIds.has(pageId), false);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setCollapsed(pageId, !collapsedPageIds.has(pageId));
    });
  });

  bindPageDragAndDrop(setCollapsed, postMessage);
}

function bindPageDragAndDrop(
  setCollapsed: (pageId: string, collapsed: boolean) => void,
  postMessage: (message: unknown) => void,
): void {
  const handles = Array.from(document.querySelectorAll<HTMLElement>('[data-drag-page-id]'));
  const rootDrop = document.querySelector<HTMLElement>('[data-root-drop]');
  const tree = document.querySelector<HTMLElement>('.tree');
  const clearDropTargets = () => {
    document.querySelectorAll('.drop-before,.drop-inside,.drop-after,.drop-target').forEach((element) => {
      element.classList.remove('drop-before', 'drop-inside', 'drop-after', 'drop-target');
    });
  };

  handles.forEach((handle) => {
    handle.addEventListener('pointerdown', (startEvent) => {
      if (startEvent.button !== 0) return;
      const draggedPageId = handle.dataset.dragPageId;
      const sourceRow = handle.closest<HTMLElement>('.tree-row');
      if (!draggedPageId || !sourceRow) return;
      startEvent.stopPropagation();
      const startX = startEvent.clientX;
      const startY = startEvent.clientY;
      const pointerId = startEvent.pointerId;
      let dragging = false;
      let dropTarget: PageDropTarget | undefined;
      let ghost: HTMLElement | undefined;

      const move = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        if (!dragging && Math.hypot(event.clientX - startX, event.clientY - startY) < 4) return;
        event.preventDefault();
        if (!dragging) {
          dragging = true;
          sourceRow.classList.add('dragging');
          document.body.classList.add('page-dragging');
          ghost = createPageDragGhost(sourceRow.querySelector('.tree-label')?.textContent ?? 'Страница');
          document.body.append(ghost);
        }
        if (ghost) {
          ghost.style.left = `${event.clientX + 12}px`;
          ghost.style.top = `${event.clientY + 12}px`;
        }
        autoScrollPageTree(tree, event.clientY);
        clearDropTargets();
        dropTarget = undefined;
        const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        if (rootDrop && hit?.closest('[data-root-drop]') === rootDrop) {
          rootDrop.classList.add('drop-target');
          dropTarget = { position: 'root' };
          return;
        }
        const row = hit?.closest<HTMLElement>('[data-page-drop-id]');
        if (!row || !canDropOnRow(row, draggedPageId)) return;
        const position = getPageDropPosition(row, event.clientY);
        row.classList.add(`drop-${position}`);
        dropTarget = { targetId: row.dataset.pageDropId, position };
      };

      const finish = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        document.removeEventListener('pointermove', move, true);
        document.removeEventListener('pointerup', finish, true);
        document.removeEventListener('pointercancel', cancel, true);
        clearDropTargets();
        sourceRow.classList.remove('dragging');
        document.body.classList.remove('page-dragging');
        ghost?.remove();
        if (dragging && dropTarget) {
          if (dropTarget.position === 'inside' && dropTarget.targetId) setCollapsed(dropTarget.targetId, false);
          postMessage({ type: 'movePage', pageId: draggedPageId, ...dropTarget });
        }
        if (dragging) {
          handle.dataset.suppressClick = 'true';
          setTimeout(() => delete handle.dataset.suppressClick, 0);
        }
      };
      const cancel = (event: PointerEvent) => {
        dropTarget = undefined;
        finish(event);
      };
      document.addEventListener('pointermove', move, { capture: true, passive: false });
      document.addEventListener('pointerup', finish, true);
      document.addEventListener('pointercancel', cancel, true);
    });
  });
}

function canDropOnRow(row: HTMLElement, draggedPageId: string): boolean {
  if (row.dataset.pageDropId === draggedPageId) return false;
  const draggedNode = document
    .querySelector<HTMLElement>(`[data-drag-page-id="${CSS.escape(draggedPageId)}"]`)
    ?.closest('.tree-node');
  return !draggedNode?.contains(row);
}

function getPageDropPosition(row: HTMLElement, clientY: number): PageDropPosition {
  const bounds = row.getBoundingClientRect();
  const offset = (clientY - bounds.top) / Math.max(bounds.height, 1);
  if (offset < 0.25) return 'before';
  if (offset > 0.75) return 'after';
  return 'inside';
}

function createPageDragGhost(title: string): HTMLElement {
  const ghost = document.createElement('div');
  ghost.className = 'page-drag-ghost';
  ghost.textContent = title;
  return ghost;
}

function autoScrollPageTree(tree: HTMLElement | null, clientY: number): void {
  if (!tree) return;
  const bounds = tree.getBoundingClientRect();
  if (clientY < bounds.top + 28) tree.scrollTop -= 10;
  if (clientY > bounds.bottom - 28) tree.scrollTop += 10;
}
