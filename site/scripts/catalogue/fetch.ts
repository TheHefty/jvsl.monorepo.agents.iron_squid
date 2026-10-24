// Downloads from the pinned datamine, never trusting what arrives: every file is checked against the
// digest recorded for it, and a throttled request is retried rather than failing a build at random.
import { createHash } from 'node:crypto';

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

type Options = { retries?: number; retryDelayMs?: number };

export async function fetchBytes(
  base: string,
  path: string,
  { retries = 3, retryDelayMs = 2000 }: Options = {},
) {
  const url = new URL(path, base).href;
  for (let attempt = 0; ; attempt++) {
    let status: string;
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      status = `HTTP ${res.status}`;
      if (res.status !== 429 && res.status < 500) attempt = retries;
    } catch (e) {
      status = (e as Error).message;
    }
    if (attempt >= retries)
      throw new Error(`datamine: could not fetch ${path} from ${url}: ${status}`);
    await new Promise((r) => setTimeout(r, retryDelayMs * 2 ** attempt));
  }
}

export async function fetchVerified(
  base: string,
  path: string,
  expected: string,
  options?: Options,
) {
  const bytes = await fetchBytes(base, path, options);
  const received = sha256(bytes);
  if (received !== expected) {
    throw new Error(
      `datamine: ${path} does not match its pinned digest: expected ${expected}, received ${received}`,
    );
  }
  return bytes;
}

// Runs fn over items with at most `limit` in flight, keeping the order of the results.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
