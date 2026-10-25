import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Every temporary folder a test makes goes through here, and is removed when that test ends, passed
// or failed (debt is-m2n): Playwright's guard fixture and Vitest's setup file both call
// removeTempDirs after each test. In the agent container /tmp is memory; folders left behind once
// filled it until the kernel killed the browser in the middle of a run.
const made: string[] = [];
const madeForSuite: string[] = [];

export function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

// A folder shared by every test of a file, removed when the file's tests are done (Vitest only).
export function suiteTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  madeForSuite.push(dir);
  return dir;
}

const remove = (dirs: string[]) => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
};
export const removeTempDirs = () => remove(made);
export const removeSuiteTempDirs = () => remove(madeForSuite);
