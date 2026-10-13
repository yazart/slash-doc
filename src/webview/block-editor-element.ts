import { BlockEditorMenu } from './block-editor-menu';
import { installBlockDrag } from './block-editor-drag';
import { installBlockInsertion } from './block-editor-insertion';
import { installBlockAreaSelection } from './block-editor-selection';
import PersistentParagraphTool from './persistent-paragraph-tool';
import HeaderTool from './header-tool';
import QuoteTool from './quote-tool';
import type { API, EditorConfig, OutputBlockData, OutputData } from './block-editor-types';
import { createEditorApi } from './block-editor-api';
import { createBlockView, saveBlock, type BlockView } from './block-editor-view';
import { installBlockClipboard } from './block-editor-clipboard';
import { cloneClipboardBlocks, encodeBlockClipboard } from './block-clipboard';
import { handleBlockKeydown } from './block-editor-keyboard';
import { handleBlockMovement } from './block-editor-movement';
import './block-editor.css';

/** Light DOM keeps document styles and existing tool surfaces/addons interoperable. */
export class BlockEditorElement extends HTMLElement {
  config: EditorConfig = {};
  readonly api: API = createEditorApi(this);
  views: BlockView[] = [];
  selected = new Set<string>();
  currentIndex = 0;
  cleanups: Array<() => void> = [];
  readonly status = document.createElement('span');
  private readonly content = document.createElement('div');
  private readonly menu = new BlockEditorMenu(this);
  private anchorId?: string;
  private metadata: Omit<OutputData, 'blocks'> = {};
  private rendering = false;
  private destroyed = false;
  private notifying = false;
  get readOnly(): boolean {
    return this.config.readOnly === true;
  }

