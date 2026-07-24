import { LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import flowDesignerStyles from './flow-designer-styles.shadow.css?raw';
import {
  createFlowDesignerData,
  type FlowDesignerData,
  type NodeType,
  type WorkflowConnection,
  type WorkflowNode,
} from './flow-designer-data';
import { FLOW_NODE_TEMPLATES, renderFlowDesignerTemplate } from './flow-designer-template';

export type { FlowDesignerData } from './flow-designer-data';
export { createFlowDesignerData } from './flow-designer-data';

type Point = { x: number; y: number };

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

  static styles = unsafeCSS(flowDesignerStyles);

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
    const template = FLOW_NODE_TEMPLATES[type];
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
    return renderFlowDesignerTemplate(
      {
        nodes: this.nodes,
        connections: this.connections,
        selected: this.selected(),
        selectedId: this.selectedId,
        pendingType: this.pendingType,
        scale: this.scale,
        offset: this.offset,
        connecting: this.connecting,
      },
      {
        setPendingType: (type) => {
          this.pendingType = type;
        },
        onCanvasDown: (event) => this.onCanvasDown(event),
        onDrop: (event) => {
          event.preventDefault();
          const type = event.dataTransfer?.getData('application/node-type') as NodeType;
          if (FLOW_NODE_TEMPLATES[type]) this.addNode(type, this.point(event));
        },
        zoom: (delta) => this.zoom(delta),
        removeConnection: (id) => {
          this.connections = this.connections.filter((item) => item.id !== id);
          this.emitChange();
        },
        path: (from, to) => this.path(from, to),
        portPoint: (node, port, output) => this.portPoint(node, port, output),
        onNodeDown: (event, node) => this.onNodeDown(event, node),
        finishConnection: (event, node, port) => this.finishConnection(event, node, port),
        startConnection: (event, node, port) => this.startConnection(event, node, port),
        clearSelection: () => {
          this.selectedId = null;
        },
        updateSelected: (updates) => this.updateSelected(updates),
        deleteSelected: () => this.deleteSelected(),
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-flow-designer': FlowDesignerElement;
  }
}
