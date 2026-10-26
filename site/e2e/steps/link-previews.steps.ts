import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext } from '@playwright/test';
import type { Catalogue } from '../../src/catalogue/types';
import { encodeShare } from '../../src/share/link';
import { siteOrigin } from '../../src/site';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { pagesOfBuild } from '../support/pages';
import { playRun, winsThenPlaying } from '../support/seed';

// The preview tags a page carries, as a preview generator reads them: the HTML as served.
function previewOf(html: string) {
  const tags: Record<string, string> = {};
  for (const m of html.matchAll(
    /<meta (?:property|name)="((?:og|twitter):[^"]+)" content="([^"]*)"/g,
  ))
    tags[m[1] ?? ''] = (m[2] ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return tags;
}
const read = async (request: APIRequestContext, baseURL: string | undefined, path: string) =>
  (await request.get(new URL(path, baseURL).href)).text();

When(
  'a preview generator reads the home page at {string}',
  async ({ request, baseURL, world }, address: string) => {
    world.preview = previewOf(await read(request, baseURL, `.${address}`));
    world.locale = address.replace(/\//g, '');
  },
);

Then('it finds the title {string}', async ({ world }, title: string) => {
  expect((world.preview as Record<string, string>)['og:title']).toBe(title);
});

Then("the page's description", async ({ world }) => {
  const locale = world.locale as string;
  expect((world.preview as Record<string, string>)['og:description']).toBe(
    messageIn(locale, 'meta.home'),
  );
});

Then('an image, with its width, height and a text alternative', async ({ world }) => {
  const p = world.preview as Record<string, string>;
  expect(p['og:image']).toMatch(new RegExp(`^${siteOrigin}/preview\\.png\\?v=[0-9a-f]{8}$`));
  expect(p['og:image:width']).toBe('1200');
  expect(p['og:image:height']).toBe('630');
  expect(p['og:image:alt']).toBe(messageIn(world.locale as string, 'meta.imageAlt'));
  expect(p['twitter:card']).toBe('summary_large_image');
});

Then('the description is in Brazilian Portuguese', async ({ world }) => {
  expect((world.preview as Record<string, string>)['og:description']).toBe(
    messageIn('pt-BR', 'meta.home'),
  );
});

Then('the preview names the language as {string}', async ({ world }, locale: string) => {
  expect((world.preview as Record<string, string>)['og:locale']).toBe(locale);
});

When('a preview generator reads any page', async ({ request, baseURL, world }) => {
  const pages = new Map<string, Record<string, string>>();
  for (const p of pagesOfBuild().filter((q) => q !== '404.html'))
    pages.set(p, previewOf(await read(request, baseURL, p)));
  world.previews = pages;
});

Then("the preview image's address starts with {string}", async ({ world }, origin: string) => {
  for (const [page, p] of world.previews as Map<string, Record<string, string>>)
    expect(p['og:image'] ?? '', page || 'the root').toMatch(new RegExp(`^${origin}`));
});

Then('opening that address returns an image', async ({ world, request, baseURL }) => {
  const addresses = new Set(
    [...(world.previews as Map<string, Record<string, string>>).values()].map(
      (p) => p['og:image'] ?? '',
    ),
  );
  for (const address of addresses) {
    // Served by this build: the same path, under the address the build is tested at.
    const { pathname, search } = new URL(address);
    const local = new URL(`.${pathname}${search}`, baseURL).href;
    const response = await request.get(local);
    expect(response.status(), local).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    expect(png.subarray(1, 4).toString('latin1'), 'a PNG').toBe('PNG');
    // Its size, from the PNG header, is the size the tags state.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  }
});

Then("the preview image carries the site's logo and no game artwork", async () => {
  // Rendered from the logo by scripts/preview-image.ts, which records the logo it used: an image
  // made from another logo, or from anything else, is not this one.
  const source = JSON.parse(readFileSync('scripts/preview-image.source.json', 'utf8')) as {
    logo: string;
    image: string;
  };
  const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
  expect(source.logo, 'the logo the image was made from').toBe(sha('public/logo.svg'));
  expect(source.image, 'the image as made').toBe(sha('public/preview.png'));
  expect(readFileSync('scripts/preview-image.ts', 'utf8')).not.toMatch(/\/game\/|catalogue/);
});

Given('a link to a run with the display name {string}', async ({ world }, name: string) => {
  const catalogue = JSON.parse(
    readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
  ) as Catalogue;
  world.name = name;
  world.link = `./en-US/run/#${encodeShare(playRun(winsThenPlaying(3), name), catalogue)}`;
});

When('a preview generator reads the link', async ({ request, baseURL, world }) => {
  // A preview generator, like any client, never sends the fragment: it asks for the page alone.
  world.html = await read(request, baseURL, world.link as string);
  world.home = previewOf(await read(request, baseURL, './en-US/'));
});

Then("the preview is the same as the home page's", async ({ world }) => {
  const shared = previewOf(world.html as string);
  expect(Object.keys(shared).length).toBeGreaterThan(5);
  expect(shared).toEqual(world.home);
});

Then('{string} appears nowhere in what it read', async ({ world }, name: string) => {
  expect(world.html as string).not.toContain(name);
});

// debt is-bql: apps keep a preview image by its address, so the address carries the image's digest
// and a new image is a new address.
Given("the site's preview image", async ({ request, baseURL, world }) => {
  const response = await request.get(new URL('./preview.png', baseURL).href);
  expect(response.status()).toBe(200);
  world.previewDigest = createHash('sha256')
    .update(await response.body())
    .digest('hex');
});

Then(
  'every page names it at an address that changes whenever the image does',
  async ({ request, baseURL, world }) => {
    const expected = `${siteOrigin}/preview.png?v=${(world.previewDigest as string).slice(0, 8)}`;
    for (const page of pagesOfBuild().filter((q) => q !== '404.html')) {
      const p = previewOf(await read(request, baseURL, page));
      expect(p['og:image'], page || 'the root').toBe(expected);
    }
  },
);
