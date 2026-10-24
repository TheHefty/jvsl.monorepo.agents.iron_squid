import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchVerified, mapLimit, sha256 } from './fetch';

const good = Buffer.from('{"rows": []}');
const digest = createHash('sha256').update(good).digest('hex');
let flaky = 0;
let server: Server;
let base = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/data/good.json') return res.end(good);
    if (req.url === '/data/altered.json') return res.end('{"rows": ["changed"]}');
    if (req.url === '/data/flaky.json') {
      flaky += 1;
      if (flaky <= 2) {
        res.writeHead(429);
        return res.end();
      }
      return res.end(good);
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://localhost:${(server.address() as AddressInfo).port}/`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('fetchVerified', () => {
  it('returns the bytes when they match the pinned digest', async () => {
    expect(await fetchVerified(base, 'data/good.json', digest, { retryDelayMs: 1 })).toEqual(good);
  });

  it('stops when the source serves other bytes than were pinned, naming the file and both digests', async () => {
    const altered = sha256(Buffer.from('{"rows": ["changed"]}'));
    await expect(
      fetchVerified(base, 'data/altered.json', digest, { retryDelayMs: 1 }),
    ).rejects.toThrow(
      `datamine: data/altered.json does not match its pinned digest: expected ${digest}, received ${altered}`,
    );
  });

  it('retries a throttled request before giving up', async () => {
    expect(await fetchVerified(base, 'data/flaky.json', digest, { retryDelayMs: 1 })).toEqual(good);
    expect(flaky).toBe(3);
  });

  it('names the file and the address when it cannot be fetched', async () => {
    await expect(
      fetchVerified(base, 'data/missing.json', digest, { retryDelayMs: 1 }),
    ).rejects.toThrow(
      `datamine: could not fetch data/missing.json from ${base}data/missing.json: HTTP 404`,
    );
  });
});

describe('mapLimit', () => {
  it('never runs more than the limit at once, and keeps the order', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});
