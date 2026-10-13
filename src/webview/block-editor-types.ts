/** The persisted block format and tool contract remain compatible with existing addons. */
export type OutputBlockData = {
  id?: string;
  type: string;
  data: Record<string, any>;
  tunes?: Record<string, any>;
  [key: string]: unknown;
};
export type OutputData = { blocks: OutputBlockData[]; time?: number; version?: string; [key: string]: unknown };
export type BlockToolConstructorOptions<T = Record<string, any>> = {
  data: T;
  api: API;
  config: Record<string, any>;
  readOnly: boolean;
  block: BlockAPI;
};
export type BlockTool = {
  render(): HTMLElement;
  save(element: HTMLElement): any | Promise<any>;
  validate?(data: any): boolean;
  renderSettings?(): HTMLElement | any[];
  renderHeaderControls?(): HTMLElement;
  destroy?(): void;
  rendered?(): void;
  updated?(): void;
  moved?(event: CustomEvent): void;
  removed?(): void;
  merge?(data: any): void;
};
export type ToolConstructable = {
  new (options: any): any;
  isInline?: boolean;
  toolbox?: { title?: string; icon?: string };
  title?: string;
  enableLineBreaks?: boolean;
  conversionConfig?: { export?: string | ((data: any) => string); import?: string | ((text: string) => any) };
};
export type InlineToolConstructable = ToolConstructable;
export type ToolSettings = {
  class: ToolConstructable;
  config?: Record<string, any>;
  toolbox?: { title?: string; icon?: string } | false;
  inlineToolbar?: boolean | string[];
};
export type EditorTools = Record<string, ToolConstructable | ToolSettings>;
export type EditorConfig = {
  holder?: string | HTMLElement;
  tools?: EditorTools;
  data?: OutputData;
  defaultBlock?: string;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
  autofocus?: boolean;
  inlineToolbar?: boolean | string[];
  i18n?: { messages?: Record<string, any> };
  onReady?: () => void;
  onChange?: (api: API, event: CustomEvent) => void;
};
export type BlockAPI = {
  id: string;
  name: string;
  holder: HTMLElement;
  isEmpty: boolean;
  selected: boolean;
  save(): Promise<OutputBlockData>;
  call(method: string, args?: any): any;
  dispatchChange(): void;
};
export type API = {
  blocks: {
    getCurrentBlockIndex(): number;
    getBlocksCount(): number;
    getBlockByIndex(index: number): BlockAPI | undefined;
    getById(id: string): BlockAPI | undefined;
    getBlockIndex(id: string): number;
    getBlockByElement(element: HTMLElement): BlockAPI | undefined;
    insert(
      type?: string,
      data?: Record<string, any>,
      config?: object,
      index?: number,
      needToFocus?: boolean,
      replace?: boolean,
      id?: string,
    ): BlockAPI;
    delete(index?: number): void;
    move(toIndex: number, fromIndex?: number): void;
    swap(fromIndex: number, toIndex: number): void;
    clear(): void;
    render(data: OutputData): Promise<void>;
    renderFromHTML(html: string): Promise<void>;
    update(id: string, data: Record<string, any>): Promise<BlockAPI | undefined>;
    composeBlockData(type: string): Promise<Record<string, any>>;
    stretchBlock(index: number, status: boolean): void;
  };
  caret: {
    setToBlock(index: number | string | BlockAPI, position?: 'start' | 'end' | 'default', offset?: number): boolean;
    setToFirstBlock(position?: 'start' | 'end' | 'default'): boolean;
    setToLastBlock(position?: 'start' | 'end' | 'default'): boolean;
  };
  selection: {
    findParentTag(tag: string, className?: string): HTMLElement | null;
    expandToTag(element: HTMLElement): void;
    save(): void;
    restore(): void;
    setFakeBackground(): void;
    removeFakeBackground(): void;
  };
  saver: { save(): Promise<OutputData> };
  readOnly: { isEnabled: boolean; toggle(state?: boolean): Promise<boolean> };
  listeners: {
    on(element: EventTarget, type: string, handler: EventListener, capture?: boolean): void;
    off(element: EventTarget, type: string, handler: EventListener, capture?: boolean): void;
  };
  events: {
    on(name: string, handler: EventListener): void;
    off(name: string, handler: EventListener): void;
    emit(name: string, data?: unknown): void;
  };
  inlineToolbar: { close(): void; open(): void };
  toolbar: { close(): void; open(): void; toggleBlockSettings(): void };
  sanitizer: { clean(html: string, rules?: unknown): string };
  styles: Record<string, string>;
  i18n: { t(text: string): string };
  notifier: { show(options: { message: string; style?: string; time?: number }): void };
};
