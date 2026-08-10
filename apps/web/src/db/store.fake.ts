import {hashEditSecret, newEditSecret, newPublicId, normalise} from './ids';
import {rebuild, type DrawRow, type MatchRow, type RunRow} from './rebuild';
import {
  UnknownChallengeError,
  type ChallengeStore,
  type CreatedChallenge,
  type MatchWrite,
  type NewChallenge,
  type StoredChallenge
} from './store';
import type {Catalogue, Draw} from '@/domain/types';

/**
 * The in-memory store, for testing route handlers without a database.
 *
 * It holds rows rather than states, and rebuilds through the same shared
 * function the real one uses. That is the point: a fake that shortcut the
 * rebuild would let a handler pass against a reconstruction the database never
 * performs.
 *
 * What it does *not* model is anything the database enforces structurally —
 * it has its own idempotency check rather than a unique constraint, and
 * `store.contract.ts` is what proves the two behave alike.
 */

type Row = {
  publicId: string;
  secretHash: string;
  handle: string;
  createdAt: string;
  completedAt: string | null;
  runs: RunRow[];
  draws: DrawRow[];
  matches: MatchRow[];
  keys: Set<string>;
};

export class FakeChallengeStore implements ChallengeStore {
  private readonly rows = new Map<string, Row>();

  constructor(private readonly catalogue: Catalogue) {}

  async create(input: NewChallenge): Promise<CreatedChallenge> {
    const publicId = newPublicId();
    const editSecret = newEditSecret();

    this.rows.set(publicId, {
      publicId,
      secretHash: hashEditSecret(editSecret),
      handle: input.handle,
      createdAt: input.at,
      completedAt: null,
      runs: [{number: 1, startedAt: input.at, endedAt: null}],
      draws: [{runNumber: 1, seq: 1, ...flatten(input.draw)}],
      matches: [],
      keys: new Set()
    });

    return {publicId, editSecret};
  }

  async findByPublicId(publicId: string): Promise<StoredChallenge | null> {
    return this.view(this.rows.get(normalise(publicId)));
  }

  async findByEditSecret(editSecret: string): Promise<StoredChallenge | null> {
    const hash = hashEditSecret(editSecret);
    for (const row of this.rows.values()) {
      if (row.secretHash === hash) return this.view(row);
    }
    return null;
  }

  async appendMatch(publicId: string, write: MatchWrite) {
    const row = this.rows.get(normalise(publicId));
    if (!row) throw new UnknownChallengeError(publicId);

    // The database does this with a unique constraint; here it is a set. The
    // scope is the challenge and not the run, because a client retrying a
    // report knows nothing about a run having ended between attempts.
    if (row.keys.has(write.idempotencyKey)) return {applied: false};
    row.keys.add(write.idempotencyKey);

    const current = row.runs[row.runs.length - 1];
    const seq = row.matches.filter(
      (m) => m.runNumber === current.number
    ).length;

    row.matches.push({
      runNumber: current.number,
      seq: seq + 1,
      result: write.result,
      mode: write.mode,
      playedAt: write.at
    });

    if (write.completesAt) row.completedAt = write.completesAt;

    if (write.startsRun !== undefined) {
      current.endedAt = write.at;
      row.runs.push({
        number: write.startsRun,
        startedAt: write.at,
        endedAt: null
      });
    }

    if (write.nextDraw) {
      const run = row.runs[row.runs.length - 1];
      const drawn = row.draws.filter((d) => d.runNumber === run.number).length;
      row.draws.push({
        runNumber: run.number,
        seq: drawn + 1,
        ...flatten(write.nextDraw)
      });
    }

    return {applied: true};
  }

  async overview() {
    const rows = [...this.rows.values()];
    const activity = (row: Row) =>
      Math.max(
        ...row.matches.map((m) => Date.parse(m.playedAt)),
        Date.parse(row.createdAt)
      );

    const latest = rows.sort((a, b) => activity(b) - activity(a))[0];

    return {
      runs: rows.reduce((total, row) => total + row.runs.length, 0),
      completed: rows.filter((row) => row.completedAt !== null).length,
      latest: this.view(latest)
    };
  }

  private view(row: Row | undefined): StoredChallenge | null {
    if (!row) return null;
    return {
      publicId: row.publicId,
      handle: row.handle,
      createdAt: row.createdAt,
      state: rebuild(row, this.catalogue)
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
