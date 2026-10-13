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
  viewport: { x: number; y: number; scale: number };
};

export function createFlowDesignerData(data?: Partial<FlowDesignerData>): FlowDesignerData {
  const nodeValues = data?.nodes;
  const nodes = Array.isArray(nodeValues)
    ? nodeValues.filter(isWorkflowNode).map((node) => ({
        ...node,
        inputs: [...node.inputs],
        outputs: [...node.outputs],
      }))
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const connectionValues = data?.connections;
  const connections = Array.isArray(connectionValues)
    ? connectionValues.filter(
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
    ['trigger', 'action', 'condition', 'transform', 'output'].includes(node.type) &&
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
