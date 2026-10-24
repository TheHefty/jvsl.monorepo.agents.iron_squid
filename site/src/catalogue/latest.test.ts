import { describe, expect, it } from 'vitest';
import { latestVersion } from './latest';

describe('latestVersion', () => {
  it('picks the newest game version by number, not by text', () => {
    // As text, "9.3.0" sorts after "11.3.0": the mistake PR #35 corrected.
    expect(latestVersion(['9.3.0', '11.3.0', '10.1.0'])).toBe('11.3.0');
    expect(latestVersion(['11.3.0', '11.10.0'])).toBe('11.10.0');
  });

  it('refuses to pick from nothing', () => {
    expect(() => latestVersion([])).toThrow('catalogue: no catalogue version');
  });
});
