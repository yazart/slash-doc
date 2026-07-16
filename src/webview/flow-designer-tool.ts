import { LitElement, css, html, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export type NodeType = 'trigger' | 'action' | 'condition' | 'transform' | 'output';

export type WorkflowNode = {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
};

export type WorkflowConnection = {
  id: string;
  fromNodeId: string;
  fromPort: number;
  toNodeId: string;
  toPort: number;
};

export type FlowDesignerData = {
  version: 1;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
};

type ToolArgs = { data?: Partial<FlowDesignerData> };
type Point = { x: number; y: number };

const templates: Record<NodeType, Pick<WorkflowNode, 'label' | 'inputs' | 'outputs'>> = {
  trigger: { label: 'Триггер', inputs: [], outputs: ['out'] },
  action: { label: 'Действие', inputs: ['in'], outputs: ['out'] },
  condition: { label: 'Условие', inputs: ['in'], outputs: ['true', 'false'] },
  transform: { label: 'Преобразование', inputs: ['in'], outputs: ['out'] },
  output: { label: 'Результат', inputs: ['in'], outputs: [] },
};

const palette: Array<{ type: NodeType; description: string }> = [
  { type: 'trigger', description: 'Запустить процесс' },
  { type: 'action', description: 'Выполнить задачу' },
  { type: 'condition', description: 'Разветвить логику' },
  { type: 'transform', description: 'Изменить данные' },
  { type: 'output', description: 'Отправить результат' },
];

@customElement('slash-flow-designer')
export class FlowDesignerElement extends LitElement {
  @property({ attribute: false }) data: FlowDesignerData = createFlowDesignerData();
  @state() private nodes: WorkflowNode[] = [];
  @state() private connections: WorkflowConnection[] = [];
  @state() private selectedId: string | null = null;
  @state() private pendingType: NodeType | null = null;
  @state() private scale = 1;
  @state() private offset: Point = { x: 0, y: 0 };
  private initialized = false;
  private dragging?: { id: string; offset: Point };
  private panning?: Point;
  private connecting?: { nodeId: string; port: number; cursor: Point };

  static styles = css`
    :host {
      --fd-bg: var(--vscode-editor-background, #1e1e1e);
      --fd-card: var(--vscode-editorWidget-background, #252526);
      --fd-fg: var(--vscode-editor-foreground, #ccc);
      --fd-muted: var(--vscode-descriptionForeground, #999);
      --fd-border: var(--vscode-panel-border, #454545);
      --fd-focus: var(--vscode-focusBorder, #007fd4);
      display: block;
      width: 100%;
      color: var(--fd-fg);
      font-family: var(--vscode-font-family, sans-serif);
    }
    * {
      box-sizing: border-box;
    }
    .editor {
      display: grid;
      grid-template-columns: 148px minmax(0, 1fr);
      height: 520px;
      overflow: hidden;
      border: 1px solid var(--fd-border);
      border-radius: 4px;
      background: var(--fd-bg);
    }
    .palette {
      z-index: 3;
      border-right: 1px solid var(--fd-border);
      background: var(--fd-card);
    }
    .heading {
      margin: 0;
      padding: 12px;
      border-bottom: 1px solid var(--fd-border);
      color: var(--fd-muted);
      font: 600 11px/1.2 var(--vscode-editor-font-family, monospace);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .palette-list {
      display: grid;
      gap: 6px;
      padding: 8px;
    }
    .palette-item {
      display: grid;
      grid-template-columns: 9px 1fr;
      gap: 8px;
      width: 100%;
      padding: 8px;
      color: var(--fd-fg);
      text-align: left;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      cursor: grab;
    }
    .palette-item:hover,
    .palette-item.active {
      border-color: var(--fd-border);
      background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.06));
    }
    .dot {
      width: 9px;
      height: 9px;
      margin-top: 2px;
      border-radius: 50%;
      background: var(--node-color);
    }
    .palette-name {
      display: block;
      font: 600 11px/1.2 var(--vscode-editor-font-family, monospace);
      text-transform: capitalize;
    }
    .palette-desc {
      display: block;
      margin-top: 3px;
      color: var(--fd-muted);
      font-size: 10px;
    }
    .workspace {
      position: relative;
      min-width: 0;
      overflow: hidden;
    }
    .canvas {
      position: absolute;
      inset: 0;
      overflow: hidden;
      cursor: grab;
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--fd-muted) 38%, transparent) 1px,
        transparent 1px
      );
      background-size: 20px 20px;
    }
    .canvas.pending {
      cursor: crosshair;
    }
    .scene {
      position: absolute;
      inset: 0;
      transform-origin: 0 0;
    }
    .connections {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }
    path {
      fill: none;
      stroke: var(--vscode-charts-blue, #3794ff);
      stroke-width: 2;
      pointer-events: stroke;
      cursor: pointer;
    }
    path:hover {
      stroke: var(--vscode-errorForeground, #f48771);
      stroke-width: 3;
    }
    path.connecting {
      stroke-dasharray: 5 5;
      pointer-events: none;
    }
    .node {
      position: absolute;
      width: 130px;
      min-height: 62px;
      padding: 11px 13px;
      color: var(--fd-fg);
      border: 2px solid var(--node-color);
      border-radius: 7px;
      background: color-mix(in srgb, var(--node-color) 12%, var(--fd-card));
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
      cursor: move;
      user-select: none;
    }
    .node.selected {
      outline: 2px solid var(--fd-focus);
      outline-offset: 2px;
    }
    .node-title {
      overflow: hidden;
      font: 600 12px/1.3 var(--vscode-editor-font-family, monospace);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .node-description {
      margin-top: 5px;
      color: var(--fd-muted);
      font-size: 10px;
    }
    .port {
      position: absolute;
      top: 50%;
      width: 10px;
      height: 10px;
      border: 2px solid var(--node-color);
      border-radius: 50%;
      background: var(--fd-bg);
      transform: translateY(-50%);
      cursor: crosshair;
    }
    .port.input {
      left: -7px;
    }
    .port.output {
      right: -7px;
    }
    .port:hover {
      background: var(--node-color);
    }
    .controls {
      position: absolute;
      right: 10px;
      bottom: 10px;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    button.control {
      min-width: 28px;
      height: 27px;
      padding: 0 6px;
      color: var(--fd-fg);
      border: 1px solid var(--fd-border);
      border-radius: 3px;
      background: var(--fd-card);
      cursor: pointer;
    }
    .zoom {
      padding: 0 5px;
      color: var(--fd-muted);
      font-size: 10px;
    }
    .properties {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 5;
      width: 210px;
      padding: 14px;
      border-left: 1px solid var(--fd-border);
      background: var(--fd-card);
      box-shadow: -5px 0 14px rgba(0, 0, 0, 0.12);
    }
    .properties-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    .properties-title {
      margin: 0;
      font-size: 12px;
    }
    .close {
      color: var(--fd-muted);
      border: 0;
      background: transparent;
      cursor: pointer;
    }
    label {
      display: grid;
      gap: 5px;
      margin: 0 0 12px;
      color: var(--fd-muted);
      font-size: 10px;
    }
    input,
    textarea {
      width: 100%;
      padding: 6px;
      color: var(--vscode-input-foreground, var(--fd-fg));
      border: 1px solid var(--vscode-input-border, var(--fd-border));
      border-radius: 2px;
      outline: 0;
      background: var(--vscode-input-background, var(--fd-bg));
      font: inherit;
    }
    textarea {
      min-height: 70px;
      resize: vertical;
    }
    input:focus,
    textarea:focus {
      border-color: var(--fd-focus);
    }
    .delete {
      width: 100%;
      padding: 6px;
      color: var(--vscode-button-foreground, white);
      border: 0;
      border-radius: 2px;
      background: var(--vscode-inputValidation-errorBorder, #be1100);
      cursor: pointer;
    }
    .trigger {
      --node-color: var(--vscode-charts-green, #89d185);
    }
    .action {
      --node-color: var(--vscode-charts-blue, #3794ff);
    }
    .condition {
      --node-color: var(--vscode-charts-yellow, #cca700);
    }
    .transform {
      --node-color: var(--vscode-charts-purple, #b180d7);
    }
    .output {
      --node-color: var(--vscode-charts-orange, #d18616);
    }
    @media (max-width: 700px) {
      .editor {
        grid-template-columns: 112px minmax(0, 1fr);
      }
      .palette-desc {
        display: none;
      }
    }
  `;

  protected willUpdate(changes: Map<PropertyKey, unknown>) {
    if (changes.has('data') && !this.initialized) {
      const data = createFlowDesignerData(this.data);
      this.nodes = structuredClone(data.nodes);
      this.connections = structuredClone(data.connections);
      this.offset = { x: data.viewport.x, y: data.viewport.y };
      this.scale = data.viewport.scale;
      this.initialized = true;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  disconnectedCallback() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    super.disconnectedCallback();
  }

  get value(): FlowDesignerData {
    return {
      version: 1,
      nodes: structuredClone(this.nodes),
      connections: structuredClone(this.connections),
      viewport: { x: this.offset.x, y: this.offset.y, scale: this.scale },
    };
  }

  private createId() {
    return Math.random().toString(36).slice(2, 11);
  }
  private selected() {
    return this.nodes.find((node) => node.id === this.selectedId);
  }
  private emitChange() {
    this.dispatchEvent(new CustomEvent('workflow-change', { detail: this.value, bubbles: true, composed: true }));
  }
  private canvasRect() {
    return this.renderRoot.querySelector('.canvas')!.getBoundingClientRect();
  }
  private point(event: MouseEvent): Point {
    const rect = this.canvasRect();
    return {
      x: (event.clientX - rect.left - this.offset.x) / this.scale,
      y: (event.clientY - rect.top - this.offset.y) / this.scale,
    };
  }

  private addNode(type: NodeType, point?: Point) {
    const template = templates[type];
    const node: WorkflowNode = {
      id: this.createId(),
      type,
      label: template.label,
      inputs: [...template.inputs],
      outputs: [...template.outputs],
      x: point?.x ?? 80 + this.nodes.length * 18,
      y: point?.y ?? 70 + this.nodes.length * 18,
    };
    this.nodes = [...this.nodes, node];
    this.pendingType = null;
    this.selectedId = node.id;
    this.emitChange();
  }

  private onCanvasDown(event: MouseEvent) {
    const target = event.target as Element;
    if (
      !target.classList.contains('canvas') &&
      !target.classList.contains('connections') &&
      !target.classList.contains('scene')
    )
      return;
    if (this.pendingType) {
      this.addNode(this.pendingType, this.point(event));
      return;
    }
    this.selectedId = null;
    this.panning = { x: event.clientX - this.offset.x, y: event.clientY - this.offset.y };
  }

  private onNodeDown(event: MouseEvent, node: WorkflowNode) {
    event.preventDefault();
    event.stopPropagation();
    const point = this.point(event);
    this.selectedId = node.id;
    this.dragging = { id: node.id, offset: { x: point.x - node.x, y: point.y - node.y } };
  }

  private onMouseMove = (event: MouseEvent) => {
    if (this.panning) {
      this.offset = { x: event.clientX - this.panning.x, y: event.clientY - this.panning.y };
    } else if (this.dragging) {
      const point = this.point(event);
      this.nodes = this.nodes.map((node) =>
        node.id === this.dragging!.id
          ? { ...node, x: point.x - this.dragging!.offset.x, y: point.y - this.dragging!.offset.y }
          : node,
      );
    } else if (this.connecting) {
      const rect = this.canvasRect();
      this.connecting = { ...this.connecting, cursor: { x: event.clientX - rect.left, y: event.clientY - rect.top } };
      this.requestUpdate();
    }
  };

  private onMouseUp = () => {
    if (this.dragging || this.panning) this.emitChange();
    this.dragging = undefined;
    this.panning = undefined;
    if (this.connecting) {
      this.connecting = undefined;
      this.requestUpdate();
    }
  };

  private startConnection(event: MouseEvent, node: WorkflowNode, port: number) {
    event.preventDefault();
    event.stopPropagation();
    this.connecting = { nodeId: node.id, port, cursor: this.portPoint(node, port, true) };
  }

  private finishConnection(event: MouseEvent, node: WorkflowNode, port: number) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.connecting || this.connecting.nodeId === node.id) return;
    this.connections = [
      ...this.connections,
      {
        id: this.createId(),
        fromNodeId: this.connecting.nodeId,
        fromPort: this.connecting.port,
        toNodeId: node.id,
        toPort: port,
      },
    ];
    this.connecting = undefined;
    this.emitChange();
  }

  private portPoint(node: WorkflowNode, port: number, output: boolean): Point {
    return {
      x: (node.x + (output ? 130 : 0)) * this.scale + this.offset.x,
      y: (node.y + 31 + port * 16) * this.scale + this.offset.y,
    };
  }

  private path(from: Point, to: Point) {
    const bend = Math.max(35, Math.abs(to.x - from.x) / 2);
    return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
  }

  private updateSelected(updates: Partial<WorkflowNode>) {
    this.nodes = this.nodes.map((node) => (node.id === this.selectedId ? { ...node, ...updates } : node));
    this.emitChange();
  }

  private deleteSelected() {
    const id = this.selectedId;
    this.nodes = this.nodes.filter((node) => node.id !== id);
    this.connections = this.connections.filter(
      (connection) => connection.fromNodeId !== id && connection.toNodeId !== id,
    );
    this.selectedId = null;
    this.emitChange();
  }

  private zoom(delta: number) {
    this.scale = Math.max(0.25, Math.min(2, this.scale + delta));
    this.emitChange();
  }

  render() {
    const selected = this.selected();
    return html`<div class="editor">
      <aside class="palette">
        <h3 class="heading">Узлы</h3>
        <div class="palette-list">
          ${palette.map(
            (item) =>
              html`<button
                type="button"
                class="palette-item ${item.type} ${this.pendingType === item.type ? 'active' : ''}"
                draggable="true"
                @click=${() => {
                  this.pendingType = item.type;
                }}
                @dragstart=${(event: DragEvent) => event.dataTransfer?.setData('application/node-type', item.type)}
              >
                <span class="dot"></span
                ><span
                  ><span class="palette-name">${item.type}</span
                  ><span class="palette-desc">${item.description}</span></span
                >
              </button>`,
          )}
        </div>
      </aside>
      <section class="workspace">
        <div
          class="canvas ${this.pendingType ? 'pending' : ''}"
          @mousedown=${this.onCanvasDown}
          @dragover=${(event: DragEvent) => event.preventDefault()}
          @drop=${(event: DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer?.getData('application/node-type') as NodeType;
            if (templates[type]) this.addNode(type, this.point(event));
          }}
          @wheel=${(event: WheelEvent) => {
            event.preventDefault();
            this.zoom(event.deltaY > 0 ? -0.1 : 0.1);
          }}
        >
          <svg class="connections">
            ${this.connections.map((connection) => {
              const from = this.nodes.find((node) => node.id === connection.fromNodeId);
              const to = this.nodes.find((node) => node.id === connection.toNodeId);
              return from && to
                ? svg`<path d=${this.path(this.portPoint(from, connection.fromPort, true), this.portPoint(to, connection.toPort, false))} @click=${() => {
                    this.connections = this.connections.filter((item) => item.id !== connection.id);
                    this.emitChange();
                  }}></path>`
                : '';
            })}
            ${
              this.connecting
                ? (() => {
                    const from = this.nodes.find((node) => node.id === this.connecting!.nodeId);
                    return from
                      ? svg`<path class="connecting" d=${this.path(this.portPoint(from, this.connecting!.port, true), this.connecting!.cursor)}></path>`
                      : '';
                  })()
                : ''
            }
          </svg>
          <div
            class="scene"
            style=${`transform: translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`}
          >
            ${this.nodes.map(
              (node) =>
                html`<div
                  class="node ${node.type} ${node.id === this.selectedId ? 'selected' : ''}"
                  style=${`left:${node.x}px;top:${node.y}px`}
                  @mousedown=${(event: MouseEvent) => this.onNodeDown(event, node)}
                >
                  <div class="node-title">${node.label}</div>
                  ${node.description ? html`<div class="node-description">${node.description}</div>` : ''}${node.inputs.map((_, port) => html`<span class="port input" style=${`top:${31 + port * 16}px`} @mouseup=${(event: MouseEvent) => this.finishConnection(event, node, port)}></span>`)}${node.outputs.map((_, port) => html`<span class="port output" style=${`top:${31 + port * 16}px`} @mousedown=${(event: MouseEvent) => this.startConnection(event, node, port)}></span>`)}
                </div>`,
            )}
          </div>
        </div>
        <div class="controls">
          <button class="control" type="button" @click=${() => this.zoom(-0.1)}>−</button
          ><span class="zoom">${Math.round(this.scale * 100)}%</span
          ><button class="control" type="button" @click=${() => this.zoom(0.1)}>+</button>
        </div>
        ${
          selected
            ? html`<aside class="properties">
                <div class="properties-header">
                  <h3 class="properties-title">Свойства узла</h3>
                  <button
                    class="close"
                    type="button"
                    @click=${() => {
                      this.selectedId = null;
                    }}
                  >
                    ×
                  </button>
                </div>
                <label
                  >Название<input
                    .value=${selected.label}
                    @input=${(event: Event) => this.updateSelected({ label: (event.target as HTMLInputElement).value })} /></label
                ><label
                  >Описание<textarea
                    .value=${selected.description ?? ''}
                    @input=${(event: Event) => this.updateSelected({ description: (event.target as HTMLTextAreaElement).value })}
                  ></textarea></label
                ><button class="delete" type="button" @click=${this.deleteSelected}>Удалить узел</button>
              </aside>`
            : ''
        }
      </section>
    </div>`;
  }
}

