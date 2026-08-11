export type BpmnSvgDimensions = {
  width: number;
  height: number;
  viewBox: string;
};

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const FALLBACK_DIMENSIONS: BpmnSvgDimensions = { width: 640, height: 120, viewBox: '0 0 640 120' };
const DIAGRAM_PADDING = 24;

export function resolveBpmnSvgDimensions(attributes: string, xml: string): BpmnSvgDimensions {
  const viewBox = parseViewBox(readAttribute(attributes, 'viewBox'));
  if (viewBox) {
    return {
      width: positiveLength(readAttribute(attributes, 'width')) ?? viewBox.width,
      height: positiveLength(readAttribute(attributes, 'height')) ?? viewBox.height,
      viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    };
  }
  const width = positiveLength(readAttribute(attributes, 'width'));
  const height = positiveLength(readAttribute(attributes, 'height'));
  if (width && height) return { width, height, viewBox: `0 0 ${width} ${height}` };
  return readDiagramBounds(xml) ?? FALLBACK_DIMENSIONS;
}

function readDiagramBounds(xml: string): BpmnSvgDimensions | undefined {
  let bounds: Bounds | undefined;
  for (const match of xml.matchAll(/<(?:[a-z_][\w.-]*:)?Bounds\b([^>]*)>/gi)) {
    const x = finiteAttribute(match[1], 'x');
    const y = finiteAttribute(match[1], 'y');
    const width = finiteAttribute(match[1], 'width');
    const height = finiteAttribute(match[1], 'height');
    if (x === undefined || y === undefined || width === undefined || height === undefined || width < 0 || height < 0) {
      continue;
    }
    bounds = includeRectangle(bounds, x, y, width, height);
  }
  for (const match of xml.matchAll(/<(?:[a-z_][\w.-]*:)?waypoint\b([^>]*)>/gi)) {
    const x = finiteAttribute(match[1], 'x');
    const y = finiteAttribute(match[1], 'y');
    if (x !== undefined && y !== undefined) bounds = includePoint(bounds, x, y);
  }
  if (!bounds) return undefined;
  const x = bounds.minX - DIAGRAM_PADDING;
  const y = bounds.minY - DIAGRAM_PADDING;
  const width = Math.max(1, bounds.maxX - bounds.minX + DIAGRAM_PADDING * 2);
  const height = Math.max(1, bounds.maxY - bounds.minY + DIAGRAM_PADDING * 2);
  return { width, height, viewBox: `${x} ${y} ${width} ${height}` };
}

function includeRectangle(bounds: Bounds | undefined, x: number, y: number, width: number, height: number): Bounds {
  return includePoint(includePoint(bounds, x, y), x + width, y + height);
}

function includePoint(bounds: Bounds | undefined, x: number, y: number): Bounds {
  if (!bounds) return { minX: x, minY: y, maxX: x, maxY: y };
  return {
    minX: Math.min(bounds.minX, x),
    minY: Math.min(bounds.minY, y),
    maxX: Math.max(bounds.maxX, x),
    maxY: Math.max(bounds.maxY, y),
  };
}

function parseViewBox(value: string): { x: number; y: number; width: number; height: number } | undefined {
  const values = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (values.length !== 4 || values.some((item) => !Number.isFinite(item)) || values[2] <= 0 || values[3] <= 0) {
    return undefined;
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function positiveLength(value: string): number | undefined {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(value);
  const number = match ? Number(match[1]) : 0;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function finiteAttribute(attributes: string, name: string): number | undefined {
  const source = readAttribute(attributes, name).trim();
  if (!source) return undefined;
  const value = Number(source);
  return Number.isFinite(value) ? value : undefined;
}

function readAttribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}
