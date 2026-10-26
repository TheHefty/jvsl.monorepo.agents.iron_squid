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
// resets, how many gear pieces the run re-rolled away. Formats 1 and 2 are still read, forever:
// links made before are in posts and messages that cannot be edited.
import { gearSlots, type Catalogue } from '../catalogue/types';
import { gearOf, type CurrentSet, type RunState } from '../run/engine';
import { displayName } from '../run/name';

const FORMAT = 3;
type Format = 1 | 2 | 3;
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
};

// A conquered set, with the mode it was conquered in when there is one.
export type SharedSet = CurrentSet & { mode?: string };

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
};

const lists = (c: Catalogue) => [c.kits, c.gear.head, c.gear.clothes, c.gear.shoes];
const widthOf = (n: number) => Math.max(1, Math.ceil(Math.log2(n)));

// How many bits each field of a set takes in a link on that catalogue: the four places, and in
// format 2 the mode, which also has "none".
export const widthsOf = (c: Catalogue, format: Format = FORMAT) => [
  ...lists(c).map((l) => widthOf(l.length)),
  ...(format >= 2 ? [widthOf(c.modes.length + 1)] : []),
];

// The mode a set was conquered in: that of the win on its draw that was not a replay. A replay won
// since does not change it, and a conquest from before modes has none.
const conquestMode = (state: RunState, draw: number) =>
  state.log.find((e) => e.draw === draw && e.result === 'win' && !e.replay)?.mode;

export function encodeShare(state: RunState, catalogue: Catalogue): string {
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
  return packShare(
    {
      version: catalogue.version,
      // A name over the byte cap, stored before the cap existed, is left out of the link.
      name: displayName(state.name ?? '').ok ? name : new Uint8Array(),
      conquered: state.conquered,
      lives: state.lives,
      resets: state.resets,
      rerolls: state.rerolls.length,
      sets,
    },
    widthsOf(catalogue),
  );
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
  if (format === 3) varint(p.rerolls ?? 0);
  let acc = 0;
  let filled = 0;
  for (const set of p.sets) {
    set.forEach((value, i) => {
      const width = widths[i] ?? 8;
      for (let bit = width - 1; bit >= 0; bit--) {
        acc = (acc << 1) | ((value >> bit) & 1);
        if (++filled === 8) {
          bytes.push(acc);
          acc = 0;
          filled = 0;
        }
      }
    });
  }
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
  if (format !== 1 && format !== 2 && format !== 3) throw new Broken();
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
  const rerolls = format === 3 ? varint() : 0;
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
  const bitsNeeded = conquered * widths.reduce((a, b) => a + b, 0);
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
    },
  };
}
