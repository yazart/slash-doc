import { describe, expect, it } from 'vitest';
import { extractEmbeddedImages } from '../src/shared/embedded-images';

describe('document file separation', () => {
  it('keeps embedded files when separation is not requested by the caller', () => {
    const source = '<img src="data:image/png;base64,aGVsbG8=">';

    expect(source).toContain('data:image/png;base64');
  });

  it('extracts data images and marked diagram SVG from HTML', () => {
    const result = extractEmbeddedImages(
      '<!DOCTYPE html><img src="data:image/png;base64,aGVsbG8="><svg data-slash-doc-bpmn="preview"><path d="M0 0"/></svg>',
      'page-file',
    );

    expect(result.content).toContain('src="page-file-1.png"');
    expect(result.content).toContain('<img src="page-file-2.svg" alt="SVG diagram">');
    expect(result.images.map((file) => file.fileName)).toEqual(['page-file-1.png', 'page-file-2.svg']);
  });

  it('uses a Markdown image reference for extracted diagram SVG', () => {
    const result = extractEmbeddedImages('<svg data-slash-doc-mermaid-state="state"></svg>');

    expect(result.content).toBe('![SVG diagram](image-1.svg)');
    expect(Buffer.from(result.images[0].data).toString('utf8')).toContain('data-slash-doc-mermaid-state');
  });
});
