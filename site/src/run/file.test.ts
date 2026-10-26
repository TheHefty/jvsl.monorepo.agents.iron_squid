import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import { reportLoss, reportWin, startRun, type RunState } from './engine';
import catalogue from './fixtures/catalogue-0.0.1.json';
import { exportRun, MAX_FILE_BYTES, readRunFile } from './file';
import { cryptoSource } from './random';

const catalogues = { '0.0.1': catalogue as Catalogue };
const at = '2026-10-20T12:00:00.000Z';
const played = (): RunState => {
  let s = startRun(catalogue as Catalogue, { name: 'Inkling Ivo' }, cryptoSource, at);
  s = reportWin(s, { step: s.step, at, mode: 'Pnt' });
  s = reportLoss(s, { step: s.step, at, mode: 'Pnt', source: cryptoSource });
  return s;
};

describe('exportRun', () => {
  it('writes the run as an Iron Squid run file, named by the date', () => {
    const file = exportRun(played(), '2026-10-25T09:00:00.000Z');
    expect(file.name).toBe('iron-squid-run-2026-10-25.json');
    expect(JSON.parse(file.content)).toMatchObject({
      format: 'iron-squid-run',
      version: 1,
      exportedAt: '2026-10-25T09:00:00.000Z',
    });
  });

  it('brings the run back exactly, log and undo included (failure 2)', () => {
    const s = played();
    expect(readRunFile(exportRun(s, at).content, catalogues)).toEqual({ ok: true, state: s });
  });
});

describe('readRunFile', () => {
  it.each([
    ['text that is not JSON', 'not json'],
    ['JSON that is not a run file', JSON.stringify({ hello: 'world' })],
    ['another format', JSON.stringify({ format: 'something-else', version: 1, run: {} })],
    [
      'a run file of a later version',
      JSON.stringify({ format: 'iron-squid-run', version: 2, run: {} }),
    ],
    [
      'a run the site cannot read',
      JSON.stringify({ format: 'iron-squid-run', version: 1, run: { schema: 2 } }),
    ],
  ])('refuses %s as not a run', (_label, text) => {
    expect(readRunFile(text, catalogues)).toMatchObject({ ok: false, reason: 'not-a-run' });
  });

  it('refuses a file over the size limit before reading it (failure 3)', () => {
    expect(readRunFile('x'.repeat(MAX_FILE_BYTES + 1), catalogues)).toMatchObject({
      ok: false,
      reason: 'not-a-run',
    });
  });

  it('refuses a run on a catalogue the site does not carry, naming the version', () => {
    const run = { ...played(), catalogueVersion: '9.9.9' };
    expect(
      readRunFile(JSON.stringify({ format: 'iron-squid-run', version: 1, run }), catalogues),
    ).toEqual({
      ok: false,
      reason: 'unknown-catalogue',
      version: '9.9.9',
    });
  });

  it('refuses a name that is not a valid display name, wherever it came from', () => {
    const run = { ...played(), name: 'a'.repeat(31) };
    expect(
      readRunFile(JSON.stringify({ format: 'iron-squid-run', version: 1, run }), catalogues),
    ).toMatchObject({
      ok: false,
      reason: 'not-a-run',
    });
  });
});