  async configure(config: EditorConfig): Promise<void> {
    this.config = {
      ...config,
      tools: {
        paragraph: PersistentParagraphTool,
        header: { class: HeaderTool, toolbox: false },
        quote: QuoteTool,
        ...config.tools,
      },
    };
    this.className = 'codex-editor slash-block-editor';
    this.tabIndex = 0;
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', 'Редактор документа');
    this.content.className = 'codex-editor__redactor';
    this.content.style.minHeight = `${config.minHeight ?? 180}px`;
    this.status.className = 'slash-editor-status';
    this.status.setAttribute('role', 'status');
    this.replaceChildren(this.status, this.content);
    this.cleanups.push(
      installBlockClipboard(this),
      installBlockDrag(this),
      installBlockAreaSelection(this),
      installBlockInsertion(this),
    );
    this.addEventListener('focusin', (event) => {
      this.trackBlock(event);
      if (event.composedPath().some((target) => target instanceof HTMLElement && target.isContentEditable))
        this.clearSelection();
    });
    this.addEventListener(
      'pointerdown',
      (event) => {
        this.trackBlock(event);
        const editable = event
          .composedPath()
          .some(
            (target) =>
              target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select')),
          );
        if (editable) this.clearSelection();
      },
      true,
    );
    this.addEventListener('input', (event) => {
      const view = this.viewForEvent(event);
      view?.tool?.updated?.();
      this.changed(view);
    });
    this.addEventListener('change', (event) => this.changed(this.viewForEvent(event)));
    this.addEventListener('keydown', (event) => handleBlockKeydown(this, event));
    this.addEventListener('keydown', (event) => handleBlockMovement(this, event), true);
    await this.render(config.data ?? { blocks: [] });
    if (config.autofocus && !this.readOnly) this.api.caret.setToFirstBlock('start');
    config.onReady?.();
  }
  async render(data: OutputData): Promise<void> {
    this.closeBlockMenu();
    this.rendering = true;
    try {
      for (const view of this.views) {
        view.dispose?.();
        view.tool?.destroy?.();
      }
      this.views = [];
      this.content.replaceChildren();
      this.clearSelection();
      const { blocks, ...metadata } = structuredClone(data);
      delete metadata.time;
      this.metadata = metadata;
      const ids = new Set<string>();
      for (const source of blocks) {
        const block = { ...source };
        if (!block.id || ids.has(block.id)) block.id = crypto.randomUUID();
        ids.add(block.id);
        this.insert(block, this.views.length, false);
      }
      if (!this.views.length && !this.readOnly)
        this.insert({ type: this.config.defaultBlock ?? 'paragraph', data: { text: '' } }, 0, false);
      this.currentIndex = 0;
    } finally {
      this.rendering = false;
    }
  }
  async save(): Promise<OutputData> {
    const blocks = await Promise.all(this.views.map(saveBlock));
    return { ...this.metadata, blocks };
  }
  insert(source: OutputBlockData, index = this.currentIndex + 1, focus = true, config?: object): BlockView {
    if (this.readOnly && !this.rendering) throw new Error('Редактор доступен только для чтения');
    const target = Math.max(0, Math.min(index, this.views.length));
    if (source.id && this.indexOf(source.id) >= 0) source = { ...source, id: crypto.randomUUID() };
    const view = createBlockView(this, source, config);
    this.views.splice(target, 0, view);
    this.content.insertBefore(view.holder, this.content.children[target] ?? null);
    view.tool?.rendered?.();
    if (focus && !this.rendering) this.api.caret.setToBlock(target, 'start');
    this.changed(view, 'block-added');
    return view;
  }
  deleteBlock(index: number, ensureBlock = true): void {
    if (this.readOnly) return;
    const view = this.views[index];
    if (!view) return;
    this.views.splice(index, 1);
    view.tool?.removed?.();
    view.dispose?.();
    view.tool?.destroy?.();
    view.holder.remove();
    this.selected.delete(view.output.id!);
    this.currentIndex = Math.max(0, Math.min(index, this.views.length - 1));
    if (ensureBlock && !this.views.length)
      this.insert({ type: this.config.defaultBlock ?? 'paragraph', data: { text: '' } }, 0);
    this.refreshSelection();
    this.changed(view, 'block-removed');
  }
  move(to: number, from: number): void {
    if (this.readOnly || !this.views[from] || to < 0 || to >= this.views.length || to === from) return;
    const [view] = this.views.splice(from, 1);
    this.views.splice(to, 0, view);
    this.syncOrder();
    this.currentIndex = to;
    view.tool?.moved?.(new CustomEvent('moved', { detail: { fromIndex: from, toIndex: to } }));
    this.changed(view, 'block-moved');
  }
  syncOrder(): void {
    const scrollPositions: Array<{ element: HTMLElement; top: number; left: number }> = [
      { element: this, top: this.scrollTop, left: this.scrollLeft },
    ];
    for (let element = this.parentElement; element; element = element.parentElement) {
      scrollPositions.push({ element, top: element.scrollTop, left: element.scrollLeft });
    }
    // Keep the document mounted: appending every block detaches the whole editor body.
    let next = this.content.firstElementChild;
    for (const view of this.views) {
      if (view.holder !== next) this.content.insertBefore(view.holder, next);
      next = view.holder.nextElementSibling;
    }
    for (const { element, top, left } of scrollPositions) {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
  }
  indexOf(id: string): number {
    return this.views.findIndex((view) => view.output.id === id);
  }
  selectBlock(id: string, range = false, additive = false): void {
    const index = this.indexOf(id);
    if (index < 0) return;
    if (range && this.anchorId && this.indexOf(this.anchorId) >= 0) {
      if (!additive) this.selected.clear();
      const anchor = this.indexOf(this.anchorId);
      this.views
        .slice(Math.min(index, anchor), Math.max(index, anchor) + 1)
        .forEach((view) => this.selected.add(view.output.id!));
    } else {
      if (!additive) this.selected.clear();
      if (additive && this.selected.has(id)) this.selected.delete(id);
      else this.selected.add(id);
      this.anchorId = id;
    }
    this.currentIndex = index;
    window.getSelection()?.removeAllRanges();
    this.refreshSelection();
    this.focus({ preventScroll: true });
    void Promise.all(this.views.filter((view) => this.selected.has(view.output.id!)).map(saveBlock)).catch((error) =>
      this.reportError(error),
    );
  }
  clearSelection(): void {
    this.selected.clear();
    this.anchorId = undefined;
    this.refreshSelection();
  }
  selectBlocks(ids: Iterable<string>, activeId?: string): void {
    this.selected = new Set([...ids].filter((id) => this.indexOf(id) >= 0));
    const active = activeId ?? [...this.views].reverse().find((view) => this.selected.has(view.output.id!))?.output.id;
    this.anchorId = active;
    if (active) this.currentIndex = this.indexOf(active);
    this.refreshSelection();
  }
  refreshSelection(): void {
    for (const view of this.views) {
      const selected = this.selected.has(view.output.id!);
      view.holder.classList.toggle('ce-block--selected', selected);
      view.holder.querySelector('.slash-block-handle')?.setAttribute('aria-pressed', String(selected));
    }
    this.setAttribute(
      'aria-label',
      this.selected.size ? `Редактор документа. Выделено блоков: ${this.selected.size}` : 'Редактор документа',
    );
  }
  async copySelection(cut = false): Promise<void> {
    const selected = this.views.filter((view) => this.selected.has(view.output.id!));
    if (!selected.length) return;
    try {
      const text = encodeBlockClipboard(await Promise.all(selected.map(saveBlock)));
      if (window.__SLASH_DOC_WRITE_CLIPBOARD__) await window.__SLASH_DOC_WRITE_CLIPBOARD__(text);
      else await navigator.clipboard.writeText(text);
      if (cut && !this.readOnly)
        for (const view of [...selected].reverse()) this.deleteBlock(this.indexOf(view.output.id!));
      this.status.textContent = `Скопировано блоков: ${selected.length}`;
    } catch (error) {
      this.reportError(error);
    }
  }
  pasteBlocks(blocks: OutputBlockData[]): void {
    if (this.readOnly) return;
    const selected = this.views.filter((view) => this.selected.has(view.output.id!));
    let index = selected.length ? this.indexOf(selected.at(-1)!.output.id!) + 1 : this.currentIndex + 1;
    this.clearSelection();
    for (const block of cloneClipboardBlocks(blocks)) {
      const view = this.insert(block, index++, false);
      this.selected.add(view.output.id!);
    }
    this.currentIndex = index - 1;
    this.refreshSelection();
    this.focus();
    this.changed();
  }
  deleteSelected(): void {
    if (this.readOnly) return;
    const index = this.views.findIndex((view) => this.selected.has(view.output.id!));
    for (const view of [...this.views].reverse())
      if (this.selected.has(view.output.id!)) this.deleteBlock(this.indexOf(view.output.id!), false);
    this.clearSelection();
    if (!this.views.length) this.insert({ type: this.config.defaultBlock ?? 'paragraph', data: { text: '' } }, 0);
    this.api.caret.setToBlock(Math.min(Math.max(0, index), this.views.length - 1), 'start');
    this.changed();
  }
  changed(view?: BlockView, type = 'block-changed'): void {
    if (this.rendering || this.readOnly || this.destroyed || this.notifying) return;
    this.notifying = true;
    queueMicrotask(() => {
      this.notifying = false;
      if (this.destroyed || this.rendering) return;
      const event = new CustomEvent(type, { detail: { target: view?.api }, bubbles: true });
      this.config.onChange?.(this.api, event);
      this.dispatchEvent(new CustomEvent('editor-change', { detail: event.detail, bubbles: true, composed: true }));
    });
  }
  disconnectedCallback(): void {
    if (!this.isConnected) this.destroy();
  }
  destroy(): void {
    this.closeBlockMenu();
    this.destroyed = true;
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.views.forEach((view) => {
      view.dispose?.();
      view.tool?.destroy?.();
    });
    this.views = [];
    this.replaceChildren();
  }
  openInsertMenu(index = this.currentIndex, anchor?: HTMLElement): void {
    this.menu.insertAfter(index, anchor);
  }
  openTypeMenu(id: string, event: MouseEvent): void {
    this.menu.changeType(id, event);
  }
  closeBlockMenu(): void {
    this.menu.close();
  }
  private trackBlock(event: Event): void {
    const view = this.viewForEvent(event);
    if (view) this.currentIndex = this.indexOf(view.output.id!);
  }
  private viewForEvent(event: Event): BlockView | undefined {
    return this.views.find((view) => event.composedPath().includes(view.holder));
  }
  private reportError(error: unknown): void {
    this.status.textContent = error instanceof Error ? error.message : String(error);
  }
}
if (!customElements.get('slash-doc-editor')) customElements.define('slash-doc-editor', BlockEditorElement);
