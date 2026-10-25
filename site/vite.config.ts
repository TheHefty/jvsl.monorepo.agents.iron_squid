import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { buildStampPlugin } from './scripts/build-stamp';
import { cspPlugin } from './scripts/csp';

// Each locale's review status, read from its catalogue (NFR-I4), so the language switcher can mark
// unreviewed languages without downloading every catalogue.
const messagesDir = process.env.MESSAGES_DIR ?? 'src/i18n/messages';
const translationStatus = Object.fromEntries(
  readdirSync(messagesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [
      f.replace(/\.json$/, ''),
      (JSON.parse(readFileSync(resolve(messagesDir, f), 'utf8')) as Record<string, string>)[
        'translation.status'
      ],
    ]),
);

export default defineConfig({
  define: { __TRANSLATION_STATUS__: JSON.stringify(translationStatus) },
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
