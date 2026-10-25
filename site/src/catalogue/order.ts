import { createHash } from 'node:crypto';
import { gearSlots, type Catalogue } from './types';

// The digest of a catalogue's items in order, kits then each gear slot. Names are left out: they
// may be added or corrected for a published version, but its order never changes.
export function catalogueOrderDigest(c: Catalogue): string {
  const ids = [c.kits, ...gearSlots.map((s) => c.gear[s])].map((items) => items.map((i) => i.id));
  return createHash('sha256').update(JSON.stringify(ids)).digest('hex');
}
