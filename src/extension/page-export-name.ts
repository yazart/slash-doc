export type PageExportFormat = 'html' | 'md';

export function createPageExportFileName(title: string, format: PageExportFormat): string {
  const normalized = title
    .normalize('NFC')
    .replaceAll(/[\u0000-\u001f<>:"/\\|?*]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^[ .]+|[ .]+$/g, '')
    .trim();
  const baseName = normalized && !/^\.+$/.test(normalized) ? normalized : 'Slash Doc';
  const safeBaseName = isReservedWindowsFileName(baseName) ? `_${baseName}` : baseName;
  const limitedBaseName =
    Array.from(safeBaseName)
      .slice(0, 180)
      .join('')
      .replaceAll(/[ .]+$/g, '') || 'Slash Doc';
  return `${limitedBaseName}.${format}`;
}

function isReservedWindowsFileName(value: string): boolean {
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
}
