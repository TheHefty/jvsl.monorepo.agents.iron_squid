import { spawnSync } from 'node:child_process';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { Given, Then, When } from '../fixtures';

// The commit the deployment published, and how long its publication may take to show.
let expected = '';
const waitSeconds = Number(process.env.DEPLOY_WAIT_SECONDS ?? 600);

// Read once, never waited for: a page without the stamp is an answer, not something to wait on.
const stamp = (page: Page) =>
  page.evaluate(
    () => document.querySelector('meta[name="iron-squid-build"]')?.getAttribute('content') ?? null,
  );
const stampIn = (html: string) =>
  /<meta name="iron-squid-build" content="([^"]*)"/.exec(html)?.[1] ?? null;

// The release this deployment published: its tag, and the commit the tag points at.
let tag = '';
function released() {
  expected = process.env.EXPECTED_BUILD ?? '';
  tag = process.env.RELEASE_TAG ?? '';
  expect(expected, 'EXPECTED_BUILD, the commit that was released').toMatch(/^[0-9a-f]{40}$/);
  expect(tag, 'RELEASE_TAG, the version tag that was released').toMatch(/^v\d+\.\d+\.\d+$/);
}

// Poll with the API client, which the guard does not watch: the 404s and older builds seen while
// the publication propagates are not what the scenario is about. The browser opens the site once,
// when the stamp is the released commit.
async function waitForTheRelease(page: Page, request: APIRequestContext, baseURL?: string) {
  const landing = new URL('en-US/', baseURL).href;
  const deadline = Date.now() + waitSeconds * 1000;
  let found: string | null = null;
  for (;;) {
    const response = await request.get(`${landing}?t=${Date.now()}`);
    found = response.ok() ? stampIn(await response.text()) : `HTTP ${response.status()}`;
    if (found === expected || Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  expect(found, `the live build after ${waitSeconds}s (expected ${expected})`).toBe(expected);
  await page.goto('./');
}

Given('a version has been cut', async () => {
  released();
});

When(
  "a visitor opens the project's domain once the publication has finished",
  async ({ page, request, baseURL }) => {
    await waitForTheRelease(page, request, baseURL);
  },
);

Then('the site loads over HTTPS', async ({ page }) => {
  expect(new URL(page.url()).protocol).toBe('https:');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

Then("it is that version's build", async ({ page }) => {
  expect(await stamp(page)).toBe(expected);
});

// deploy-on-release. The version in the scenario is its example; the run checks the release it was
// started for, which RELEASE_TAG names.
Given("release-please's pull request proposes version {word}", async ({}, example: string) => {
  expect(example, 'the scenario names a version').toMatch(/^\d+\.\d+\.\d+$/);
  released();
});

When('the pull request is merged', async () => {
  // It has been: this run is the deployment its merge started, through the release it published.
});

Then('the tag v{word} is created', async ({}, example: string) => {
  void example;
  const at = spawnSync('git', ['rev-parse', `${tag}^{commit}`], { encoding: 'utf8' });
  expect(at.stdout.trim(), `the commit ${tag} points at`).toBe(expected);
});

Then(
  'the published site is built from that tag once the publication has finished',
  async ({ page, request, baseURL }) => {
    await waitForTheRelease(page, request, baseURL);
    expect(await stamp(page)).toBe(expected);
  },
);

let redirect: { status: number; location: string | undefined } | undefined;

When("a visitor opens the project's domain over plain HTTP", async ({ request, baseURL }) => {
  const http = new URL(baseURL ?? '');
  http.protocol = 'http:';
  const response = await request.get(http.href, { maxRedirects: 0 });
  redirect = { status: response.status(), location: response.headers()['location'] };
});

Then('they are sent to the same address over HTTPS', async ({ baseURL }) => {
  expect(redirect?.status, 'the answer to plain HTTP').toBe(301);
  expect(redirect?.location).toBe(baseURL);
});
