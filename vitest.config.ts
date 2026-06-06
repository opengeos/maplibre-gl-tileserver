import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'tests/',
        'examples/',
        'dist/',
        'src/cli.ts',
        'src/geolibre.ts',
        'src/browser.ts',
        'src/index.ts',
        'src/index-core.ts',
        'src/react.ts',
        'src/maplibre.ts',
        'src/types/external.d.ts',
        'src/gdal/worker.ts',
        'src/providers/geotiff-provider.ts',
        'src/cache/filesystem.ts',
        'src/cache/indexeddb.ts',
        'src/lib/**',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
      thresholds: {
        lines: 45,
        functions: 45,
        statements: 45,
        branches: 40,
      },
    },
  },
});
