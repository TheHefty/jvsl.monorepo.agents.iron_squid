import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPagesServer } from './pages-server';

// The server stands in for GitHub Pages in the acceptance tests, so it has to answer the way
// Pages does: a directory serves its index.html, a missing path serves 404.html with status 404.
describe('pages server', () => {
  const root = mkdtempSync(join(tmpdir(), 'pages-'));
  mkdirSync(join(root, 'en-US'));
  writeFileSync(join(root, 'index.html'), 'root');
  writeFileSync(join(root, 'en-US', 'index.html'), 'english');
  writeFileSync(join(root, '404.html'), 'not found page');
  writeFileSync(join(root, 'app.js'), 'js');

  for (const base of ['/', '/repo/']) {
    describe(`under ${base}`, () => {
      const server = createPagesServer({ root, basePath: base });
      let url = '';
      beforeAll(async () => {
        await new Promise<void>((r) => server.listen(0, r));
        url = `http://localhost:${(server.address() as AddressInfo).port}`;
      });
      afterAll(() => new Promise<void>((r) => server.close(() => r())));

      it('serves a directory through its index.html', async () => {
        const res = await fetch(`${url}${base}en-US/`);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('english');
      });

      it('redirects a directory without its trailing slash', async () => {
        const res = await fetch(`${url}${base}en-US`, { redirect: 'manual' });
        expect(res.status).toBe(301);
        expect(res.headers.get('location')).toBe(`${base}en-US/`);
      });

      it('serves files with their content type', async () => {
        const res = await fetch(`${url}${base}app.js`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/javascript/);
      });

      it('answers a missing path with 404.html and status 404', async () => {
        const res = await fetch(`${url}${base}no-such-page/`);
        expect(res.status).toBe(404);
        expect(await res.text()).toBe('not found page');
      });

      it('never serves a file outside the root', async () => {
        const res = await fetch(`${url}${base}..%2f..%2fetc%2fpasswd`);
        expect(res.status).toBe(404);
      });
    });
  }

  it('answers 404 outside the base path', async () => {
    const server = createPagesServer({ root, basePath: '/repo/' });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://localhost:${port}/en-US/`);
    await new Promise<void>((r) => server.close(() => r()));
    expect(res.status).toBe(404);
  });
});
