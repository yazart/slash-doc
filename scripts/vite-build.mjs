import { access, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import { createSlashDocViteConfig } from '../vite.config.mjs';

const watch = process.argv.includes('--watch');
const targets = ['extension', 'webview', 'sidebar', 'runner'];
await rm(resolve('dist'), { recursive: true, force: true });

if (watch) {
  await Promise.all(targets.map((target) => build(createSlashDocViteConfig(target, true))));
  console.log('Vite watches extension, editor webview, sidebar, and file processor runner.');
} else {
  for (const target of targets) {
    await build(createSlashDocViteConfig(target));
  }
  await validateBuildOutput();
}

async function validateBuildOutput() {
  const expectedFiles = [
    'extension.js',
    'webview.js',
    'webview.css',
    'sidebar.js',
    'sidebar.css',
    'file-processor-runner.js',
  ];
  await Promise.all(expectedFiles.map((fileName) => access(resolve('dist', fileName))));
  const extensionBundle = await readFile(resolve('dist', 'extension.js'), 'utf8');
  if (extensionBundle.includes('__viteBrowserExternal')) {
    throw new Error('The extension host bundle contains a Vite browser external shim.');
  }
}
