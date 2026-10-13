import { renderSafeMarkdown } from '../shared/markdown';
import annotationExportStyles from './styles/image-annotation-export.embedded.css?raw';
import { escapeAttribute, isRecord } from './utils';

type ExportAnnotationImage = { dataUrl: string; width: number; height: number; name: string };
type ExportImageRegion = {
  id: string;
  number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  zIndex: number;
};
type ExportImageAnnotation = {
  version: 1;
  image: ExportAnnotationImage | null;
  annotations: ExportImageRegion[];
  stretchToWidth: boolean;
};

export function exportImageAnnotationToHtml(data: Record<string, unknown>): string {
  const annotation = normalizeExportImageAnnotation(data);

  if (!annotation.image) {
    return '';
  }

  const encodedState = Buffer.from(JSON.stringify(annotation), 'utf8').toString('base64');
  const metadata = JSON.stringify(annotation).replaceAll(']]>', ']]]]><![CDATA[>');
  const overlay = renderAnnotationOverlay(annotation.annotations, annotation.image.width, annotation.image.height);
  const hotspots = annotation.annotations
    .map(
      (region) =>
        `<div class="slash-annotation-hotspot" tabindex="0" style="left:${region.x * 100}%;top:${region.y * 100}%;width:${region.width * 100}%;height:${region.height * 100}%"><div class="slash-annotation-tooltip"><strong>${region.number}</strong>${renderAnnotationMarkdown(region.description || 'Без описания')}</div></div>`,
    )
    .join('');
  const rows = renderAnnotationHtmlRows(annotation.annotations);
  const canvasClass = annotation.stretchToWidth ? 'stretched' : 'natural';
  const canvasStyle = annotation.stretchToWidth
    ? ''
    : ` style="--slash-annotation-image-width:${annotation.image.width}px"`;

  return `<style>${annotationExportStyles}</style><figure class="slash-image-annotation-export"><div class="slash-annotation-canvas ${canvasClass}"${canvasStyle}><img src="${escapeAttribute(annotation.image.dataUrl)}" alt="${escapeAttribute(annotation.image.name)}" width="${annotation.image.width}" height="${annotation.image.height}" data-slash-doc-annotation="${encodedState}"><svg class="slash-annotation-overlay" viewBox="0 0 ${annotation.image.width} ${annotation.image.height}" preserveAspectRatio="none" aria-hidden="true">${overlay}</svg><div class="slash-annotation-hotspots">${hotspots}</div></div>${rows ? `<table class="slash-annotation-table"><thead><tr><th>#</th><th>Описание</th></tr></thead><tbody>${rows}</tbody></table>` : ''}<svg width="0" height="0" aria-hidden="true"><metadata id="slash-doc-image-annotation-data"><![CDATA[${metadata}]]></metadata></svg></figure>`;
}

export function exportImageAnnotationToMarkdown(data: Record<string, unknown>): string {
  const annotation = normalizeExportImageAnnotation(data);

  if (!annotation.image) {
    return '';
  }

  const image = createAnnotatedImageDataUri(annotation);
  const rows = annotation.annotations.map(
    (region) => `| ${region.number} | ${escapeMarkdownTableCell(region.description || '—')} |`,
  );
  const table = rows.length ? `\n| # | Описание |\n| ---: | --- |\n${rows.join('\n')}` : '';
  return `![Annotated image](${image})${table}`;
}

function createAnnotatedImageDataUri(annotation: ExportImageAnnotation): string {
  const image = annotation.image;

  if (!image) {
    return '';
  }

  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  const overlay = renderAnnotationOverlay(annotation.annotations, width, height);
  const metadata = JSON.stringify(annotation).replaceAll(']]>', ']]]]><![CDATA[>');
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><metadata id="slash-doc-image-annotation-data"><![CDATA[${metadata}]]></metadata><image href="${escapeAttribute(image.dataUrl)}" width="${width}" height="${height}" preserveAspectRatio="none"/>${overlay}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function renderAnnotationOverlay(regions: ExportImageRegion[], width = 1000, height = 1000): string {
  const strokeWidth = 2;
  const badgeRadius = Math.max(8, Math.min(14, Math.min(width, height) * 0.012));
  const fontSize = badgeRadius;
  return [...regions]
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((region) => {
      const x = region.x * width;
      const y = region.y * height;
      const regionWidth = region.width * width;
      const regionHeight = region.height * height;
      const badgeX = x + badgeRadius + strokeWidth;
      const badgeY = y + badgeRadius + strokeWidth;
      return `<g><rect x="${x}" y="${y}" width="${regionWidth}" height="${regionHeight}" fill="#ffbc00" fill-opacity="0.12" stroke="#ffbc00" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"/><circle cx="${badgeX}" cy="${badgeY}" r="${badgeRadius}" fill="#ffbc00"/><text x="${badgeX}" y="${badgeY + fontSize * 0.34}" fill="#202124" font-family="sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle">${region.number}</text></g>`;
    })
    .join('');
}

function renderAnnotationHtmlRows(regions: ExportImageRegion[]): string {
  return regions
    .map(
      (region) => `<tr><td>${region.number}</td><td>${renderAnnotationMarkdown(region.description || '—')}</td></tr>`,
    )
    .join('');
}

function renderAnnotationMarkdown(value: string): string {
  return renderSafeMarkdown(value);
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
}

function normalizeExportImageAnnotation(data: Record<string, unknown>): ExportImageAnnotation {
  const value = isRecord(data.image) ? data.image : undefined;
  const image =
    value && typeof value.dataUrl === 'string' && value.dataUrl.startsWith('data:image/')
      ? {
          dataUrl: value.dataUrl,
          width: Math.max(1, getAnnotationNumber(value.width, 1)),
          height: Math.max(1, getAnnotationNumber(value.height, 1)),
          name: typeof value.name === 'string' ? value.name : 'annotated-image',
        }
      : null;
  const annotations = Array.isArray(data.annotations)
    ? data.annotations.filter(isRecord).flatMap((region, index) => {
        if (typeof region.id !== 'string') return [];
        return [
          {
            id: region.id,
            number: index + 1,
            x: clampUnit(region.x),
            y: clampUnit(region.y),
            width: clampUnit(region.width),
            height: clampUnit(region.height),
            description: typeof region.description === 'string' ? region.description : '',
            zIndex: getAnnotationNumber(region.zIndex, index),
          },
        ];
      })
    : [];
  return { version: 1, image, annotations, stretchToWidth: data.stretchToWidth !== false };
}

function clampUnit(value: unknown): number {
  return Math.max(0, Math.min(1, getAnnotationNumber(value, 0)));
}

function getAnnotationNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
