import {
  EmptyPoolError,
  GEAR_SLOTS,
  type Catalogue,
  type ChallengeState,
  type DeadRun,
  type Draw,
  type GearSlot,
  type GearItem,
  type MatchEvent,
  type MatchMode,
  type MatchResult,
  type Rng,
  type RunState,
  type Weapon,
  type WeaponState
} from './types';

/**
 * The rules of the challenge, as pure functions. See docs/CHALLENGE.md — that
 * document is the source of truth, and this file implements it rather than the
 * other way round.
 *
 * Note what is deliberately absent: there is no re-roll. A player cannot ask
 * for a different weapon or a different gear set, so no function offers it.
 * The previous implementation shipped an unrestricted re-roll handler, which is
 * harmless in a private tracker and fatal in a public one.
 */

export const LIVES_AT_START = 1;
export const WINS_PER_EXTRA_LIFE = 10;

function pick<T>(pool: T[], rng: Rng): T {
  // `pool` is never empty here — callers check — but an rng that returns an
  // out-of-range index would corrupt a run silently, so it is pinned.
  const index = rng(pool.length);
  if (!Number.isInteger(index) || index < 0 || index >= pool.length) {
    throw new RangeError(
      `Rng returned ${index}, which is not a valid index into a pool of ${pool.length}.`
    );
  }
  return pool[index];
}

/** How many weapons a run must clear. Derived from the catalogue, never fixed. */
export function targetWeaponCount(catalogue: Catalogue): number {
  return catalogue.weapons.length;
}

/**
 * Draws a weapon and one item per gear slot from what the run has not consumed.
 *
 * Single use is per item: each drawn head, clothes and shoes leaves its own
 * pool. Not the combination — with 18.5 million combinations against 162
 * draws, "the set does not repeat" would bind in 0.070% of runs, which is to
 * say never.
 */
export function drawFrom(
  catalogue: Catalogue,
  cleared: readonly string[],
  spentGear: Record<GearSlot, readonly string[]>,
  rng: Rng
): Draw {
  const clearedSet = new Set(cleared);
  const weapons = catalogue.weapons.filter((w) => !clearedSet.has(w.id));
  if (weapons.length === 0) throw new EmptyPoolError('weapons');

  // The weapon is drawn first, then head, clothes and shoes in that order.
  // Fixed so a seeded rng produces a reproducible draw.
  const weaponId = pick(weapons, rng).id;

  const gear = {} as Record<GearSlot, string>;
  for (const slot of GEAR_SLOTS) {
    const spent = new Set(spentGear[slot]);
    const available = catalogue.gear[slot].filter((g) => !spent.has(g.id));
    if (available.length === 0) throw new EmptyPoolError(slot);
    gear[slot] = pick(available, rng).id;
  }

  return {weaponId, gear};
}

/**
 * Begins a run: one life, no wins, the full weapon and gear pools restored.
 *
 * Nothing carries over from a previous run. That is the whole difficulty of the
 * challenge — a weapon cleared in a dead run must be cleared again.
 */
export function startRun(
  catalogue: Catalogue,
  rng: Rng,
  number: number,
  at: string
): RunState {
  const spentGear: Record<GearSlot, string[]> = {
    head: [],
    clothes: [],
    shoes: []
  };

  return {
    number,
    lives: LIVES_AT_START,
    wins: 0,
    cleared: [],
    spentGear,
    draw: drawFrom(catalogue, [], spentGear, rng),
    matches: [],
    startedAt: at
  };
}

export function startChallenge(
  catalogue: Catalogue,
  rng: Rng,
  at: string
): ChallengeState {
  return {
    status: 'ongoing',
    run: startRun(catalogue, rng, 1, at),
    deadRuns: []
  };
}

function recordMatch(run: RunState, event: MatchEvent): RunState['matches'] {
  return [
    ...run.matches,
    {draw: run.draw, result: event.result, mode: event.mode, at: event.at}
  ];
}

function applyWin(
  state: ChallengeState,
  catalogue: Catalogue,
  rng: Rng,
  event: MatchEvent
): ChallengeState {
  const {run} = state;
  const cleared = [...run.cleared, run.draw.weaponId];
  const wins = run.wins + 1;
  const matches = recordMatch(run, event);

  // Single use, per item: the drawn gear leaves its pool alongside the weapon.
  const spentGear: Record<GearSlot, string[]> = {
    head: [...run.spentGear.head, run.draw.gear.head],
    clothes: [...run.spentGear.clothes, run.draw.gear.clothes],
    shoes: [...run.spentGear.shoes, run.draw.gear.shoes]
  };

  // +1 life for every ten wins within this run.
  const lives = wins % WINS_PER_EXTRA_LIFE === 0 ? run.lives + 1 : run.lives;

  const finished = cleared.length === targetWeaponCount(catalogue);

  return {
    ...state,
    status: finished ? 'complete' : 'ongoing',
    completedAt: finished ? event.at : state.completedAt,
    run: {
      ...run,
      lives,
      wins,
      cleared,
      spentGear,
      matches,
      // A finished challenge keeps its last draw rather than dealing one it
      // could not satisfy: the weapon pool is empty by definition.
      draw: finished ? run.draw : drawFrom(catalogue, cleared, spentGear, rng)
    }
  };
}

