import { describe, expect, it } from 'vitest';
import { displayName } from './name';

describe('displayName', () => {
  it('is optional: empty or blank means no name', () => {
    expect(displayName('')).toEqual({ ok: true, name: undefined });
    expect(displayName('   ')).toEqual({ ok: true, name: undefined });
  });

  it('is trimmed', () => {
    expect(displayName('  Inkling Ivo ')).toEqual({ ok: true, name: 'Inkling Ivo' });
  });

  it('counts characters as the player sees them, so 30 emoji fit and 31 do not', () => {
    expect(displayName('🦑'.repeat(30))).toEqual({ ok: true, name: '🦑'.repeat(30) });
    expect(displayName('🦑'.repeat(31))).toEqual({ ok: false, reason: 'length', length: 31 });
    expect(displayName('👩‍👩‍👧'.repeat(16))).toEqual({ ok: true, name: '👩‍👩‍👧'.repeat(16) });
  });

  it('refuses a name over 300 bytes, so the longest still fits in a share link (FR-11)', () => {
    // 👩‍👩‍👧 is one character of 18 bytes: 16 of them are 288 bytes, 17 are 306.
    expect(displayName('👩‍👩‍👧'.repeat(17))).toEqual({ ok: false, reason: 'bytes' });
    expect(displayName('👨‍👩‍👧‍👦'.repeat(30))).toEqual({ ok: false, reason: 'bytes' });
    expect(displayName('é'.repeat(30))).toEqual({ ok: true, name: 'é'.repeat(30) });
  });

  it('refuses more than 30 characters, saying how many there are', () => {
    expect(displayName('a'.repeat(31))).toEqual({ ok: false, reason: 'length', length: 31 });
  });
});
