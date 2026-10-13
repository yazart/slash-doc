import type { BlockEditorElement } from './block-editor-element';

type Point = { x: number; y: number };
type Rectangle = { left: number; top: number; right: number; bottom: number };

export function selectionRectangle(start: Point, end: Point): Rectangle {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  };
}

export function intersectsSelection(selection: Rectangle, block: Rectangle): boolean {
  return (
    selection.left < block.right &&
    selection.right > block.left &&
    selection.top < block.bottom &&
    selection.bottom > block.top
  );
}

/** Start only in editor whitespace so text, widgets and block dragging retain their gestures. */
export function installBlockAreaSelection(editor: BlockEditorElement): () => void {
  const scope = editor.parentElement ?? editor;
  const marquee = document.createElement('div');
  marquee.className = 'slash-block-selection-area';
  marquee.setAttribute('aria-hidden', 'true');
  let gesture:
    | {
        pointerId: number;
        start: Point;
        point: Point;
        initial: Point;
        before: Set<string>;
        index: number;
        additive: boolean;
        active: boolean;
        scroll: HTMLElement;
      }
    | undefined;
  let frame: number | undefined;
  let suppressClick = false;

  const update = () => {
    if (!gesture?.active) return;
    const rect = editor.getBoundingClientRect();
    const area = selectionRectangle({ x: rect.left + gesture.start.x, y: rect.top + gesture.start.y }, gesture.point);
    Object.assign(marquee.style, {
      left: `${area.left}px`,
      top: `${area.top}px`,
      width: `${area.right - area.left}px`,
      height: `${area.bottom - area.top}px`,
    });
    const hits = editor.views
      .filter((view) => {
        const bounds = view.holder.getBoundingClientRect();
        // The empty insertion strip below a block is not part of its visible content.
        return intersectsSelection(area, {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: Math.min(
            bounds.bottom,
            view.content.getBoundingClientRect().bottom + parseFloat(getComputedStyle(view.holder).paddingBottom),
          ),
        });
      })
      .map((view) => view.output.id!);
    const ids = new Set(gesture.additive ? gesture.before : []);
    hits.forEach((id) => ids.add(id));
    const active = gesture.point.y < rect.top + gesture.start.y ? hits[0] : hits.at(-1);
    editor.selectBlocks(ids, active);
  };

  const autoScroll = () => {
    frame = undefined;
    if (!gesture?.active) return;
    if (editor.readOnly || !editor.isConnected) {
      finish(true);
      return;
    }
    const scrolling = gesture.scroll;
    const bounds =
      scrolling === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : scrolling.getBoundingClientRect();
    const top = Math.max(0, bounds.top);
    const bottom = Math.min(window.innerHeight, bounds.bottom);
    const y = gesture.point.y;
    const speed =
      y < top + 32 ? -Math.min(18, (top + 32 - y) / 2) : y > bottom - 32 ? Math.min(18, (y - bottom + 32) / 2) : 0;
    if (speed) {
      const previous = scrolling.scrollTop;
      scrolling.scrollTop += speed;
      if (previous !== scrolling.scrollTop) update();
    }
    frame = window.requestAnimationFrame(autoScroll);
  };

  const finish = (cancel = false) => {
    if (!gesture) return;
    const previous = gesture;
    gesture = undefined;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    marquee.remove();
    editor.classList.remove('slash-block-area-selecting');
    if (scope.hasPointerCapture(previous.pointerId)) scope.releasePointerCapture(previous.pointerId);
    if (cancel && previous.active) {
      editor.selectBlocks(previous.before, editor.views[previous.index]?.output.id);
      editor.currentIndex = previous.index;
    }
  };

  const down = (event: PointerEvent) => {
    // Reset on a new gesture, retaining suppression through mouseup after Escape.
    if (!gesture) suppressClick = false;
    if (editor.readOnly || event.button !== 0 || !event.isPrimary || event.pointerType !== 'mouse') return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target !== scope &&
      target !== editor &&
      target !== editor.querySelector('.codex-editor__redactor') &&
      !(target.matches('.slash-block-insertion-space') && editor.contains(target))
    )
      return;
    finish(true);
    suppressClick = false;
    const rect = editor.getBoundingClientRect();
    gesture = {
      pointerId: event.pointerId,
      start: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      point: { x: event.clientX, y: event.clientY },
      initial: { x: event.clientX, y: event.clientY },
      before: new Set(editor.selected),
      index: editor.currentIndex,
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
      active: false,
      scroll: findScrollContainer(scope),
    };
  };
  const move = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture.point = { x: event.clientX, y: event.clientY };
    if (!gesture.active) {
      if (Math.hypot(event.clientX - gesture.initial.x, event.clientY - gesture.initial.y) < 5) return;
      gesture.active = true;
      suppressClick = true;
      editor.closeBlockMenu();
      editor.focus({ preventScroll: true });
      window.getSelection()?.removeAllRanges();
      editor.classList.add('slash-block-area-selecting');
      document.body.append(marquee);
      scope.setPointerCapture(event.pointerId);
      frame = window.requestAnimationFrame(autoScroll);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    update();
  };
  const up = (event: PointerEvent) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.active && event.type === 'pointerup') {
      gesture.point = { x: event.clientX, y: event.clientY };
      update();
      event.preventDefault();
    }
    finish(event.type === 'pointercancel');
  };
  const cancel = (event: KeyboardEvent) => {
    if (!gesture || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    finish(true);
  };
  const click = (event: MouseEvent) => {
    if (!suppressClick || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  };
  const blur = () => finish(true);
  scope.addEventListener('pointerdown', down, true);
  scope.addEventListener('click', click, true);
  document.addEventListener('pointermove', move, { capture: true, passive: false });
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  window.addEventListener('keydown', cancel, true);
  window.addEventListener('blur', blur);
  return () => {
    finish();
    scope.removeEventListener('pointerdown', down, true);
    scope.removeEventListener('click', click, true);
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', up, true);
    window.removeEventListener('keydown', cancel, true);
    window.removeEventListener('blur', blur);
  };
}

function findScrollContainer(element: HTMLElement): HTMLElement {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return document.scrollingElement as HTMLElement;
}
