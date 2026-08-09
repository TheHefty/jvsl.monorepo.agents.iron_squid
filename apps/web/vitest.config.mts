import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Native replacement for vite-tsconfig-paths: resolves the `@/*` alias
    // straight from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      // See test/server-only.stub.ts for why this is an alias rather than a
      // resolve condition.
      'server-only': fileURLToPath(
        new URL('./test/server-only.stub.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The contract suite talks to a real Postgres and is not part of the run
    // that husky fires on pre-push — see `npm run test:db`, and
    // docs/ARCHITECTURE.md for why the two are split.
    exclude: ['**/node_modules/**', 'src/**/*.contract.test.ts']
  }
});
