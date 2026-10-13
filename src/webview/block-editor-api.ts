import { isNodeInsideSelector } from './shadow-dom';
import type { API } from './block-editor-types';
import type { BlockEditorElement } from './block-editor-element';
import { focusBlock, selectionApi, toolSettings } from './block-editor-view';
import { sanitizeTableCellHtml } from '../shared/table-cell-html';

export function createEditorApi(editor: BlockEditorElement): API {
  const events = new EventTarget();
  return {
    blocks: {
      getCurrentBlockIndex: () => editor.currentIndex,
      getBlocksCount: () => editor.views.length,
      getBlockByIndex: (index) => editor.views[index]?.api,
      getById: (id) => editor.views.find((view) => view.output.id === id)?.api,
      getBlockIndex: (id) => editor.indexOf(id),
      getBlockByElement: (element) =>
        editor.views.find((view) =>
          isNodeInsideSelector(element, `.ce-block[data-id="${CSS.escape(view.output.id!)}"]`),
        )?.api,
      insert: (type, data, config, index, focus, replace, id) => {
        if (replace) editor.deleteBlock(index ?? editor.currentIndex, false);
        return editor.insert(
          { type: type ?? editor.config.defaultBlock ?? 'paragraph', data: data ?? {}, id },
          index,
          focus,
          config,
        ).api;
      },
      delete: (index) => editor.deleteBlock(index ?? editor.currentIndex),
      move: (to, from) => editor.move(to, from ?? editor.currentIndex),
      swap: (from, to) => {
        if (editor.readOnly) return;
        const first = editor.views[from];
        const second = editor.views[to];
        if (!first || !second) return;
        editor.views[from] = second;
        editor.views[to] = first;
        editor.syncOrder();
        editor.changed();
      },
      clear: () => {
        void editor.render({ blocks: [] }).then(() => editor.changed());
      },
      render: (data) => editor.render(data),
      renderFromHTML: (html) =>
        editor.render({ blocks: [{ type: 'paragraph', data: { text: sanitizeTableCellHtml(html) } }] }),
      update: async (id, data) => {
        const index = editor.indexOf(id);
        const old = editor.views[index];
        if (!old) return undefined;
        const saved = await old.api.save();
        editor.deleteBlock(index, false);
        return editor.insert({ ...saved, data: { ...saved.data, ...data } }, index, false).api;
      },
      composeBlockData: async (type) => {
        const settings = toolSettings(editor.config.tools ?? {}, type);
        if (!settings) return {};
        const tool = new settings.class({
          data: {},
          config: settings.config ?? {},
          api: editor.api,
          readOnly: true,
          block: {},
        });
        try {
          return await tool.save(tool.render());
        } finally {
          tool.destroy?.();
        }
      },
      stretchBlock: (index, status) => editor.views[index]?.holder.classList.toggle('ce-block--stretched', status),
    },
    caret: {
      setToBlock: (index, position, offset) => {
        const number = typeof index === 'number' ? index : editor.indexOf(typeof index === 'string' ? index : index.id);
        editor.currentIndex = number;
        editor.clearSelection();
        return focusBlock(editor.views[number], position, offset);
      },
      setToFirstBlock(position) {
        return this.setToBlock(0, position);
      },
      setToLastBlock(position) {
        return this.setToBlock(editor.views.length - 1, position);
      },
    },
    selection: selectionApi(),
    saver: { save: () => editor.save() },
    readOnly: {
      get isEnabled() {
        return editor.readOnly;
      },
      async toggle(state = !editor.readOnly) {
        const data = await editor.save();
        editor.config.readOnly = state;
        await editor.render(data);
        return state;
      },
    },
    listeners: {
      on: (element, type, handler, capture) => {
        element.addEventListener(type, handler, capture);
        editor.cleanups.push(() => element.removeEventListener(type, handler, capture));
      },
      off: (element, type, handler, capture) => element.removeEventListener(type, handler, capture),
    },
    events: {
      on: (name, handler) => events.addEventListener(name, handler),
      off: (name, handler) => events.removeEventListener(name, handler),
      emit: (name, data) => events.dispatchEvent(new CustomEvent(name, { detail: data })),
    },
    inlineToolbar: {
      close: () =>
        editor.querySelectorAll<HTMLElement>('.slash-text-inline-toolbar').forEach((element) => {
          element.hidden = true;
        }),
      open: () => undefined,
    },
    toolbar: {
      close: () => undefined,
      open: () => undefined,
      toggleBlockSettings: () =>
        editor.views[editor.currentIndex]?.holder
          .querySelector<HTMLButtonElement>('[aria-label="Настройки блока"]')
          ?.click(),
    },
    sanitizer: { clean: (html) => sanitizeTableCellHtml(html) },
    styles: {
      block: 'cdx-block',
      input: 'cdx-input',
      button: 'cdx-button',
      settingsButton: 'cdx-settings-button',
      settingsButtonActive: 'cdx-settings-button--active',
      inlineToolButton: 'ce-inline-tool',
      inlineToolButtonActive: 'ce-inline-tool--active',
    },
    i18n: { t: (text) => editor.config.i18n?.messages?.toolNames?.[text] ?? text },
    notifier: {
      show: ({ message }) => {
        editor.status.textContent = message;
      },
    },
  };
}
