// Reads a run from outside the engine — storage, an imported file — and refuses anything that is
// not a run this site can play: an unknown format is never guessed into the current one, so a run
// saved by an older or newer site is reported, not corrupted.
import { gearSlots, type Catalogue, type GearSlot } from '../catalogue/types';
import type { LogEntry, Redraw, RerollEntry, Replays, RunState, Snapshot } from './engine';
import { displayName } from './name';

export type ParseResult =
  | { ok: true; state: RunState }
  | { ok: false; reason: 'not-a-run' | 'unknown-schema' | 'unknown-catalogue'; detail: string };

class Refused extends Error {
  constructor(
    readonly reason: 'not-a-run' | 'unknown-schema' | 'unknown-catalogue',
    detail: string,
  ) {
    super(detail);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown, name: string, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max)
    throw new Refused('not-a-run', `${name} is not a count`);
  return v as number;
};
const permutation = (v: unknown, of: string[], name: string) => {
  if (
    !Array.isArray(v) ||
    v.length !== of.length ||
    [...v].sort().join('\n') !== [...of].sort().join('\n')
  ) {
    throw new Refused('not-a-run', `${name} is not the catalogue drawn once`);
  }
  return v as string[];
};

type Schema = 1 | 2 | 3 | 4 | 5;

function state(v: unknown, catalogues: Record<string, Catalogue>, schema: Schema): Snapshot {
  if (!isObject(v)) throw new Refused('not-a-run', 'the run is not an object');
  if (v.schema !== schema)
    throw new Refused('not-a-run', `the previous state is not format ${schema}`);
  const version = v.catalogueVersion;
  const catalogue = typeof version === 'string' ? catalogues[version] : undefined;
  if (!catalogue)
    throw new Refused('unknown-catalogue', `the run needs catalogue ${String(version)}`);
  if (!isObject(v.order)) throw new Refused('not-a-run', 'the run has no order');
  const kits = permutation(
    v.order.kits,
    catalogue.kits.map((k) => k.id),
    'order.kits',
  );
  const gear = Object.fromEntries(
    gearSlots.map((slot) => [
      slot,
      permutation(
        (v.order as Record<string, unknown>)[slot],
        catalogue.gear[slot].map((g) => g.id),
        `order.${slot}`,
      ),
    ]),
  ) as Record<(typeof gearSlots)[number], string[]>;
  const conquered = count(v.conquered, 'conquered', kits.length);
  const cursor = count(v.cursor, 'cursor', kits.length - 1);
  if (cursor > conquered)
    throw new Refused('not-a-run', 'the cursor is ahead of the conquered kits');
  if (v.phase !== 'playing' && v.phase !== 'conquered')
    throw new Refused('not-a-run', 'the phase is unknown');
  if (typeof v.startedAt !== 'string') throw new Refused('not-a-run', 'the run has no start date');
  let name: string | undefined;
  if (v.name !== undefined) {
    const checked = typeof v.name === 'string' ? displayName(v.name) : undefined;
    // A name over the byte cap was allowed before the cap existed; such a run stays readable.
    const valid = checked?.ok
      ? checked.name === v.name
      : checked?.reason === 'bytes' && v.name === (v.name as string).trim();
    if (!valid) throw new Refused('not-a-run', 'the name is not a valid display name');
    name = v.name as string;
  }
  // Before match-modes a win stayed on show until the player asked for the next set. Such a run
  // loads on that next set, which its order already holds: nothing is drawn (failure 2).
  const left = v.phase === 'conquered' && conquered < kits.length;
  // Re-rolls (format 3): each slot's spares are the pieces past the kits in its order. A run from
  // before them has none.
  const { worn, spent } =
    schema >= 3 ? rerolled(v, kits.length, gear) : { worn: noneWorn(), spent: noneSpent() };
  // The reset a run follows (format 4). A run saved before keeps the earlier one: it was begun
  // under it, and finishes under it (FR-18).
  // Format 5 adds the restart rule.
  const rules = schema >= 5 ? ['restart', 'reshuffle', 'in-order'] : ['reshuffle', 'in-order'];
  if (schema >= 4 && !rules.includes(v.resetRule as string))
    throw new Refused('not-a-run', 'the reset rule is unknown');
  const resetRule = schema >= 4 ? (v.resetRule as Snapshot['resetRule']) : 'in-order';
  return {
    schema: 5,
    resetRule,
    catalogueVersion: catalogue.version,
    ...(name === undefined ? {} : { name }),
    startedAt: v.startedAt,
    order: { kits, ...gear },
    conquered,
    cursor: left ? cursor + 1 : cursor,
    phase: left ? 'playing' : v.phase,
    lives: count(v.lives, 'lives'),
    winsSinceReset: count(v.winsSinceReset, 'winsSinceReset'),
    resets: count(v.resets, 'resets'),
    matches: count(v.matches, 'matches'),
    step: count(v.step, 'step'),
    worn,
    spent,
  };
}

