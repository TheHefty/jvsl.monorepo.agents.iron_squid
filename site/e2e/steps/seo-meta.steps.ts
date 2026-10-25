import { expect } from '@playwright/test';
import { locales } from '../../src/i18n/locales';
import { siteOrigin } from '../../src/site';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { pagesOfBuild } from '../support/pages';

// What a crawler reads: the HTML as served, before any script runs.
const descriptionOf = (html: string) =>
  /<meta name="description" content="([^"]*)"/
    .exec(html)?.[1]
    ?.replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
const alternatesOf = (html: string) =>
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({
    lang: m[1] ?? '',
    href: m[2] ?? '',
  }));
const route: Record<string, string> = {
  'home page': '',
  'privacy notice': 'privacy/',
  'terms of use': 'terms/',
};
const key: Record<string, string> = {
  'home page': 'meta.home',
  'privacy notice': 'meta.privacy',
  'terms of use': 'meta.terms',
};

When(
  /^a search engine reads the (home page|privacy notice|terms of use) at "\/([^/]+)\/"$/,
  async ({ request, baseURL, world }, page: string, locale: string) => {
    const response = await request.get(new URL(`./${locale}/${route[page]}`, baseURL).href);
    expect(response.status()).toBe(200);
    world.html = await response.text();
    world.locale = locale;
    world.pageName = page;
  },
);

Then('the page has a description', async ({ world }) => {
  expect(descriptionOf(world.html as string) ?? '').not.toBe('');
});

Then('the description is in the language of {string}', async ({ world }, locale: string) => {
  expect(descriptionOf(world.html as string)).toBe(
    messageIn(locale, key[world.pageName as string] ?? ''),
  );
});

Then('the page names its own address in every locale the site offers', async ({ world }) => {
  const named = alternatesOf(world.html as string).filter((a) => a.lang !== 'x-default');
  expect(named.map((a) => a.href).sort()).toEqual(locales.map((l) => `${siteOrigin}/${l}/`).sort());
});

Then('each address is marked with its language', async ({ world }) => {
  for (const a of alternatesOf(world.html as string).filter((x) => x.lang !== 'x-default'))
    expect(a.href).toBe(`${siteOrigin}/${a.lang}/`);
});

Then(
  'the page names the root of the site as the default for any other language',
  async ({ world }) => {
    expect(alternatesOf(world.html as string).filter((a) => a.lang === 'x-default')).toEqual([
      { lang: 'x-default', href: `${siteOrigin}/` },
    ]);
  },
);

// Every page the build writes, read as served, keyed by its canonical address.
async function everyPage(request: import('@playwright/test').APIRequestContext, baseURL?: string) {
  const pages = new Map<string, string>();
  for (const p of pagesOfBuild().filter((q) => q !== '404.html')) {
    const html = await (await request.get(new URL(p, baseURL).href)).text();
    pages.set(`${siteOrigin}/${p}`, html);
  }
  return pages;
}

Given('every page the site publishes', async ({ request, baseURL, world }) => {
  world.pages = await everyPage(request, baseURL);
});

Then('every address one page names as its sibling names that page back', async ({ world }) => {
  const pages = world.pages as Map<string, string>;
  const wrong: string[] = [];
  for (const [address, html] of pages) {
    for (const { lang, href } of alternatesOf(html)) {
      if (lang === 'x-default') continue;
      const sibling = pages.get(href);
      if (!sibling) wrong.push(`${address} names ${href}, which the site does not publish`);
      else if (!alternatesOf(sibling).some((a) => a.href === address))
        wrong.push(`${href} does not name ${address} back`);
    }
  }
  expect(wrong).toEqual([]);
});

When('a search engine reads any page', async ({ request, baseURL, world }) => {
  world.pages = await everyPage(request, baseURL);
});

Then('every address it names starts with {string}', async ({ world }, origin: string) => {
  expect(`${siteOrigin}/`).toBe(origin);
  const wrong: string[] = [];
  for (const [address, html] of world.pages as Map<string, string>) {
    // The addresses a crawler is told about: alternates, and the preview's (link-preview).
    const told = [
      ...alternatesOf(html).map((a) => a.href),
      ...[...html.matchAll(/<meta property="og:(?:url|image)" content="([^"]+)"/g)].map(
        (m) => m[1] ?? '',
      ),
    ];
    expect(told.length, `${address} names addresses`).toBeGreaterThan(0);
    for (const u of told) if (!u.startsWith(origin)) wrong.push(`${address}: ${u}`);
  }
  expect(wrong).toEqual([]);
});

When(
  'a search engine reads an address the site does not have',
  async ({ request, baseURL, world }) => {
    const response = await request.get(new URL('./en-US/nowhere/', baseURL).href);
    expect(response.status()).toBe(404);
    world.html = await response.text();
  },
);

Then('the page tells it not to index the page', async ({ world }) => {
  expect(world.html as string).toContain('<meta name="robots" content="noindex" />');
});
