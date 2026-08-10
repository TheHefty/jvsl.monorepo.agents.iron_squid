/**
 * Cache tags, in one place so the reader and the writer cannot disagree.
 *
 * A page caches its challenge under this tag; reporting a match invalidates
 * the same one. Two spellings of the same string would mean a public page that
 * never updates, and nothing would fail loudly.
 */
export function challengeTag(publicId: string): string {
  return `challenge:${publicId}`;
}