const noneWorn = (): Snapshot['worn'] => ({ head: {}, clothes: {}, shoes: {} });
const noneSpent = (): Snapshot['spent'] => ({ head: 0, clothes: 0, shoes: 0 });

// Which spare each re-rolled draw wears, and how many each slot has given: a draw that exists, a
// spare already given, never one given twice, and never more than the slot has (FR-25).
function rerolled(v: Record<string, unknown>, kits: number, gear: Record<GearSlot, string[]>) {
  const wornIn: unknown = v.worn;
  const spentIn: unknown = v.spent;
  if (!isObject(wornIn) || !isObject(spentIn))
    throw new Refused('not-a-run', 'the run has no re-rolls');
  const worn = noneWorn();
  const spent = noneSpent();
  for (const slot of gearSlots) {
    spent[slot] = count(spentIn[slot], `spent.${slot}`, gear[slot].length - kits);
    const bySlot: unknown = wornIn[slot];
    if (!isObject(bySlot)) throw new Refused('not-a-run', `worn.${slot} is not a map`);
    const given = new Set<number>();
    for (const [key, value] of Object.entries(bySlot) as [string, unknown][]) {
      const draw = Number(key);
      if (!Number.isInteger(draw) || String(draw) !== key || draw < 0 || draw >= kits)
        throw new Refused('not-a-run', `worn.${slot} names no draw ${key}`);
      const index = count(value, `worn.${slot}.${key}`);
      if (index < kits || index >= kits + spent[slot] || given.has(index))
        throw new Refused('not-a-run', `worn.${slot}.${key} is not a spare given`);
      given.add(index);
      worn[slot][draw] = index;
    }
  }
  return { worn, spent };
}

// The replays of each reset (format 4): for reset r, a kit drawn at most once and only among the
// conquered ones, and per slot one piece for each, never the same twice, and only a piece the run
// has used: one of the kits' own or a spare already given. Anything else is a run that cannot be.
function replayEntries(v: unknown, core: Snapshot): Record<number, Replays> {
  if (!isObject(v)) throw new Refused('not-a-run', 'the run has no replays');
  const kits = core.order.kits.length;
  const out: Record<number, Replays> = {};
  for (const [key, value] of Object.entries(v) as [string, unknown][]) {
    const reset = Number(key);
    const bad = () => new Refused('not-a-run', `the replays of reset ${key} cannot be`);
    if (!Number.isInteger(reset) || String(reset) !== key || reset < 1 || reset > core.resets + 1)
      throw bad();
    if (!isObject(value) || !Array.isArray(value.draws) || !isObject(value.gear)) throw bad();
    const draws = value.draws.map((d) => count(d, `replays ${key} draw`, kits - 1));
    if (draws.length > core.conquered + 1 || new Set(draws).size !== draws.length) throw bad();
    const gear = {} as Replays['gear'];
    for (const slot of gearSlots) {
      const list: unknown = (value.gear as Record<string, unknown>)[slot];
      if (!Array.isArray(list) || list.length !== draws.length) throw bad();
      const used = kits + core.spent[slot];
      gear[slot] = list.map((i) => count(i, `replays ${key} ${slot}`, used - 1));
      if (new Set(gear[slot]).size !== gear[slot].length) throw bad();
    }
    out[reset] = {
      matches: count(value.matches, `replays ${key} match`, core.matches + 1),
      draws,
      gear,
    };
  }
  if (core.resetRule === 'reshuffle' && core.resets > 0 && !out[core.resets])
    throw new Refused('not-a-run', 'the run has no replays for its last reset');
  return out;
}

