import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Native modules must be loaded by Node at runtime, not bundled by Rollup.
      external: ['better-sqlite3', 'bindings', 'file-uri-to-path'],
    },
  },
});
