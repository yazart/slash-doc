import type { API, BlockAPI, BlockTool, EditorTools, OutputBlockData, ToolSettings } from './block-editor-types';
import type { BlockEditorElement } from './block-editor-element';
import HeaderTool from './header-tool';
import { textHeadingLevel } from '../shared/text-block';
import { LUCIDE_ICONS } from './lucide-icons';

export type BlockView = {
  output: OutputBlockData;
  tool?: BlockTool;
  holder: HTMLElement;
  content: HTMLElement;
  api: BlockAPI;
  dispose?: () => void;
};
export function toolSettings(tools: EditorTools, name: string): ToolSettings | undefined {
  const value = tools[name];
  return typeof value === 'function' ? { class: value } : value;
}
export function createBlockView(editor: BlockEditorElement, source: OutputBlockData, config?: object): BlockView {
  const output = structuredClone(source);
  if (output.type === 'header' && toolSettings(editor.config.tools ?? {}, 'header')?.class === HeaderTool) {
    output.type = 'paragraph';
    output.data.level = textHeadingLevel(source);
  }
  output.id ||= crypto.randomUUID();
  const holder = document.createElement('section');
  holder.className = 'ce-block';
  holder.draggable = !editor.readOnly;
  holder.dataset.id = output.id;
  holder.dataset.blockType = output.type;
  const content = document.createElement('div');
  content.className = 'ce-block__content';
  const view: BlockView = { output, holder, content, api: undefined as unknown as BlockAPI };
  view.api = {
    id: output.id,
    name: output.type,
    holder,
    get isEmpty() {
      return !content.textContent?.trim();
    },
    get selected() {
      return editor.selected.has(output.id!);
    },
    save: () => saveBlock(view),
    call: (method, args) => (view.tool as any)?.[method]?.(args),
    dispatchChange: () => editor.changed(view),
  };
  const settings = toolSettings(editor.config.tools ?? {}, output.type);
  if (settings && !settings.class.isInline) {
    view.tool = new settings.class({
      data: output.data,
      config: { ...settings.config, ...config },
      api: editor.api,
      readOnly: editor.readOnly,
      block: view.api,
    });
    content.append(view.tool!.render());
  } else {
    const missing = document.createElement('pre');
    missing.className = 'slash-missing-block';
    missing.textContent = `Блок «${output.type}» недоступен. Данные сохранены.\n${JSON.stringify(output.data, null, 2)}`;
    content.append(missing);
  }
  if (!editor.readOnly) holder.append(createControls(editor, view));
  holder.append(content);
  if (!editor.readOnly) {
    const insert = document.createElement('div');
    insert.className = 'slash-block-insertion-space';
    holder.append(insert);
  }
  if (editor.readOnly) view.dispose = makeReadOnly(content);
  return view;
}
export async function saveBlock(view: BlockView): Promise<OutputBlockData> {
  const data = view.tool ? await view.tool.save(view.content.firstElementChild as HTMLElement) : view.output.data;
  view.output = { ...view.output, data: structuredClone(data) };
  return structuredClone(view.output);
}
export function snapshotBlock(view: BlockView): OutputBlockData {
  if (view.tool) {
    const data = view.tool.save(view.content.firstElementChild as HTMLElement);
    if (data && typeof data.then === 'function') {
      void Promise.resolve(data)
        .then((saved) => {
          view.output.data = structuredClone(saved);
        })
        .catch(() => undefined);
    } else view.output.data = structuredClone(data);
  }
  return structuredClone(view.output);
}
export function visitRoots(root: ParentNode, action: (root: ParentNode) => void): void {
  action(root);
  for (const element of Array.from(root.querySelectorAll('*')))
    if (element.shadowRoot) visitRoots(element.shadowRoot, action);
}
export function makeReadOnly(root: HTMLElement): () => void {
  const observed = new WeakSet<ParentNode>();
  const observer = new MutationObserver(() => apply());
  const apply = () =>
    visitRoots(root, (scope) => {
      if (!observed.has(scope)) {
        observed.add(scope);
        observer.observe(scope, { childList: true, subtree: true });
      }
      scope.querySelectorAll<HTMLElement>('[contenteditable]').forEach((element) => {
        element.contentEditable = 'false';
      });
      scope
        .querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>(
          'input, button, select, textarea',
        )
        .forEach((element) => {
          element.disabled = true;
        });
    });
  apply();
  return () => observer.disconnect();
}
export function focusBlock(
  view: BlockView | undefined,
  position: 'start' | 'end' | 'default' = 'end',
  offset?: number,
): boolean {
  if (!view) return false;
  let target: HTMLElement | undefined;
  visitRoots(view.content, (root) => {
    target ??=
      root.querySelector<HTMLElement>(
        '[contenteditable="true"], textarea, input:not([type="file"]):not([type="checkbox"])',
      ) ?? undefined;
  });
  target ??= view.holder;
  target.focus();
  if (target.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(position === 'start');
    if (offset !== undefined && target.firstChild?.nodeType === Node.TEXT_NODE)
      range.setStart(target.firstChild, Math.min(offset, target.firstChild.textContent?.length ?? 0));
    const selection =
      (target.getRootNode() as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ??
      window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  return true;
}
function createControls(editor: BlockEditorElement, view: BlockView): HTMLElement {
  const controls = document.createElement('header');
  controls.className = 'slash-block-controls';
  const select = iconButton('Выделить блок (Shift — диапазон, Ctrl/⌘ — добавить)', LUCIDE_ICONS.gripVertical);
  select.className = 'slash-block-handle slash-block-icon-button';
  select.setAttribute('aria-pressed', 'false');
  select.addEventListener('click', (event) =>
    editor.selectBlock(view.output.id!, event.shiftKey, event.metaKey || event.ctrlKey),
  );
  select.addEventListener('contextmenu', (event) => editor.openTypeMenu(view.output.id!, event));
  controls.append(select);
  const settings = toolSettings(editor.config.tools ?? {}, view.output.type);
  const name = (settings?.toolbox || settings?.class.toolbox)?.title ?? view.output.type;
  const label = button('Изменить тип блока', name);
  label.className = 'slash-block-title';
  label.setAttribute('aria-haspopup', 'dialog');
  label.addEventListener('click', (event) => editor.openTypeMenu(view.output.id!, event));
  controls.append(label);
  if (view.tool?.renderHeaderControls) {
    const custom = view.tool.renderHeaderControls();
    custom.classList.add('slash-block-tool-controls');
    controls.append(custom);
  }
  if (view.tool?.renderSettings) {
    const panel = document.createElement('div');
    panel.className = 'slash-block-settings';
    panel.hidden = true;
    const toggle = iconButton('Настройки блока', LUCIDE_ICONS.settings);
    toggle.addEventListener('click', () => {
      const rendered = view.tool?.renderSettings?.();
      panel.replaceChildren();
      if (rendered instanceof HTMLElement) panel.append(rendered);
      else if (Array.isArray(rendered))
        for (const item of rendered) {
          const control = button(item.label ?? item.title ?? '', item.label ?? item.title ?? '');
          control.addEventListener('click', () => {
            item.onActivate?.();
            editor.changed(view);
          });
          panel.append(control);
        }
      panel.hidden = !panel.hidden;
    });
    controls.append(toggle, panel);
  }
  const separator = document.createElement('span');
  separator.className = 'slash-block-controls-separator';
  separator.setAttribute('role', 'separator');
  separator.setAttribute('aria-orientation', 'vertical');
  controls.append(separator);
  for (const [title, text, action] of [
    [
      'Переместить вверх',
      LUCIDE_ICONS.arrowUp,
      () => editor.move(editor.indexOf(view.output.id!) - 1, editor.indexOf(view.output.id!)),
    ],
    [
      'Переместить вниз',
      LUCIDE_ICONS.arrowDown,
      () => editor.move(editor.indexOf(view.output.id!) + 1, editor.indexOf(view.output.id!)),
    ],
    [
      'Копировать блок',
      LUCIDE_ICONS.copy,
      () => {
        if (!editor.selected.has(view.output.id!)) editor.selectBlock(view.output.id!);
        void editor.copySelection();
      },
    ],
    ['Удалить блок', LUCIDE_ICONS.trash2, () => editor.deleteBlock(editor.indexOf(view.output.id!))],
  ] as const) {
    const control = iconButton(title, text);
    control.addEventListener('click', action);
    controls.append(control);
  }
  return controls;
}
export function button(title: string, text: string): HTMLButtonElement {
  const control = document.createElement('button');
  control.type = 'button';
  control.title = title;
  control.textContent = text;
  control.setAttribute('aria-label', title);
  return control;
}
export function iconButton(title: string, icon: string): HTMLButtonElement {
  const control = button(title, '');
  control.className = 'slash-block-icon-button';
  control.innerHTML = icon;
  return control;
}
export function selectionApi(): API['selection'] {
  let saved: Range | undefined;
  return {
    save() {
      const selection = window.getSelection();
      if (selection?.rangeCount) saved = selection.getRangeAt(0).cloneRange();
    },
    restore() {
      if (saved?.commonAncestorContainer.isConnected) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(saved);
      }
    },
    findParentTag(tag, className) {
      const node = window.getSelection()?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      return element?.closest<HTMLElement>(`${tag}${className ? `.${className}` : ''}`) ?? null;
    },
    expandToTag(element) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    setFakeBackground() {
      this.save();
    },
    removeFakeBackground() {
      /* Selection is retained as a Range rather than DOM decorations. */
    },
  };
}
