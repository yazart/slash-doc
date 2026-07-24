import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: [
        'src/extension/page-export-name.ts',
        'src/shared/api-endpoint.ts',
        'src/shared/markdown.ts',
        'src/webview/flow-designer-data.ts',
        'src/webview/network-canvas-data.ts',
      ],
    },
  },
});
