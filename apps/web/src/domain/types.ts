/**
 * The Iron Squid domain, in plain data.
 *
 * Nothing here imports React, Next.js, or anything that touches I/O. The rules
 * of the challenge have to be enforceable on the server and testable without a
 * browser, and the previous implementation failed at both by living inside a
 * presentational component.
 *
 * Vocabulary follows docs/CHALLENGE.md exactly, and it is not the obvious
 * English reading: a **run** is one attempt, and a **challenge** is the whole
 * sequence of them.
 */

export type GearSlot = 'head' | 'clothes' | 'shoes';

export const GEAR_SLOTS: readonly GearSlot[] = ['head', 'clothes', 'shoes'];

export type Weapon = {
  id: string;
  name: string;
  className: string;
};

/**
 * How a weapon stands in the run being viewed.
 *
 * Note the armory has no "failed" state: a weapon cleared in a run that later
 * died is simply untouched again, because rule 5 takes the credit back.
 */
export type WeaponState = 'cleared' | 'current' | 'untouched';

export type GearItem = {
  id: string;
  name: string;
  slot: GearSlot;
};

/** Everything that can be drawn. Generated from the dataset; never hardcoded. */
export type Catalogue = {
  weapons: Weapon[];
  gear: Record<GearSlot, GearItem[]>;
};

/** One assignment of a weapon and a full set of gear. */
export type Draw = {
  weaponId: string;
  gear: Record<GearSlot, string>;
};

export type MatchResult = 'win' | 'loss';

/**
 * The four ranked modes. Rule 3 counts a win only in Anarchy or X Battle, so
 * Turf War is deliberately absent and cannot be reported.
 *
 * The mode is recorded because it is the only trace the honour system leaves:
 * results are self-reported and unverifiable, but a log that names the mode
 * makes rule 3 something a reader can check rather than merely assume. The
 * stage is not recorded — it proves nothing and would be one more field to fill
 * in on every match.
 */
export const MATCH_MODES = [
  'splatZones',
  'towerControl',
  'rainmaker',
  'clamBlitz'
] as const;

export type MatchMode = (typeof MATCH_MODES)[number];

/**
 * One played match. Losses are recorded too — the run log is supposed to show
 * deaths, and the previous implementation dropped every non-fatal defeat.
 */
export type MatchRecord = {
  draw: Draw;
  result: MatchResult;
  mode: MatchMode;
  at: string;
};

/** One attempt: from a full board to zero lives, or to the last weapon. */
export type RunState = {
  number: number;
  lives: number;
  /** Wins within *this* run. Resets with the run, as does `lives`. */
  wins: number;
  /** Weapon ids cleared in this run, in the order they were cleared. */
  cleared: string[];
  /** Gear ids spent in this run. Single use is per item, not per set. */
  spentGear: Record<GearSlot, string[]>;
  draw: Draw;
  matches: MatchRecord[];
  startedAt: string;
};

export type DeadRun = {
  number: number;
  cleared: string[];
  matches: MatchRecord[];
  startedAt: string;
  endedAt: string;
};

export type ChallengeState = {
  status: 'ongoing' | 'complete';
  run: RunState;
  deadRuns: DeadRun[];
  completedAt?: string;
};

/**
 * Returns an integer in [0, exclusiveMax).
 *
 * Injected rather than called directly so the domain stays pure and testable.
 * In production this is backed by a CSPRNG on the server: the client never
 * produces a draw, because a client that can re-roll until it likes the weapon
 * voids rules 1 and 3 invisibly.
 */
export type Rng = (exclusiveMax: number) => number;

export type MatchEvent = {
  result: MatchResult;
  mode: MatchMode;
  at: string;
};

/** Thrown when the catalogue cannot satisfy a draw. */
export class EmptyPoolError extends Error {
  constructor(readonly pool: 'weapons' | GearSlot) {
    super(`Cannot draw: the ${pool} pool is empty.`);
    this.name = 'EmptyPoolError';
  }
}
