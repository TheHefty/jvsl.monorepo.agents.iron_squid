import 'server-only';

import {Pool} from '@neondatabase/serverless';
import {drizzle, type NeonDatabase} from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

/**
 * The production connection.
 *
 * Neon's WebSocket pool rather than its HTTP driver, because the HTTP one has
 * no `transaction()` and the store's writes span three tables — see
 * docs/ARCHITECTURE.md#persistence for why that decided it.
 *
 * Built on first use rather than on import, and that is not a style choice:
 * `next build` imports every route module to collect page data, so a pool
 * created at module scope would demand DATABASE_URL at build time and fail a
 * build that has no business touching a database. A missing variable should
 * fail the request that needs one.
 *
 * The instance is then kept, so a warm serverless invocation reuses its socket
 * instead of opening one per request.
 */

let instance: NeonDatabase<typeof schema> | null = null;

export function db(): NeonDatabase<typeof schema> {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. In development it points at a Neon branch — see docs/ARCHITECTURE.md.'
    );
  }

  instance = drizzle(new Pool({connectionString: url}), {schema});
  return instance;
}
