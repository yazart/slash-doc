import { describe, expect, it } from 'vitest';
import { createSlashDocViteConfig } from '../vite.config.mjs';

describe('Vite target configuration', () => {
  it('builds extension host targets in Node SSR mode', () => {
    const config = createSlashDocViteConfig('extension');
    const output = config.build?.rollupOptions?.output;

    expect(config.build?.ssr).toMatch(/src\/extension\.ts$/);
    expect(config.ssr).toMatchObject({ external: ['vscode'], noExternal: true });
    expect(config.resolve).toMatchObject({ conditions: ['node'] });
    expect(output).toMatchObject({ entryFileNames: 'extension.js', format: 'cjs' });
  });

  it('keeps browser targets in Vite library mode with stable filenames', () => {
    const config = createSlashDocViteConfig('webview');
    const library = config.build?.lib;

    expect(config.build?.ssr).toBe(false);
    expect(config.ssr).toBeUndefined();
    expect(typeof library === 'object' && library.fileName()).toBe('webview.js');
  });
});
