import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { buildStampPlugin } from './scripts/build-stamp';
import { cspPlugin } from './scripts/csp';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), cspPlugin(), buildStampPlugin(process.env.BUILD_SHA)],
  // Scenarios that build the site build it elsewhere, never over the dist/ under test.
  build: { outDir: process.env.BUILD_OUT_DIR ?? 'dist', emptyOutDir: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'e2e/support/**/*.test.ts'],
    environment: 'node',
  },
});
