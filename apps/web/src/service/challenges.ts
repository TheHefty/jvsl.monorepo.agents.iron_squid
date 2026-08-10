import {applyMatch, drawFrom, drawsFrom} from '@/domain/challenge';
import type {
  Catalogue,
  ChallengeState,
  Draw,
  MatchMode,
  MatchResult,
  Rng
} from '@/domain/types';
import type {
  ChallengeStore,
  CreatedChallenge,
  MatchWrite,
  Overview,
  StoredChallenge
} from '@/db/store';

/**
 * The layer between a route handler and the store.
 *
 * The store reads and writes; the domain decides. This does the joining —
 * loads a challenge, pushes a reported result through `applyMatch`, and works
 * out from the result which rows changed. Keeping it here rather than in the
 * store is what leaves the in-memory fake free of rules, and a fake free of
 * rules is the only kind worth testing a handler against.
 *
 * Nothing here is framework-aware: no request, no response, no Next. A handler
 * validates its input and calls these.
 */

/** Injected so tests do not depend on the wall clock. */
export type Clock = () => string;

export type MatchReport = {
  result: MatchResult;
  mode: MatchMode;
  /** Client-generated, and the only field of the three a client may set. */
  idempotencyKey: string;
};

export type ReportOutcome = {
  /** False when the key had been seen: a retry, and a success. */
  applied: boolean;
  challenge: StoredChallenge;
};

/** Thrown when an edit secret matches nothing. Never says which part failed. */
export class NoSuchChallengeError extends Error {
  constructor() {
    super('No challenge for that link.');
    this.name = 'NoSuchChallengeError';
  }
}

/** Thrown when a report arrives for a challenge that is already finished. */
export class ChallengeCompleteError extends Error {
  constructor() {
    super('That challenge is complete; no further matches apply.');
    this.name = 'ChallengeCompleteError';
  }
}

const NO_GEAR_SPENT = {head: [], clothes: [], shoes: []} as const;

export class ChallengeService {
  constructor(
    private readonly store: ChallengeStore,
    private readonly catalogue: Catalogue,
    private readonly rng: Rng,
    private readonly now: Clock
  ) {}

  /**
   * Opens a challenge, with its first draw already dealt and stored.
   *
   * The draw is produced here rather than by the client, and written before
   * the response exists — that ordering is the rule, not an implementation
   * detail.
   */
  async create(handle: string): Promise<CreatedChallenge> {
    const at = this.now();
    const draw = drawFrom(this.catalogue, [], NO_GEAR_SPENT, this.rng);
    return this.store.create({handle, at, draw});
  }

  read(publicId: string): Promise<StoredChallenge | null> {
    return this.store.findByPublicId(publicId);
  }

  /**
   * The same challenge, opened by its credential instead of its public id.
   *
   * What the edit screens render is identical to what the public one does —
   * the difference between them is what they let you *do*, not what they show.
   */
  readByEditSecret(editSecret: string): Promise<StoredChallenge | null> {
    return this.store.findByEditSecret(editSecret);
  }

  /** The two counts and the live challenge the landing page shows. */
  overview(): Promise<Overview> {
    return this.store.overview();
  }

  /**
   * Records a reported result against the challenge the secret opens.
   *
   * The timestamp is the server's. A client may lie about a result — the
   * honour system accepts that — but letting it also choose when the match
   * happened would let it reorder a run's history, which the replay depends
   * on.
   */
  async report(
    editSecret: string,
    report: MatchReport
  ): Promise<ReportOutcome> {
    const found = await this.store.findByEditSecret(editSecret);
    if (!found) throw new NoSuchChallengeError();
    if (found.state.status === 'complete') throw new ChallengeCompleteError();

    const at = this.now();
    const draws = drawsFrom(this.catalogue, this.rng);

    const after = applyMatch(found.state, this.catalogue, draws, {
      result: report.result,
      mode: report.mode,
      at
    });

    const {applied} = await this.store.appendMatch(
      found.publicId,
      writeFor(found.state, after, {...report, at})
    );

    // A rejected key means the stored history already contains this match, so
    // what the caller should see is what was already there — not the state
    // this call computed on top of it.
    if (!applied) return {applied: false, challenge: found};

    return {applied: true, challenge: {...found, state: after}};
  }
}

/**
 * Works out which rows a reported result changed, by comparing the state
 * before it with the state after.
 *
 * Reading it back off the domain rather than re-deriving it is deliberate:
 * "did this loss end the run" and "did this win deal a new draw" are rules,
 * and asking the result is the only way to answer them without writing those
 * rules down a second time.
 *
 * Note what protects a concurrent pair of reports: the store numbers each
 * match within its run, and `UNIQUE (run_id, seq)` rejects the second writer
 * that computed the same position from the same stale read. It is optimistic
 * concurrency that fell out of needing a deterministic order for replay.
 */
function writeFor(
  before: ChallengeState,
  after: ChallengeState,
  report: MatchReport & {at: string}
): MatchWrite {
  const write: MatchWrite = {
    idempotencyKey: report.idempotencyKey,
    result: report.result,
    mode: report.mode,
    at: report.at,
    // Recorded when it happens, because counting finished challenges any
    // other way means replaying every one of them.
    ...(after.status === 'complete' && before.status !== 'complete'
      ? {completesAt: report.at}
      : {})
  };

  if (after.run.number !== before.run.number) {
    // The run died and another began; its opening draw is the new one.
    return {...write, startsRun: after.run.number, nextDraw: after.run.draw};
  }

  if (!sameDraw(before.run.draw, after.run.draw)) {
    return {...write, nextDraw: after.run.draw};
  }

  // A loss with a life to spare: rule 3 keeps the weapon up, so nothing new
  // was dealt and nothing but the match itself is written.
  return write;
}

function sameDraw(a: Draw, b: Draw): boolean {
  return (
    a.weaponId === b.weaponId &&
    a.gear.head === b.gear.head &&
    a.gear.clothes === b.gear.clothes &&
    a.gear.shoes === b.gear.shoes
  );
}
