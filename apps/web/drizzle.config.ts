import {defineConfig} from 'drizzle-kit';

/**
 * drizzle-kit's configuration — generating migrations, and applying them.
 *
 * The URL is never defaulted. A missing DATABASE_URL must not quietly become
 * localhost: a migration that appears to succeed against a database nobody
 * meant to touch is worse than one that refuses to run.
 *
 * It is omitted rather than demanded, because `generate` only reads the schema
 * and has no business requiring a database. `migrate` without it stops with
 * drizzle-kit's own message.
 *
 * Note that in this dev container nothing reaches a container over the network
 * — see docs/ARCHITECTURE.md. Against the local Postgres, migrate has to run
 * from inside a container itself; against Neon it runs from here.
 */

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  verbose: true,
  ...(url ? {dbCredentials: {url}} : {})
});
