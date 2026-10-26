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
import { siteOrigin } from '../src/site';
import { contentSecurityPolicy } from './csp';

type Options = {
  distDir: string;
  basePath: string;
  locales: readonly string[];
  defaultLocale: string;
  catalogueVersion: string;
  // Every locale's catalogue: each page describes itself in its own language (FR-70).
  catalogues: Record<string, Record<string, string>>;
  // The root's script (src/i18n/root-entry.ts, built as a classic script): it sends a visitor to
  // their language (NFR-I5) before the refresh to the default locale fires.
  rootScript: string;
  // Every page's first script (src/theme/theme-entry.ts): sets the chosen theme before the page
  // paints (FR-61). A classic script of the site's own, so the CSP is unchanged.
  themeScript: string;
};

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function emitPages({
  distDir,
  basePath,
  locales,
  defaultLocale,
  catalogueVersion,
  catalogues,
  rootScript,
  themeScript,
}: Options): void {
  const shellPath = join(distDir, 'index.html');
  if (!existsSync(shellPath)) {
    throw new Error(`emit-pages: no built index.html in ${distDir}; run "vite build" first.`);
  }
  // Scripts of the site's own, named by their content, like every other asset, so a cached copy is
  // never a stale one.
  const named = (prefix: string, code: string) => {
    const file = `${prefix}-${createHash('sha256').update(code).digest('hex').slice(0, 12)}.js`;
    writeFileSync(join(distDir, file), code);
    return file;
  };
  const themeTag = `<script src="${basePath}${named('theme', themeScript)}"></script>`;
  // Right after the charset, before the stylesheet and anything that paints.
  const firstInHead = (html: string) =>
    html.replace(/(<meta charset="UTF-8" \/>)/, `$1${themeTag}`);
  const shell = firstInHead(readFileSync(shellPath, 'utf8'));
  const messages = catalogues[defaultLocale] ?? {};
  // What a search engine is told (FR-70, FR-71): the page's description in its own language, and the
  // same page in every locale, absolute on the site's domain whatever base path this build has,
  // with the root as the default. The shared-run page describes itself as the home page: its run
  // is in the fragment, which no crawler sees.
  const describedBy: Record<string, string> = {
    '': 'meta.home',
    run: 'meta.home',
    terms: 'meta.terms',
    privacy: 'meta.privacy',
  };
  const description = (locale: string, id: string) =>
    `<meta name="description" content="${escape(catalogues[locale]?.[id] ?? '')}" />`;
  const alternatesOf = (route: string) =>
    [
      ...locales.map(
        (l) =>
          `<link rel="alternate" hreflang="${l}" href="${siteOrigin}/${l}/${route ? `${route}/` : ''}" />`,
      ),
      `<link rel="alternate" hreflang="x-default" href="${siteOrigin}/" />`,
    ].join('');
  // What a preview generator shows for a posted link (FR-72): the site's name, the page's
  // description, its locale and the site's own image. The shared-run page previews as the home
  // page, address included: its run is in the fragment, which no preview generator receives.
  // Apps keep a preview image by its address: the address carries the image's digest, so a new image
  // is a new address and no app keeps showing the old one (debt is-bql).
  const previewFile = join(distDir, 'preview.png');
  const previewVersion = existsSync(previewFile)
    ? createHash('sha256').update(readFileSync(previewFile)).digest('hex').slice(0, 8)
    : '';
  const previewImage = `${siteOrigin}/preview.png${previewVersion ? `?v=${previewVersion}` : ''}`;
  const preview = (locale: string, route: string) => {
    const shown = route === 'run' ? '' : route;
    const id = describedBy[route] ?? 'meta.home';
    const meta = (property: string, content: string) =>
      `<meta property="${property}" content="${escape(content)}" />`;
    return (
      meta('og:type', 'website') +
      meta('og:site_name', catalogues[locale]?.['site.name'] ?? '') +
      meta('og:title', catalogues[locale]?.['site.name'] ?? '') +
      meta('og:description', catalogues[locale]?.[id] ?? '') +
      meta('og:url', `${siteOrigin}/${locale}/${shown ? `${shown}/` : ''}`) +
      meta('og:locale', locale.replace('-', '_')) +
      meta('og:image', previewImage) +
      meta('og:image:width', '1200') +
      meta('og:image:height', '630') +
      meta('og:image:alt', catalogues[locale]?.['meta.imageAlt'] ?? '') +
      `<meta name="twitter:card" content="summary_large_image" />`
    );
  };
  const page = (locale: string, extraHead: string) =>
    shell
      .replace(/<html lang="[^"]*">/, `<html lang="${locale}">`)
      .replace('</head>', `${extraHead}</head>`);

  for (const locale of locales) {
    for (const route of routes) {
      mkdirSync(join(distDir, locale, route), { recursive: true });
      writeFileSync(
        join(distDir, locale, route, 'index.html'),
        page(
          locale,
          description(locale, describedBy[route] ?? 'meta.home') +
            alternatesOf(route) +
            preview(locale, route),
        ),
      );
    }
  }
  writeFileSync(
    join(distDir, '404.html'),
    page(
      defaultLocale,
      '<meta name="iron-squid-page" content="not-found" />' +
        '<meta name="robots" content="noindex" />' +
        description(defaultLocale, 'meta.notFound'),
    ),
  );
  const alternates =
    description(defaultLocale, 'meta.home') + alternatesOf('') + preview(defaultLocale, '');

  const target = `${basePath}${defaultLocale}/`;
  const rootFile = named('root', rootScript);
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
    `<!doctype html><html lang="${defaultLocale}"><head><meta charset="UTF-8" />${themeTag}` +
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
  const catalogues = Object.fromEntries(
    locales.map((l) => [
      l,
      JSON.parse(
        readFileSync(new URL(`../src/i18n/messages/${l}.json`, import.meta.url), 'utf8'),
      ) as Record<string, string>,
    ]),
  );
  // The root's script, bundled alone as a classic script (an IIFE): it runs as soon as it is read,
  // before the refresh below, whenever each browser chooses to apply that. A module script waits
  // for the document; it happens to beat the refresh in Chromium, but nothing promises it does.
  const { build } = await import('vite');
  const classic = async (entry: string, name: string) => {
    const built = (await build({
      configFile: false,
      logLevel: 'warn',
      build: { write: false, minify: true, lib: { entry, formats: ['iife'], name } },
    })) as { output: { code?: string }[] } | { output: { code?: string }[] }[];
    const code = (Array.isArray(built) ? built[0] : built)?.output[0]?.code;
    if (!code) throw new Error(`emit-pages: ${entry} was not built`);
    return code;
  };
  emitPages({
    rootScript: await classic('src/i18n/root-entry.ts', 'ironSquidRoot'),
    themeScript: await classic('src/theme/theme-entry.ts', 'ironSquidTheme'),
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
    catalogues,
  });
  console.log(`emit-pages: ${locales.length} locale page(s), root and 404 written`);
}
