import { html, svg, type TemplateResult } from 'lit';
import { FLOW_PORT_GAP, FLOW_PORT_TOP } from '../shared/flow-designer-layout';
import type { NodeType, WorkflowConnection, WorkflowNode } from './flow-designer-data';

type Point = { x: number; y: number };

export const FLOW_NODE_TEMPLATES: Record<NodeType, Pick<WorkflowNode, 'label' | 'inputs' | 'outputs'>> = {
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

export type FlowDesignerTemplateState = {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  selected: WorkflowNode | undefined;
  selectedId: string | null;
  pendingType: NodeType | null;
  scale: number;
  offset: Point;
  connecting?: { nodeId: string; port: number; cursor: Point };
};

export type FlowDesignerTemplateActions = {
  setPendingType(type: NodeType): void;
  onCanvasDown(event: MouseEvent): void;
  onDrop(event: DragEvent): void;
  zoom(delta: number): void;
  removeConnection(id: string): void;
  path(from: Point, to: Point): string;
  portPoint(node: WorkflowNode, port: number, output: boolean): Point;
  onNodeDown(event: MouseEvent, node: WorkflowNode): void;
  finishConnection(event: MouseEvent, node: WorkflowNode, port: number): void;
  startConnection(event: MouseEvent, node: WorkflowNode, port: number): void;
  clearSelection(): void;
  updateSelected(updates: Partial<WorkflowNode>): void;
  deleteSelected(): void;
};

export function renderFlowDesignerTemplate(
  state: FlowDesignerTemplateState,
  actions: FlowDesignerTemplateActions,
): TemplateResult {
  return html`<div class="editor">
    <aside class="palette">
      <h3 class="heading">Узлы</h3>
      <div class="palette-list">
        ${palette.map(
          (item) =>
            html`<button
              type="button"
              class="palette-item ${item.type} ${state.pendingType === item.type ? 'active' : ''}"
              draggable="true"
              @click=${() => actions.setPendingType(item.type)}
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
        class="canvas ${state.pendingType ? 'pending' : ''}"
        @mousedown=${actions.onCanvasDown}
        @dragover=${(event: DragEvent) => event.preventDefault()}
        @drop=${actions.onDrop}
        @wheel=${(event: WheelEvent) => {
          event.preventDefault();
          actions.zoom(event.deltaY > 0 ? -0.1 : 0.1);
        }}
      >
        <svg class="connections">
          ${state.connections.map((connection) => renderConnection(state, actions, connection))}
          ${renderPendingConnection(state, actions)}
        </svg>
        <div
          class="scene"
          style=${`transform: translate(${state.offset.x}px, ${state.offset.y}px) scale(${state.scale})`}
        >
          ${state.nodes.map((node) => renderNode(state, actions, node))}
        </div>
      </div>
      <div class="controls">
        <button class="control" type="button" @click=${() => actions.zoom(-0.1)}>−</button
        ><span class="zoom">${Math.round(state.scale * 100)}%</span
        ><button class="control" type="button" @click=${() => actions.zoom(0.1)}>+</button>
      </div>
      ${state.selected ? renderProperties(state.selected, actions) : ''}
    </section>
  </div>`;
}

function renderConnection(
  state: FlowDesignerTemplateState,
  actions: FlowDesignerTemplateActions,
  connection: WorkflowConnection,
): TemplateResult | string {
  const from = state.nodes.find((node) => node.id === connection.fromNodeId);
  const to = state.nodes.find((node) => node.id === connection.toNodeId);
  return from && to
    ? svg`<path d=${actions.path(actions.portPoint(from, connection.fromPort, true), actions.portPoint(to, connection.toPort, false))} @click=${() => actions.removeConnection(connection.id)}></path>`
    : '';
}

function renderPendingConnection(
  state: FlowDesignerTemplateState,
  actions: FlowDesignerTemplateActions,
): TemplateResult | string {
  if (!state.connecting) return '';
  const from = state.nodes.find((node) => node.id === state.connecting?.nodeId);
  return from
    ? svg`<path class="connecting" d=${actions.path(
        actions.portPoint(from, state.connecting.port, true),
        state.connecting.cursor,
      )}></path>`
    : '';
}

function renderNode(
  state: FlowDesignerTemplateState,
  actions: FlowDesignerTemplateActions,
  node: WorkflowNode,
): TemplateResult {
  return html`<div
    class="node ${node.type} ${node.id === state.selectedId ? 'selected' : ''}"
    style=${`left:${node.x}px;top:${node.y}px`}
    @mousedown=${(event: MouseEvent) => actions.onNodeDown(event, node)}
  >
    <div class="node-title">${node.label}</div>
    ${node.description ? html`<div class="node-description">${node.description}</div>` : ''}${node.inputs.map(
      (_, port) =>
        html`<span
          class="port input"
          style=${`top:${FLOW_PORT_TOP + port * FLOW_PORT_GAP}px`}
          @mouseup=${(event: MouseEvent) => actions.finishConnection(event, node, port)}
        ></span>`,
    )}${node.outputs.map(
      (_, port) =>
        html`<span
          class="port output"
          style=${`top:${FLOW_PORT_TOP + port * FLOW_PORT_GAP}px`}
          @mousedown=${(event: MouseEvent) => actions.startConnection(event, node, port)}
        ></span>`,
    )}
  </div>`;
}

function renderProperties(selected: WorkflowNode, actions: FlowDesignerTemplateActions): TemplateResult {
  return html`<aside class="properties">
    <div class="properties-header">
      <h3 class="properties-title">Свойства узла</h3>
      <button class="close" type="button" @click=${actions.clearSelection}>×</button>
    </div>
    <label
      >Название<input
        .value=${selected.label}
        @input=${(event: Event) =>
          actions.updateSelected({ label: (event.target as HTMLInputElement).value })} /></label
    ><label
      >Описание<textarea
        .value=${selected.description ?? ''}
        @input=${(event: Event) => actions.updateSelected({ description: (event.target as HTMLTextAreaElement).value })}
      ></textarea></label
    ><button class="delete" type="button" @click=${actions.deleteSelected}>Удалить узел</button>
  </aside>`;
}
