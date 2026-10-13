import defaultIcon from '../../assets/slash-doc.svg?raw';

export const DEFAULT_FAVICON = `data:image/svg+xml,${encodeURIComponent(defaultIcon)}`;

export function normalizeFavicon(value: unknown): string {
  return typeof value === 'string' &&
    /^data:image\/(?:png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[a-z0-9+/]+={0,2}$/i.test(
      value.trim(),
    )
    ? value.trim()
    : '';
}
