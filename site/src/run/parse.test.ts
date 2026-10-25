import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import { currentSet } from './engine';
import catalogue from './fixtures/catalogue-0.0.1.json';
import v1 from './fixtures/run-v1.json';
import { parseRun } from './parse';

const catalogues = { '0.0.1': catalogue as Catalogue };
const with_ = (patch: Record<string, unknown>) => ({ ...structuredClone(v1), ...patch });

describe('parseRun', () => {
  // This fixture is a run saved in the first format the site ever wrote. It stays as it is: a change
  // that can no longer read it would lose every run saved before that change (task run-engine,
  // failure 3).
  it('reads a run saved in format 1, forever', () => {
    const result = parseRun(structuredClone(v1), catalogues);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.name).toBe('Inkling Ivo');
      expect(currentSet(result.state)).toEqual({
        kit: 'K2',
        head: 'H1',
        clothes: 'C0',
        shoes: 'S3',
      });
      expect(result.state.previous?.phase).toBe('playing');
    }
  });

  it('refuses a format it does not know, rather than guessing a migration', () => {
    expect(parseRun(with_({ schema: 2 }), catalogues)).toEqual({
      ok: false,
      reason: 'unknown-schema',
      detail: 'the run is in format 2; this site reads format 1',
    });
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
