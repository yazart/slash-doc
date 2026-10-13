import { describe, expect, it } from 'vitest';
import { exportMermaidFigure, exportMermaidSvg } from '../src/extension/document-export-mermaid';
import { readMermaidSvg } from '../src/extension/document-import-readers';

describe('Mermaid HTML export', () => {
  it('exports the rendered diagram as inline SVG instead of Mermaid code', () => {
    const html = exportMermaidFigure({
      code: 'flowchart TD\nA-->B',
      caption: 'Схема',
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0L10 10"/></svg>',
    });

    expect(html).toContain('<svg');
    expect(html).toContain('<path d="M0 0L10 10"/>');
    expect(html).toContain('<figcaption>Схема</figcaption>');
    expect(html).not.toContain('<pre');
    expect(html).not.toContain('flowchart TD');
  });

  it('embeds import state and removes executable SVG content', () => {
    const svg = exportMermaidSvg({
      code: 'graph TD; A-->B',
      svg: '<svg onload="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">A</a></svg>',
    });
    const encoded = /data-slash-doc-mermaid-state="([^"]+)"/.exec(svg)?.[1];

    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('onload=');
    expect(svg).not.toContain('javascript:');
    expect(JSON.parse(Buffer.from(encoded ?? '', 'base64').toString('utf8'))).toEqual({
      code: 'graph TD; A-->B',
      caption: '',
    });
  });

  it('restores Mermaid data from the exported SVG', () => {
    const svg = exportMermaidSvg({
      code: 'sequenceDiagram\nA->>B: Hello',
      caption: 'Sequence',
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello</text></svg>',
    });

    expect(readMermaidSvg(svg)).toMatchObject({
      code: 'sequenceDiagram\nA->>B: Hello',
      caption: 'Sequence',
      svg,
    });
  });
});
