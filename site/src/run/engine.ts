// The rules of a run (charter, "The rules the site enforces"), as pure functions over an immutable
// state: no screen, no storage, no clock (time is passed in). Every draw of the run is fixed when it
// starts, so nothing a player does afterwards (undo included) can change what comes next (FR-14).
import { gearSlots, type Catalogue, type GearSlot } from '../catalogue/types';
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

// A piece of gear given up for the next spare of its slot (FR-25), where it happened: on which draw,
// and after how many matches, so the run log can place it among the results (FR-24).
export type RerollEntry = {
  at: string;
  draw: number;
  slot: GearSlot;
  from: string;
  to: string;
  afterMatches: number;
};

// The replays of one reset (FR-18, reshuffle rule): the conquered kits in the order drawn for it, by
// their draw, and per slot the order index of the gear dealt to each, in the same order. `matches`
// is the match that caused the reset, so a reset reported again after undo reuses it (FR-14).
export type Replays = { matches: number; draws: number[]; gear: Record<GearSlot, number[]> };

// Which reset a run follows: 'reshuffle' for runs started after 2026-10-26, 'in-order' (the conquered
// sets again, in order, with their own gear) for runs begun before, which finish under it.
export type ResetRule = 'reshuffle' | 'in-order';

// The state before the last result, without the logs: undo removes the log's last entry instead, so
// a long run never stores its log twice (task run-log-format, failure 3); re-rolls are never undone,
// and a reset's replays outlive an undo so that it cannot draw them again.
export type Snapshot = Omit<RunState, 'previous' | 'log' | 'logSince' | 'rerolls' | 'replays'>;

export type RunState = {
  schema: 4;
  resetRule: ResetRule;
  catalogueVersion: string;
  name?: string;
  startedAt: string;
  // The whole run, drawn at the start: draw n is kit n with head, clothes and shoes n. The order is
  // stored rather than a seed, so a change in this code can never reorder a run in progress. Each
  // gear slot holds more pieces than kits: those past the kits are its spares, in the order a
  // re-roll takes them (FR-25), so what a re-roll gives is fixed from the start too (FR-14).
  order: Order;
  // Per slot, the order index a re-rolled draw wears instead of its own, and how many spares the
  // slot has given; a spare given and re-rolled away again stays spent.
  worn: Record<GearSlot, Record<number, number>>;
  spent: Record<GearSlot, number>;
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
  // Every re-roll, in the order made; never undone, so kept apart from the results.
  rerolls: RerollEntry[];
  // The replays drawn for each reset, by reset number; kept apart from the results, like re-rolls.
  replays: Record<number, Replays>;
  // The state before the last result: what undo returns to (FR-20). One level only.
  previous?: Snapshot;
};

export type CurrentSet = { kit: string; head: string; clothes: string; shoes: string };

// The reset a new run follows. Until the screen shows the reshuffled reset (task reshuffle-screen),
// a run started on the site keeps the earlier one, so the rules and the screen change together.
export function startRun(
  catalogue: Catalogue,
  { name, resetRule = 'in-order' }: { name: string | undefined; resetRule?: ResetRule },
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
    schema: 4,
    resetRule,
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
    worn: { head: {}, clothes: {}, shoes: {} },
    spent: { head: 0, clothes: 0, shoes: 0 },
    rerolls: [],
    replays: {},
  };
}

// The order index of the piece draw n wears in a slot: its own, unless it was re-rolled.
const wornIndex = (s: Snapshot, n: number, slot: GearSlot) => s.worn[slot][n] ?? n;

// The kit and the gear draw n is played with: the gear it was re-rolled to, if it was.
export function gearOf(s: Snapshot, n: number): CurrentSet {
  const at = (list: string[], index: number) => {
    const id = list[index];
    if (id === undefined) throw new Error(`run: no draw ${n} in this run`);
    return id;
  };
  return {
    kit: at(s.order.kits, n),
    head: at(s.order.head, wornIndex(s, n, 'head')),
    clothes: at(s.order.clothes, wornIndex(s, n, 'clothes')),
    shoes: at(s.order.shoes, wornIndex(s, n, 'shoes')),
  };
}

// The replays being played, under the reshuffle rule: those of the latest reset, while the cursor is
// still among the conquered kits.
const replaying = (s: RunState) =>
  s.resetRule === 'reshuffle' && s.phase === 'playing' && s.cursor < s.conquered
    ? s.replays[s.resets]
    : undefined;

// The draw of the kit being played: on a reshuffled replay, the one drawn for that place.
const currentDraw = (s: RunState) => replaying(s)?.draws[s.cursor] ?? s.cursor;

export function currentSet(s: RunState): CurrentSet {
  const r = replaying(s);
  if (!r) return gearOf(s, s.cursor);
  const at = (list: string[], index: number | undefined) => {
    const id = index === undefined ? undefined : list[index];
    if (id === undefined) throw new Error(`run: no replay ${s.cursor} in reset ${s.resets}`);
    return id;
  };
  return {
    kit: at(s.order.kits, r.draws[s.cursor]),
    head: at(s.order.head, r.gear.head[s.cursor]),
    clothes: at(s.order.clothes, r.gear.clothes[s.cursor]),
    shoes: at(s.order.shoes, r.gear.shoes[s.cursor]),
  };
}

// The order index of the piece the set being played wears in a slot.
const currentIndex = (s: RunState, slot: GearSlot) =>
  replaying(s)?.gear[slot][s.cursor] ?? wornIndex(s, s.cursor, slot);

function fresh(s: RunState, { step }: { step: number }): void {
  if (step !== s.step)
    throw new Error(`run: stale action for step ${step}; the run is at step ${s.step}`);
}

