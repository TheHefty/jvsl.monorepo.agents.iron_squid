// Turns the single page Vite builds into a real file for every address the site has: one page per
// locale (NFR-I8), a root that sends visitors to the default locale, and a 404 page. Each address
// is then answered by GitHub Pages with status 200, instead of every page being 404.html in disguise.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  const name = escape(messages['site.name'] ?? '');
  const cont = escape(messages['root.continue'] ?? '');
  const link = (href: string, id: string) => `<a href="${href}">${escape(messages[id] ?? '')}</a>`;
  const notices =
    `<nav><ul><li>${link(`${target}terms/`, 'footer.terms')}</li>` +
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
      `<meta http-equiv="refresh" content="0; url=${target}" />${alternates}<title>${name}</title></head>` +
      `<body><main><p><a href="${target}">${cont}</a></p></main>` +
      `<footer>${notices}<p>${version}</p></footer></body></html>`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { locales, defaultLocale } = await import('../src/i18n/locales');
  const messages = JSON.parse(
    readFileSync(new URL(`../src/i18n/messages/${defaultLocale}.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>;
  emitPages({
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
