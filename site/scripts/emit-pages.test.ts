import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tempDir } from '../e2e/support/temp';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitPages } from './emit-pages';
import { contentSecurityPolicy, cspPlugin } from './csp';

const shell = `<!doctype html><html lang="x"><head><meta charset="UTF-8" /><title>t</title>
<script type="module" crossorigin src="/repo/assets/index.js"></script>
<link rel="stylesheet" crossorigin href="/repo/assets/index.css"></head>
<body><div id="root"></div></body></html>`;

function build(basePath = '/repo/') {
  const dist = tempDir('dist-');
  writeFileSync(join(dist, 'index.html'), shell);
  emitPages({
    rootScript: 'location.replace("/repo/ja-JP/");',
    themeScript: 'document.documentElement.dataset.theme = "dark";',
    distDir: dist,
    basePath,
    locales: ['en-US', 'ja-JP'],
    defaultLocale: 'en-US',
    catalogueVersion: '1.2.3',
    catalogues: {
      'en-US': {
        'root.continue': 'Continue to Iron Squid',
        'site.name': 'Iron Squid',
        'catalogue.version': 'Weapons and gear from Splatoon 3 {version}',
        'footer.terms': 'Terms of use',
        'footer.privacy': 'Privacy',
        'footer.security': 'Security policy',
        'footer.fan': 'A fan project.',
        'meta.home': 'The home page.',
        'meta.terms': 'The terms.',
        'meta.privacy': 'The privacy notice.',
        'meta.notFound': 'No such page.',
        'meta.imageAlt': 'The logo.',
      },
      'ja-JP': {
        'site.name': 'Iron Squid',
        'meta.home': 'ホーム',
        'meta.terms': '規約',
        'meta.privacy': 'プライバシー',
        'meta.imageAlt': 'ロゴ',
      },
    },
  });
  const read = (p: string) => readFileSync(join(dist, p), 'utf8');
  return { dist, read };
}

