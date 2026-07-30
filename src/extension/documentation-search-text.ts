import { isRecord, stripHtml } from './utils';

export function getDocumentationSearchText(data: unknown): string {
  return collectText(data).join(' ').replaceAll(/\s+/g, ' ').trim();
}

function collectText(value: unknown): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('data:') || value.length > 200_000) return [];
    return [stripHtml(value)];
  }
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, item]) =>
    /^(id|type|version|time|dataUrl|icon|svg)$/i.test(key) ? [] : collectText(item),
  );
}
