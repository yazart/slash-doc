import { normalizeHexColor, readInlineColors } from './inline-colors';

export function readTableCellBackgrounds(row: string): string[] {
  const inherited = readInlineColors(row.slice(0, row.indexOf('>') + 1)).background;
  return [...row.matchAll(/<(?:td|th)\b([^>]*)>/gi)].map(([, attributes]) => {
    const stored = /\bdata-slash-cell-background\s*=\s*["'](#[0-9a-f]{6})["']/i.exec(attributes)?.[1];
    if (stored) return normalizeHexColor(stored);
    const color = readInlineColors(attributes).background;
    return color !== inherited ? color : '';
  });
}
