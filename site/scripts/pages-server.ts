// A static server that answers the way GitHub Pages does, so the acceptance tests run against the
// production build under the same rules it is published under: a directory serves its index.html,
// a directory without its trailing slash is redirected, and anything missing gets 404.html with
// status 404. `vite preview` answers every unknown path with index.html, which would let a broken
// link pass as a working page.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function createPagesServer({ root, basePath }: { root: string; basePath: string }): Server {
  const top = resolve(root);
  return createServer((req, res) => {
    const notFound = () => {
      res.writeHead(404, { 'content-type': types['.html'] });
      const page = join(top, '404.html');
      if (existsSync(page)) createReadStream(page).pipe(res);
      else res.end();
    };
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (!path.startsWith(basePath)) return notFound();
    const file = resolve(top, '.' + sep + path.slice(basePath.length));
    if (file !== top && !file.startsWith(top + sep)) return notFound();
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith('/')) {
        res.writeHead(301, { location: path + '/' });
        return res.end();
      }
      const index = join(file, 'index.html');
      if (!existsSync(index)) return notFound();
      res.writeHead(200, { 'content-type': types['.html'] });
      return createReadStream(index).pipe(res);
    }
    if (!existsSync(file)) return notFound();
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const basePath = process.env.BASE_PATH ?? '/';
  const port = Number(process.env.PREVIEW_PORT ?? 4173);
  const root = resolve(process.env.SITE_DIR ?? 'dist');
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`pages-server: no build at ${root}; run "npm run build" first.`);
    process.exit(1);
  }
  createPagesServer({ root, basePath }).listen(port, () =>
    console.log(`pages-server: ${root} at http://localhost:${port}${basePath}`),
  );
}
