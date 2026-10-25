// Reads a run from outside the engine — storage, an imported file — and refuses anything that is
// not a run this site can play: an unknown format is never guessed into the current one, so a run
// saved by an older or newer site is reported, not corrupted.
import { gearSlots, type Catalogue } from '../catalogue/types';
import type { RunState } from './engine';
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

function state(
  v: unknown,
  catalogues: Record<string, Catalogue>,
  nested: boolean,
): Omit<RunState, 'previous'> {
  if (!isObject(v)) throw new Refused('not-a-run', 'the run is not an object');
  if (v.schema !== 1) {
    if (nested) throw new Refused('not-a-run', 'the previous state is not format 1');
    throw new Refused(
      'unknown-schema',
      `the run is in format ${String(v.schema)}; this site reads format 1`,
    );
  }
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
    if (!checked?.ok || checked.name !== v.name)
      throw new Refused('not-a-run', 'the name is not a valid display name');
    name = checked.name;
  }
  return {
    schema: 1,
    catalogueVersion: catalogue.version,
    ...(name === undefined ? {} : { name }),
    startedAt: v.startedAt,
    order: { kits, ...gear },
    conquered,
    cursor,
    phase: v.phase,
    lives: count(v.lives, 'lives'),
    winsSinceReset: count(v.winsSinceReset, 'winsSinceReset'),
    resets: count(v.resets, 'resets'),
    matches: count(v.matches, 'matches'),
    step: count(v.step, 'step'),
  };
}

// A broken previous state is a corrupted run, whatever is wrong with it.
function previousState(v: unknown, catalogues: Record<string, Catalogue>) {
  try {
    return state(v, catalogues, true);
  } catch (e) {
    if (e instanceof Refused) throw new Refused('not-a-run', `the previous state: ${e.message}`);
    throw e;
  }
}

export function parseRun(input: unknown, catalogues: Record<string, Catalogue>): ParseResult {
  try {
    const run = state(input, catalogues, false);
    const previous =
      isObject(input) && input.previous !== undefined
        ? previousState(input.previous, catalogues)
        : undefined;
    return { ok: true, state: previous ? { ...run, previous } : run };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, reason: e.reason, detail: e.message };
    throw e;
  }
}
