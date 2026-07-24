import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);

const targets = {
  extension: {
    entry: 'src/extension.ts',
    fileName: 'extension.js',
    format: 'cjs',
    platform: 'node',
    sourcemap: true,
  },
  webview: {
    entry: 'src/webview/main.ts',
    fileName: 'webview.js',
    cssFileName: 'webview',
    format: 'iife',
    globalName: 'SlashDocWebview',
    platform: 'browser',
    sourcemap: true,
  },
  sidebar: {
    entry: 'src/sidebar/main.ts',
    fileName: 'sidebar.js',
    cssFileName: 'sidebar',
    format: 'iife',
    globalName: 'SlashDocSidebar',
    platform: 'browser',
    sourcemap: true,
  },
  runner: {
    entry: 'src/file-processor-runner.ts',
    fileName: 'file-processor-runner.js',
    format: 'cjs',
    platform: 'node',
    sourcemap: false,
  },
};

export function createSlashDocViteConfig(targetName, watch = false) {
  const target = targets[targetName];
  if (!target) throw new Error(`Unknown Slash Doc Vite target: ${targetName}`);
  const isNode = target.platform === 'node';

  return {
    configFile: false,
    root,
    publicDir: false,
    resolve: isNode
      ? {
          conditions: ['node'],
          mainFields: ['module', 'main'],
        }
      : undefined,
    ssr: isNode
      ? {
          external: ['vscode'],
          noExternal: true,
        }
      : undefined,
    build: {
      target: isNode ? 'node20' : 'es2022',
      outDir: resolve(root, 'dist'),
      emptyOutDir: false,
      copyPublicDir: false,
      minify: false,
      sourcemap: target.sourcemap,
      cssCodeSplit: false,
      assetsDir: 'assets',
      watch: watch ? {} : null,
      ssr: isNode ? resolve(root, target.entry) : false,
      lib: isNode
        ? undefined
        : {
            entry: resolve(root, target.entry),
            formats: [target.format],
            name: target.globalName,
            fileName: () => target.fileName,
            cssFileName: target.cssFileName,
          },
      rollupOptions: {
        external: isNode ? (id) => id === 'vscode' || nodeBuiltins.has(id) : [],
        output: {
          assetFileNames: (assetInfo) => {
            if (target.cssFileName && assetInfo.name?.endsWith('.css')) {
              return `${target.cssFileName}.css`;
            }
            return 'assets/[name]-[hash][extname]';
          },
          exports: isNode ? 'auto' : undefined,
          ...(isNode ? { entryFileNames: target.fileName, format: target.format } : {}),
          inlineDynamicImports: true,
        },
      },
    },
  };
}

export default defineConfig(({ mode }) => createSlashDocViteConfig(mode));
