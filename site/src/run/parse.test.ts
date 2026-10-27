import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import { currentSet } from './engine';
import catalogue from './fixtures/catalogue-0.0.1.json';
import v1 from './fixtures/run-v1.json';
import v2 from './fixtures/run-v2.json';
import { parseRun } from './parse';

const catalogues = { '0.0.1': catalogue as Catalogue };
const with_ = (patch: Record<string, unknown>) => ({ ...structuredClone(v1), ...patch });

describe('parseRun', () => {
  it('still reads a run named before names were capped at 300 bytes (share-codec)', () => {
    const name = '👨‍👩‍👧‍👦'.repeat(30);
    expect(parseRun(with_({ name }), catalogues)).toMatchObject({ ok: true, state: { name } });
  });

  // This fixture is a run saved in the first format the site ever wrote. It stays as it is: a change
  // that can no longer read it would lose every run saved before that change (task run-engine,
  // failure 3).
  it('reads a run saved in format 1, forever', () => {
    const result = parseRun(structuredClone(v1), catalogues);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.name).toBe('Inkling Ivo');
      // Saved with its first set conquered and on show, it loads on the second, which its order
      // already held (match-modes: a win moves straight on to the next set).
      expect(currentSet(result.state)).toEqual({
        kit: 'K0',
        head: 'H2',
        clothes: 'C2',
        shoes: 'S1',
      });
      expect(result.state.previous?.phase).toBe('playing');
    }
  });

  it('refuses a format it does not know, rather than guessing a migration', () => {
    expect(parseRun(with_({ schema: 6 }), catalogues)).toEqual({
      ok: false,
      reason: 'unknown-schema',
      detail: 'the run is in format 6; this site reads formats 1 to 5',
    });
  });

  it('migrates format 1 explicitly: same run, an empty log complete from the day it was read', () => {
    const result = parseRun(structuredClone(v1), catalogues, '2026-10-25T08:00:00.000Z');
    expect(result).toMatchObject({
      ok: true,
      state: { schema: 5, resetRule: 'in-order', log: [], logSince: '2026-10-25T08:00:00.000Z' },
    });
    if (result.ok) {
      expect(result.state.startedAt).toBe(v1.startedAt);
      expect(result.state.conquered).toBe(v1.conquered);
      expect(result.state.previous && 'log' in result.state.previous).toBe(false);
    }
  });

  // Format 2 is kept forever too, from the day it is first written.
  it('reads a run saved in format 2, forever', () => {
    const result = parseRun(structuredClone(v2), catalogues);
    expect(result).toMatchObject({
      ok: true,
      state: { schema: 5, resetRule: 'in-order', logSince: '2026-10-25T10:00:00.000Z' },
    });
    if (result.ok) expect(result.state.log).toEqual(v2.log);
  });

  it.each([
    ['a log longer than the matches played', { ...structuredClone(v2), matches: 0 }],
    [
      'a log entry for a draw past the run',
      { ...structuredClone(v2), log: [{ ...v2.log[0], draw: 3 }] },
    ],
    [
      'a log entry with no result',
      { ...structuredClone(v2), log: [{ ...v2.log[0], result: 'draw' }] },
    ],
    ['a format-2 run with no log date', { ...structuredClone(v2), logSince: undefined }],
  ])('refuses %s', (_label, input) => {
    expect(parseRun(input, catalogues)).toMatchObject({ ok: false, reason: 'not-a-run' });
  });

  it('refuses a run on a catalogue the site does not carry, naming it', () => {
    expect(parseRun(with_({ catalogueVersion: '9.9.9' }), catalogues)).toEqual({
      ok: false,
      reason: 'unknown-catalogue',
      detail: 'the run needs catalogue 9.9.9',
    });
  });

  it('refuses an order that is not the catalogue drawn once', () => {
    const twice = with_({ order: { ...v1.order, kits: ['K2', 'K2', 'K1'] } });
    expect(parseRun(twice, catalogues)).toMatchObject({ ok: false, reason: 'not-a-run' });
  });

  it.each([
    ['nothing', null],
    ['text', 'a run'],
    ['a cursor past the run', with_({ cursor: 3 })],
    ['more conquered than kits', with_({ conquered: 4 })],
    ['a cursor ahead of the conquered kits', with_({ cursor: 2, conquered: 1 })],
    ['an unknown phase', with_({ phase: 'paused' })],
    ['negative lives', with_({ lives: -1 })],
    ['a name over 30 characters', with_({ name: 'a'.repeat(31) })],
    ['a broken previous state', with_({ previous: { schema: 1 } })],
  ])('refuses %s', (_label, input) => {
    expect(parseRun(input, catalogues)).toMatchObject({ ok: false, reason: 'not-a-run' });
  });
});
