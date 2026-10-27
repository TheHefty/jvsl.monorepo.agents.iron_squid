// The share link (FR-40, FR-43, NFR-P2): what a shared run shows, packed into the link's fragment,
// and read back with every check a link from anyone needs (FR-44).
//
// Format 1, as bytes in base64url without padding:
//   1 · version (length, ASCII) · name (length, UTF-8) · conquered · lives · resets
// as unsigned varints, then for each conquered set its kit, head, clothes and shoes as their places
// in that catalogue version's lists, packed in as many bits as each list needs. Only what a shared
// run shows is carried: never the sets not yet played, the log or the undo state.
//
// Format 2 (share-mode) is format 1 with one more field per set: the mode it was conquered in, 0
// when none was recorded and then the catalogue's modes from 1. Format 3 (share-rerolls) adds, after
// resets, how many gear pieces the run re-rolled away. Format 4 (share-log-codec) adds the run log
// (FR-45): after the re-rolls, how many earlier matches it leaves out and how many it carries; after
// the sets, for each match carried, oldest first, a bit for a win, its mode (0 when none was
// recorded), its kit's place in the catalogue, and a bit each for a replay and for a reset. Never a
// date. Formats 1 to 3 are still read, forever, with no log: links made before are in posts and
// messages that cannot be edited.
import { gearSlots, type Catalogue } from '../catalogue/types';
import { gearOf, type CurrentSet, type RunState } from '../run/engine';
import { displayName } from '../run/name';

const FORMAT = 4;
type Format = 1 | 2 | 3 | 4;
// The characters a link's fragment may take: NFR-P2's 2,000 less the address before the '#', which
// is at most 100 (origin, base path, locale and '/run/#').
export const FRAGMENT_BUDGET = 1900;
const slots = ['kits', ...gearSlots] as const;

export type SharedRun = {
  catalogueVersion: string;
  name?: string;
  conquered: number;
  total: number;
  lives: number;
  resets: number;
  // Gear pieces re-rolled away (FR-25); none in a link made before re-rolls.
  rerolls: number;
  complete: boolean;
  sets: SharedSet[];
  // The run log, oldest first, and how many earlier matches the link leaves out (FR-45); no log in a
  // link made before it was shared. The longest winning streak is over the matches carried (FR-46).
  log?: SharedMatch[];
  logOmitted: number;
  longestStreak?: number;
};

// A conquered set, with the mode it was conquered in when there is one.
export type SharedSet = CurrentSet & { mode?: string };

// A match of a shared log: no date, ever.
export type SharedMatch = {
  result: 'win' | 'loss';
  kit: string;
  mode?: string;
  replay: boolean;
  reset: boolean;
};

export type ShareResult =
  | { ok: true; run: SharedRun }
  | { ok: false; reason: 'broken' }
  | { ok: false; reason: 'unknown-catalogue'; version: string };

// The link's fields as numbers and bytes, before any check: what packShare writes.
export type Packed = {
  version: string;
  name: Uint8Array;
  conquered: number;
  lives: number;
  resets: number;
  rerolls?: number;
  sets: number[][];
  // Each match as [win 1 or loss 0, mode index or 0, kit place, replay 1/0, reset 1/0].
  log?: { omitted: number; matches: number[][] };
};

const lists = (c: Catalogue) => [c.kits, c.gear.head, c.gear.clothes, c.gear.shoes];
const widthOf = (n: number) => Math.max(1, Math.ceil(Math.log2(n)));

// How many bits each field of a set takes in a link on that catalogue: the four places, and in
// format 2 the mode, which also has "none".
export const widthsOf = (c: Catalogue, format: Format = FORMAT) => [
  ...lists(c).map((l) => widthOf(l.length)),
  ...(format >= 2 ? [widthOf(c.modes.length + 1)] : []),
];

// How many bits each field of a match of the log takes (format 4).
const matchWidths = (c: Catalogue) => [
  1,
  widthOf(c.modes.length + 1),
  widthOf(c.kits.length),
  1,
  1,
];

