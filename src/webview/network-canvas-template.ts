import { html, svg, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type {
  NetworkConnection,
  NetworkLineType,
  NetworkNode,
  NetworkNodeType,
  NetworkVlan,
} from './network-canvas-data';
import { networkIcon } from './network-icons';

type Point = { x: number; y: number };
export type NetworkSelectedItem =
  | { kind: 'node'; value: NetworkNode }
  | { kind: 'vlan'; value: NetworkVlan }
  | { kind: 'connection'; value: NetworkConnection };

export const NETWORK_NODE_TYPES: Array<{ type: NetworkNodeType; label: string }> = [
  { type: 'server', label: 'Сервер' },
  { type: 'database', label: 'База данных' },
  { type: 'workstation', label: 'Рабочая станция' },
  { type: 'balancer', label: 'Балансировщик' },
];

export const NETWORK_VLAN_COLORS = ['#06b6d4', '#8b5cf6', '#f97316', '#ec4899', '#10b981', '#6366f1'];

const lineTypes: NetworkLineType[] = ['solid', 'dashed', 'dotted', 'double'];
const lineTypeLabels: Record<NetworkLineType, string> = {
  solid: 'Сплошная',
  dashed: 'Штриховая',
  dotted: 'Пунктирная',
  double: 'Двойная',
};

export type NetworkCanvasTemplateState = {
  nodes: NetworkNode[];
  vlans: NetworkVlan[];
  connections: NetworkConnection[];
  selected: NetworkSelectedItem | undefined;
  selectedId: string | null;
  connectingFrom: string | null;
  scale: number;
  offset: Point;
};

export type NetworkCanvasTemplateActions = {
  addNode(type: NetworkNodeType, point?: Point): void;
  addVlan(point?: Point): void;
  onCanvasDown(event: MouseEvent): void;
  point(event: MouseEvent): Point;
  zoom(delta: number): void;
  onItemDown(event: MouseEvent, kind: 'node' | 'vlan', id: string): void;
  startConnection(event: MouseEvent, id: string): void;
  selectConnection(id: string): void;
  resetView(): void;
  clearSelection(): void;
  updateSelected(value: string): void;
  updateLineType(type: NetworkLineType): void;
  updateVlan(updates: Partial<Pick<NetworkVlan, 'width' | 'height' | 'color'>>): void;
  deleteSelected(): void;
};

export function renderNetworkCanvasTemplate(
  state: NetworkCanvasTemplateState,
  actions: NetworkCanvasTemplateActions,
): TemplateResult {
  return html`<div class="editor">
    <aside class="sidebar">
      <h3 class="heading">Компоненты</h3>
      <div class="items">
        ${NETWORK_NODE_TYPES.map(
          (item) =>
            html`<button
              class="item ${item.type}"
              type="button"
              draggable="true"
              @click=${() => actions.addNode(item.type)}
              @dragstart=${(event: DragEvent) => event.dataTransfer?.setData('application/network-type', item.type)}
            >
              <span class="icon">${unsafeHTML(networkIcon(item.type, 18))}</span><span>${item.label}</span>
            </button>`,
        )}
        <div class="separator"></div>
        <button
          class="item vlan-item"
          type="button"
          draggable="true"
          @click=${() => actions.addVlan()}
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
      ${state.connectingFrom ? html`<div class="hint">Выберите узел или VLAN для соединения</div>` : ''}
      <div
        class="canvas"
        @mousedown=${actions.onCanvasDown}
        @wheel=${(event: WheelEvent) => {
          event.preventDefault();
          actions.zoom(event.deltaY > 0 ? -0.1 : 0.1);
        }}
        @dragover=${(event: DragEvent) => event.preventDefault()}
        @drop=${(event: DragEvent) => {
          event.preventDefault();
          const type = event.dataTransfer?.getData('application/network-type');
          if (!type) return;
          const point = actions.point(event);
          if (type === 'vlan') actions.addVlan(point);
          else actions.addNode(type as NetworkNodeType, point);
        }}
      >
        <div
          class="content"
          style=${`transform:translate(${state.offset.x}px,${state.offset.y}px) scale(${state.scale})`}
        >
          <svg class="connections">
            ${state.connections.map((connection) => renderConnection(state, actions, connection))}
          </svg>
          ${state.vlans.map((vlan) => renderVlan(state, actions, vlan))}
          ${state.nodes.map((node) => renderNode(state, actions, node))}
        </div>
      </div>
      <div class="toolbar">
        <button @click=${() => actions.zoom(-0.15)}>−</button><span class="zoom">${Math.round(state.scale * 100)}%</span
        ><button @click=${() => actions.zoom(0.15)}>+</button
        ><button title="Сбросить вид" @click=${actions.resetView}>⌂</button>
      </div>
      ${state.selected ? renderProperties(state.selected, actions) : ''}
    </main>
  </div>`;
}

function renderConnection(
  state: NetworkCanvasTemplateState,
  actions: NetworkCanvasTemplateActions,
  connection: NetworkConnection,
): TemplateResult | string {
  const from = endpoint(state, connection.from);
  const to = endpoint(state, connection.to);
  if (!from || !to) return '';
  const type = connection.lineType ?? 'dashed';
  const dash = type === 'dashed' ? '7 4' : type === 'dotted' ? '2 5' : undefined;
  const color =
    connection.id === state.selectedId ? 'var(--nc-primary)' : 'color-mix(in srgb,var(--nc-primary) 55%,transparent)';
  const lines =
    type === 'double'
      ? svg`<line x1=${from.x - 3} y1=${from.y - 3} x2=${to.x - 3} y2=${to.y - 3} stroke=${color} stroke-width="2"/><line x1=${from.x + 3} y1=${from.y + 3} x2=${to.x + 3} y2=${to.y + 3} stroke=${color} stroke-width="2"/>`
      : svg`<line x1=${from.x} y1=${from.y} x2=${to.x} y2=${to.y} stroke=${color} stroke-width="2" stroke-dasharray=${dash ?? ''}/>`;
  return svg`<g class="connection" @click=${(event: Event) => {
    event.stopPropagation();
    actions.selectConnection(connection.id);
  }}>${lines}<line x1=${from.x} y1=${from.y} x2=${to.x} y2=${to.y} stroke="transparent" stroke-width="14"/>${connection.label ? svg`<text class="connection-label" x=${(from.x + to.x) / 2} y=${(from.y + to.y) / 2 - 7}>${connection.label}</text>` : ''}</g>`;
}

function renderVlan(
  state: NetworkCanvasTemplateState,
  actions: NetworkCanvasTemplateActions,
  vlan: NetworkVlan,
): TemplateResult {
  return html`<div
    class="vlan ${vlan.id === state.selectedId ? 'selected' : ''}"
    style=${`--vlan-color:${vlan.color};left:${vlan.x}px;top:${vlan.y}px;width:${vlan.width}px;height:${vlan.height}px`}
    @mousedown=${(event: MouseEvent) => actions.onItemDown(event, 'vlan', vlan.id)}
    @contextmenu=${(event: MouseEvent) => actions.startConnection(event, vlan.id)}
  >
    <span class="vlan-label">${vlan.name}</span>
  </div>`;
}

function renderNode(
  state: NetworkCanvasTemplateState,
  actions: NetworkCanvasTemplateActions,
  node: NetworkNode,
): TemplateResult {
  return html`<div
    class="network-node ${node.type} ${node.id === state.selectedId ? 'selected' : ''}"
    style=${`left:${node.x}px;top:${node.y}px`}
    @mousedown=${(event: MouseEvent) => actions.onItemDown(event, 'node', node.id)}
    @contextmenu=${(event: MouseEvent) => actions.startConnection(event, node.id)}
  >
    <div class="node-card">${unsafeHTML(networkIcon(node.type, 28))}</div>
    <span class="node-label">${node.label}</span>
  </div>`;
}

function renderProperties(selected: NetworkSelectedItem, actions: NetworkCanvasTemplateActions): TemplateResult {
  return html`<aside class="properties">
    <div class="properties-header">
      <h3>${selected.kind === 'connection' ? 'Соединение' : selected.kind === 'vlan' ? 'VLAN' : 'Сетевой узел'}</h3>
      <button class="close" @click=${actions.clearSelection}>×</button>
    </div>
    <label
      >${selected.kind === 'vlan' ? 'Название' : 'Подпись'}<input
        .value=${
          selected.kind === 'node'
            ? selected.value.label
            : selected.kind === 'vlan'
              ? selected.value.name
              : (selected.value.label ?? '')
        }
        @input=${(event: Event) => actions.updateSelected((event.target as HTMLInputElement).value)} /></label
    >${
      selected.kind === 'connection'
        ? html`<label
            >Тип линии<select
              .value=${selected.value.lineType ?? 'dashed'}
              @change=${(event: Event) =>
                actions.updateLineType((event.target as HTMLSelectElement).value as NetworkLineType)}
            >
              ${lineTypes.map((type) => html`<option value=${type}>${lineTypeLabels[type]}</option>`)}
            </select></label
          >`
        : ''
    }${
      selected.kind === 'vlan'
        ? html`<label
              >Ширина<input
                type="number"
                min="100"
                .value=${String(selected.value.width)}
                @input=${(event: Event) =>
                  actions.updateVlan({
                    width: Math.max(100, Number((event.target as HTMLInputElement).value) || 100),
                  })} /></label
            ><label
              >Высота<input
                type="number"
                min="70"
                .value=${String(selected.value.height)}
                @input=${(event: Event) =>
                  actions.updateVlan({
                    height: Math.max(70, Number((event.target as HTMLInputElement).value) || 70),
                  })} /></label
            ><label
              >Цвет<input
                type="color"
                .value=${selected.value.color}
                @input=${(event: Event) => actions.updateVlan({ color: (event.target as HTMLInputElement).value })}
            /></label>`
        : ''
    }<button class="delete" @click=${actions.deleteSelected}>Удалить</button>
  </aside>`;
}

function endpoint(state: NetworkCanvasTemplateState, id: string): Point | undefined {
  const node = state.nodes.find((item) => item.id === id);
  if (node) return { x: node.x, y: node.y };
  const vlan = state.vlans.find((item) => item.id === id);
  return vlan ? { x: vlan.x + vlan.width / 2, y: vlan.y + vlan.height / 2 } : undefined;
}
