import 'server-only';

import {desc, eq, inArray, isNotNull, sql, type SQL} from 'drizzle-orm';
import type {NeonDatabase} from 'drizzle-orm/neon-serverless';
import type {NodePgDatabase} from 'drizzle-orm/node-postgres';
import {hashEditSecret, newEditSecret, newPublicId, normalise} from './ids';
import {rebuild, type DrawRow, type MatchRow, type RunRow} from './rebuild';
import * as schema from './schema';
import {
  UnknownChallengeError,
  type ChallengeStore,
  type CreatedChallenge,
  type MatchWrite,
  type NewChallenge,
  type Overview,
  type StoredChallenge
} from './store';
import type {Catalogue, Draw} from '@/domain/types';

/**
 * The store, over Postgres.
 *
 * Both drivers are accepted because both are used: node-postgres against the
 * local database, and Neon's WebSocket pool in production. They are
 * interchangeable *here* because both implement `transaction()` — Neon's HTTP
 * driver does not, which is why it is not one of the two. The point of keeping
 * one code path is that the contract suite then exercises the shape that
 * ships, rather than a cousin of it.
 */

type Db = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

const {challenges, draws, matches, runs} = schema;

export class DrizzleChallengeStore implements ChallengeStore {
  constructor(
    private readonly db: Db,
    private readonly catalogue: Catalogue
  ) {}

  async create(input: NewChallenge): Promise<CreatedChallenge> {
    const publicId = newPublicId();
    const editSecret = newEditSecret();
    const at = new Date(input.at);

    // One transaction: a challenge without a run cannot be rebuilt, so it must
    // not be possible to observe one.
    await this.db.transaction(async (tx) => {
      const [challenge] = await tx
        .insert(challenges)
        .values({
          publicId,
          secretHash: hashEditSecret(editSecret),
          handle: input.handle,
          createdAt: at
        })
        .returning({id: challenges.id});

      const [run] = await tx
        .insert(runs)
        .values({challengeId: challenge.id, number: 1, startedAt: at})
        .returning({id: runs.id});

      await tx
        .insert(draws)
        .values({runId: run.id, seq: 1, drawnAt: at, ...flatten(input.draw)});
    });

    return {publicId, editSecret};
  }

  findByPublicId(publicId: string): Promise<StoredChallenge | null> {
    return this.load(eq(challenges.publicId, normalise(publicId)));
  }

  findByEditSecret(editSecret: string): Promise<StoredChallenge | null> {
    return this.load(eq(challenges.secretHash, hashEditSecret(editSecret)));
  }

