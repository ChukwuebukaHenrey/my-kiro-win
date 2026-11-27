import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: [
            'packages/*/test/**/*.test.ts',
            'tools/*/test/**/*.test.ts',
            'apps/*/test/**/*.test.ts',
          ],
          environment: 'node',
          testTimeout: 15_000,
        },
      },
      {
        test: {
          name: 'dom',
          include: ['packages/*/test/**/*.test.tsx', 'apps/*/test/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['packages/ui/test/setup.ts'],
          testTimeout: 15_000,
        },
      },
    ],
  },
});
