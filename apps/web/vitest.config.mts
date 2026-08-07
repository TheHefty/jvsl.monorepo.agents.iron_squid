import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Native replacement for vite-tsconfig-paths: resolves the `@/*` alias
    // straight from tsconfig.json.
    tsconfigPaths: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
});
