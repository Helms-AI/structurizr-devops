import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use Node environment for CLI tool testing
    environment: 'node',

    // Include test files
    include: ['tests/**/*.test.ts'],

    // Setup file for MSW and global mocks
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/structurizr/**/*.ts'],
      exclude: ['src/lib/structurizr/index.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },

    // Globals for test functions (describe, it, expect, etc.)
    globals: true,

    // Timeout for tests
    testTimeout: 10000,

    // Watch mode exclude patterns
    watchExclude: ['**/node_modules/**', '**/dist/**'],
  },
});
