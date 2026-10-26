import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Os workspaces exportam o código-fonte pela condição "source" (WI-0015).
  resolve: { conditions: ['source'] },
  test: {
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/support/isolate-git-environment.ts'],
  },
});
