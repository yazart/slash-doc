import type { API } from '@editorjs/editorjs/types';
import type { InlineTool, MenuConfig } from '@editorjs/editorjs/types/tools';
import type { PopoverItemType } from '@editorjs/editorjs/types/utils/popover';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export default class TextColorTool implements InlineTool {
  private readonly api: API;
  private range?: Range;

  static get isInline(): boolean {
    return true;
  }

  static get title(): string {
    return 'Цвет текста';
  }

  static get sanitize(): Record<string, Record<string, boolean>> {
    return {
      span: {
        class: true,
        style: true,
        'data-slash-text-color': true,
      },
    };
  }

  constructor({ api }: { api: API }) {
    this.api = api;
  }

  render(): MenuConfig {
    this.captureRange();
    return {
      icon: '<svg class="slash-text-color-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15.5h10M7 13l3-9 3 9M8.1 10h3.8"/><path class="color-line" d="M4 18h12"/></svg>',
      title: 'Цвет текста',
      isActive: () => Boolean(this.api.selection.findParentTag('SPAN', 'slash-text-color')),
      children: {
        isFlippable: false,
        items: [
          {
            type: 'html' as PopoverItemType.Html,
            element: this.createPalette(),
          },
        ],
        onOpen: () => {
          this.captureRange();
          this.api.selection.setFakeBackground?.();
        },
        onClose: () => this.api.selection.removeFakeBackground?.(),
      },
    };
  }

  private createPalette(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'slash-text-color-actions';
    actions.addEventListener('pointerdown', (event) => event.stopPropagation());
    actions.addEventListener('mousedown', (event) => event.stopPropagation());
    actions.addEventListener('click', (event) => event.stopPropagation());

    for (const color of COLORS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'slash-text-color-swatch';
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.setAttribute('aria-label', `Цвет ${color}`);
      swatch.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      swatch.addEventListener('mousedown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      swatch.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.applyColor(color);
      });
      actions.append(swatch);
    }

    const custom = document.createElement('input');
    custom.className = 'slash-text-color-picker';
    custom.type = 'color';
    custom.value = '#3b82f6';
    custom.title = 'Другой цвет';
    custom.setAttribute('aria-label', 'Другой цвет');
    custom.addEventListener('pointerdown', (event) => event.stopPropagation());
    custom.addEventListener('mousedown', (event) => event.stopPropagation());
    custom.addEventListener('click', (event) => event.stopPropagation());
    custom.addEventListener('change', (event) => {
      event.stopPropagation();
      this.applyColor(custom.value);
    });
    actions.append(custom);
    return actions;
  }

  surround(range: Range | null): void {
    if (!range || range.collapsed) return;
    this.range = range.cloneRange();
  }

  private captureRange(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;
    this.range = range.cloneRange();
    this.api.selection.save?.();
  }

  clear(): void {
    this.api.selection.removeFakeBackground?.();
    this.range = undefined;
  }

  private applyColor(color: string): void {
    const range = this.range;
    if (!range || range.collapsed || !/^#[0-9a-f]{6}$/i.test(color)) return;

    const contents = range.extractContents();
    const span = document.createElement('span');
    span.className = 'slash-text-color';
    span.dataset.slashTextColor = color.toLowerCase();
    span.style.color = color;
    span.append(contents);
    range.insertNode(span);
    this.api.selection.removeFakeBackground?.();
    this.api.selection.expandToTag(span);
    this.range = undefined;
  }
}
