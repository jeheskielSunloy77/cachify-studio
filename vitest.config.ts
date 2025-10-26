import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test/setup.ts'],
    include: [
      'src/renderer/test/**/*.test.ts',
      'src/renderer/test/**/*.test.tsx',
      'src/main/test/**/*.test.ts',
    ],
    css: true,
  },
});
