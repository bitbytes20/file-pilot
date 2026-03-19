/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-var-requires */
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  resolve: {
    alias: {
      'node:sqlite': 'node:sqlite',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
    },
    setupFiles: [],
    deps: {
      external: ['node:sqlite'],
    },
  },
});
