# Iron Squid

A website for the **Iron Squid** challenge in Splatoon 3: win a match with every weapon in the game,
each with randomly drawn gear, and start over — replaying every weapon already won — when you lose
your last life. You start with one life and earn another for every ten wins.

The site draws your weapon and gear, holds you to the rules, keeps your progress in your browser and
gives you a link to share your run. It is in development; see [`docs/CHARTER.md`](docs/CHARTER.md)
for what it is for and [`docs/SRS.md`](docs/SRS.md) for what it will do.

## Working on it

The site lives in [`site/`](site/). It needs Node 24.

```sh
cd site
npm ci
npx playwright install chromium   # once, for the acceptance tests
npm run dev          # the dev server (no Content Security Policy; see below)
npm run build        # the production build, one page per locale, in dist/
npm run typecheck
npm run lint
npm test             # unit tests (Vitest)
npm run bdd          # acceptance tests: the stories' .feature files, against the build in dist/
npm run bdd:manual   # the scenarios CI does not run, and why
```

The acceptance tests run against the production build and never the dev server, because the dev
server has no Content Security Policy. Build first. Set `BASE_PATH` the same way for both commands
to test the site under a sub-path.

To check Markdown sizes before each commit, enable the hook once per clone:
`git config core.hooksPath .githooks`.

## Translations

The interface is written in `en-US`. A translation is marked `unreviewed` in its catalogue
(`site/src/i18n/messages/<locale>.json`, key `translation.status`) until a fluent speaker has
reviewed it, and the site says so on every page in that language. These have not been reviewed yet:

- `en-GB` — unreviewed

To review one, read it against `en-US`, correct it, and set its status to `reviewed` in the same
pull request that removes it from this list. A test keeps this list and the catalogues in step.

## Licence

The code and documentation are under the [MIT licence](LICENSE).

Splatoon, its weapon and gear names and its images are the property of Nintendo. They are **not**
covered by that licence, and this project is not affiliated with or endorsed by Nintendo.
