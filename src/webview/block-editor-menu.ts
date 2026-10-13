import type { BlockEditorElement } from './block-editor-element';
import { button, toolSettings } from './block-editor-view';
import { convertBlockType } from './block-editor-conversion';
import { LUCIDE_ICONS } from './lucide-icons';
import { orderedBlockTypes } from '../shared/block-tool-order';

export class BlockEditorMenu {
  private menu?: HTMLElement;
  private restoreFocus?: HTMLElement;
  private cleanups: Array<() => void> = [];
  constructor(private readonly editor: BlockEditorElement) {}
  insertAfter(index: number, anchor?: HTMLElement): void {
    const id = this.editor.views[index]?.output.id;
    this.open(
      'Добавить блок',
      anchor?.getBoundingClientRect() ?? this.editor.views[index]?.holder.getBoundingClientRect(),
      async (type) => {
        const target = id ? this.editor.indexOf(id) : this.editor.views.length - 1;
        if (id && target < 0) return;
        this.editor.api.blocks.insert(type, {}, undefined, target + 1, true);
      },
    );
  }
  changeType(id: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.open(
      'Тип блока',
      event.type === 'contextmenu' || !(event.currentTarget instanceof HTMLElement)
        ? { left: event.clientX, bottom: event.clientY }
        : event.currentTarget.getBoundingClientRect(),
      (type) => convertBlockType(this.editor, id, type),
      this.editor.views.find((view) => view.output.id === id)?.output.type,
    );
  }
  close(restore = false): void {
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.menu?.remove();
    this.menu = undefined;
    if (restore && this.restoreFocus?.isConnected) this.restoreFocus.focus();
  }
  private open(
    title: string,
    rect: Pick<DOMRect, 'left' | 'bottom'> | undefined,
    action: (type: string) => Promise<void>,
    current?: string,
  ): void {
    this.close();
    if (this.editor.readOnly) return;
    this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : this.editor;
    const menu = document.createElement('div');
    menu.className = 'slash-block-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', title);
    const heading = document.createElement('strong');
    heading.textContent = title;
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Поиск блоков';
    search.setAttribute('aria-label', 'Поиск блоков');
    const list = document.createElement('div');
    list.setAttribute('role', 'menu');
    const buttons: HTMLButtonElement[] = [];
    for (const name of orderedBlockTypes(Object.keys(this.editor.config.tools ?? {}))) {
      const settings = toolSettings(this.editor.config.tools!, name)!;
      if (settings.class.isInline || settings.toolbox === false) continue;
      const label = settings.toolbox?.title ?? settings.class.toolbox?.title ?? name;
      const item = button(label, '');
      const icon = document.createElement('span');
      icon.className = 'slash-block-menu-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = settings.toolbox?.icon ?? settings.class.toolbox?.icon ?? LUCIDE_ICONS.panelsTopLeft;
      const text = document.createElement('span');
      text.textContent = label;
      item.append(icon, text);
      item.dataset.blockType = name;
      item.setAttribute('role', 'menuitem');
      if (name === current) item.setAttribute('aria-current', 'true');
      item.addEventListener('click', () => {
        this.close();
        void action(name).catch((error: unknown) => {
          this.editor.status.textContent = error instanceof Error ? error.message : String(error);
        });
      });
      buttons.push(item);
      list.append(item);
    }
    search.addEventListener('input', () => {
      buttons.forEach((item) => {
        item.hidden = !item.textContent?.toLocaleLowerCase().includes(search.value.toLocaleLowerCase());
      });
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close(true);
      }
      const visible = buttons.filter((item) => !item.hidden);
      const index = visible.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        visible[(index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length]?.focus();
      }
      if (event.key === 'Enter' && event.target === search) {
        event.preventDefault();
        visible[0]?.click();
      }
    });
    menu.append(heading, search, list);
    document.body.append(menu);
    this.menu = menu;
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect?.left ?? 8, window.innerWidth - bounds.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect?.bottom ?? 8, window.innerHeight - bounds.height - 8))}px`;
    const outside = (event: Event) => {
      if (!event.composedPath().includes(menu)) this.close();
    };
    const close = () => this.close();
    const scroll = (event: Event) => {
      if (!event.composedPath().includes(menu)) this.close();
    };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    this.cleanups.push(
      () => document.removeEventListener('pointerdown', outside, true),
      () => window.removeEventListener('resize', close),
      () => window.removeEventListener('scroll', scroll, true),
    );
    search.focus({ preventScroll: true });
  }
}