  async appendMatch(publicId: string, write: MatchWrite) {
    const [challenge] = await this.db
      .select({id: challenges.id})
      .from(challenges)
      .where(eq(challenges.publicId, normalise(publicId)))
      .limit(1);

    if (!challenge) throw new UnknownChallengeError(publicId);

    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(runs)
        .where(eq(runs.challengeId, challenge.id))
        .orderBy(desc(runs.number))
        .limit(1);

      const [{played}] = await tx
        .select({played: sql<number>`count(*)::int`})
        .from(matches)
        .where(eq(matches.runId, current.id));

      const [{dealt}] = await tx
        .select({dealt: sql<number>`count(*)::int`})
        .from(draws)
        .where(eq(draws.runId, current.id));

      const [up] = await tx
        .select({id: draws.id})
        .from(draws)
        .where(eq(draws.runId, current.id))
        .orderBy(desc(draws.seq))
        .limit(1);

      const at = new Date(write.at);

      // The unique constraint on (challenge_id, idempotency_key) is the whole
      // of the idempotency. Nothing below runs when it bites, and the
      // transaction means "nothing" is literal.
      const inserted = await tx
        .insert(matches)
        .values({
          challengeId: challenge.id,
          runId: current.id,
          drawId: up.id,
          result: write.result,
          mode: write.mode,
          playedAt: at,
          idempotencyKey: write.idempotencyKey,
          seq: played + 1
        })
        .onConflictDoNothing()
        .returning({id: matches.id});

      if (inserted.length === 0) return {applied: false};

      let runId = current.id;
      let seq = dealt + 1;

      if (write.startsRun !== undefined) {
        await tx.update(runs).set({endedAt: at}).where(eq(runs.id, current.id));

        const [next] = await tx
          .insert(runs)
          .values({
            challengeId: challenge.id,
            number: write.startsRun,
            startedAt: at
          })
          .returning({id: runs.id});

        runId = next.id;
        seq = 1;
      }

      if (write.nextDraw) {
        await tx
          .insert(draws)
          .values({runId, seq, drawnAt: at, ...flatten(write.nextDraw)});
      }

      if (write.completesAt) {
        await tx
          .update(challenges)
          .set({completedAt: new Date(write.completesAt)})
          .where(eq(challenges.id, challenge.id));
      }

      return {applied: true};
    });
  }

  async overview(): Promise<Overview> {
    // Two counts that are plain SQL, and one row. None of this replays a
    // challenge — which is the reason completed_at is stored at all.
    const [[runCount], [completedCount], recent] = await Promise.all([
      this.db.select({n: sql<number>`count(*)::int`}).from(runs),
      this.db
        .select({n: sql<number>`count(*)::int`})
        .from(challenges)
        .where(isNotNull(challenges.completedAt)),
      this.db
        .select({id: challenges.id})
        .from(challenges)
        .leftJoin(matches, eq(matches.challengeId, challenges.id))
        .groupBy(challenges.id)
        .orderBy(
          desc(sql`coalesce(max(${matches.playedAt}), ${challenges.createdAt})`)
        )
        .limit(1)
    ]);

    return {
      runs: runCount.n,
      completed: completedCount.n,
      // "Most recently active" is the last match played, falling back to when
      // the challenge was opened — a challenge with no matches yet is still
      // the newest thing on the site.
      latest: recent[0]
        ? await this.load(eq(challenges.id, recent[0].id))
        : null
    };
  }

  private async load(where: SQL): Promise<StoredChallenge | null> {
    const [challenge] = await this.db
      .select()
      .from(challenges)
      .where(where)
      .limit(1);

    if (!challenge) return null;

    const runRows = await this.db
      .select()
      .from(runs)
      .where(eq(runs.challengeId, challenge.id));

    const ids = runRows.map((run) => run.id);
    const numberOf = new Map(runRows.map((run) => [run.id, run.number]));

    const [drawRows, matchRows] = await Promise.all([
      this.db.select().from(draws).where(inArray(draws.runId, ids)),
      this.db.select().from(matches).where(inArray(matches.runId, ids))
    ]);

    const rows = {
      runs: runRows.map((run): RunRow => ({
        number: run.number,
        startedAt: run.startedAt.toISOString(),
        endedAt: run.endedAt?.toISOString() ?? null
      })),
      draws: drawRows.map((draw): DrawRow => ({
        runNumber: numberOf.get(draw.runId) as number,
        seq: draw.seq,
        weaponId: draw.weaponId,
        headId: draw.headId,
        clothesId: draw.clothesId,
        shoesId: draw.shoesId
      })),
      matches: matchRows.map((match): MatchRow => ({
        runNumber: numberOf.get(match.runId) as number,
        seq: match.seq,
        result: match.result,
        mode: match.mode,
        playedAt: match.playedAt.toISOString()
      }))
    };

    return {
      publicId: challenge.publicId,
      handle: challenge.handle,
      createdAt: challenge.createdAt.toISOString(),
      state: rebuild(rows, this.catalogue)
    };
  }
}

function flatten(draw: Draw) {
  return {
    weaponId: draw.weaponId,
    headId: draw.gear.head,
    clothesId: draw.gear.clothes,
    shoesId: draw.gear.shoes
  };
}
