import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./__tests__/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    fileParallelism: false,
  },
});
