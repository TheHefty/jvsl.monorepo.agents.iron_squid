import type {
  ChallengeState,
  Draw,
  MatchMode,
  MatchResult
} from '@/domain/types';

/**
 * The challenge store: the port, and nothing behind it.
 *
 * It reads and writes. It does not apply the rules — a service above it does
 * the read → `applyMatch` → write, and that is deliberate rather than tidy:
 * the in-memory fake exists so route handlers can be tested without a
 * database, and a fake that reimplements the orchestration would be a fake
 * that agrees with a handler because both got it wrong the same way.
 *
 * Two implementations satisfy this, and `store.contract.ts` holds the
 * assertions both must pass so they cannot drift.
 */

export type StoredChallenge = {
  publicId: string;
  handle: string;
  createdAt: string;
  /** Rebuilt by replaying the stored draws and matches through the domain. */
  state: ChallengeState;
};

export type NewChallenge = {
  handle: string;
  /** When the first run started. */
  at: string;
  /** Dealt by the server and written before anyone sees it. */
  draw: Draw;
};

/**
 * The secret is returned exactly once, here, and never again — only its hash
 * is stored. Losing it means losing write access to that challenge.
 */
export type CreatedChallenge = {
  publicId: string;
  editSecret: string;
};

/**
 * A reported match, together with whatever the domain decided followed from
 * it. The store writes these; it does not work out which apply.
 */
export type MatchWrite = {
  /** Client-generated, unique per challenge. A repeat is ignored. */
  idempotencyKey: string;
  result: MatchResult;
  mode: MatchMode;
  at: string;

  /**
   * The draw dealt after this match, when one was.
   *
   * Absent for a loss with lives left — that draw survives, and rule 3 keeps
   * the weapon up until it is won.
   */
  nextDraw?: Draw;

  /** Set when this match finished the challenge. Recorded once, never undone. */
  completesAt?: string;

  /**
   * Set when this match emptied the last life: the current run ends at `at`,
   * and a new one begins with this number. `nextDraw` is then its first draw
   * rather than a continuation of the old one.
   */
  startsRun?: number;
};

/**
 * `applied: false` means the key had been seen before and nothing was written.
 * It is a success, not an error: it is what a retried Background Sync entry is
 * supposed to produce.
 */
export type AppendResult = {applied: boolean};

/** What the landing needs: two counts, and whoever is playing right now. */
export type Overview = {
  /** Every run ever started, across every challenge. Countable in SQL. */
  runs: number;
  /** Challenges that reached the end. Countable only because it is recorded. */
  completed: number;
  /** The most recently active public challenge, or null on an empty site. */
  latest: StoredChallenge | null;
};

export interface ChallengeStore {
  create(input: NewChallenge): Promise<CreatedChallenge>;

  findByPublicId(publicId: string): Promise<StoredChallenge | null>;

  /** Takes the secret itself, hashes it, and looks up by the hash. */
  findByEditSecret(editSecret: string): Promise<StoredChallenge | null>;

  appendMatch(publicId: string, write: MatchWrite): Promise<AppendResult>;

  overview(): Promise<Overview>;
}

/** Thrown when a write names a challenge that is not there. */
export class UnknownChallengeError extends Error {
  constructor(readonly publicId: string) {
    super(`No challenge with public id ${publicId}.`);
    this.name = 'UnknownChallengeError';
  }
}