function snapshot(s: RunState): Snapshot {
  const {
    previous: _previous,
    log: _log,
    logSince: _logSince,
    rerolls: _rerolls,
    replays: _replays,
    ...rest
  } = s;
  void [_previous, _log, _logSince, _rerolls, _replays];
  return rest;
}

// A loss that resets a run under the reshuffle rule draws its replays, so it needs the randomness
// a run is drawn from; nothing else does.
type Result = { step: number; at: string; mode: string; source?: RandomSource };

const entry = (
  s: RunState,
  { at, mode }: Result,
  result: 'win' | 'loss',
  after: RunState,
): LogEntry => ({
  at,
  draw: currentDraw(s),
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
  return {
    ...s.previous,
    log: s.log.slice(0, -1),
    logSince: s.logSince,
    rerolls: s.rerolls,
    replays: s.replays,
    step: s.step + 1,
  };
}

// Why a re-roll of a slot is refused, or undefined when it is allowed (FR-25): on a newly drawn set,
// or a reshuffled replay, before any result for it, and only while the slot has a spare, so the run
// can always be finished (FR-13, NFR-D6). A replay of a run that follows the earlier reset keeps its
// gear. The kit is never re-rolled: it has no slot here.
export function rerollRefusal(
  s: RunState,
  slot: GearSlot,
): 'complete' | 'replay' | 'played' | 'no-spare' | undefined {
  if (s.phase !== 'playing') return 'complete';
  if (s.cursor < s.conquered) {
    if (s.resetRule === 'in-order') return 'replay';
    // A result for this replay: one since the reset, for its kit.
    const since = s.log.findLastIndex((e) => e.reset);
    const draw = currentDraw(s);
    if (s.log.slice(since + 1).some((e) => e.draw === draw)) return 'played';
  } else if (s.log.some((e) => e.draw === s.cursor)) return 'played';
  if (s.order.kits.length + s.spent[slot] >= s.order[slot].length) return 'no-spare';
  return undefined;
}

const refusals = {
  complete: 'run: no re-roll once the run is complete',
  replay: 'run: no re-roll on a replay, which keeps the gear the set was won with',
  played: 'run: no re-roll once a result is reported for the set',
  'no-spare': 'run: no spare left in this slot; the run could not be finished',
};

// Gives up the piece the set wears in a slot for the slot's next spare. The piece given up is spent:
// it is never drawn again. A re-roll cannot be undone, and it takes away the undo of the result
// before it, or undoing that result would bring the piece given up back.
export function reroll(
  s: RunState,
  action: { step: number; at: string; slot: GearSlot },
): RunState {
  fresh(s, action);
  const { slot } = action;
  const refused = rerollRefusal(s, slot);
  if (refused) throw new Error(refusals[refused]);
  const spare = s.order.kits.length + s.spent[slot];
  const { previous: _previous, ...rest } = s;
  void _previous;
  // On a replay the piece is the one dealt to it, which the next reset deals out in its stead; on a
  // new draw, the one the set wears from then on, conquest included.
  const r = replaying(s);
  const swapped = r && {
    ...s.replays,
    [s.resets]: { ...r, gear: { ...r.gear, [slot]: r.gear[slot].with(s.cursor, spare) } },
  };
  return {
    ...rest,
    ...(swapped
      ? { replays: swapped }
      : { worn: { ...s.worn, [slot]: { ...s.worn[slot], [s.cursor]: spare } } }),
    spent: { ...s.spent, [slot]: s.spent[slot] + 1 },
    rerolls: [
      ...s.rerolls,
      {
        at: action.at,
        draw: currentDraw(s),
        slot,
        from: s.order[slot][currentIndex(s, slot)] ?? '',
        to: s.order[slot][spare] ?? '',
        afterMatches: s.matches,
      },
    ],
    step: s.step + 1,
  };
}

// The replays of the reset a loss is about to cause (FR-18): the conquered kits in a new order, with
// the gear they were last won with dealt out again among them. A kit holds the gear dealt to it at
// the previous reset, re-rolls included, or else the gear it was conquered with. The draw is kept
// with the match that caused it, so the same loss reported again after undo brings it back (FR-14).
function replaysFor(s: RunState, action: Result): Replays {
  const next = s.resets + 1;
  const kept = s.replays[next];
  if (kept && kept.matches === s.matches + 1 && kept.draws.length === s.conquered) return kept;
  if (!action.source) throw new Error('run: a reset draws its replays, and needs a random source');
  const previous = s.replays[s.resets];
  const holds = (slot: GearSlot, draw: number) => {
    const place = previous?.draws.indexOf(draw) ?? -1;
    return place >= 0 ? (previous?.gear[slot][place] ?? draw) : wornIndex(s, draw, slot);
  };
  const conquered = Array.from({ length: s.conquered }, (_, n) => n);
  const deal = (slot: GearSlot) =>
    shuffle(
      conquered.map((n) => holds(slot, n)),
      action.source as RandomSource,
    );
  return {
    matches: s.matches + 1,
    draws: shuffle(conquered, action.source),
    gear: { head: deal('head'), clothes: deal('clothes'), shoes: deal('shoes') },
  };
}

// A loss costs a life and the same set is played again (FR-17). On the last life the run resets
// (FR-18): back to the first replay with 1 life, and what was conquered stays conquered. Under the
// reshuffle rule the replays are drawn for the reset; under the earlier rule they are the conquered
// sets in order, the cursor walking from 0 again, each with the gear it was won with.
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
  const replays =
    s.resetRule === 'reshuffle'
      ? { ...s.replays, [s.resets + 1]: replaysFor(s, action) }
      : s.replays;
  return recorded(s, action, 'loss', {
    ...s,
    replays,
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
