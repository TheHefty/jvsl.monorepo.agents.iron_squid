// The randomness a run is drawn from. Never Math.random: the draw is the challenge, and it has to be
// unpredictable and fair (FR-12). The source is injectable so tests can drive it.
export type RandomSource = (buffer: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

export const cryptoSource: RandomSource = (buffer) => crypto.getRandomValues(buffer);

const RANGE = 2 ** 32;

// A uniform integer in [0, n). Values from the top of the 32-bit range that would make the low
// results likelier are thrown away and drawn again (rejection sampling), so there is no modulo bias.
export function randomBelow(n: number, source: RandomSource): number {
  if (!Number.isInteger(n) || n < 1 || n > RANGE) throw new Error(`random: cannot draw below ${n}`);
  const limit = RANGE - (RANGE % n);
  const buffer = new Uint32Array(1);
  for (;;) {
    const value = source(buffer)[0] ?? 0;
    if (value < limit) return value % n;
  }
}

// Fisher–Yates: every order of the items is equally likely. Returns a new array.
export function shuffle<T>(items: readonly T[], source: RandomSource): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1, source);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
