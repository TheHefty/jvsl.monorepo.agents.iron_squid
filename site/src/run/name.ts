// The run's optional display name (FR-11): at most 30 characters as the player sees them, so an
// emoji or a family of emoji is one character, as the field's counter says; and at most 300 bytes,
// so the longest name still fits in a share link (NFR-P2). One character can be any number of
// bytes, and only names heavy with emoji families or stacked accents reach that.
const MAX = 30;
export const MAX_NAME_BYTES = 300;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export type NameResult =
  | { ok: true; name: string | undefined }
  | { ok: false; reason: 'length'; length: number }
  | { ok: false; reason: 'bytes' };

export function displayName(input: string): NameResult {
  const name = input.trim();
  const length = [...segmenter.segment(name)].length;
  if (length > MAX) return { ok: false, reason: 'length', length };
  if (new TextEncoder().encode(name).length > MAX_NAME_BYTES) return { ok: false, reason: 'bytes' };
  return { ok: true, name: length === 0 ? undefined : name };
}
