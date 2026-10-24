---
status: Draft
story: run-in-the-browser/site-online
epic: run-in-the-browser
pr:
depends-on: []
---

# Task: project-scaffold

## Summary

Creates the site's project and every check that has to pass before a change reaches `main`: a
Vite + React + TypeScript app under `site/`, served as one page per locale and route, with the
react-intl seam and a Content Security Policy from the first commit; Vitest for the run's logic;
and the stories' `.feature` files made executable through playwright-bdd, against the production
build, with every scenario also checked for accessibility, third-party requests and CSP violations.
After it, `site-online.feature` is the first acceptance file CI enforces — the scenarios that need
the published site wait for `pages-deploy`, and the ones only GitHub can perform are marked
`@manual`.

## Problem

There is no code, and nothing yet that could stop broken code from merging. `main` is protected
(a PR is required), but a PR is mergeable the moment it opens, because no check exists. Every later
story is built on whatever this task decides, so the seams the SRS requires from the first commit —
strings in a catalogue (NFR-I1), an address per locale (NFR-I8), no request to anyone else (NFR-D2)
— are cheapest now and expensive after the first component is written without them.

## Proposal

### Layout

The app lives in `site/`, with its own `package.json`, `"private": true`, `"license": "MIT"` (the
licence must match in all three places) and `"engines": { "node": ">=24" }`. The root stays for
documents and repository tooling. `npm`, with `package-lock.json` committed: the lockfile's
integrity hashes are the digests the rules require for build-time dependencies.

```
site/
  src/            app code; *.test.ts(x) beside what they test (Vitest)
  src/i18n/       locales.ts (the list of offered locales; en-US only for now) and messages/en-US.json
  public/         static files copied as-is
  e2e/            playwright-bdd: steps/, fixtures.ts, playwright.config.ts
  scripts/        build helpers (per-locale pages)
```

### Pages, addresses and the build

- **Vite + React 19, TypeScript `strict`.** The app reads its locale from the first path segment and
  wraps everything in react-intl's `IntlProvider` with that locale's messages.
- **One HTML file per locale and route.** After `vite build`, `scripts/emit-pages.ts` writes the
  built `index.html` to `/<locale>/index.html` for every offered locale (and later every route), with
  `<html lang>` and `hreflang` alternates set. Each address is then a real file that GitHub Pages
  serves with `200`. That avoids the "SPA in `404.html`" trick, which answers every page with a 404
  status.
- **`/index.html`** sends the visitor to `/en-US/` with `<meta http-equiv="refresh">` and a visible
  link. Choosing by the browser's language replaces it in `choose-language`.
- **`/404.html`** is a real "page not found" page in `en-US`, linking home.
- **Base path from `BASE_PATH`**, defaulting to `/`. `pages-deploy` sets it to the repository path
  until `custom-domain` moves the site to the root.