// The longest run of wins with no loss between them, replays included (FR-46).
export function longestStreak(matches: { result: 'win' | 'loss' }[]): number {
  let best = 0;
  let current = 0;
  for (const m of matches) {
    current = m.result === 'win' ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

// The mode a set was conquered in: that of the win on its draw that was not a replay. A replay won
// since does not change it, and a conquest from before modes has none.
// Under the restart rule only the matches since the last reset count: a reset draws a new order, and
// a draw before it was another kit.
function conquestMode(state: RunState, draw: number) {
  const since = state.resetRule === 'restart' ? state.log.findLastIndex((e) => e.reset) + 1 : 0;
  return state.log.slice(since).find((e) => e.draw === draw && e.result === 'win' && !e.replay)
    ?.mode;
}

export function encodeShare(
  state: RunState,
  catalogue: Catalogue,
  budget: number = FRAGMENT_BUDGET,
): string {
  const places = lists(catalogue).map((items) => new Map(items.map((item, i) => [item.id, i])));
  const modes = catalogue.modes.map((m) => m.id);
  const name = new TextEncoder().encode(state.name ?? '');
  const sets = Array.from({ length: state.conquered }, (_, n) => [
    ...slots.map((slot, i) => {
      // The gear the set was played with, re-rolls included (FR-25).
      const worn = gearOf(state, n);
      const id = slot === 'kits' ? worn.kit : worn[slot];
      const place = places[i]?.get(id);
      if (place === undefined)
        throw new Error(`share: ${id} is not in catalogue ${catalogue.version}`);
      return place;
    }),
    modes.indexOf(conquestMode(state, n) ?? '') + 1,
  ]);
  const kitPlaces = places[0];
  const matches = state.log.map((e) => [
    e.result === 'win' ? 1 : 0,
    modes.indexOf(e.mode ?? '') + 1,
    // The kit the entry names (format 5); before, its draw in an order no reset has replaced.
    kitPlaces?.get(e.kit ?? state.order.kits[e.draw] ?? '') ?? 0,
    e.replay ? 1 : 0,
    e.reset ? 1 : 0,
  ]);
  const pack = (carried: number) =>
    packShare(
      {
        version: catalogue.version,
        // A name over the byte cap, stored before the cap existed, is left out of the link.
        name: displayName(state.name ?? '').ok ? name : new Uint8Array(),
        conquered: state.conquered,
        lives: state.lives,
        resets: state.resets,
        rerolls: state.rerolls.length,
        sets,
        log: {
          omitted: state.matches - carried,
          matches: matches.slice(matches.length - carried),
        },
      },
      widthsOf(catalogue),
    );
  // As many of the most recent matches as fit (FR-45): the longest link that is within budget.
  let fits = 0;
  let over = matches.length + 1;
  if (pack(matches.length).length <= budget) return pack(matches.length);
  while (over - fits > 1) {
    const mid = Math.floor((fits + over) / 2);
    if (pack(mid).length <= budget) fits = mid;
    else over = mid;
  }
  return pack(fits);
}

// Writes the fields as they are, checking nothing.
export function packShare(p: Packed, widths: number[], format: Format = FORMAT): string {
  const bytes: number[] = [format];
  const varint = (n: number) => {
    do {
      bytes.push((n & 0x7f) | (n > 0x7f ? 0x80 : 0));
      n >>>= 7;
    } while (n > 0);
  };
  const ascii = new TextEncoder().encode(p.version);
  varint(ascii.length);
  bytes.push(...ascii);
  varint(p.name.length);
  bytes.push(...p.name);
  varint(p.conquered);
  varint(p.lives);
  varint(p.resets);
  if (format >= 3) varint(p.rerolls ?? 0);
  if (format >= 4) {
    varint(p.log?.omitted ?? 0);
    varint(p.log?.matches.length ?? 0);
  }
  let acc = 0;
  let filled = 0;
  const write = (value: number, width: number) => {
    for (let bit = width - 1; bit >= 0; bit--) {
      acc = (acc << 1) | ((value >> bit) & 1);
      if (++filled === 8) {
        bytes.push(acc);
        acc = 0;
        filled = 0;
      }
    }
  };
  for (const set of p.sets) set.forEach((value, i) => write(value, widths[i] ?? 8));
  // The log's widths follow from the sets': the mode's is the sets' last, the kit's their first.
  const logWidths = [1, widths[4] ?? 3, widths[0] ?? 8, 1, 1];
  if (format >= 4)
    for (const match of p.log?.matches ?? [])
      match.forEach((value, i) => write(value, logWidths[i] ?? 1));
  if (filled > 0) bytes.push(acc << (8 - filled));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

class Broken extends Error {}

export function decodeShare(text: string, catalogues: Record<string, Catalogue>): ShareResult {
  try {
    return read(text, catalogues);
  } catch (e) {
    if (e instanceof Broken) return { ok: false, reason: 'broken' };
    throw e;
  }
}

function read(text: string, catalogues: Record<string, Catalogue>): ShareResult {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) throw new Broken();
  const bytes = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
  let at = 0;
  const byte = () => {
    const b = bytes[at++];
    if (b === undefined) throw new Broken();
    return b;
  };
  const varint = () => {
    let n = 0;
    for (let shift = 0; shift < 28; shift += 7) {
      const b = byte();
      n |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return n;
    }
    throw new Broken();
  };
  const take = (n: number) => {
    if (at + n > bytes.length) throw new Broken();
    at += n;
    return bytes.slice(at - n, at);
  };

  const format = byte();
  if (format !== 1 && format !== 2 && format !== 3 && format !== 4) throw new Broken();
  const version = String.fromCharCode(...take(varint()));
  if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)) throw new Broken();
  let name: string;
  try {
    name = new TextDecoder('utf-8', { fatal: true }).decode(take(varint()));
  } catch {
    throw new Broken();
  }
  const checked = displayName(name);
  if (!checked.ok || (checked.name ?? '') !== name) throw new Broken();
  const conquered = varint();
  const lives = varint();
  const resets = varint();
  const rerolls = format >= 3 ? varint() : 0;
  const omitted = format >= 4 ? varint() : 0;
  const carried = format >= 4 ? varint() : 0;
  const catalogue = catalogues[version];
  if (!catalogue) return { ok: false, reason: 'unknown-catalogue', version };
  const items = lists(catalogue);
  const widths = widthsOf(catalogue, format);
  const modes = catalogue.modes;
  if (lives < 1 || conquered > catalogue.kits.length) throw new Broken();
  // A re-roll spends a spare, the pieces past the kits in a slot: no run has more re-rolls.
  const spares = [catalogue.gear.head, catalogue.gear.clothes, catalogue.gear.shoes].reduce(
    (n, list) => n + Math.max(0, list.length - catalogue.kits.length),
    0,
  );
  if (rerolls > spares) throw new Broken();

  // The sets: exactly the bits they need, then nothing but the zero bits that pad the last byte.
  const logWidths = matchWidths(catalogue);
  const bitsNeeded =
    conquered * widths.reduce((a, b) => a + b, 0) + carried * logWidths.reduce((a, b) => a + b, 0);
  if (bytes.length - at !== Math.ceil(bitsNeeded / 8)) throw new Broken();
  let bit = 0;
  const readBits = (width: number) => {
    let n = 0;
    for (let i = 0; i < width; i++, bit++) {
      n = (n << 1) | (((bytes[at + (bit >> 3)] ?? 0) >> (7 - (bit & 7))) & 1);
    }
    return n;
  };
  const seen = items.map(() => new Set<number>());
  const sets: SharedSet[] = [];
  for (let n = 0; n < conquered; n++) {
    const ids = items.map((list, i) => {
      const place = readBits(widths[i] ?? 0);
      const item = list[place];
      const used = seen[i];
      if (!item || !used || used.has(place)) throw new Broken();
      used.add(place);
      return item.id;
    });
    const [kit = '', head = '', clothes = '', shoes = ''] = ids;
    let mode: string | undefined;
    if (format >= 2) {
      const index = readBits(widths[4] ?? 0);
      if (index > modes.length) throw new Broken();
      mode = modes[index - 1]?.id;
    }
    sets.push({ kit, head, clothes, shoes, ...(mode ? { mode } : {}) });
  }
  // The log: a mode the catalogue has or none, and a kit of the catalogue.
  const log: SharedMatch[] = [];
  for (let n = 0; n < carried; n++) {
    const [win, modeIndex, place, replay, reset] = logWidths.map((w) => readBits(w));
    const kit = catalogue.kits[place ?? -1]?.id;
    if (!kit || (modeIndex ?? 0) > modes.length) throw new Broken();
    const mode = modes[(modeIndex ?? 0) - 1]?.id;
    log.push({
      result: win ? 'win' : 'loss',
      kit,
      ...(mode ? { mode } : {}),
      replay: replay === 1,
      reset: reset === 1,
    });
  }
  if (bit < (bytes.length - at) * 8 && readBits((bytes.length - at) * 8 - bit) !== 0)
    throw new Broken();

  return {
    ok: true,
    run: {
      catalogueVersion: version,
      ...(name ? { name } : {}),
      conquered,
      total: catalogue.kits.length,
      lives,
      resets,
      rerolls,
      complete: conquered === catalogue.kits.length,
      sets,
      logOmitted: omitted,
      ...(format >= 4 ? { log, longestStreak: longestStreak(log) } : {}),
    },
  };
}
