// The scenarios' temporary folders are removed when each test ends, even a failed one (debt is-m2n).
import { existsSync } from 'node:fs';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { tempDir } from '../support/temp';

test.describe.configure({ mode: 'serial' });

let passed = '';
let failed = '';

test('a test makes a folder', async () => {
  passed = tempDir('probe-');
  expect(existsSync(passed)).toBe(true);
});

test('a failing test makes a folder', async () => {
  test.fail();
  failed = tempDir('probe-');
  expect(existsSync(failed)).toBe(false);
});

test('both folders are gone once their tests ended', async () => {
  expect(passed).not.toBe('');
  expect(failed).not.toBe('');
  expect(existsSync(passed)).toBe(false);
  expect(existsSync(failed)).toBe(false);
});
