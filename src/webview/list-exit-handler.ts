type ListBlocksApi = {
  getCurrentBlockIndex(): number;
  insert(
    type?: string,
    data?: Record<string, unknown>,
    config?: object,
    index?: number,
    needToFocus?: boolean,
  ): unknown;
};

type CaretApi = {
  setToBlock(index: number, position?: 'end' | 'start' | 'default', offset?: number): boolean;
};

export function installListExitHandler(holder: Element, blocks: ListBlocksApi, caret: CaretApi): void {
  holder.addEventListener(
    'keydown',
    (event) => {
      if (!(event instanceof KeyboardEvent) || event.key !== 'Enter' || event.isComposing) return;
      const item = findCurrentListItem(event);
      const list = item?.closest<HTMLElement>('.cdx-list');
      if (!item || !list) return;
      const items = Array.from(list.querySelectorAll<HTMLElement>(':scope > .cdx-list__item'));
      if (!shouldExitList(item, items)) return;
      const blockIndex = blocks.getCurrentBlockIndex();
      event.preventDefault();
      event.stopImmediatePropagation();
      item.remove();
      blocks.insert('paragraph', { text: '' }, undefined, blockIndex + 1, true);
      caret.setToBlock(blockIndex + 1, 'start');
    },
    true,
  );
}

export function shouldExitList(
  item: Pick<HTMLElement, 'textContent'>,
  items: Array<Pick<HTMLElement, 'textContent'>>,
): boolean {
  return items.length >= 2 && items.at(-1) === item && isEmptyText(item.textContent);
}

function findCurrentListItem(event: KeyboardEvent): HTMLElement | undefined {
  const fromPath = event
    .composedPath()
    .find((target): target is HTMLElement => target instanceof HTMLElement && target.matches('.cdx-list__item'));
  if (fromPath) return fromPath;
  const anchor = window.getSelection()?.anchorNode;
  const element = anchor instanceof Element ? anchor : anchor?.parentElement;
  return element?.closest<HTMLElement>('.cdx-list__item') ?? undefined;
}

function isEmptyText(value: string | null): boolean {
  return !(value ?? '').replaceAll(/[\s\u200B-\u200D\uFEFF]/g, '');
}
