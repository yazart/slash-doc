export type NetworkNodeType = 'server' | 'database' | 'workstation' | 'balancer';
export type NetworkLineType = 'solid' | 'dashed' | 'dotted' | 'double';
export type NetworkNode = { id: string; type: NetworkNodeType; label: string; x: number; y: number; vlanId?: string };
export type NetworkVlan = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type NetworkConnection = { id: string; from: string; to: string; label?: string; lineType?: NetworkLineType };
export type NetworkCanvasData = {
  version: 1;
  nodes: NetworkNode[];
  vlans: NetworkVlan[];
  connections: NetworkConnection[];
  viewport: { x: number; y: number; scale: number };
};

export function createNetworkData(data?: Partial<NetworkCanvasData>): NetworkCanvasData {
  const nodeValues = data?.nodes;
  const nodes = Array.isArray(nodeValues) ? nodeValues.filter(isNode).map((item) => ({ ...item })) : [];
  const vlanValues = data?.vlans;
  const vlans = Array.isArray(vlanValues)
    ? vlanValues.filter(isVlan).map((item) => ({
        ...item,
        width: Math.max(100, item.width),
        height: Math.max(70, item.height),
        color: /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#06b6d4',
      }))
    : [];
  const ids = new Set([...nodes, ...vlans].map((item) => item.id));
  const connectionValues = data?.connections;
  const connections = Array.isArray(connectionValues)
    ? connectionValues
        .filter((item) => isConnection(item) && ids.has(item.from) && ids.has(item.to))
        .map((item) => ({ ...item }))
    : [];
  return {
    version: 1,
    nodes,
    vlans,
    connections,
    viewport: {
      x: finite(data?.viewport?.x, 0),
      y: finite(data?.viewport?.y, 0),
      scale: Math.max(0.2, Math.min(3, finite(data?.viewport?.scale, 1))),
    },
  };
}

function isNode(value: unknown): value is NetworkNode {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<NetworkNode>;
  return (
    typeof item.id === 'string' &&
    typeof item.type === 'string' &&
    ['server', 'database', 'workstation', 'balancer'].includes(item.type) &&
    typeof item.label === 'string' &&
    Number.isFinite(item.x) &&
    Number.isFinite(item.y)
  );
}

function isVlan(value: unknown): value is NetworkVlan {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<NetworkVlan>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.color === 'string' &&
    Number.isFinite(item.x) &&
    Number.isFinite(item.y) &&
    Number.isFinite(item.width) &&
    Number.isFinite(item.height)
  );
}

function isConnection(value: unknown): value is NetworkConnection {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<NetworkConnection>;
  return (
    typeof item.id === 'string' &&
    typeof item.from === 'string' &&
    typeof item.to === 'string' &&
    (!item.lineType || ['solid', 'dashed', 'dotted', 'double'].includes(item.lineType))
  );
}

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
