import { describe, expect, it } from 'vitest';
import { createSlashDocViteConfig } from '../vite.config.mjs';

describe('Vite target configuration', () => {
  it('builds extension host targets in CommonJS library mode without SSR', () => {
    const config = createSlashDocViteConfig('extension');
    const library = config.build?.lib;
    const external = config.build?.rollupOptions?.external;

    expect(config.build?.ssr).toBeUndefined();
    expect(config.ssr).toBeUndefined();
    expect(config.resolve).toMatchObject({ conditions: ['node'] });
    expect(typeof library === 'object' && library.formats).toEqual(['cjs']);
    expect(typeof library === 'object' && library.fileName()).toBe('extension.js');
    expect(typeof external === 'function' && external('node:fs')).toBe(true);
    expect(typeof external === 'function' && external('vscode')).toBe(true);
    expect(typeof external === 'function' && external('bufferutil')).toBe(true);
    expect(typeof external === 'function' && external('utf-8-validate')).toBe(true);
  });

  it('keeps browser targets in Vite library mode with stable filenames', () => {
    const config = createSlashDocViteConfig('webview');
    const library = config.build?.lib;

    expect(config.build?.ssr).toBeUndefined();
    expect(config.ssr).toBeUndefined();
    expect(typeof library === 'object' && library.fileName()).toBe('webview.js');
  });
});
