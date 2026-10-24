import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { buildStampPlugin } from './scripts/build-stamp';
import { cspPlugin } from './scripts/csp';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), cspPlugin(), buildStampPlugin(process.env.BUILD_SHA)],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
