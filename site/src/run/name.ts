// The run's optional display name (FR-11): at most 30 characters as the player sees them, so an
// emoji or a family of emoji is one character, as the field's counter says.
const MAX = 30;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export type NameResult = { ok: true; name: string | undefined } | { ok: false; length: number };

export function displayName(input: string): NameResult {
  const name = input.trim();
  const length = [...segmenter.segment(name)].length;
  if (length > MAX) return { ok: false, length };
  return { ok: true, name: length === 0 ? undefined : name };
}