// The new draw of each reset that started over (format 5): every list of the catalogue drawn once, by
// reset number, kept with the match that caused it.
function redrawEntries(
  v: unknown,
  core: Snapshot,
  catalogue: Catalogue | undefined,
): Record<number, Redraw> {
  if (!isObject(v)) throw new Refused('not-a-run', 'the run has no redraws');
  const out: Record<number, Redraw> = {};
  for (const [key, value] of Object.entries(v) as [string, unknown][]) {
    const reset = Number(key);
    if (!Number.isInteger(reset) || String(reset) !== key || reset < 1 || reset > core.resets + 1)
      throw new Refused('not-a-run', `the redraw of reset ${key} cannot be`);
    if (!isObject(value) || !isObject(value.order) || !catalogue)
      throw new Refused('not-a-run', `the redraw of reset ${key} cannot be`);
    const order = value.order;
    out[reset] = {
      matches: count(value.matches, `redraw ${key} match`, core.matches + 1),
      order: {
        kits: permutation(
          order.kits,
          catalogue.kits.map((k) => k.id),
          `redraw ${key} kits`,
        ),
        head: permutation(
          order.head,
          catalogue.gear.head.map((g) => g.id),
          `redraw ${key} head`,
        ),
        clothes: permutation(
          order.clothes,
          catalogue.gear.clothes.map((g) => g.id),
          `redraw ${key} clothes`,
        ),
        shoes: permutation(
          order.shoes,
          catalogue.gear.shoes.map((g) => g.id),
          `redraw ${key} shoes`,
        ),
      },
    };
  }
  return out;
}

// The re-rolls a run records: one per spare given, each naming pieces of its slot.
function rerollEntries(
  v: unknown,
  core: Snapshot,
  catalogue: Catalogue | undefined,
): RerollEntry[] {
  const total = gearSlots.reduce((n, slot) => n + core.spent[slot], 0);
  // A reset that starts over gives every spare back: only the re-rolls since it are spares spent.
  const sinceReset = (list: unknown[]) =>
    core.resetRule === 'restart'
      ? list.filter((e) => isObject(e) && (e.reset ?? 0) === core.resets).length
      : list.length;
  if (!Array.isArray(v) || sinceReset(v) !== total)
    throw new Refused('not-a-run', 'the re-rolls do not match the spares given');
  return v.map((e: unknown, i) => {
    const bad = () => new Refused('not-a-run', `re-roll ${i} is not a re-roll`);
    if (!isObject(e) || typeof e.at !== 'string') throw bad();
    const slot = gearSlots.find((g) => g === e.slot);
    if (!slot) throw bad();
    const ids = new Set(catalogue?.gear[slot].map((g) => g.id));
    if (
      typeof e.from !== 'string' ||
      typeof e.to !== 'string' ||
      !ids.has(e.from) ||
      !ids.has(e.to)
    )
      throw bad();
    return {
      at: e.at,
      draw: count(e.draw, `re-roll ${i} draw`, core.order.kits.length - 1),
      slot,
      from: e.from,
      to: e.to,
      afterMatches: count(e.afterMatches, `re-roll ${i} matches`, core.matches),
      ...(e.reset === undefined
        ? {}
        : { reset: count(e.reset, `re-roll ${i} reset`, core.resets) }),
    };
  });
}

