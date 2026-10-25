// Turns the single page Vite builds into a real file for every address the site has: one page per
// locale (NFR-I8), a root that sends visitors to the default locale, and a 404 page. Each address
// is then answered by GitHub Pages with status 200, instead of every page being 404.html in disguise.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IntlMessageFormat } from 'intl-messageformat';
import { latestVersion } from '../src/catalogue/latest';
import { links } from '../src/notices/links';
import { routes } from '../src/pages';
import { contentSecurityPolicy } from './csp';

type Options = {
  distDir: string;
  basePath: string;
  locales: readonly string[];
  defaultLocale: string;
  catalogueVersion: string;
  messages: Record<string, string>;
  // The root's script (src/i18n/root-entry.ts, built as a classic script): it sends a visitor to
  // their language (NFR-I5) before the refresh to the default locale fires.
  rootScript: string;
};

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function emitPages({
  distDir,
  basePath,
  locales,
  defaultLocale,
  catalogueVersion,
  messages,
  rootScript,
}: Options): void {
  const shellPath = join(distDir, 'index.html');
  if (!existsSync(shellPath)) {
    throw new Error(`emit-pages: no built index.html in ${distDir}; run "vite build" first.`);
  }
  const shell = readFileSync(shellPath, 'utf8');
  const alternates = [
    ...locales.map((l) => `<link rel="alternate" hreflang="${l}" href="${basePath}${l}/" />`),
    `<link rel="alternate" hreflang="x-default" href="${basePath}" />`,
  ].join('');
  const page = (locale: string, extraHead = '') =>
    shell
      .replace(/<html lang="[^"]*">/, `<html lang="${locale}">`)
      .replace('</head>', `${alternates}${extraHead}</head>`);

  for (const locale of locales) {
    for (const route of routes) {
      mkdirSync(join(distDir, locale, route), { recursive: true });
      writeFileSync(join(distDir, locale, route, 'index.html'), page(locale));
    }
  }
  writeFileSync(
    join(distDir, '404.html'),
    page(defaultLocale, '<meta name="iron-squid-page" content="not-found" />'),
  );

  const target = `${basePath}${defaultLocale}/`;
  // Named by its content, like every other asset, so a cached copy is never a stale one.
  const rootFile = `root-${createHash('sha256').update(rootScript).digest('hex').slice(0, 12)}.js`;
  writeFileSync(join(distDir, rootFile), rootScript);
  // The site's own stylesheet: the root has no app, but its footer is laid out like every page's
  // (links far enough apart to meet WCAG 2.2 target size; defect is-8qd).
  const stylesheets = (shell.match(/<link rel="stylesheet"[^>]*>/g) ?? []).join('');
  const name = escape(messages['site.name'] ?? '');
  const cont = escape(messages['root.continue'] ?? '');
  const link = (href: string, id: string) => `<a href="${href}">${escape(messages[id] ?? '')}</a>`;
  const notices =
    `<nav aria-label="${escape(messages['footer.label'] ?? '')}"><ul class="footer-links">` +
    `<li>${link(`${target}terms/`, 'footer.terms')}</li>` +
    `<li>${link(`${target}privacy/`, 'footer.privacy')}</li>` +
    `<li>${link(links.securityPolicy, 'footer.security')}</li></ul></nav>` +
    `<p>${escape(messages['footer.fan'] ?? '')}</p>`;
  const version = escape(
    String(
      new IntlMessageFormat(messages['catalogue.version'] ?? '', defaultLocale).format({
        version: catalogueVersion,
      }),
    ),
  );
  writeFileSync(
    shellPath,
    `<!doctype html><html lang="${defaultLocale}"><head><meta charset="UTF-8" />` +
      `${contentSecurityPolicy}<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      // A classic script runs where it stands, before the refresh below; without scripts the
      // refresh still takes the visitor to the default locale.
      `<script src="${basePath}${rootFile}"></script>` +
      `<link rel="icon" type="image/svg+xml" href="${basePath}logo.svg" />` +
      `<meta http-equiv="refresh" content="0; url=${target}" />${alternates}${stylesheets}<title>${name}</title></head>` +
      `<body><main><p><a href="${target}">${cont}</a></p></main>` +
      `<footer class="site-footer">${notices}<p>${version}</p></footer></body></html>`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { locales, defaultLocale } = await import('../src/i18n/locales');
  const messages = JSON.parse(
    readFileSync(new URL(`../src/i18n/messages/${defaultLocale}.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>;
  // The root's script, bundled alone as a classic script (an IIFE): it runs as soon as it is read,
  // before the refresh below, whenever each browser chooses to apply that. A module script waits
  // for the document; it happens to beat the refresh in Chromium, but nothing promises it does.
  const { build } = await import('vite');
  const built = (await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      write: false,
      minify: true,
      lib: { entry: 'src/i18n/root-entry.ts', formats: ['iife'], name: 'ironSquidRoot' },
    },
  })) as { output: { code?: string }[] } | { output: { code?: string }[] }[];
  const rootScript = (Array.isArray(built) ? built[0] : built)?.output[0]?.code;
  if (!rootScript) throw new Error('emit-pages: the root script was not built');
  emitPages({
    rootScript,
    // Scenarios that build the site build it elsewhere, never over the dist/ under test.
    distDir: process.env.BUILD_OUT_DIR ?? 'dist',
    basePath: process.env.BASE_PATH ?? '/',
    locales,
    defaultLocale,
    catalogueVersion: latestVersion(
      readdirSync(process.env.CATALOGUE_DIR ?? 'src/catalogue', { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name),
    ),
    messages,
  });
  console.log(`emit-pages: ${locales.length} locale page(s), root and 404 written`);
}
