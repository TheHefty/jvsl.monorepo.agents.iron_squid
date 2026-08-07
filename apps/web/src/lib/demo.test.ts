import {describe, expect, it} from 'vitest';

import {MATCH_MODES} from '@/domain/types';

import {getDemoChallenge} from './demo';

/**
 * The demo's value is that its numbers cannot lie to each other, so that is
 * what these check: not the specific figures, but that they agree.
 */

describe('the demo challenge', () => {
  it('is identical on every call, so pages do not shift under the reader', async () => {
    const [a, b] = await Promise.all([
      getDemoChallenge('en'),
      getDemoChallenge('en')
    ]);
    expect(a.draw.weapon.id).toBe(b.draw.weapon.id);
    expect(a.progress).toEqual(b.progress);
  });

  it('is the same challenge in every language, only differently named', async () => {
    const [en, ja] = await Promise.all([
      getDemoChallenge('en'),
      getDemoChallenge('ja')
    ]);

    expect(ja.draw.weapon.id).toBe(en.draw.weapon.id);
    expect(ja.progress).toEqual(en.progress);
    expect(ja.draw.weapon.name).not.toBe(en.draw.weapon.name);
  });

  it('has been played rather than written down', async () => {
    // Every match is a real one that went through applyMatch.
    const demo = await getDemoChallenge('en');
    expect(demo.log).toHaveLength(demo.progress.matches);
    expect(demo.progress.matches).toBeGreaterThan(demo.progress.cleared);
  });
});

describe('the numbers agree with each other', () => {
  it('clears exactly as many weapons as the armory shows cleared', async () => {
    const demo = await getDemoChallenge('en');
    const cleared = demo.armory.filter((w) => w.state === 'cleared');
    expect(cleared).toHaveLength(demo.progress.cleared);
  });

  it('shows exactly one weapon as current, and it is the drawn one', async () => {
    const demo = await getDemoChallenge('en');
    const current = demo.armory.filter((w) => w.state === 'current');
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe(demo.draw.weapon.id);
  });

  it('has spent one piece of gear per slot per weapon cleared', async () => {
    const demo = await getDemoChallenge('en');
    for (const slot of ['head', 'clothes', 'shoes'] as const) {
      expect(demo.progress.gearSpent[slot]).toBe(demo.progress.cleared);
    }
  });

  it('never shows more lives than have been earned', async () => {
    const demo = await getDemoChallenge('en');
    expect(demo.run.lives).toBeLessThanOrEqual(demo.progress.livesMax);
    expect(demo.run.lives).toBeGreaterThan(0);
  });

  it('is on a later run than one, and has the deaths to account for it', async () => {
    const demo = await getDemoChallenge('en');
    expect(demo.run.number).toBe(demo.progress.deaths + 1);
  });

  it('has a personal best no run has beaten', async () => {
    const demo = await getDemoChallenge('en');
    expect(demo.progress.best).toBeGreaterThanOrEqual(demo.progress.cleared);
  });

  it('never draws a weapon it has already cleared this run', async () => {
    const demo = await getDemoChallenge('en');
    expect(demo.challenge.run.cleared).not.toContain(demo.draw.weapon.id);
  });
});

describe('the log', () => {
  it('runs newest first', async () => {
    const demo = await getDemoChallenge('en');
    const times = demo.log.map((entry) => Date.parse(entry.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('records losses, not only wins', async () => {
    // The failure the original app shipped: a defeat was written down only
    // when it was the last one.
    const demo = await getDemoChallenge('en');
    expect(demo.log.some((entry) => entry.result === 'loss')).toBe(true);
  });

  it('names a ranked mode on every entry', async () => {
    const demo = await getDemoChallenge('en');
    for (const entry of demo.log) {
      expect(MATCH_MODES).toContain(entry.mode);
    }
  });

  it('spans the dead runs as well as the live one', async () => {
    const demo = await getDemoChallenge('en');
    const runs = new Set(demo.log.map((entry) => entry.runNumber));
    expect(runs.size).toBe(demo.run.number);
  });
});
