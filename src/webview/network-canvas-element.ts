import { LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import networkCanvasStyles from './network-canvas-styles.shadow.css?raw';
import {
  createNetworkData,
  type NetworkCanvasData,
  type NetworkConnection,
  type NetworkLineType,
  type NetworkNode,
  type NetworkNodeType,
  type NetworkVlan,
} from './network-canvas-data';
import {
  NETWORK_NODE_TYPES,
  NETWORK_VLAN_COLORS,
  renderNetworkCanvasTemplate,
  type NetworkSelectedItem,
} from './network-canvas-template';

export { createNetworkData } from './network-canvas-data';
export type { NetworkCanvasData } from './network-canvas-data';

type Point = { x: number; y: number };
@customElement('slash-network-canvas')
export class NetworkCanvasElement extends LitElement {
  @property({ attribute: false }) data: NetworkCanvasData = createNetworkData();
  @state() private nodes: NetworkNode[] = [];
  @state() private vlans: NetworkVlan[] = [];
  @state() private connections: NetworkConnection[] = [];
  @state() private selectedId: string | null = null;
  @state() private connectingFrom: string | null = null;
  @state() private scale = 1;
  @state() private offset: Point = { x: 0, y: 0 };
  private initialized = false;
  private dragging?: { kind: 'node' | 'vlan'; id: string; offset: Point };
  private panning?: Point;

  static styles = unsafeCSS(networkCanvasStyles);

  protected willUpdate(changes: Map<PropertyKey, unknown>) {
    if (changes.has('data') && !this.initialized) {
      const data = createNetworkData(this.data);
      this.nodes = structuredClone(data.nodes);
      this.vlans = structuredClone(data.vlans);
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
  get value(): NetworkCanvasData {
    return {
      version: 1,
      nodes: structuredClone(this.nodes),
      vlans: structuredClone(this.vlans),
      connections: structuredClone(this.connections),
      viewport: { x: this.offset.x, y: this.offset.y, scale: this.scale },
    };
  }
  private createId() {
    return `network-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  private emitChange() {
    this.dispatchEvent(new CustomEvent('network-change', { detail: this.value, bubbles: true, composed: true }));
  }
  private rect() {
    return this.renderRoot.querySelector('.canvas')!.getBoundingClientRect();
  }
  private point(event: MouseEvent): Point {
    const rect = this.rect();
    return {
      x: (event.clientX - rect.left - this.offset.x) / this.scale,
      y: (event.clientY - rect.top - this.offset.y) / this.scale,
    };
  }
  private selected(): NetworkSelectedItem | undefined {
    const node = this.nodes.find((item) => item.id === this.selectedId);
    if (node) return { kind: 'node', value: node };
    const vlan = this.vlans.find((item) => item.id === this.selectedId);
    if (vlan) return { kind: 'vlan', value: vlan };
    const connection = this.connections.find((item) => item.id === this.selectedId);
    return connection ? { kind: 'connection', value: connection } : undefined;
  }
  private addNode(type: NetworkNodeType, point?: Point) {
    const label = NETWORK_NODE_TYPES.find((item) => item.type === type)!.label;
    this.nodes = [
      ...this.nodes,
      {
        id: this.createId(),
        type,
        label: `${label} ${this.nodes.filter((node) => node.type === type).length + 1}`,
        x: point?.x ?? 230 + this.nodes.length * 35,
        y: point?.y ?? 150 + this.nodes.length * 28,
      },
    ];
    this.emitChange();
  }
  private addVlan(point?: Point) {
    const index = this.vlans.length;
    this.vlans = [
      ...this.vlans,
      {
        id: this.createId(),
        name: `VLAN ${index + 1}`,
        color: NETWORK_VLAN_COLORS[index % NETWORK_VLAN_COLORS.length],
        x: point?.x ?? 120 + index * 35,
        y: point?.y ?? 90 + index * 30,
        width: 280,
        height: 180,
      },
    ];
    this.emitChange();
  }
  private onCanvasDown(event: MouseEvent) {
    const target = event.target as Element;
    if (
      !target.classList.contains('canvas') &&
      !target.classList.contains('content') &&
      !target.classList.contains('connections')
    )
      return;
    if (this.connectingFrom) {
      this.connectingFrom = null;
      return;
    }
    this.selectedId = null;
    this.panning = { x: event.clientX - this.offset.x, y: event.clientY - this.offset.y };
  }
  private onItemDown(event: MouseEvent, kind: 'node' | 'vlan', id: string) {
    event.preventDefault();
    event.stopPropagation();
    if (this.connectingFrom) {
      this.completeConnection(id);
      return;
    }
    const item =
      kind === 'node' ? this.nodes.find((node) => node.id === id) : this.vlans.find((vlan) => vlan.id === id);
    if (!item) return;
    const point = this.point(event);
    this.selectedId = id;
    this.dragging = { kind, id, offset: { x: point.x - item.x, y: point.y - item.y } };
  }
  private onMouseMove = (event: MouseEvent) => {
    if (this.panning) {
      this.offset = { x: event.clientX - this.panning.x, y: event.clientY - this.panning.y };
    } else if (this.dragging) {
      const point = this.point(event);
      if (this.dragging.kind === 'node')
        this.nodes = this.nodes.map((node) =>
          node.id === this.dragging!.id
            ? { ...node, x: point.x - this.dragging!.offset.x, y: point.y - this.dragging!.offset.y }
            : node,
        );
      else
        this.vlans = this.vlans.map((vlan) =>
          vlan.id === this.dragging!.id
            ? { ...vlan, x: point.x - this.dragging!.offset.x, y: point.y - this.dragging!.offset.y }
            : vlan,
        );
    }
  };
  private onMouseUp = () => {
    if (this.dragging || this.panning) this.emitChange();
    this.dragging = undefined;
    this.panning = undefined;
  };
  private startConnection(event: MouseEvent, id: string) {
    event.preventDefault();
    event.stopPropagation();
    this.connectingFrom = id;
    this.selectedId = id;
  }
  private completeConnection(id: string) {
    if (
      this.connectingFrom &&
      this.connectingFrom !== id &&
      !this.connections.some(
        (item) =>
          (item.from === this.connectingFrom && item.to === id) ||
          (item.from === id && item.to === this.connectingFrom),
      )
    )
      this.connections = [
        ...this.connections,
        { id: this.createId(), from: this.connectingFrom, to: id, lineType: 'dashed' },
      ];
    this.connectingFrom = null;
    this.emitChange();
  }
  private updateSelected(value: string) {
    const selected = this.selected();
    if (!selected) return;
    if (selected.kind === 'node')
      this.nodes = this.nodes.map((item) => (item.id === selected.value.id ? { ...item, label: value } : item));
    if (selected.kind === 'vlan')
      this.vlans = this.vlans.map((item) => (item.id === selected.value.id ? { ...item, name: value } : item));
    if (selected.kind === 'connection')
      this.connections = this.connections.map((item) =>
        item.id === selected.value.id ? { ...item, label: value } : item,
      );
    this.emitChange();
  }
  private updateLineType(lineType: NetworkLineType) {
    if (!this.selectedId) return;
    this.connections = this.connections.map((item) => (item.id === this.selectedId ? { ...item, lineType } : item));
    this.emitChange();
  }
  private updateVlan(updates: Partial<Pick<NetworkVlan, 'width' | 'height' | 'color'>>) {
    if (!this.selectedId) return;
    this.vlans = this.vlans.map((item) => (item.id === this.selectedId ? { ...item, ...updates } : item));
    this.emitChange();
  }
  private deleteSelected() {
    const id = this.selectedId;
    if (!id) return;
    this.nodes = this.nodes.filter((item) => item.id !== id);
    this.vlans = this.vlans.filter((item) => item.id !== id);
    this.connections = this.connections.filter((item) => item.id !== id && item.from !== id && item.to !== id);
    this.selectedId = null;
    this.emitChange();
  }
  private zoom(delta: number) {
    this.scale = Math.max(0.2, Math.min(3, this.scale + delta));
    this.emitChange();
  }
  render() {
    return renderNetworkCanvasTemplate(
      {
        nodes: this.nodes,
        vlans: this.vlans,
        connections: this.connections,
        selected: this.selected(),
        selectedId: this.selectedId,
        connectingFrom: this.connectingFrom,
        scale: this.scale,
        offset: this.offset,
      },
      {
        addNode: (type, point) => this.addNode(type, point),
        addVlan: (point) => this.addVlan(point),
        onCanvasDown: (event) => this.onCanvasDown(event),
        point: (event) => this.point(event),
        zoom: (delta) => this.zoom(delta),
        onItemDown: (event, kind, id) => this.onItemDown(event, kind, id),
        startConnection: (event, id) => this.startConnection(event, id),
        selectConnection: (id) => {
          this.selectedId = id;
        },
        resetView: () => {
          this.scale = 1;
          this.offset = { x: 0, y: 0 };
          this.emitChange();
        },
        clearSelection: () => {
          this.selectedId = null;
        },
        updateSelected: (value) => this.updateSelected(value),
        updateLineType: (type) => this.updateLineType(type),
        updateVlan: (updates) => this.updateVlan(updates),
        deleteSelected: () => this.deleteSelected(),
      },
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-network-canvas': NetworkCanvasElement;
  }
}