function applyLoss(
  state: ChallengeState,
  catalogue: Catalogue,
  rng: Rng,
  event: MatchEvent
): ChallengeState {
  const {run} = state;
  const lives = run.lives - 1;
  const matches = recordMatch(run, event);

  if (lives > 0) {
    // The draw survives a loss. The weapon is yours until you win with it.
    return {...state, run: {...run, lives, matches}};
  }

  const dead: DeadRun = {
    number: run.number,
    cleared: run.cleared,
    matches,
    startedAt: run.startedAt,
    endedAt: event.at
  };

  return {
    ...state,
    run: startRun(catalogue, rng, run.number + 1, event.at),
    deadRuns: [dead, ...state.deadRuns]
  };
}

/**
 * Applies a reported match result.
 *
 * Results are self-reported — the honour system — so this does not verify that
 * a win happened. What it does enforce is everything the player cannot choose:
 * which weapon is up, when a life is spent, and when the board resets.
 */
export function applyMatch(
  state: ChallengeState,
  catalogue: Catalogue,
  rng: Rng,
  event: MatchEvent
): ChallengeState {
  if (state.status === 'complete') {
    throw new Error('The challenge is complete; no further matches apply.');
  }

  return event.result === 'win'
    ? applyWin(state, catalogue, rng, event)
    : applyLoss(state, catalogue, rng, event);
}

/** One tile of the armory: a weapon, and how it stands in the run being viewed. */
export type ArmoryEntry = Weapon & {state: WeaponState};

/**
 * How each weapon in the catalogue stands in the current run.
 *
 * A read model rather than stored state: `cleared` is a list of ids, and the
 * armory needs it as a list of weapons in roster order. Deriving it here keeps
 * the rule — one weapon is active, the rest are cleared or untouched — out of
 * the component that draws the grid.
 */
export function armoryView(
  state: ChallengeState,
  catalogue: Catalogue
): ArmoryEntry[] {
  const cleared = new Set(state.run.cleared);

  return catalogue.weapons.map((weapon) => ({
    ...weapon,
    state: cleared.has(weapon.id)
      ? 'cleared'
      : weapon.id === state.run.draw.weaponId
        ? 'current'
        : 'untouched'
  }));
}

/**
 * The active draw with its ids resolved to catalogue entries.
 *
 * Stored state keeps ids, because the draw must mean the same thing in every
 * language. Resolving them is a read concern, and doing it here keeps the
 * lookup out of the pages.
 */
export function drawView(
  state: ChallengeState,
  catalogue: Catalogue
): {weapon: Weapon; gear: Record<GearSlot, GearItem>} {
  const {draw} = state.run;

  const weapon = catalogue.weapons.find((w) => w.id === draw.weaponId);
  if (!weapon) {
    throw new Error(`Drawn weapon ${draw.weaponId} is not in the catalogue.`);
  }

  const gear = {} as Record<GearSlot, GearItem>;
  for (const slot of GEAR_SLOTS) {
    const item = catalogue.gear[slot].find((g) => g.id === draw.gear[slot]);
    if (!item) {
      throw new Error(
        `Drawn ${slot} ${draw.gear[slot]} is not in the catalogue.`
      );
    }
    gear[slot] = item;
  }

  return {weapon, gear};
}

/** One row of the run log. Carries no prose: the mode is a key, not a label. */
export type LogEntry = {
  id: string;
  result: MatchResult;
  mode: MatchMode;
  weaponName: string;
  runNumber: number;
  at: string;
};

/**
 * Every match played, newest first, across the live run and the dead ones.
 *
 * Losses included — that is the whole point of the log, and the failure the
 * original app shipped, where a defeat was only written down when it was the
 * last one.
 */
export function matchLog(
  state: ChallengeState,
  catalogue: Catalogue
): LogEntry[] {
  const names = new Map(catalogue.weapons.map((w) => [w.id, w.name]));

  const rows = [state.run, ...state.deadRuns].flatMap((run) =>
    run.matches.map((match, index) => ({
      id: `${run.number}-${index}`,
      result: match.result,
      mode: match.mode,
      weaponName: names.get(match.draw.weaponId) ?? match.draw.weaponId,
      runNumber: run.number,
      at: match.at
    }))
  );

  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Wins since the last loss, within the current run. */
function trailingWins(run: RunState): number {
  let streak = 0;
  for (let i = run.matches.length - 1; i >= 0; i -= 1) {
    if (run.matches[i].result !== 'win') break;
    streak += 1;
  }
  return streak;
}

/** Read models the UI needs, derived rather than stored. */
export function progress(state: ChallengeState, catalogue: Catalogue) {
  const total = targetWeaponCount(catalogue);
  const cleared = state.run.cleared.length;

  return {
    total,
    cleared,
    remaining: total - cleared,
    winsToNextLife:
      WINS_PER_EXTRA_LIFE - (state.run.wins % WINS_PER_EXTRA_LIFE),
    /** Consecutive wins right now. Not the same as `wins`, which losses do not reset. */
    streak: trailingWins(state.run),
    /**
     * The furthest any run has got, this one included. The number a player
     * actually competes against once a run has died.
     */
    best: Math.max(cleared, ...state.deadRuns.map((r) => r.cleared.length), 0),
    /** Lives earned this run, which is what the meter draws as its total. */
    livesMax: LIVES_AT_START + Math.floor(state.run.wins / WINS_PER_EXTRA_LIFE),
    deaths: state.deadRuns.length,
    matches:
      state.run.matches.length +
      state.deadRuns.reduce((n, r) => n + r.matches.length, 0),
    gearSpent: {
      head: state.run.spentGear.head.length,
      clothes: state.run.spentGear.clothes.length,
      shoes: state.run.spentGear.shoes.length
    },
    gearTotals: {
      head: catalogue.gear.head.length,
      clothes: catalogue.gear.clothes.length,
      shoes: catalogue.gear.shoes.length
    }
  };
}
