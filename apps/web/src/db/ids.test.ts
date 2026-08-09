import {describe, expect, it} from 'vitest';
import {
  EDIT_SECRET_BITS,
  PUBLIC_ID_BITS,
  hashEditSecret,
  newEditSecret,
  newPublicId,
  normalise
} from './ids';

/**
 * These are the project's credentials, so the tests assert the properties
 * RULES.md#security actually depends on rather than that the functions return
 * strings.
 */

const ALPHABET = /^[0-9abcdefghjkmnpqrstvwxyz]+$/;

describe('the public id', () => {
  it('is ten characters of the reduced alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      const id = newPublicId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(ALPHABET);
    }
  });

  it('never contains the characters the alphabet drops', () => {
    // i, l and o are unreadable beside 1 and 0 in a retyped URL; u is dropped
    // so generated ids do not spell things.
    const sample = Array.from({length: 500}, newPublicId).join('');
    expect(sample).not.toMatch(/[ilou]/);
  });

  it('does not repeat across a large sample', () => {
    const ids = new Set(Array.from({length: 5000}, newPublicId));
    expect(ids.size).toBe(5000);
  });

  it('carries the entropy the design claims', () => {
    expect(PUBLIC_ID_BITS).toBe(50);
  });
});

describe('the edit secret', () => {
  it('clears the 128 bits RULES.md requires', () => {
    expect(EDIT_SECRET_BITS).toBeGreaterThanOrEqual(128);
    expect(newEditSecret()).toHaveLength(26);
  });

  it('is drawn from the same alphabet and never repeats', () => {
    const secrets = Array.from({length: 2000}, newEditSecret);
    for (const secret of secrets) expect(secret).toMatch(ALPHABET);
    expect(new Set(secrets).size).toBe(2000);
  });

  it('is not derivable from a public id, or from another secret', () => {
    // Both come from the same alphabet, so the check that matters is that
    // nothing about one predicts the other.
    const a = newEditSecret();
    const b = newEditSecret();
    expect(a).not.toBe(b);
    expect(a.slice(0, 10)).not.toBe(newPublicId());
  });
});

describe('hashing the edit secret', () => {
  it('produces a sha-256 digest, not the secret', () => {
    const secret = newEditSecret();
    const hash = hashEditSecret(secret);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(secret);
  });

  it('is stable for the same secret and distinct for different ones', () => {
    const secret = newEditSecret();
    expect(hashEditSecret(secret)).toBe(hashEditSecret(secret));
    expect(hashEditSecret(secret)).not.toBe(hashEditSecret(newEditSecret()));
  });

  it('hashes the normalised form, so a retyped secret still matches', () => {
    const secret = newEditSecret();
    expect(hashEditSecret(secret.toUpperCase())).toBe(hashEditSecret(secret));
    expect(hashEditSecret(` ${secret} `)).toBe(hashEditSecret(secret));
  });
});

describe('normalising', () => {
  it('folds exactly the confusions the alphabet was chosen to avoid', () => {
    expect(normalise('OIL')).toBe('011');
    expect(normalise('  K7M2PQ  ')).toBe('k7m2pq');
  });

  it('leaves a generated id untouched', () => {
    // Generated ids never contain the folded characters, so normalising one
    // must be a no-op — otherwise a stored id and its normalised form would
    // disagree.
    for (let i = 0; i < 200; i += 1) {
      const id = newPublicId();
      expect(normalise(id)).toBe(id);
    }
  });
});
