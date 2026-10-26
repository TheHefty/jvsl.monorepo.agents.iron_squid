// Reads a run from outside the engine — storage, an imported file — and refuses anything that is
// not a run this site can play: an unknown format is never guessed into the current one, so a run
// saved by an older or newer site is reported, not corrupted.
import { gearSlots, type Catalogue } from '../catalogue/types';
import type { LogEntry, RunState, Snapshot } from './engine';
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

function state(v: unknown, catalogues: Record<string, Catalogue>, schema: 1 | 2): Snapshot {
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
  return {
    schema: 2,
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
  };
}

// A broken previous state is a corrupted run, whatever is wrong with it.
function previousState(v: unknown, catalogues: Record<string, Catalogue>, schema: 1 | 2) {
  try {
    return state(v, catalogues, schema);
  } catch (e) {
    if (e instanceof Refused) throw new Refused('not-a-run', `the previous state: ${e.message}`);
    throw e;
  }
}

function logEntries(v: unknown, draws: number, matches: number, modes: string[]): LogEntry[] {
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
    return {
      at: e.at,
      draw,
      result: e.result,
      ...(e.mode === undefined ? {} : { mode: e.mode }),
      livesAfter,
      conqueredAfter,
      replay: e.replay,
      reset: e.reset,
    };
  });
}

// Formats 1 and 2 are read. Format 1 has no log: it is migrated, explicitly, to format 2 with an
// empty log complete from `now`, the day it was read; nothing is invented for the matches before.
export function parseRun(
  input: unknown,
  catalogues: Record<string, Catalogue>,
  now: string = new Date().toISOString(),
): ParseResult {
  try {
    if (!isObject(input)) throw new Refused('not-a-run', 'the run is not an object');
    const schema = input.schema;
    if (schema !== 1 && schema !== 2) {
      throw new Refused(
        'unknown-schema',
        `the run is in format ${String(schema)}; this site reads formats 1 and 2`,
      );
    }
    const core = state(input, catalogues, schema);
    let log: LogEntry[] = [];
    let logSince = now;
    if (schema === 2) {
      log = logEntries(
        input.log,
        core.order.kits.length,
        core.matches,
        catalogues[core.catalogueVersion]?.modes.map((m) => m.id) ?? [],
      );
      if (typeof input.logSince !== 'string')
        throw new Refused('not-a-run', 'the run has no log date');
      logSince = input.logSince;
    }
    const previous =
      input.previous !== undefined ? previousState(input.previous, catalogues, schema) : undefined;
    const run: RunState = { ...core, log, logSince };
    return { ok: true, state: previous ? { ...run, previous } : run };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.reason, detail: e.message };
    throw e;
  }
}
