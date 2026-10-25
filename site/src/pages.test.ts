import { describe, expect, it } from 'vitest';
import { pageFromPath } from './pages';

describe('pageFromPath', () => {
  it.each([
    ['/en-US/', '/', 'home'],
    ['/en-US/privacy/', '/', 'privacy'],
    ['/en-US/terms/', '/', 'terms'],
    ['/en-US/run/', '/', 'shared'],
    ['/repo/en-US/run/', '/repo/', 'shared'],
    ['/repo/en-US/terms/', '/repo/', 'terms'],
    ['/en-US/nowhere/', '/', 'not-found'],
    ['/', '/', 'not-found'],
  ])('%s under %s is the %s page', (path, base, page) => {
    expect(pageFromPath(path, base)).toBe(page);
  });
});
