import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

/**
 * The contract suite, against a real Postgres.
 *
 * Separate from vitest.config.mts because this one needs a database and that
 * one must not: husky runs the default suite on pre-push, and a suite that
 * needed Docker would turn "the daemon is down" into "I cannot push".
 *
 * No jsdom and no React plugin here — nothing under test renders.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': fileURLToPath(
        new URL('./test/server-only.stub.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.contract.test.ts'],
    // One database, one connection: parallel files would truncate each
    // other's rows out from under them.
    fileParallelism: false
  }
});
