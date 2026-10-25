// Vitest's side of tempDir (e2e/support/temp.ts): each test's folders go when the test ends.
import { afterAll, afterEach } from 'vitest';
import { removeSuiteTempDirs, removeTempDirs } from './temp';

afterEach(removeTempDirs);
afterAll(removeSuiteTempDirs);