export default class FlowDesignerTool {
  private readonly data: FlowDesignerData;
  private element?: FlowDesignerElement;
  private wrapper?: HTMLDivElement;

  static get toolbox() {
    return {
      title: 'Конструктор процессов',
      icon: '<svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="3" cy="3" r="2" stroke="currentColor"/><circle cx="14" cy="8.5" r="2" stroke="currentColor"/><circle cx="3" cy="14" r="2" stroke="currentColor"/><path d="M5 3h2.5A3.5 3.5 0 0 1 11 6.5M5 14h2.5a3.5 3.5 0 0 0 3.5-3.5" stroke="currentColor"/></svg>',
    };
  }

  constructor({ data }: ToolArgs) {
    this.data = createFlowDesignerData(data);
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'slash-flow-designer-tool';
    this.element = document.createElement('slash-flow-designer');
    this.element.data = this.data;
    this.element.addEventListener('workflow-change', () => {
      if (!this.wrapper) return;
      this.wrapper.dataset.revision = String(Number(this.wrapper.dataset.revision ?? '0') + 1);
      this.wrapper.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    });
    this.wrapper.append(this.element);
    return this.wrapper;
  }

  save(): FlowDesignerData {
    return this.element?.value ?? this.data;
  }
}

function createFlowDesignerData(data?: Partial<FlowDesignerData>): FlowDesignerData {
  const nodes = Array.isArray(data?.nodes)
    ? data.nodes.filter(isWorkflowNode).map((node) => ({
        ...node,
        inputs: [...node.inputs],
        outputs: [...node.outputs],
      }))
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const connections = Array.isArray(data?.connections)
    ? data.connections.filter(
        (connection) =>
          isWorkflowConnection(connection) && nodeIds.has(connection.fromNodeId) && nodeIds.has(connection.toNodeId),
      )
    : [];
  const viewport = data?.viewport;

  return {
    version: 1,
    nodes,
    connections: structuredClone(connections),
    viewport: {
      x: finiteNumber(viewport?.x, 0),
      y: finiteNumber(viewport?.y, 0),
      scale: Math.max(0.25, Math.min(2, finiteNumber(viewport?.scale, 1))),
    },
  };
}

function isWorkflowNode(value: unknown): value is WorkflowNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Partial<WorkflowNode>;
  return (
    typeof node.id === 'string' &&
    typeof node.type === 'string' &&
    node.type in templates &&
    typeof node.label === 'string' &&
    typeof node.x === 'number' &&
    Number.isFinite(node.x) &&
    typeof node.y === 'number' &&
    Number.isFinite(node.y) &&
    Array.isArray(node.inputs) &&
    node.inputs.every((item) => typeof item === 'string') &&
    Array.isArray(node.outputs) &&
    node.outputs.every((item) => typeof item === 'string')
  );
}

function isWorkflowConnection(value: unknown): value is WorkflowConnection {
  if (!value || typeof value !== 'object') return false;
  const connection = value as Partial<WorkflowConnection>;
  return (
    typeof connection.id === 'string' &&
    typeof connection.fromNodeId === 'string' &&
    typeof connection.toNodeId === 'string' &&
    Number.isInteger(connection.fromPort) &&
    Number.isInteger(connection.toPort)
  );
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-flow-designer': FlowDesignerElement;
  }
}
