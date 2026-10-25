// A run as a file the player keeps (FR-31): exported to move it to another browser or device, or to
// keep a copy, and read back only after every check parseRun makes (FR-32). The file is the player's;
// the site never sends it anywhere.
import type { Catalogue } from '../catalogue/types';
import type { RunState } from './engine';
import { parseRun } from './parse';

const FORMAT = 'iron-squid-run';
// A run with a long log is tens of KB; a file larger than this is not one, and is refused before it
// is parsed (task export-import, failure 3).
export const MAX_FILE_BYTES = 1_000_000;

export function exportRun(state: RunState, now: string) {
  return {
    name: `iron-squid-run-${now.slice(0, 10)}.json`,
    content: JSON.stringify({ format: FORMAT, version: 1, exportedAt: now, run: state }),
  };
}

export type FileResult =
  | { ok: true; state: RunState }
  | { ok: false; reason: 'not-a-run' }
  | { ok: false; reason: 'unknown-catalogue'; version: string };

export function readRunFile(text: string, catalogues: Record<string, Catalogue>): FileResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, reason: 'not-a-run' };
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-a-run' };
  }
  const f = file as { format?: unknown; version?: unknown; run?: { catalogueVersion?: unknown } };
  if (typeof f !== 'object' || f === null || f.format !== FORMAT || f.version !== 1) {
    return { ok: false, reason: 'not-a-run' };
  }
  const parsed = parseRun(f.run, catalogues);
  if (parsed.ok) return { ok: true, state: parsed.state };
  // A catalogue the site lacks is named only when the file names one; without it, it is not a run.
  const version = f.run?.catalogueVersion;
  if (parsed.reason === 'unknown-catalogue' && typeof version === 'string' && version !== '') {
    return { ok: false, reason: 'unknown-catalogue', version };
  }
  return { ok: false, reason: 'not-a-run' };
}
