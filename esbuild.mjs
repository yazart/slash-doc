import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  // Keep only VS Code API external; Express and its dependencies are bundled.
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  outfile: 'dist/extension.js'
};

const webviewConfig = {
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  outfile: 'dist/webview.js'
};

const sidebarConfig = {
  entryPoints: ['src/sidebar/main.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  outfile: 'dist/sidebar.js'
};

if (watch) {
  const extensionContext = await esbuild.context(extensionConfig);
  const webviewContext = await esbuild.context(webviewConfig);
  const sidebarContext = await esbuild.context(sidebarConfig);
  await extensionContext.watch();
  await webviewContext.watch();
  await sidebarContext.watch();
  console.log('Watching extension, editor webview, and sidebar sources...');
} else {
  await Promise.all([
    esbuild.build(extensionConfig),
    esbuild.build(webviewConfig),
    esbuild.build(sidebarConfig)
  ]);
}
