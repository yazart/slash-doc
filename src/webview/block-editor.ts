import './block-editor-element';
import type { BlockEditorElement } from './block-editor-element';
import type { EditorConfig } from './block-editor-types';
export type { OutputData, OutputBlockData } from './block-editor-types';

/** Constructor facade for applications and addons using the former editor API. */
export default class SlashDocEditor {
  readonly element: BlockEditorElement;
  readonly isReady: Promise<void>;
  constructor(config: EditorConfig = {}) {
    const holder = typeof config.holder === 'string' ? document.getElementById(config.holder) : config.holder;
    if (!holder) throw new Error('Не найден контейнер редактора');
    this.element = document.createElement('slash-doc-editor') as BlockEditorElement;
    holder.replaceChildren(this.element);
    this.isReady = this.element.configure(config);
  }
  get blocks() {
    return this.element.api.blocks;
  }
  get caret() {
    return this.element.api.caret;
  }
  get readOnly() {
    return this.element.api.readOnly;
  }
  get saver() {
    return this.element.api.saver;
  }
  get toolbar() {
    return this.element.api.toolbar;
  }
  get inlineToolbar() {
    return this.element.api.inlineToolbar;
  }
  get listeners() {
    return this.element.api.listeners;
  }
  get events() {
    return this.element.api.events;
  }
  save() {
    return this.element.save();
  }
  render(data: import('./block-editor-types').OutputData) {
    return this.element.render(data);
  }
  clear() {
    this.blocks.clear();
  }
  destroy() {
    this.element.destroy();
    this.element.remove();
  }
}
