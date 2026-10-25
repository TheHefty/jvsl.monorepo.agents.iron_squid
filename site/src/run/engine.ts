// The rules of a run (charter, "The rules the site enforces"), as pure functions over an immutable
// state: no screen, no storage, no clock (time is passed in). Every draw of the run is fixed when it
// starts, so nothing a player does afterwards (undo included) can change what comes next (FR-14).
import { gearSlots, type Catalogue } from '../catalogue/types';
import { shuffle, type RandomSource } from './random';

type Order = { kits: string[]; head: string[]; clothes: string[]; shoes: string[] };

export type RunState = {
  schema: 1;
  catalogueVersion: string;
  name?: string;
  startedAt: string;
  // The whole run, drawn at the start: draw n is kit n with head, clothes and shoes n. The order is
  // stored rather than a seed, so a change in this code can never reorder a run in progress.
  order: Order;
  // Kits conquered so far (a prefix of order.kits), and the set being played (a replay when it is
  // below conquered, which reset-and-replay brings).
  conquered: number;
  cursor: number;
  // After a win the conquered set stays on show until the player asks for the next (FR-23).
  phase: 'playing' | 'conquered';
  lives: number;
  winsSinceReset: number;
  resets: number;
  matches: number;
  // Goes up with every change; an action names the step it was made on, and a stale one is refused.
  step: number;
  // The state before the last result: what undo returns to (FR-20). One level only.
  previous?: Omit<RunState, 'previous'>;
};

export type CurrentSet = { kit: string; head: string; clothes: string; shoes: string };

export function startRun(
  catalogue: Catalogue,
  { name }: { name: string | undefined },
  source: RandomSource,
  at: string,
): RunState {
  for (const slot of gearSlots) {
    const n = catalogue.gear[slot].length;
    if (n < catalogue.kits.length) {
      throw new Error(`run: the ${slot} slot has ${n} pieces for ${catalogue.kits.length} kits`);
    }
  }
  const ids = (items: { id: string }[]) =>
    shuffle(
      items.map((i) => i.id),
      source,
    );
  return {
    schema: 1,
    catalogueVersion: catalogue.version,
    ...(name === undefined ? {} : { name }),
    startedAt: at,
    order: {
      kits: ids(catalogue.kits),
      head: ids(catalogue.gear.head),
      clothes: ids(catalogue.gear.clothes),
      shoes: ids(catalogue.gear.shoes),
    },
    conquered: 0,
    cursor: 0,
    phase: 'playing',
    lives: 1,
    winsSinceReset: 0,
    resets: 0,
    matches: 0,
    step: 0,
  };
}

export function currentSet(s: RunState): CurrentSet {
  const at = (list: string[]) => {
    const id = list[s.cursor];
    if (id === undefined) throw new Error(`run: no draw ${s.cursor} in this run`);
    return id;
  };
  return {
    kit: at(s.order.kits),
    head: at(s.order.head),
    clothes: at(s.order.clothes),
    shoes: at(s.order.shoes),
  };
}

function fresh(s: RunState, { step }: { step: number }): void {
  if (step !== s.step)
    throw new Error(`run: stale action for step ${step}; the run is at step ${s.step}`);
}

function withoutPrevious(s: RunState): Omit<RunState, 'previous'> {
  const { previous: _previous, ...rest } = s;
  void _previous;
  return rest;
}

export function reportWin(s: RunState, action: { step: number; at: string }): RunState {
  fresh(s, action);
  if (s.phase !== 'playing')
    throw new Error('run: a win is reported while playing, not after a win');
  return {
    ...s,
    conquered: s.cursor === s.conquered ? s.conquered + 1 : s.conquered,
    phase: 'conquered',
    // Every 10th win since the run started or was reset earns a life (FR-16); replays count.
    lives: (s.winsSinceReset + 1) % 10 === 0 ? s.lives + 1 : s.lives,
    winsSinceReset: s.winsSinceReset + 1,
    matches: s.matches + 1,
    step: s.step + 1,
    previous: withoutPrevious(s),
  };
}

export function nextSet(s: RunState, action: { step: number }): RunState {
  fresh(s, action);
  if (s.phase !== 'conquered')
    throw new Error('run: the next set comes after a win, not after a win is undone');
  if (s.cursor + 1 >= s.order.kits.length) {
    throw new Error('run: every kit is conquered; there is no next set');
  }
  const { previous: _previous, ...rest } = s;
  void _previous;
  // Asking for the next set keeps the last result undoable: undo is lost only at the next result.
  return {
    ...rest,
    phase: 'playing',
    cursor: s.cursor + 1,
    step: s.step + 1,
    ...(s.previous ? { previous: s.previous } : {}),
  };
}

export function undo(s: RunState): RunState {
  if (!s.previous) throw new Error('run: nothing to undo');
  return { ...s.previous, step: s.step + 1 } as RunState;
}

// A loss costs a life and the same set is played again (FR-17). On the last life the run resets
// (FR-18): back to the first conquered set with 1 life, and what was conquered stays conquered. The
// order is fixed and the conquered kits are its prefix, so the replay is the cursor walking from 0
// again, each set with the gear it was won with.
export function reportLoss(s: RunState, action: { step: number; at: string }): RunState {
  fresh(s, action);
  if (s.phase !== 'playing')
    throw new Error('run: a loss is reported while playing, not after a win');
  const previous = withoutPrevious(s);
  if (s.lives > 1)
    return { ...s, lives: s.lives - 1, matches: s.matches + 1, step: s.step + 1, previous };
  return {
    ...s,
    cursor: 0,
    lives: 1,
    winsSinceReset: 0,
    resets: s.resets + 1,
    matches: s.matches + 1,
    step: s.step + 1,
    previous,
  };
}

// How many more wins earn the next life (FR-22).
export const winsToNextLife = (s: RunState) => 10 - (s.winsSinceReset % 10);

// A replay: a set already conquered, being played again after a reset (FR-19). Only while playing:
// once a set is won, cursor < conquered holds for a new conquest too, and the card says "conquered".
export const isReplay = (s: RunState) => s.phase === 'playing' && s.cursor < s.conquered;

// Replays left before new draws, counting the one on screen: the fifth of 12 leaves 8.
export const replaysRemaining = (s: RunState) => (isReplay(s) ? s.conquered - s.cursor : 0);
