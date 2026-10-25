import { describe, expect, it } from 'vitest';
import { cryptoSource, randomBelow, shuffle, type RandomSource } from './random';

// A source that hands out the given 32-bit values in turn, and counts how many it handed out.
function scripted(values: number[]): RandomSource & { used: () => number } {
  let i = 0;
  const source = (buffer: Uint32Array<ArrayBuffer>) => {
    for (let j = 0; j < buffer.length; j++) buffer[j] = values[i++] ?? 0;
    return buffer;
  };
  return Object.assign(source, { used: () => i });
}

describe('randomBelow', () => {
  it('rejects the values that would make some results likelier (no modulo bias)', () => {
    // 2^32 is not a multiple of 3: 4294967295 is the one value that would favour 0, so it is
    // thrown away and the next value used.
    const source = scripted([4294967295, 7]);
    expect(randomBelow(3, source)).toBe(1);
    expect(source.used()).toBe(2);
  });

  it('refuses a range it cannot draw from', () => {
    expect(() => randomBelow(0, scripted([1]))).toThrow('random: cannot draw below 0');
  });
});

describe('shuffle', () => {
  it('is Fisher–Yates: each position swaps with one at or before it, drawn by the source', () => {
    // i = 3 swaps with 0: d b c a. i = 2 swaps with 2, itself: d b c a. i = 1 swaps with 0: b d c a.
    expect(shuffle(['a', 'b', 'c', 'd'], scripted([0, 2, 0]))).toEqual(['b', 'd', 'c', 'a']);
  });

  it('never changes what it was given', () => {
    const items = ['a', 'b', 'c'];
    shuffle(items, cryptoSource);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('makes every order equally likely, on the real source', () => {
    // 60,000 shuffles of 4 items: each of the 24 orders is expected 2,500 times. A biased shuffle
    // (sort by random, an off-by-one, modulo bias) lands in the thousands; a fair one stays under
    // 80, which a fair shuffle exceeds about once in ten million runs.
    const counts = new Map<string, number>();
    for (let n = 0; n < 60_000; n++) {
      const key = shuffle(['a', 'b', 'c', 'd'], cryptoSource).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(24);
    const chiSquare = [...counts.values()].reduce((s, c) => s + (c - 2500) ** 2 / 2500, 0);
    expect(chiSquare).toBeLessThan(80);
  });
});