describe('emitPages', () => {
  it('writes one page per locale, in that locale', () => {
    const { read } = build();
    expect(read('en-US/index.html')).toContain('<html lang="en-US">');
    expect(read('ja-JP/index.html')).toContain('<html lang="ja-JP">');
    expect(read('ja-JP/index.html')).toContain('src="/repo/assets/index.js"');
  });

  it('writes the terms and privacy pages of every locale', () => {
    const { read } = build();
    for (const locale of ['en-US', 'ja-JP']) {
      for (const page of ['terms', 'privacy']) {
        expect(read(`${locale}/${page}/index.html`)).toContain(`<html lang="${locale}">`);
      }
    }
  });

  it('styles the root page with the stylesheet of the site, so its footer is laid out like every page', () => {
    const { read } = build();
    const root = read('index.html');
    expect(root).toContain('<link rel="stylesheet" crossorigin href="/repo/assets/index.css">');
    expect(root).toContain('<footer class="site-footer"><nav');
    expect(root).toContain('<ul class="footer-links">');
  });

  it('gives the root page the notices and the fan-project line', () => {
    const { read } = build();
    const root = read('index.html');
    expect(root).toContain('<a href="/repo/en-US/terms/">Terms of use</a>');
    expect(root).toContain('<a href="/repo/en-US/privacy/">Privacy</a>');
    expect(root).toContain('Security policy</a>');
    expect(root).toContain('A fan project.');
  });

  it('names the same page in every locale, on the domain of the site whatever the base path', () => {
    const { read } = build();
    const terms = read('ja-JP/terms/index.html');
    expect(terms).toContain(
      '<link rel="alternate" hreflang="en-US" href="https://iron-squid.top/en-US/terms/" />',
    );
    expect(terms).toContain(
      '<link rel="alternate" hreflang="ja-JP" href="https://iron-squid.top/ja-JP/terms/" />',
    );
    expect(terms).toContain(
      '<link rel="alternate" hreflang="x-default" href="https://iron-squid.top/" />',
    );
  });

  it('describes each page in its own language, and keeps the 404 page out of indexes', () => {
    const { read } = build();
    expect(read('ja-JP/privacy/index.html')).toContain(
      '<meta name="description" content="プライバシー" />',
    );
    expect(read('en-US/run/index.html')).toContain(
      '<meta name="description" content="The home page." />',
    );
    const missing = read('404.html');
    expect(missing).toContain('<meta name="robots" content="noindex" />');
    expect(missing).toContain('<meta name="description" content="No such page." />');
  });

  it('makes the root a page that picks the language with a script of the site, before the refresh to the default locale that stays for browsers without scripts', () => {
    const { read, dist } = build();
    const root = read('index.html');
    const script = /<script src="\/repo\/(root-[0-9a-f]{12}\.js)"><\/script>/.exec(root);
    expect(script, 'a classic script, from the site, not inline').not.toBeNull();
    expect(read(script?.[1] ?? '')).toBe('location.replace("/repo/ja-JP/");');
    expect(root.indexOf('<script')).toBeLessThan(root.indexOf('http-equiv="refresh"'));
    expect(root).toContain('<meta http-equiv="refresh" content="0; url=/repo/en-US/" />');
    expect(root).toContain('<a href="/repo/en-US/">Continue to Iron Squid</a>');
    expect(root).toContain(contentSecurityPolicy);
    expect(root).not.toMatch(/<script>|<script [^>]*>[^<]/);
    expect(dist).toBeTruthy();
  });

  it('says on the root page which game version the catalogue matches', () => {
    const { read } = build();
    expect(read('index.html')).toContain('<p>Weapons and gear from Splatoon 3 1.2.3</p></footer>');
  });

  it('writes a 404 page that the app renders as "not found"', () => {
    const { read } = build();
    const page = read('404.html');
    expect(page).toContain('<html lang="en-US">');
    expect(page).toContain('<meta name="iron-squid-page" content="not-found" />');
    expect(page).toContain('src="/repo/assets/index.js"');
  });

  it('refuses a dist without a built index.html', () => {
    const dist = tempDir('dist-');
    expect(() =>
      emitPages({
        distDir: dist,
        basePath: '/',
        locales: ['en-US'],
        defaultLocale: 'en-US',
        catalogueVersion: '1.2.3',
        catalogues: {},
        rootScript: '',
        themeScript: '',
      }),
    ).toThrow(/no built index\.html/);
    expect(existsSync(join(dist, 'en-US'))).toBe(false);
  });
});

describe('the theme script', () => {
  it('runs first on every page, before the stylesheet, so no page paints in the other theme (theme-switch, failure 1)', () => {
    const { read } = build();
    for (const page of ['en-US/index.html', 'ja-JP/privacy/index.html', '404.html', 'index.html']) {
      const html = read(page);
      const script = /<script src="\/repo\/(theme-[0-9a-f]{12}\.js)"><\/script>/.exec(html);
      expect(script, page).not.toBeNull();
      expect(read(script?.[1] ?? '')).toBe('document.documentElement.dataset.theme = "dark";');
      expect(html.indexOf(script?.[0] ?? ''), page).toBeLessThan(html.indexOf('rel="stylesheet"'));
      expect(html.indexOf(script?.[0] ?? ''), page).toBeGreaterThan(html.indexOf('<meta charset'));
    }
  });
});

describe('the content security policy', () => {
  it('allows nothing from any host but the site itself', () => {
    expect(contentSecurityPolicy).toBe(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; ` +
        `style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; ` +
        `base-uri 'self'; form-action 'none'" />`,
    );
  });

  it('is added to the built page only, never to the dev server', () => {
    const plugin = cspPlugin();
    expect(plugin.apply).toBe('build');
    const html = (plugin.transformIndexHtml as (h: string) => string)(
      '<head><meta charset="UTF-8" /></head>',
    );
    expect(html).toBe(`<head><meta charset="UTF-8" />${contentSecurityPolicy}</head>`);
  });
});
