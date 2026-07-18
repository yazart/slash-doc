import { outlineSvgPrimitives } from './lucide-icons';

export type NetworkIconName = 'server' | 'database' | 'workstation' | 'balancer' | 'layers';

// Entity icon paths are kept in sync with network-canvas/src/components/editor/icons.ts.
const paths: Record<NetworkIconName, string> = {
  server:
    '<rect width="18" height="8" x="3" y="4" rx="2"/><rect width="18" height="8" x="3" y="14" rx="2"/><path d="M7 8h.01M7 18h.01"/>',
  database:
    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  workstation: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  balancer: '<path d="m16 16 3-8 3 8a5 5 0 0 1-6 0ZM2 16l3-8 3 8a5 5 0 0 1-6 0ZM7 21h10M12 3v18M3 7h18"/>',
  layers:
    '<path d="m12.83 2.18 8 4a2 2 0 0 1 0 3.58l-8 4a2 2 0 0 1-1.66 0l-8-4a2 2 0 0 1 0-3.58l8-4a2 2 0 0 1 1.66 0Z"/><path d="m22 12.5-9.17 4.59a2 2 0 0 1-1.66 0L2 12.5M22 17.5l-9.17 4.59a2 2 0 0 1-1.66 0L2 17.5"/>',
};

export function networkIcon(name: NetworkIconName, size = 20): string {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${outlineSvgPrimitives(paths[name])}</svg>`;
}

export function networkIconContent(name: NetworkIconName): string {
  return outlineSvgPrimitives(paths[name]);
}
