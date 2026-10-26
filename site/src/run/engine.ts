// The rules of a run (charter, "The rules the site enforces"), as pure functions over an immutable
// state: no screen, no storage, no clock (time is passed in). Every draw of the run is fixed when it
// starts, so nothing a player does afterwards (undo included) can change what comes next (FR-14).
import { gearSlots, type Catalogue } from '../catalogue/types';
import { shuffle, type RandomSource } from './random';

type Order = { kits: string[]; head: string[]; clothes: string[]; shoes: string[] };

// One reported result (FR-24): which draw of the order it was (so its kit and gear are the run's own
// order[draw]), win or loss, the mode it was played in, the lives left and the kits conquered after
// it, and whether it was a replay or reset the run. A result reported before the site recorded modes
// has none, and none is invented for it.
export type LogEntry = {
  at: string;
  draw: number;
  result: 'win' | 'loss';
  mode?: string;
  livesAfter: number;
  conqueredAfter: number;
  replay: boolean;
  reset: boolean;
};

// The state before the last result, without the log: undo removes the log's last entry instead, so
// a long run never stores its log twice (task run-log-format, failure 3).
export type Snapshot = Omit<RunState, 'previous' | 'log' | 'logSince'>;

export type RunState = {
  schema: 2;
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
  // A win moves straight on to the next set (FR-23); only the final win stays on show, as 'conquered'.
  phase: 'playing' | 'conquered';
  lives: number;
  winsSinceReset: number;
  resets: number;
  matches: number;
  // Goes up with every change; an action names the step it was made on, and a stale one is refused.
  step: number;
  // Every result, in the order played (FR-24), complete from logSince: the start of a run begun in
  // format 2, or the day a format-1 run was migrated, before which nothing was recorded.
  log: LogEntry[];
  logSince: string;
  // The state before the last result: what undo returns to (FR-20). One level only.
  previous?: Snapshot;
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
    schema: 2,
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
    log: [],
    logSince: at,
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

function snapshot(s: RunState): Snapshot {
  const { previous: _previous, log: _log, logSince: _logSince, ...rest } = s;
  void _previous;
  void _log;
  void _logSince;
  return rest;
}

type Result = { step: number; at: string; mode: string };

const entry = (
  s: RunState,
  { at, mode }: Result,
  result: 'win' | 'loss',
  after: RunState,
): LogEntry => ({
  at,
  draw: s.cursor,
  result,
  mode,
  livesAfter: after.lives,
  conqueredAfter: after.conquered,
  replay: s.cursor < s.conquered,
  reset: after.resets > s.resets,
});

// A result's new state, with its log entry and the snapshot undo returns to.
function recorded(s: RunState, action: Result, result: 'win' | 'loss', after: RunState): RunState {
  return { ...after, log: [...s.log, entry(s, action, result, after)], previous: snapshot(s) };
}

// Every result names the mode it was played in (match-modes); which modes exist is the catalogue's,
// and the screen offers only those.
function checked(s: RunState, action: Result, result: 'win' | 'loss'): void {
  fresh(s, action);
  if (!action.mode) throw new Error(`run: a ${result} is reported with the mode it was played in`);
  if (s.phase !== 'playing')
    throw new Error(`run: a ${result} is reported while playing, not after the run is complete`);
}

// A win moves straight on to the next set, drawn when the run started (FR-14, FR-23), unless it
// conquers the last kit: then the run is complete and its final set stays on show.
export function reportWin(s: RunState, action: Result): RunState {
  checked(s, action, 'win');
  const conquered = s.cursor === s.conquered ? s.conquered + 1 : s.conquered;
  const complete = conquered === s.order.kits.length;
  return recorded(s, action, 'win', {
    ...s,
    conquered,
    cursor: complete ? s.cursor : s.cursor + 1,
    phase: complete ? 'conquered' : 'playing',
    // Every 10th win since the run started or was reset earns a life (FR-16); replays count.
    lives: (s.winsSinceReset + 1) % 10 === 0 ? s.lives + 1 : s.lives,
    winsSinceReset: s.winsSinceReset + 1,
    matches: s.matches + 1,
    step: s.step + 1,
  });
}

// Undo exists only after a result, whose entry is the log's last: it goes with the result.
export function undo(s: RunState): RunState {
  if (!s.previous) throw new Error('run: nothing to undo');
  return { ...s.previous, log: s.log.slice(0, -1), logSince: s.logSince, step: s.step + 1 };
}

// A loss costs a life and the same set is played again (FR-17). On the last life the run resets
// (FR-18): back to the first conquered set with 1 life, and what was conquered stays conquered. The
// order is fixed and the conquered kits are its prefix, so the replay is the cursor walking from 0
// again, each set with the gear it was won with.
export function reportLoss(s: RunState, action: Result): RunState {
  checked(s, action, 'loss');
  if (s.lives > 1) {
    return recorded(s, action, 'loss', {
      ...s,
      lives: s.lives - 1,
      matches: s.matches + 1,
      step: s.step + 1,
    });
  }
  return recorded(s, action, 'loss', {
    ...s,
    cursor: 0,
    lives: 1,
    winsSinceReset: 0,
    resets: s.resets + 1,
    matches: s.matches + 1,
    step: s.step + 1,
  });
}

// How many more wins earn the next life (FR-22).
export const winsToNextLife = (s: RunState) => 10 - (s.winsSinceReset % 10);

// A replay: a set already conquered, being played again after a reset (FR-19).
export const isReplay = (s: RunState) => s.phase === 'playing' && s.cursor < s.conquered;

// Replays left before new draws, counting the one on screen: the fifth of 12 leaves 8.
export const replaysRemaining = (s: RunState) => (isReplay(s) ? s.conquered - s.cursor : 0);

// The end of a run (FR-21): every kit conquered. Only a win on a new draw raises the conquered count,
// so a replay never ends a run, and a complete run is always on show after its final win, where no
// result is accepted.
export const isComplete = (s: RunState) => s.conquered === s.order.kits.length;

// What the run took. Wins and losses are counted from the log; when the log does not cover the whole
// run (a run migrated from format 1), `since` says from when, so a part is never shown as the whole.
export function totals(s: RunState) {
  const wins = s.log.filter((e) => e.result === 'win').length;
  return {
    matches: s.matches,
    wins,
    losses: s.log.length - wins,
    resets: s.resets,
    since: s.logSince > s.startedAt ? s.logSince : undefined,
  };
}
