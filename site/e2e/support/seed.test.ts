import { describe, expect, it } from 'vitest';
import { parseRun } from '../../src/run/parse';
import { playRun, winsThenPlaying } from './seed';
import { readFileSync } from 'node:fs';

const catalogue = JSON.parse(readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'));

describe('playRun', () => {
  it('reaches exactly the counts a scenario asks for', () => {
    expect(playRun(winsThenPlaying(9))).toMatchObject({
      lives: 1,
      winsSinceReset: 9,
      conquered: 9,
      phase: 'playing',
    });
    expect(playRun(winsThenPlaying(10))).toMatchObject({ lives: 2, conquered: 10 });
    expect(playRun([...winsThenPlaying(10), 'loss'])).toMatchObject({
      lives: 1,
      conquered: 10,
      resets: 0,
    });
    // A new run starts over at a reset (FR-18): nothing conquered after it.
    expect(playRun([...winsThenPlaying(3), 'loss'])).toMatchObject({
      lives: 1,
      conquered: 0,
      resets: 1,
      cursor: 0,
    });
  });

  it('builds runs the site itself reads back', () => {
    const state = playRun([...winsThenPlaying(12), 'loss', 'loss'], 'Inkling Ivo');
    expect(parseRun(JSON.parse(JSON.stringify(state)), { '11.3.0': catalogue })).toMatchObject({
      ok: true,
    });
  });
});
