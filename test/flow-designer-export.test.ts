import { describe, expect, it } from 'vitest';
import { createFlowDesignerDataUri } from '../src/extension/document-export-diagrams';
import { FLOW_NODE_WIDTH } from '../src/shared/flow-designer-layout';

describe('Flow Designer HTML export', () => {
  it('keeps a horizontal row of more than eight nodes from overlapping', () => {
    const nodes = Array.from({ length: 9 }, (_, index) => ({
      id: `node-${index}`,
      type: 'action',
      label: `Node ${index + 1}`,
      description: '',
      x: index * 150,
      y: 0,
      inputs: ['in'],
      outputs: ['out'],
    }));
    const svg = decodeSvg(createFlowDesignerDataUri({ nodes, connections: [] }));
    const rectangles = Array.from(svg.matchAll(/<g class="node [^"]+"><rect x="([\d.]+)"[^>]+\swidth="([\d.]+)"/g));

    expect(rectangles).toHaveLength(9);
    expect(rectangles.every((match) => Number(match[2]) === FLOW_NODE_WIDTH)).toBe(true);
    for (let index = 1; index < rectangles.length; index += 1) {
      const previousRight = Number(rectangles[index - 1][1]) + Number(rectangles[index - 1][2]);
      expect(Number(rectangles[index][1])).toBeGreaterThanOrEqual(previousRight);
    }
  });

  it('exports multiline and wrapped descriptions as separate SVG lines', () => {
    const description = ['First line', 'Second line contains enough words to wrap', '', 'Fourth line'].join('\n');
    const svg = decodeSvg(
      createFlowDesignerDataUri({
        nodes: [
          {
            id: 'node-1',
            type: 'action',
            label: 'Node',
            description,
            x: 0,
            y: 0,
            inputs: ['in'],
            outputs: ['out'],
          },
        ],
        connections: [],
      }),
    );
    const lines = Array.from(svg.matchAll(/<tspan\b[^>]*>(.*?)<\/tspan>/g));
    const nodeHeight = Number(/<g class="node [^"]+"><rect[^>]+\sheight="([\d.]+)"/.exec(svg)?.[1]);
    const svgHeight = Number(/<svg[^>]+\sheight="([\d.]+)"/.exec(svg)?.[1]);

    expect(lines.map((match) => match[1])).toContain('First line');
    expect(lines.map((match) => match[1])).toContain('&#160;');
    expect(lines.length).toBeGreaterThan(4);
    expect(nodeHeight).toBeGreaterThan(FLOW_NODE_WIDTH / 2);
    expect(svgHeight).toBeGreaterThanOrEqual(nodeHeight + 64);
  });
});

function decodeSvg(dataUri: string): string {
  return Buffer.from(dataUri.split(',', 2)[1], 'base64').toString('utf8');
}