- **CSP in a `<meta http-equiv>`**, because Pages cannot set headers:
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';
  connect-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'none'`. That rules out
  inline scripts, inline `style` attributes and third-party hosts. The dev server injects inline
  scripts for hot reload, so the CSP is added at build only — which is exactly why the tests run
  against the build (failure 2).

### Strings

Every user-facing string goes through react-intl, with ICU messages in `messages/<locale>.json`.
ESLint's `react/jsx-no-literals` fails on text written directly in JSX, so NFR-I1 is enforced
rather than remembered.

### Checks

| Check | Tool | Runs |
|---|---|---|
| `typecheck` | `tsc --noEmit` | every PR |
| `lint` | ESLint (typescript-eslint, react-hooks, jsx-a11y, `react/jsx-no-literals`) + Prettier `--check` | every PR |
| `unit` | Vitest + Testing Library | every PR |
| `acceptance` | playwright-bdd on Chromium, against `vite preview` of the production build | every PR |

All four are **required status checks** on `main`; the branch protection is updated in this task.
GitHub Actions are pinned to commit SHAs, not tags, for the same reason the datamine is pinned.

### Acceptance tests

- **Registered explicitly.** `e2e/playwright.config.ts` lists the `.feature` files CI runs, read in
  place from `docs/PLANNING/`. A story's file is added to the list by the task that starts the
  story, so a registered file is one somebody has seen fail. This task registers
  `site-online.feature`.
- **A missing step fails the build of the tests** (`missingSteps: 'fail-on-gen'`), never skips the
  scenario.
- **Every scenario is also guarded by a fixture.** It fails the scenario if the page:
  - made a request to any host but its own (NFR-D2);
  - reported a CSP violation;
  - asked for a file of its own that answered 404;
  - ended with any axe-core violation at WCAG 2.2 A/AA (NFR-A8).

  This applies to every scenario of every story, so the guarantees hold everywhere and not only in
  the scenarios that name them.
- **Tags.**
  - `@manual` marks a scenario only GitHub can perform: "A change whose tests fail cannot be
    merged", and the half of the accessibility scenario that GitHub refuses the merge. These are
    excluded from CI, verified by hand in this task and recorded under *Verification*, and listed by
    `npm run bdd:manual` so nobody mistakes them for automated.
  - `@deployed` marks a scenario that needs the published site: "A merged change reaches the
    domain" and "Plain HTTP is upgraded". It is excluded here and run after deployment by
    `pages-deploy`.

  Adding the tags edits `site-online.feature` and its `OVERVIEW.md` in the same PR.
- **The inaccessible-control scenario** builds a fixture page with a nameless button behind a test-only
  route that never ships, and asserts that the accessibility check fails on it.

Scenarios this task turns green: *The root sends the visitor to a locale*, *An address that does not
exist says so*, *The site makes no request to anyone else*, and the automated half of *A change that
makes a page inaccessible cannot be merged*.

### Repository tooling

`.githooks/pre-commit` runs `check-md-size`, and says so when it is absent. It is enabled per clone
with `git config core.hooksPath .githooks`, and the README says how.

## Three worst failure scenarios

| # | Scenario | How it manifests | Test that catches it |
|---|---|---|---|
| 1 | **The gates exist and gate nothing.** Checks run but are not required, or a `.feature` runs zero scenarios, or a step missing is skipped instead of failing. | Every PR shows green; a broken change merges; the `.feature` reads as enforced while nothing ran. | `missingSteps: 'fail-on-gen'`. The `acceptance` job fails if the run reports fewer scenarios than the registered files declare (minus `@manual`/`@deployed`). The required checks are confirmed with `gh api …/branches/main/protection` under *Verification*. Each registered scenario is seen red once — the step bodies are written after the steps fail. |
| 2 | **The CSP breaks the production page and nothing else.** Dev has no CSP, so an inline `style=` or a library that injects a `<style>` passes every local look and ships a blank or unstyled page. | The published site renders nothing, or loses its styles, with a CSP error in the console that no one reads. | The acceptance suite runs only against `vite preview` of the production build. The guard fixture fails any scenario on a `securitypolicyviolation`. A unit test asserts the built `index.html` carries the CSP meta, exactly. |
| 3 | **The base path is wrong for where the site is served.** Built for `/` and served under `/jvsl.monorepo.agents.iron_squid/`, or the other way round. | HTML loads, every script and stylesheet answers 404, the page is blank. It works locally and fails only once published. | The preview serves the build under the same `BASE_PATH` CI builds with, and the guard fixture fails on any same-origin 404. The acceptance job runs once with `BASE_PATH=/jvsl.monorepo.agents.iron_squid/`, the value `pages-deploy` will use. |

## Blast radius

- [ ] The template submodule — none; this repository has no `.code-server/` submodule.
- [ ] The image — none.
- [ ] The stack manifest — none; Node 24 is already selected.
- [ ] The agent's sandbox map — none.
- [x] A dependency fetched at build time — npm packages, pinned by `package-lock.json` integrity hashes; Playwright's Chromium, pinned by the Playwright version; GitHub Actions pinned to commit SHAs.
- [ ] The release/versioning discipline — none; that is `release-please`.
- [x] Another story or task — every later story builds on the layout, the guard fixture and the registration rule. `pages-deploy` depends on this.
- [x] Repository settings — the branch protection on `main` gains four required status checks.

## Alternatives considered

- **The app at the repository root** — rejected: the root already holds the charter, the rules and
  repository tooling, and keeping the app in `site/` stops its config from mixing with theirs.
- **An SPA that falls back to `404.html`** — rejected: every deep address would answer with status
  404, which search engines and link checkers read as "missing".
- **`@cucumber/cucumber` with Playwright as a library** — rejected at the grilling: playwright-bdd
  keeps Playwright's own runner, parallelism, traces and report.
- **Registering every `.feature` now** — rejected: twelve stories' scenarios would fail for
  behaviour nobody has started, and the suite would have to stay red or the files be skipped.
  Skipped files are the "reads as enforced, isn't" failure the rules name.
- **Accessibility checked only in dedicated scenarios** — rejected: NFR-A8 says every page and every
  state; a fixture on every scenario gets that without a second suite.
- **Jest** — rejected: Vitest shares Vite's config and transforms, so there is no second build
  setup to keep in step.
- **Doing nothing until there is a feature to show** — rejected: the first component written
  without the seams is the first one to retrofit.

## Verification

Filled while implementing: the commands run and what they printed, the red run of each registered
scenario before its steps existed, the `@manual` scenarios performed by hand on a real PR, and the
branch protection read back from the API.

## After the code

Filled once the code exists.

| # | Check | Where in the diff | Or "none", and what was looked at |
|---|---|---|---|
| 1 | Where outside data enters: its size limit, its validation, what unexpected input does | | |
| 2 | Every query: filtered by owner, bounded, served by an index that exists | | |
| 3 | Writes and deletes: what here cannot be undone | | |
| 4 | Cost multipliers: a loop that calls an API or the database once per item | | |
| 5 | Paths the tests did not touch: the branches this change created that nothing exercises | | |

## Open questions

None.

## Outcome

Filled in when the status leaves `Draft`.
