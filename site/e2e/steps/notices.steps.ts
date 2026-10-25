import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { links } from '../../src/notices/links';
import { Given, Then, When } from '../fixtures';
import { localeOfPage, messageIn } from '../support/messages';
import { pagesOfBuild, timeForEveryPage } from '../support/pages';

const catalogue = JSON.parse(readFileSync('src/i18n/messages/en-US.json', 'utf8')) as Record<
  string,
  string
>;
const message = (id: string, values: Record<string, unknown> = {}) => {
  const text = catalogue[id];
  if (text === undefined) throw new Error(`steps: en-US catalogue has no message "${id}"`);
  return String(new IntlMessageFormat(text, 'en-US').format(values));
};

type Footer = {
  page: string;
  locale: string;
  text: string;
  links: { name: string; href: string }[];
};

// Every page's footer, static pages read from the HTML as served (the root sends the browser on at
// once), app pages read in the browser, with each link's name and where it resolves to.
async function footers(page: Page, request: APIRequestContext, baseURL: string): Promise<Footer[]> {
  const out: Footer[] = [];
  for (const p of pagesOfBuild()) {
    const url = new URL(p, baseURL).href;
    const html = await (await request.get(url)).text();
    // Static: without the app's module script (the root's own small script is not the app).
    if (!html.includes('<script type="module"')) {
      const footer = /<footer[^>]*>([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? '';
      out.push({
        page: p || 'the root',
        locale: localeOfPage(p),
        text: footer.replace(/<[^>]+>/g, ' '),
        links: [...footer.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map((m) => ({
          href: new URL(m[1] ?? '', url).href,
          name: m[2] ?? '',
        })),
      });
      continue;
    }
    await page.goto(url);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    out.push({
      page: p,
      locale: localeOfPage(p),
      text: (await footer.innerText()).replace(/\s+/g, ' '),
      links: await footer.getByRole('link').evaluateAll((as) =>
        as.map((a) => ({
          name: (a.textContent ?? '').trim(),
          href: (a as HTMLAnchorElement).href,
        })),
      ),
    });
  }
  return out;
}

Given(
  'a visitor is on any page of the site',
  async ({ page, request, baseURL, guard, world, $test }) => {
    $test.setTimeout(timeForEveryPage());
    for (const p of pagesOfBuild())
      if (p === '404.html') guard.expectedMissing.add(new URL(p, baseURL).pathname);
    world.footers = await footers(page, request, baseURL ?? '');
    expect((world.footers as Footer[]).length).toBeGreaterThan(2);
  },
);

const noticeIds: Record<string, string> = {
  'terms of use': 'footer.terms',
  'privacy notice': 'footer.privacy',
  'security policy': 'footer.security',
};

Then(/^the page links to the (.+)$/, async ({ request, baseURL, world }, notice: string) => {
  const id = noticeIds[notice];
  if (!id) throw new Error(`steps: no notice called "${notice}"`);
  const origin = new URL(baseURL ?? '').origin;
  for (const f of world.footers as Footer[]) {
    const link = f.links.find((l) => l.name === messageIn(f.locale, id));
    expect(link, `${f.page} links to the ${notice}`).toBeDefined();
    if (!link) continue;
    if (new URL(link.href).origin === origin) {
      // The site's own notice pages: each link really leads to a page, from every page.
      expect((await request.get(link.href)).status(), `${f.page} -> ${link.href}`).toBe(200);
    } else {
      expect(link.href).toBe(links.securityPolicy);
    }
  }
});

Then('the page says the site is a fan project', async ({ world }) => {
  for (const f of world.footers as Footer[])
    expect(f.text, f.page).toContain(messageIn(f.locale, 'footer.fan'));
});

// What the notice says is read in en-US; every other page carries its own translation of that same
// notice, which the step above checks.
const english = (footers: Footer[]) => footers.filter((f) => f.locale === 'en-US');

Then('it says the site is not affiliated with or endorsed by Nintendo', async ({ world }) => {
  for (const f of english(world.footers as Footer[]))
    expect(f.text, f.page).toContain('not affiliated with or endorsed by Nintendo');
});

Then("it says Splatoon's names and images belong to Nintendo", async ({ world }) => {
  for (const f of english(world.footers as Footer[]))
    expect(f.text, f.page).toContain('names and images belong to Nintendo');
});

const privacy = (p: Page) => p.getByRole('article');

When('a visitor reads the privacy notice', async ({ page }) => {
  await page.goto('./en-US/privacy/');
  await expect(
    page.getByRole('heading', { level: 1, name: message('privacy.title') }),
  ).toBeVisible();
});

Then('it lists the run, the optional display name and the language choice', async ({ page }) => {
  const items = privacy(page).getByRole('list').first().getByRole('listitem');
  await expect(items).toHaveText([
    message('privacy.item.run'),
    message('privacy.item.name'),
    message('privacy.item.language'),
  ]);
});

Then("it says they are kept only in the visitor's own browser", async ({ page }) => {
  await expect(privacy(page)).toContainText(message('privacy.where'));
});

Then('it says the site sends none of them anywhere', async ({ page }) => {
  await expect(privacy(page)).toContainText('The site sends none of it anywhere');
});

Then('it says GitHub serves the site and receives what any web host receives', async ({ page }) => {
  await expect(privacy(page)).toContainText(message('privacy.host'));
});

Then("it links to GitHub's privacy statement", async ({ page }) => {
  await expect(
    privacy(page).getByRole('link', { name: message('privacy.hostLink') }),
  ).toHaveAttribute('href', links.githubPrivacy);
});

Then(
  'it says a display name is visible to anyone who receives a link to the run',
  async ({ page }) => {
    await expect(privacy(page)).toContainText(message('privacy.name'));
  },
);

Then('it says how to contact the maintainer about it', async ({ page }) => {
  await expect(
    privacy(page).getByRole('link', { name: message('privacy.issues') }),
  ).toHaveAttribute('href', links.issues);
  await expect(
    privacy(page).getByRole('link', { name: message('privacy.privateReport') }),
  ).toHaveAttribute('href', links.privateReport);
});

Then("it says requests about the host's records go to GitHub", async ({ page }) => {
  await expect(privacy(page)).toContainText(
    'Requests about the records GitHub keeps as the host go to GitHub.',
  );
});

When('a visitor reads the terms of use or the privacy notice', async ({ page, world }) => {
  const texts: string[] = [];
  for (const path of ['./en-US/terms/', './en-US/privacy/']) {
    await page.goto(path);
    texts.push(await page.getByRole('article').innerText());
  }
  world.notices = texts;
});

Then('the text says it has not been reviewed by a lawyer', async ({ world }) => {
  for (const text of world.notices as string[])
    expect(text).toContain(message('notice.unreviewed'));
});
