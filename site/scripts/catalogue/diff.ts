// What moving the datamine pin changes, so a game update reaches the site as something a reviewer
// can read, and a removed id, which a run in progress may hold, is never dropped unnoticed.
import { gearSlots, type Catalogue } from '../../src/catalogue/types';

type Change = { added: string[]; removed: string[] };
export type CatalogueDiff = Record<'kits' | (typeof gearSlots)[number] | 'modes', Change>;

const change = (before: { id: string }[], after: { id: string }[]): Change => {
  const was = new Set(before.map((i) => i.id));
  const is = new Set(after.map((i) => i.id));
  return {
    added: after.map((i) => i.id).filter((id) => !was.has(id)),
    removed: before.map((i) => i.id).filter((id) => !is.has(id)),
  };
};

export function diffCatalogues(before: Catalogue, after: Catalogue): CatalogueDiff {
  return {
    kits: change(before.kits, after.kits),
    head: change(before.gear.head, after.gear.head),
    clothes: change(before.gear.clothes, after.gear.clothes),
    shoes: change(before.gear.shoes, after.gear.shoes),
    modes: change(before.modes ?? [], after.modes ?? []),
  };
}

export function describeDiff(diff: CatalogueDiff): string {
  const lines = Object.entries(diff).flatMap(([kind, { added, removed }]) => {
    const parts = [
      ...(added.length ? [`+${added.length} (${added.join(', ')})`] : []),
      ...(removed.length ? [`-${removed.length} (${removed.join(', ')})`] : []),
    ];
    return parts.length ? [`${kind}: ${parts.join(', ')}`] : [];
  });
  return lines.length ? lines.join('\n') : 'no kits or gear added or removed';
}

export const removedIds = (diff: CatalogueDiff) => Object.values(diff).flatMap((c) => c.removed);
