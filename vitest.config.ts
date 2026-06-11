import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    alias: {
      'sqlite': 'node:sqlite'
    },
    server: {
      deps: {
        external: ['node:sqlite', 'sqlite'],
      },
    },
  },
});
