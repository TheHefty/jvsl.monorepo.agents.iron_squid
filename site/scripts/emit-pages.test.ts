import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitPages } from './emit-pages';
import { contentSecurityPolicy, cspPlugin } from './csp';

const shell = `<!doctype html><html lang="x"><head><meta charset="UTF-8" /><title>t</title>
<script type="module" crossorigin src="/repo/assets/index.js"></script></head>
<body><div id="root"></div></body></html>`;

function build(basePath = '/repo/') {
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  writeFileSync(join(dist, 'index.html'), shell);
  emitPages({
    distDir: dist,
    basePath,
    locales: ['en-US', 'ja-JP'],
    defaultLocale: 'en-US',
    catalogueVersion: '1.2.3',
    messages: {
      'root.continue': 'Continue to Iron Squid',
      'site.name': 'Iron Squid',
      'catalogue.version': 'Weapons and gear from Splatoon 3 {version}',
      'footer.terms': 'Terms of use',
      'footer.privacy': 'Privacy',
      'footer.security': 'Security policy',
      'footer.fan': 'A fan project.',
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

  it('gives the root page the notices and the fan-project line', () => {
    const { read } = build();
    const root = read('index.html');
    expect(root).toContain('<a href="/repo/en-US/terms/">Terms of use</a>');
    expect(root).toContain('<a href="/repo/en-US/privacy/">Privacy</a>');
    expect(root).toContain('Security policy</a>');
    expect(root).toContain('A fan project.');
  });

  it('names every locale as an alternate of each page', () => {
    const { read } = build();
    const page = read('en-US/index.html');
    expect(page).toContain('<link rel="alternate" hreflang="en-US" href="/repo/en-US/" />');
    expect(page).toContain('<link rel="alternate" hreflang="ja-JP" href="/repo/ja-JP/" />');
    expect(page).toContain('<link rel="alternate" hreflang="x-default" href="/repo/" />');
  });

  it('makes the root a page that sends the visitor to the default locale, without a script', () => {
    const { read } = build();
    const root = read('index.html');
    expect(root).toContain('<meta http-equiv="refresh" content="0; url=/repo/en-US/" />');
    expect(root).toContain('<a href="/repo/en-US/">Continue to Iron Squid</a>');
    expect(root).toContain(contentSecurityPolicy);
    expect(root).not.toContain('<script');
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
    const dist = mkdtempSync(join(tmpdir(), 'dist-'));
    expect(() =>
      emitPages({
        distDir: dist,
        basePath: '/',
        locales: ['en-US'],
        defaultLocale: 'en-US',
        catalogueVersion: '1.2.3',
        messages: {},
      }),
    ).toThrow(/no built index\.html/);
    expect(existsSync(join(dist, 'en-US'))).toBe(false);
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
