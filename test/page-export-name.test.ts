import { describe, expect, it } from 'vitest';
import { createPageExportFileName } from '../src/extension/page-export-name';

describe('createPageExportFileName', () => {
  it('preserves readable Unicode titles and adds the requested extension', () => {
    expect(createPageExportFileName('Документация API', 'html')).toBe('Документация API.html');
    expect(createPageExportFileName('Документация API', 'md')).toBe('Документация API.md');
  });

  it('removes unsafe filename characters and normalizes separators', () => {
    expect(createPageExportFileName('  API: v1 / users?  ', 'html')).toBe('API- v1 - users-.html');
  });

  it('protects reserved and empty Windows filenames', () => {
    expect(createPageExportFileName('CON', 'md')).toBe('_CON.md');
    expect(createPageExportFileName('...', 'html')).toBe('Slash Doc.html');
  });

  it('limits the basename to 180 Unicode code points', () => {
    const fileName = createPageExportFileName('😀'.repeat(200), 'html');
    expect(Array.from(fileName.slice(0, -5))).toHaveLength(180);
    expect(fileName).toMatch(/\.html$/);
  });
});
