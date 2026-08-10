import {applyMatch, replayDraws, startChallenge} from '@/domain/challenge';
import type {
  Catalogue,
  ChallengeState,
  Draw,
  MatchEvent,
  MatchMode,
  MatchResult
} from '@/domain/types';

/**
 * Rows back into a `ChallengeState`.
 *
 * Shared by both stores rather than written twice, because "the fake and the
 * database rebuild the same challenge differently" is the failure the contract
 * suite exists to catch and this is the cheapest way to make it impossible.
 *
 * It is pure: rows in, state out, no I/O. The rules are not reimplemented here
 * — the stored matches are pushed back through the same reducer that applied
 * them, and the stored draws are dealt back through `replayDraws` so the
 * rebuild lands on the weapons the player actually held.
 */

export type RunRow = {
  number: number;
  startedAt: string;
  endedAt: string | null;
};

export type DrawRow = {
  runNumber: number;
  seq: number;
  weaponId: string;
  headId: string;
  clothesId: string;
  shoesId: string;
};

export type MatchRow = {
  runNumber: number;
  seq: number;
  result: MatchResult;
  mode: MatchMode;
  playedAt: string;
};

export type Rows = {
  runs: readonly RunRow[];
  draws: readonly DrawRow[];
  matches: readonly MatchRow[];
};

const byRunThenSeq = (a: {runNumber: number; seq: number}, b: typeof a) =>
  a.runNumber - b.runNumber || a.seq - b.seq;

function toDraw(row: DrawRow): Draw {
  return {
    weaponId: row.weaponId,
    gear: {head: row.headId, clothes: row.clothesId, shoes: row.shoesId}
  };
}

export function rebuild(rows: Rows, catalogue: Catalogue): ChallengeState {
  const runs = [...rows.runs].sort((a, b) => a.number - b.number);
  if (runs.length === 0) {
    throw new Error('A stored challenge has no runs, which cannot happen.');
  }

  // One source for the whole rebuild: its position is what puts the draws back
  // in the order they were dealt, across run boundaries as well as within one.
  const draws = replayDraws([...rows.draws].sort(byRunThenSeq).map(toDraw));

  const events: MatchEvent[] = [...rows.matches]
    .sort(byRunThenSeq)
    .map((row) => ({result: row.result, mode: row.mode, at: row.playedAt}));

  let state = startChallenge(draws, runs[0].startedAt);
  for (const event of events) {
    state = applyMatch(state, catalogue, draws, event);
  }

  return state;
}
