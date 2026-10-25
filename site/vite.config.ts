import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { buildStampPlugin } from './scripts/build-stamp';
import { cspPlugin } from './scripts/csp';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), cspPlugin(), buildStampPlugin(process.env.BUILD_SHA)],
  // The catalogues the site is built with, from where the build's scripts read them, so a scenario
  // can build the site from catalogues of its own; and the images those scripts placed for them.
  resolve: { alias: { '@catalogues': resolve(process.env.CATALOGUE_DIR ?? 'src/catalogue') } },
  publicDir: process.env.PUBLIC_DIR ?? 'public',
  // Scenarios that build the site build it elsewhere, never over the dist/ under test.
  build: { outDir: process.env.BUILD_OUT_DIR ?? 'dist', emptyOutDir: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'e2e/support/**/*.test.ts'],
    environment: 'node',
  },
});
