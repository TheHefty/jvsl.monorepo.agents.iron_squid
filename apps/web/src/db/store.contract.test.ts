import {sql} from 'drizzle-orm';
import {drizzle} from 'drizzle-orm/node-postgres';
import {afterAll} from 'vitest';
import pg from 'pg';
import {loadCatalogue} from '@/data/catalogue';
import * as schema from './schema';
import {describeChallengeStore} from './store.contract';
import {DrizzleChallengeStore} from './store.drizzle';

/**
 * The same contract, against a real Postgres.
 *
 * Excluded from `npm test` and run by `npm run test:db`, which goes through
 * scripts/local-db.sh because nothing in this dev container reaches a
 * container over the network. docs/ARCHITECTURE.md has the why.
 */

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
const db = drizzle(pool, {schema});

afterAll(async () => {
  await pool.end();
});

describeChallengeStore('the Postgres store', async () => {
  // Every case starts from an empty database, so one leaving rows behind
  // cannot make the next one pass.
  await db.execute(sql`truncate table challenges cascade`);
  const catalogue = await loadCatalogue('en');
  return {store: new DrizzleChallengeStore(db, catalogue), catalogue};
});
