/**
 * The Iron Squid schema, as an event log.
 *
 * A challenge is not stored as a state — it is stored as the things that
 * happened to it, and `ChallengeState` is rebuilt by replaying them through the
 * domain reducer. docs/ARCHITECTURE.md records why, and the short version is
 * that the alternative has nowhere to put the idempotency key except inside the
 * document that key exists to protect.
 *
 * Note the import below is relative rather than `@/domain/types`: drizzle-kit
 * loads this file outside Next, through esbuild, and does not resolve the
 * tsconfig alias. Same trap as scripts/generate-catalogue.mts.
 */

import {sql} from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import {MATCH_MODES, type MatchMode, type MatchResult} from '../domain/types';

const MATCH_RESULTS: readonly MatchResult[] = ['win', 'loss'];

/**
 * A `col in (…)` check built from a domain constant.
 *
 * `sql.raw` is safe here and only here: every value comes from a frozen array
 * in src/domain/types.ts, never from a request. A reported result may be a lie
 * — RULES.md accepts that by design — but it still has to be one of these four
 * modes and one of these two results, and the database is the last place that
 * can insist on it.
 */
function oneOf(column: string, values: readonly string[]) {
  return sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(', ')})`);
}

export const challenges = pgTable(
  'challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** The short slug in a shared URL. Public by design; random so the corpus
     * cannot be walked, and independent of the handle so a rename does not
     * break every link already pasted. */
    publicId: text('public_id').notNull(),

    /** SHA-256 of the edit token, never the token. Looked up by this. */
    secretHash: text('secret_hash').notNull(),

    /** Untrusted user content: escaped everywhere, and some will need
     * removing. See RULES.md#privacy. */
    handle: text('handle').notNull(),

    /** Nullable on purpose. There are no accounts, and this is the seam that
     * lets a challenge be claimed later without reshaping the table. */
    ownerId: uuid('owner_id'),

    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow()
  },
  (t) => [
    unique('challenges_public_id_key').on(t.publicId),
    unique('challenges_secret_hash_key').on(t.secretHash)
  ]
);

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, {onDelete: 'cascade'}),

    /** 1-based, and the number the UI shows: "Run #7". */
    number: integer('number').notNull(),

    startedAt: timestamp('started_at', {withTimezone: true}).notNull(),

    /** Null while the run is alive. Set when lives reach zero. */
    endedAt: timestamp('ended_at', {withTimezone: true})
  },
  // The unique constraint already builds the index that "this challenge's runs,
  // in order" needs, so there is no separate index here.
  (t) => [unique('runs_challenge_number_key').on(t.challengeId, t.number)]
);

/**
 * One assignment of a weapon and a full gear set.
 *
 * Written before it is shown to anyone: the server owns the randomness, and a
 * draw that exists only in a response is one a client could have influenced.
 */
export const draws = pgTable(
  'draws',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, {onDelete: 'cascade'}),

    /** Catalogue ids, not names. Names are per-locale and come from the
     * dataset at render time. */
    weaponId: text('weapon_id').notNull(),
    headId: text('head_id').notNull(),
    clothesId: text('clothes_id').notNull(),
    shoesId: text('shoes_id').notNull(),

    drawnAt: timestamp('drawn_at', {withTimezone: true}).notNull().defaultNow()
  },
  (t) => [index('draws_run_idx').on(t.runId, t.drawnAt)]
);

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, {onDelete: 'cascade'}),
    drawId: uuid('draw_id')
      .notNull()
      .references(() => draws.id, {onDelete: 'cascade'}),

    result: text('result').$type<MatchResult>().notNull(),

    /** One of the four ranked modes. Turf War cannot be reported: rule 3
     * counts a win only in Anarchy or X Battle. */
    mode: text('mode').$type<MatchMode>().notNull(),

    playedAt: timestamp('played_at', {withTimezone: true}).notNull(),

    /**
     * Client-generated, and the whole of the idempotency implementation.
     *
     * Background Sync retries, restored tabs and double-tapped buttons all
     * deliver the same report twice. The unique constraint below is what makes
     * the second one a no-op instead of a spent life.
     */
    idempotencyKey: text('idempotency_key').notNull()
  },
  (t) => [
    unique('matches_run_idempotency_key').on(t.runId, t.idempotencyKey),
    index('matches_run_played_idx').on(t.runId, t.playedAt),
    check('matches_result_check', oneOf('result', MATCH_RESULTS)),
    check('matches_mode_check', oneOf('mode', MATCH_MODES))
  ]
);
