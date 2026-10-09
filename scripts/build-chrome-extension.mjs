import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromeCspCompat } from './chrome-csp-compat.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = resolve(root, 'dist/chrome-extension');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
for (const [entry, fileName] of [
  ['content', 'content.js'],
  ['gitlab-editor-bridge', 'gitlab-editor-bridge.js'],
  ['editor', 'editor.js'],
]) {
  await build({
    configFile: false,
    root,
    publicDir: false,
    plugins: [chromeCspCompat()],
    build: {
      outDir,
      emptyOutDir: false,
      target: 'chrome111',
      minify: false,
      cssCodeSplit: false,
      lib: {
        entry: resolve(root, `src/chrome/${entry}.ts`),
        name: 'SlashDocChrome',
        formats: ['iife'],
        fileName: () => fileName,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'editor.css' : 'assets/[name]-[hash][extname]'),
        },
      },
    },
  });
}
for (const file of ['manifest.json', 'editor.html'])
  await copyFile(resolve(root, 'chrome-extension', file), resolve(outDir, file));
console.log(`Chrome extension: ${outDir}`);
