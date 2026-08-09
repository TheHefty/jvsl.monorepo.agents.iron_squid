import 'server-only';

import {createHash, randomBytes} from 'node:crypto';

/**
 * The two identifiers, and the hash that stands in for one of them.
 *
 * They have opposite jobs, which is why nothing here is shared between them
 * beyond the alphabet. See docs/ARCHITECTURE.md#persistence.
 */

/**
 * Crockford's base32: no I, L, O or U.
 *
 * The first three are dropped because they are unreadable next to 1 and 0 in a
 * URL somebody may retype from a screenshot, and U because leaving it out keeps
 * accidental words out of generated ids.
 *
 * 32 characters divides 256 exactly, so masking a random byte to five bits is
 * uniform. No rejection sampling, and no modulo bias.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** Bits of entropy per character, by construction of the alphabet above. */
const BITS_PER_CHAR = 5;

/** ~50 bits. Enough that the corpus cannot be walked; it is not a secret. */
const PUBLIC_ID_LENGTH = 10;

/**
 * 130 bits, which clears the 128 that RULES.md requires with a character to
 * spare rather than landing exactly on the floor.
 */
const EDIT_SECRET_LENGTH = 26;

function randomChars(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte & 31];
  return out;
}

/**
 * The slug in a shared URL.
 *
 * Random rather than sequential so the corpus cannot be enumerated, and
 * independent of the handle so renaming a player does not break every link
 * already pasted. It is not a credential: the page it addresses is public by
 * design.
 */
export function newPublicId(): string {
  return randomChars(PUBLIC_ID_LENGTH);
}

/**
 * The edit token. This is a password in every sense that matters.
 *
 * It is returned to its owner once, at creation, and never stored — only the
 * hash below is. RULES.md#security has the rest of what that obliges: it is
 * never logged, never rendered on a public page, and never cached by the
 * service worker.
 */
export function newEditSecret(): string {
  return randomChars(EDIT_SECRET_LENGTH);
}

export const PUBLIC_ID_BITS = PUBLIC_ID_LENGTH * BITS_PER_CHAR;
export const EDIT_SECRET_BITS = EDIT_SECRET_LENGTH * BITS_PER_CHAR;

/**
 * What actually goes in the database, and what a lookup compares against.
 *
 * SHA-256 rather than a password hash on purpose: Argon2 exists to make brute
 * force expensive against the low-entropy secrets humans choose, and 130 random
 * bits are already out of reach without it. Paying tens of milliseconds on
 * every read of an edit page would buy nothing.
 */
export function hashEditSecret(secret: string): string {
  return createHash('sha256').update(normalise(secret), 'utf8').digest('hex');
}

/**
 * Folds the confusions the alphabet was chosen to avoid.
 *
 * Crockford's point is that a human transcribing an id can write O for 0 or
 * I for 1 and still be understood. Applied to both identifiers so that a link
 * retyped from a screenshot resolves instead of 404ing — and applied *before*
 * hashing, so the secret and its hash agree on what the same token is.
 */
export function normalise(id: string): string {
  return id.trim().toLowerCase().replace(/[il]/g, '1').replace(/o/g, '0');
}
