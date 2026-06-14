import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration for the Shopify Autonomous Store Platform.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/types/**',
        'src/app/layout.tsx',
        'src/app/page.tsx',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@components': path.resolve(__dirname, './src/components'),
      '@agents': path.resolve(__dirname, './src/agents'),
      '@repositories': path.resolve(__dirname, './src/repositories'),
      '@services': path.resolve(__dirname, './src/services'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@schemas': path.resolve(__dirname, './src/schemas'),
      '@types': path.resolve(__dirname, './src/types'),
      '@workflows': path.resolve(__dirname, './src/workflows'),
      '@jobs': path.resolve(__dirname, './src/jobs'),
      '@providers': path.resolve(__dirname, './src/providers'),
    },
  },
});
