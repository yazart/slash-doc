import { describe, expect, it } from 'vitest';
import { createNetworkCanvasDataUri } from '../src/extension/document-export-diagrams';
import { createFlowDesignerData, type WorkflowNode } from '../src/webview/flow-designer-data';
import { createNetworkData } from '../src/webview/network-canvas-data';

describe('createFlowDesignerData', () => {
  it('keeps valid graph data, drops orphan edges, and clamps the viewport', () => {
    const node: WorkflowNode = {
      id: 'start',
      type: 'trigger',
      label: 'Старт',
      x: 10,
      y: 20,
      inputs: [],
      outputs: ['out'],
    };
    const data = createFlowDesignerData({
      nodes: [node, { ...node, id: 'bad', type: 'unknown' as WorkflowNode['type'] }],
      connections: [
        { id: 'valid', fromNodeId: 'start', fromPort: 0, toNodeId: 'start', toPort: 0 },
        { id: 'orphan', fromNodeId: 'start', fromPort: 0, toNodeId: 'missing', toPort: 0 },
      ],
      viewport: { x: Number.NaN, y: 30, scale: 99 },
    });

    expect(data.nodes).toHaveLength(1);
    expect(data.connections.map(({ id }) => id)).toEqual(['valid']);
    expect(data.viewport).toEqual({ x: 0, y: 30, scale: 2 });
    expect(data.nodes[0]).not.toBe(node);
  });
});

describe('createNetworkData', () => {
  it('normalizes VLANs, removes invalid connections, and clamps scale', () => {
    const data = createNetworkData({
      nodes: [{ id: 'server', type: 'server', label: 'API', x: 1, y: 2 }],
      vlans: [{ id: 'vlan', name: 'DMZ', color: 'invalid', x: 0, y: 0, width: 5, height: 6 }],
      connections: [
        { id: 'valid', from: 'server', to: 'vlan', lineType: 'dashed' },
        { id: 'orphan', from: 'server', to: 'missing' },
      ],
      viewport: { x: 1, y: Number.POSITIVE_INFINITY, scale: 0 },
    });

    expect(data.vlans[0]).toMatchObject({ width: 100, height: 70, color: '#06b6d4' });
    expect(data.connections.map(({ id }) => id)).toEqual(['valid']);
    expect(data.viewport).toEqual({ x: 1, y: 0, scale: 0.2 });
  });

  it('embeds explicit entity icon colors in exported SVG', () => {
    const source = createNetworkCanvasDataUri({
      nodes: [
        { id: 'server', type: 'server', label: 'Server', x: 0, y: 0 },
        { id: 'database', type: 'database', label: 'Database', x: 120, y: 0 },
        { id: 'workstation', type: 'workstation', label: 'Workstation', x: 240, y: 0 },
        { id: 'balancer', type: 'balancer', label: 'Balancer', x: 360, y: 0 },
      ],
    });
    const svg = Buffer.from(source.split(',')[1], 'base64').toString('utf8');

    expect(svg).not.toContain('currentColor');
    expect(svg).toContain('stroke="#06b6d4"');
    expect(svg).toContain('stroke="#8b5cf6"');
    expect(svg).toContain('stroke="#10b981"');
    expect(svg).toContain('stroke="#f97316"');
  });
});