// A broken previous state is a corrupted run, whatever is wrong with it.
function previousState(v: unknown, catalogues: Record<string, Catalogue>, schema: Schema) {
  try {
    return state(v, catalogues, schema);
  } catch (e) {
    if (e instanceof Refused) throw new Refused('not-a-run', `the previous state: ${e.message}`);
    throw e;
  }
}

function logEntries(
  v: unknown,
  draws: number,
  matches: number,
  modes: string[],
  kits: string[],
): LogEntry[] {
  if (!Array.isArray(v) || v.length > matches)
    throw new Refused('not-a-run', 'the log is not a log');
  return v.map((e: unknown, i) => {
    const bad = () => new Refused('not-a-run', `log entry ${i} is not a result`);
    if (!isObject(e)) throw bad();
    const draw = count(e.draw, `log entry ${i} draw`, draws - 1);
    const livesAfter = count(e.livesAfter, `log entry ${i} lives`);
    const conqueredAfter = count(e.conqueredAfter, `log entry ${i} conquered`, draws);
    if (typeof e.at !== 'string' || (e.result !== 'win' && e.result !== 'loss')) throw bad();
    if (typeof e.replay !== 'boolean' || typeof e.reset !== 'boolean' || livesAfter < 1)
      throw bad();
    // No mode is a result from before modes were recorded; a mode is one of the catalogue's.
    if (e.mode !== undefined && !(typeof e.mode === 'string' && modes.includes(e.mode)))
      throw new Refused('not-a-run', `log entry ${i} names a mode the catalogue does not have`);
    // The kit it was played with (format 5), one of the catalogue's.
    if (e.kit !== undefined && !(typeof e.kit === 'string' && kits.includes(e.kit)))
      throw new Refused('not-a-run', `log entry ${i} names a kit the catalogue does not have`);
    return {
      at: e.at,
      draw,
      ...(e.kit === undefined ? {} : { kit: e.kit }),
      result: e.result,
      ...(e.mode === undefined ? {} : { mode: e.mode }),
      livesAfter,
      conqueredAfter,
      replay: e.replay,
      reset: e.reset,
    };
  });
}

// Formats 1, 2 and 3 are read; format 3 adds the re-rolls, which a run from before has none of.
// Format 1 has no log: it is migrated, explicitly, to the current format with an
// empty log complete from `now`, the day it was read; nothing is invented for the matches before.
export function parseRun(
  input: unknown,
  catalogues: Record<string, Catalogue>,
  now: string = new Date().toISOString(),
): ParseResult {
  try {
    if (!isObject(input)) throw new Refused('not-a-run', 'the run is not an object');
    const schema = input.schema;
    if (schema !== 1 && schema !== 2 && schema !== 3 && schema !== 4 && schema !== 5) {
      throw new Refused(
        'unknown-schema',
        `the run is in format ${String(schema)}; this site reads formats 1 to 5`,
      );
    }
    const core = state(input, catalogues, schema);
    let log: LogEntry[] = [];
    let logSince = now;
    if (schema !== 1) {
      log = logEntries(
        input.log,
        core.order.kits.length,
        core.matches,
        catalogues[core.catalogueVersion]?.modes.map((m) => m.id) ?? [],
        core.order.kits,
      );
      if (typeof input.logSince !== 'string')
        throw new Refused('not-a-run', 'the run has no log date');
      logSince = input.logSince;
    }
    const previous =
      input.previous !== undefined ? previousState(input.previous, catalogues, schema) : undefined;
    const rerolls =
      schema >= 3 ? rerollEntries(input.rerolls, core, catalogues[core.catalogueVersion]) : [];
    const replays = schema >= 4 ? replayEntries(input.replays, core) : {};
    const redraws =
      schema >= 5 ? redrawEntries(input.redraws, core, catalogues[core.catalogueVersion]) : {};
    const run: RunState = { ...core, log, logSince, rerolls, replays, redraws };
    return { ok: true, state: previous ? { ...run, previous } : run };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.reason, detail: e.message };
    throw e;
  }
}
