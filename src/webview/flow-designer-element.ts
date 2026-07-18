import { LitElement, html, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { FLOW_DESIGNER_STYLES } from './flow-designer-styles';
import {
  createFlowDesignerData,
  type FlowDesignerData,
  type NodeType,
  type WorkflowConnection,
  type WorkflowNode,
} from './flow-designer-data';

export type { FlowDesignerData } from './flow-designer-data';
export { createFlowDesignerData } from './flow-designer-data';

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

  static styles = FLOW_DESIGNER_STYLES;

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

declare global {
  interface HTMLElementTagNameMap {
    'slash-flow-designer': FlowDesignerElement;
  }
}
