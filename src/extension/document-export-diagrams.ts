import { networkIconContent, type NetworkIconName } from '../webview/network-icons';
import { escapeAttribute, escapeHtml, isRecord } from './utils';

type ExportFlowNode = {
  id: string;
  type: string;
  label: string;
  description: string;
  x: number;
  y: number;
  inputs: string[];
  outputs: string[];
};

type ExportFlowConnection = {
  fromNodeId: string;
  fromPort: number;
  toNodeId: string;
  toPort: number;
};

export function createFlowDesignerDataUri(data: Record<string, unknown>): string {
  const svg = renderFlowDesignerSvg(data);
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function renderFlowDesignerSvg(data: Record<string, unknown>): string {
  const nodes = normalizeExportFlowNodes(data.nodes);
  const connections = normalizeExportFlowConnections(data.connections);
  const nodeWidth = 180;
  const nodeHeight = 76;
  const padding = 32;
  const minX = nodes.length > 0 ? Math.min(...nodes.map((node) => node.x)) : 0;
  const minY = nodes.length > 0 ? Math.min(...nodes.map((node) => node.y)) : 0;
  const maxX = nodes.length > 0 ? Math.max(...nodes.map((node) => node.x + nodeWidth)) : 360;
  const maxY = nodes.length > 0 ? Math.max(...nodes.map((node) => node.y + nodeHeight)) : 180;
  const width = Math.max(360, maxX - minX + padding * 2);
  const height = Math.max(180, maxY - minY + padding * 2);
  const offsetX = padding - minX;
  const offsetY = padding - minY;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const viewport = isRecord(data.viewport)
    ? {
        x: getFiniteNumber(data.viewport.x, 0),
        y: getFiniteNumber(data.viewport.y, 0),
        scale: Math.max(0.25, Math.min(2, getFiniteNumber(data.viewport.scale, 1))),
      }
    : { x: 0, y: 0, scale: 1 };
  const serializedData = JSON.stringify({ version: 1, nodes, connections, viewport }).replaceAll(
    ']]>',
    ']]]]><![CDATA[>',
  );
  const connectionSvg = connections
    .map((connection) => {
      const from = nodeById.get(connection.fromNodeId);
      const to = nodeById.get(connection.toNodeId);

      if (!from || !to) {
        return '';
      }

      const startX = from.x + offsetX + nodeWidth;
      const startY = from.y + offsetY + nodeHeight / 2 + connection.fromPort * 12;
      const endX = to.x + offsetX;
      const endY = to.y + offsetY + nodeHeight / 2 + connection.toPort * 12;
      const bend = Math.max(42, Math.abs(endX - startX) / 2);
      return `<path d="M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}"/>`;
    })
    .join('');
  const nodeSvg = nodes
    .map((node) => {
      const x = node.x + offsetX;
      const y = node.y + offsetY;
      const color = getFlowNodeColor(node.type);
      const label = escapeHtml(node.label || getFlowNodeLabel(node.type));
      const description = node.description
        ? `<text class="description" x="${x + 14}" y="${y + 49}">${escapeHtml(node.description)}</text>`
        : '';
      const inputPorts = node.inputs
        .map(
          (_, index) =>
            `<circle cx="${x}" cy="${y + nodeHeight / 2 + index * 12}" r="5" fill="#ffffff" stroke="${color}"/>`,
        )
        .join('');
      const outputPorts = node.outputs
        .map(
          (_, index) =>
            `<circle cx="${x + nodeWidth}" cy="${y + nodeHeight / 2 + index * 12}" r="5" fill="#ffffff" stroke="${color}"/>`,
        )
        .join('');

      return `<g class="node node-${escapeAttribute(node.type)}"><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="2"/><text class="label" x="${x + 14}" y="${y + 29}">${label}</text>${description}${inputPorts}${outputPorts}</g>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Диаграмма конструктора процессов">
  <metadata id="slash-doc-flow-data"><![CDATA[${serializedData}]]></metadata>
  <style><![CDATA[
    .background { fill: #ffffff; }
    .connections path { fill: none; stroke: #4f83cc; stroke-width: 2; }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #202124; }
    .label { font-size: 14px; font-weight: 600; }
    .description { font-size: 11px; fill: #5f6368; }
  ]]></style>
  <rect class="background" width="100%" height="100%" rx="8"/>
  <g class="connections">${connectionSvg}</g>
  <g class="nodes">${nodeSvg}</g>
</svg>`;
}

function normalizeExportFlowNodes(value: unknown): ExportFlowNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((node, index) => ({
    id: typeof node.id === 'string' ? node.id : `node-${index + 1}`,
    type: typeof node.type === 'string' ? node.type : 'action',
    label: typeof node.label === 'string' ? node.label : '',
    description: typeof node.description === 'string' ? node.description : '',
    x: getFiniteNumber(node.x, index * 210),
    y: getFiniteNumber(node.y, 0),
    inputs: Array.isArray(node.inputs) ? node.inputs.filter((item): item is string => typeof item === 'string') : [],
    outputs: Array.isArray(node.outputs) ? node.outputs.filter((item): item is string => typeof item === 'string') : [],
  }));
}

function normalizeExportFlowConnections(value: unknown): ExportFlowConnection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).flatMap((connection) => {
    if (typeof connection.fromNodeId !== 'string' || typeof connection.toNodeId !== 'string') {
      return [];
    }

    return [
      {
        fromNodeId: connection.fromNodeId,
        fromPort: Math.max(0, Math.trunc(getFiniteNumber(connection.fromPort, 0))),
        toNodeId: connection.toNodeId,
        toPort: Math.max(0, Math.trunc(getFiniteNumber(connection.toPort, 0))),
      },
    ];
  });
}

function getFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getFlowNodeColor(type: string): string {
  return (
    (
      {
        trigger: '#2e9b57',
        action: '#3979c6',
        condition: '#b77900',
        transform: '#8655b6',
        output: '#c56824',
      } as Record<string, string>
    )[type] ?? '#697386'
  );
}

function getFlowNodeLabel(type: string): string {
  return (
    (
      {
        trigger: 'Триггер',
        action: 'Действие',
        condition: 'Условие',
        transform: 'Преобразование',
        output: 'Результат',
      } as Record<string, string>
    )[type] ?? 'Узел'
  );
}

type ExportNetworkNode = { id: string; type: string; label: string; x: number; y: number; vlanId?: string };
type ExportNetworkVlan = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type ExportNetworkConnection = { id: string; from: string; to: string; label: string; lineType: string };

export function createNetworkCanvasDataUri(data: Record<string, unknown>): string {
  return `data:image/svg+xml;base64,${Buffer.from(renderNetworkCanvasSvg(data), 'utf8').toString('base64')}`;
}

function renderNetworkCanvasSvg(data: Record<string, unknown>): string {
  const nodes = normalizeExportNetworkNodes(data.nodes);
  const vlans = normalizeExportNetworkVlans(data.vlans);
  const connections = normalizeExportNetworkConnections(data.connections);
  const items = [
    ...nodes.map((node) => ({ left: node.x - 50, top: node.y - 40, right: node.x + 50, bottom: node.y + 40 })),
    ...vlans.map((vlan) => ({ left: vlan.x, top: vlan.y, right: vlan.x + vlan.width, bottom: vlan.y + vlan.height })),
  ];
  const padding = 36;
  const minX = items.length ? Math.min(...items.map((item) => item.left)) : 0;
  const minY = items.length ? Math.min(...items.map((item) => item.top)) : 0;
  const maxX = items.length ? Math.max(...items.map((item) => item.right)) : 500;
  const maxY = items.length ? Math.max(...items.map((item) => item.bottom)) : 280;
  const width = Math.max(500, maxX - minX + padding * 2);
  const height = Math.max(280, maxY - minY + padding * 2);
  const offsetX = padding - minX;
  const offsetY = padding - minY;
  const endpoints = new Map<string, { x: number; y: number }>([
    ...nodes.map((node) => [node.id, { x: node.x + offsetX, y: node.y + offsetY }] as const),
    ...vlans.map(
      (vlan) => [vlan.id, { x: vlan.x + vlan.width / 2 + offsetX, y: vlan.y + vlan.height / 2 + offsetY }] as const,
    ),
  ]);
  const viewport = isRecord(data.viewport)
    ? {
        x: getFiniteNumber(data.viewport.x, 0),
        y: getFiniteNumber(data.viewport.y, 0),
        scale: Math.max(0.2, Math.min(3, getFiniteNumber(data.viewport.scale, 1))),
      }
    : { x: 0, y: 0, scale: 1 };
  const metadata = JSON.stringify({ version: 1, nodes, vlans, connections, viewport }).replaceAll(
    ']]>',
    ']]]]><![CDATA[>',
  );
  const vlanSvg = vlans
    .map(
      (vlan) =>
        `<g class="vlan"><rect x="${vlan.x + offsetX}" y="${vlan.y + offsetY}" width="${vlan.width}" height="${vlan.height}" rx="9" fill="${escapeAttribute(vlan.color)}" fill-opacity="0.07" stroke="${escapeAttribute(vlan.color)}" stroke-width="2" stroke-dasharray="7 5"/><rect x="${vlan.x + offsetX}" y="${vlan.y + offsetY}" width="${Math.max(70, vlan.name.length * 8 + 18)}" height="25" rx="5" fill="${escapeAttribute(vlan.color)}" fill-opacity="0.18"/><text class="vlan-label" x="${vlan.x + offsetX + 9}" y="${vlan.y + offsetY + 17}" fill="${escapeAttribute(vlan.color)}">${escapeHtml(vlan.name)}</text></g>`,
    )
    .join('');
  const connectionSvg = connections
    .map((connection) => {
      const from = endpoints.get(connection.from);
      const to = endpoints.get(connection.to);
      if (!from || !to) return '';
      const dash =
        connection.lineType === 'dashed'
          ? ' stroke-dasharray="8 5"'
          : connection.lineType === 'dotted'
            ? ' stroke-dasharray="2 6" stroke-linecap="round"'
            : '';
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const px = (-dy / length) * 3;
      const py = (dx / length) * 3;
      const visible =
        connection.lineType === 'double'
          ? `<line x1="${from.x + px}" y1="${from.y + py}" x2="${to.x + px}" y2="${to.y + py}"/><line x1="${from.x - px}" y1="${from.y - py}" x2="${to.x - px}" y2="${to.y - py}"/>`
          : `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"${dash}/>`;
      const label = connection.label
        ? `<g class="connection-label"><rect x="${(from.x + to.x) / 2 - Math.max(34, connection.label.length * 3.5 + 8)}" y="${(from.y + to.y) / 2 - 12}" width="${Math.max(68, connection.label.length * 7 + 16)}" height="20" rx="4"/><text x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 + 2}">${escapeHtml(connection.label)}</text></g>`
        : '';
      return `<g class="connection">${visible}${label}</g>`;
    })
    .join('');
  const nodeSvg = nodes.map((node) => renderNetworkNodeSvg(node, offsetX, offsetY)).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Сетевая схема">
  <metadata id="slash-doc-network-data"><![CDATA[${metadata}]]></metadata>
  <style><![CDATA[
    .background { fill:#f6f8fa; }
    .grid { stroke:#d8dee4; stroke-width:1; }
    text { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .vlan-label { font-size:11px; font-weight:600; letter-spacing:.06em; }
    .connection line { stroke:#378b9c; stroke-width:2; }
    .connection-label rect { fill:#fff; stroke:#8dbbc4; }
    .connection-label text { fill:#57606a; font-size:10px; text-anchor:middle; }
    .node-label { fill:#424a53; font-size:11px; text-anchor:middle; }
  ]]></style>
  <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path class="grid" d="M20 0H0V20" fill="none"/></pattern></defs>
  <rect class="background" width="100%" height="100%" rx="8"/><rect width="100%" height="100%" fill="url(#grid)" opacity=".55"/>
  <g class="vlans">${vlanSvg}</g><g class="connections">${connectionSvg}</g><g class="nodes">${nodeSvg}</g>
</svg>`;
}

function renderNetworkNodeSvg(node: ExportNetworkNode, offsetX: number, offsetY: number): string {
  const x = node.x + offsetX;
  const y = node.y + offsetY;
  const color =
    ({ server: '#0891b2', database: '#7c3aed', workstation: '#159447', balancer: '#d97706' } as Record<string, string>)[
      node.type
    ] ?? '#697386';
  const iconName: NetworkIconName =
    node.type === 'database' || node.type === 'workstation' || node.type === 'balancer' ? node.type : 'server';
  return `<g class="node node-${escapeAttribute(node.type)}"><rect x="${x - 29}" y="${y - 29}" width="58" height="54" rx="8" fill="#fff" stroke="${color}"/><g transform="translate(${x - 22} ${y - 22}) scale(1.84)" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${networkIconContent(iconName)}</g><text class="node-label" x="${x}" y="${y + 42}">${escapeHtml(node.label)}</text></g>`;
}

function normalizeExportNetworkNodes(value: unknown): ExportNetworkNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((node, index) =>
    typeof node.id === 'string'
      ? [
          {
            id: node.id,
            type: typeof node.type === 'string' ? node.type : 'server',
            label: typeof node.label === 'string' ? node.label : `Node ${index + 1}`,
            x: getFiniteNumber(node.x, index * 130),
            y: getFiniteNumber(node.y, 0),
            ...(typeof node.vlanId === 'string' ? { vlanId: node.vlanId } : {}),
          },
        ]
      : [],
  );
}

function normalizeExportNetworkVlans(value: unknown): ExportNetworkVlan[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((vlan, index) =>
    typeof vlan.id === 'string'
      ? [
          {
            id: vlan.id,
            name: typeof vlan.name === 'string' ? vlan.name : `VLAN ${index + 1}`,
            color: typeof vlan.color === 'string' && /^#[0-9a-f]{6}$/i.test(vlan.color) ? vlan.color : '#06b6d4',
            x: getFiniteNumber(vlan.x, 0),
            y: getFiniteNumber(vlan.y, 0),
            width: Math.max(100, getFiniteNumber(vlan.width, 280)),
            height: Math.max(70, getFiniteNumber(vlan.height, 180)),
          },
        ]
      : [],
  );
}

function normalizeExportNetworkConnections(value: unknown): ExportNetworkConnection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((connection, index) =>
    typeof connection.from === 'string' && typeof connection.to === 'string'
      ? [
          {
            id: typeof connection.id === 'string' ? connection.id : `connection-${index + 1}`,
            from: connection.from,
            to: connection.to,
            label: typeof connection.label === 'string' ? connection.label : '',
            lineType: typeof connection.lineType === 'string' ? connection.lineType : 'dashed',
          },
        ]
      : [],
  );
}
