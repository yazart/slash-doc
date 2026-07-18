import { LitElement, html, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { NETWORK_CANVAS_STYLES } from './network-canvas-styles';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { networkIcon } from './network-icons';
import {
  createNetworkData,
  type NetworkCanvasData,
  type NetworkConnection,
  type NetworkLineType,
  type NetworkNode,
  type NetworkNodeType,
  type NetworkVlan,
} from './network-canvas-data';

export { createNetworkData } from './network-canvas-data';
export type { NetworkCanvasData } from './network-canvas-data';

type Point = { x: number; y: number };
type SelectedItem =
  | { kind: 'node'; value: NetworkNode }
  | { kind: 'vlan'; value: NetworkVlan }
  | { kind: 'connection'; value: NetworkConnection };

const nodeTypes: Array<{ type: NetworkNodeType; label: string }> = [
  { type: 'server', label: 'Сервер' },
  { type: 'database', label: 'База данных' },
  { type: 'workstation', label: 'Рабочая станция' },
  { type: 'balancer', label: 'Балансировщик' },
];
const vlanColors = ['#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#10b981', '#6366f1'];
const lineTypes: NetworkLineType[] = ['solid', 'dashed', 'dotted', 'double'];
const lineTypeLabels: Record<NetworkLineType, string> = {
  solid: 'Сплошная',
  dashed: 'Штриховая',
  dotted: 'Пунктирная',
  double: 'Двойная',
};

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

  static styles = NETWORK_CANVAS_STYLES;

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
  private endpoint(id: string): Point | undefined {
    const node = this.nodes.find((item) => item.id === id);
    if (node) return { x: node.x, y: node.y };
    const vlan = this.vlans.find((item) => item.id === id);
    return vlan ? { x: vlan.x + vlan.width / 2, y: vlan.y + vlan.height / 2 } : undefined;
  }
  private selected(): SelectedItem | undefined {
    const node = this.nodes.find((item) => item.id === this.selectedId);
    if (node) return { kind: 'node', value: node };
    const vlan = this.vlans.find((item) => item.id === this.selectedId);
    if (vlan) return { kind: 'vlan', value: vlan };
    const connection = this.connections.find((item) => item.id === this.selectedId);
    return connection ? { kind: 'connection', value: connection } : undefined;
  }
  private addNode(type: NetworkNodeType, point?: Point) {
    const label = nodeTypes.find((item) => item.type === type)!.label;
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
        color: vlanColors[index % vlanColors.length],
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
  private connectionSvg(connection: NetworkConnection) {
    const from = this.endpoint(connection.from),
      to = this.endpoint(connection.to);
    if (!from || !to) return '';
    const type = connection.lineType ?? 'dashed';
    const dash = type === 'dashed' ? '7 4' : type === 'dotted' ? '2 5' : undefined;
    const color =
      connection.id === this.selectedId ? 'var(--nc-primary)' : 'color-mix(in srgb,var(--nc-primary) 55%,transparent)';
    const lines =
      type === 'double'
        ? svg`<line x1=${from.x - 3} y1=${from.y - 3} x2=${to.x - 3} y2=${to.y - 3} stroke=${color} stroke-width="2"/><line x1=${from.x + 3} y1=${from.y + 3} x2=${to.x + 3} y2=${to.y + 3} stroke=${color} stroke-width="2"/>`
        : svg`<line x1=${from.x} y1=${from.y} x2=${to.x} y2=${to.y} stroke=${color} stroke-width="2" stroke-dasharray=${dash ?? ''}/>`;
    return svg`<g class="connection" @click=${(event: Event) => {
      event.stopPropagation();
      this.selectedId = connection.id;
    }}>${lines}<line x1=${from.x} y1=${from.y} x2=${to.x} y2=${to.y} stroke="transparent" stroke-width="14"/>${connection.label ? svg`<text class="connection-label" x=${(from.x + to.x) / 2} y=${(from.y + to.y) / 2 - 7}>${connection.label}</text>` : ''}</g>`;
  }
  render() {
    const selected = this.selected();
    return html`<div class="editor">
      <aside class="sidebar">
        <h3 class="heading">Компоненты</h3>
        <div class="items">
          ${nodeTypes.map((item) => html`<button class="item ${item.type}" type="button" draggable="true" @click=${() => this.addNode(item.type)} @dragstart=${(event: DragEvent) => event.dataTransfer?.setData('application/network-type', item.type)}><span class="icon">${unsafeHTML(networkIcon(item.type, 18))}</span><span>${item.label}</span></button>`)}
          <div class="separator"></div>
          <button
            class="item vlan-item"
            type="button"
            draggable="true"
            @click=${() => this.addVlan()}
            @dragstart=${(event: DragEvent) => event.dataTransfer?.setData('application/network-type', 'vlan')}
          >
            <span class="icon">${unsafeHTML(networkIcon('layers', 18))}</span><span>Сегмент VLAN</span>
          </button>
        </div>
        <p class="help">
          Нажмите, чтобы добавить • Перетащите, чтобы переместить<br />Правая кнопка — соединить<br />Выберите и удалите
          элемент
        </p>
      </aside>
      <main class="stage">
        ${this.connectingFrom ? html`<div class="hint">Выберите узел или VLAN для соединения</div>` : ''}
        <div
          class="canvas"
          @mousedown=${this.onCanvasDown}
          @wheel=${(event: WheelEvent) => {
            event.preventDefault();
            this.zoom(event.deltaY > 0 ? -0.1 : 0.1);
          }}
          @dragover=${(event: DragEvent) => event.preventDefault()}
          @drop=${(event: DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer?.getData('application/network-type');
            if (!type) return;
            const point = this.point(event);
            if (type === 'vlan') this.addVlan(point);
            else this.addNode(type as NetworkNodeType, point);
          }}
        >
          <div
            class="content"
            style=${`transform:translate(${this.offset.x}px,${this.offset.y}px) scale(${this.scale})`}
          >
            <svg class="connections">${this.connections.map((item) => this.connectionSvg(item))}</svg
            >${this.vlans.map((vlan) => html`<div class="vlan ${vlan.id === this.selectedId ? 'selected' : ''}" style=${`--vlan-color:${vlan.color};left:${vlan.x}px;top:${vlan.y}px;width:${vlan.width}px;height:${vlan.height}px`} @mousedown=${(event: MouseEvent) => this.onItemDown(event, 'vlan', vlan.id)} @contextmenu=${(event: MouseEvent) => this.startConnection(event, vlan.id)}><span class="vlan-label">${vlan.name}</span></div>`)}${this.nodes.map(
              (node) =>
                html`<div
                  class="network-node ${node.type} ${node.id === this.selectedId ? 'selected' : ''}"
                  style=${`left:${node.x}px;top:${node.y}px`}
                  @mousedown=${(event: MouseEvent) => this.onItemDown(event, 'node', node.id)}
                  @contextmenu=${(event: MouseEvent) => this.startConnection(event, node.id)}
                >
                  <div class="node-card">${unsafeHTML(networkIcon(node.type, 28))}</div>
                  <span class="node-label">${node.label}</span>
                </div>`,
            )}
          </div>
        </div>
        <div class="toolbar">
          <button @click=${() => this.zoom(-0.15)}>−</button><span class="zoom">${Math.round(this.scale * 100)}%</span
          ><button @click=${() => this.zoom(0.15)}>+</button
          ><button
            title="Сбросить вид"
            @click=${() => {
              this.scale = 1;
              this.offset = { x: 0, y: 0 };
              this.emitChange();
            }}
          >
            ⌂
          </button>
        </div>
        ${
          selected
            ? html`<aside class="properties">
                <div class="properties-header">
                  <h3>
                    ${selected.kind === 'connection' ? 'Соединение' : selected.kind === 'vlan' ? 'VLAN' : 'Сетевой узел'}
                  </h3>
                  <button
                    class="close"
                    @click=${() => {
                      this.selectedId = null;
                    }}
                  >
                    ×
                  </button>
                </div>
                <label
                  >${selected.kind === 'vlan' ? 'Название' : 'Подпись'}<input
                    .value=${selected.kind === 'node' ? selected.value.label : selected.kind === 'vlan' ? selected.value.name : (selected.value.label ?? '')}
                    @input=${(event: Event) => this.updateSelected((event.target as HTMLInputElement).value)} /></label
                >${
                  selected.kind === 'connection'
                    ? html`<label
                        >Тип линии<select
                          .value=${selected.value.lineType ?? 'dashed'}
                          @change=${(event: Event) => this.updateLineType((event.target as HTMLSelectElement).value as NetworkLineType)}
                        >
                          ${lineTypes.map((type) => html`<option value=${type}>${lineTypeLabels[type]}</option>`)}
                        </select></label
                      >`
                    : ''
                }${selected.kind === 'vlan' ? html`<label>Ширина<input type="number" min="100" .value=${String(selected.value.width)} @input=${(event: Event) => this.updateVlan({ width: Math.max(100, Number((event.target as HTMLInputElement).value) || 100) })} /></label><label>Высота<input type="number" min="70" .value=${String(selected.value.height)} @input=${(event: Event) => this.updateVlan({ height: Math.max(70, Number((event.target as HTMLInputElement).value) || 70) })} /></label><label>Цвет<input type="color" .value=${selected.value.color} @input=${(event: Event) => this.updateVlan({ color: (event.target as HTMLInputElement).value })} /></label>` : ''}<button
                  class="delete"
                  @click=${this.deleteSelected}
                >
                  Удалить
                </button>
              </aside>`
            : ''
        }
      </main>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'slash-network-canvas': NetworkCanvasElement;
  }
}
