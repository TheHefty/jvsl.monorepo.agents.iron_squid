---
status: Draft
story: run-in-the-browser/site-online
epic: run-in-the-browser
pr: 21
depends-on: [project-scaffold]
---

# Task: pages-deploy

## Summary

Publishes the site to GitHub Pages on every push to `main`, from a build that has passed the same
checks a pull request must, and then proves the deployment by running the story's `@deployed`
scenarios against the live site. Until `custom-domain`, the site is at
`https://thehefty.github.io/jvsl.monorepo.agents.iron_squid/`.

## Problem

After `project-scaffold`, a change can be checked but not seen: nothing publishes it. And a check
that passed on a pull request does not prove `main` is good. Two PRs that are green on their own can
be red together once both are merged, and a deploy that trusts the PR's result publishes that.

## Proposal

- **`.github/workflows/deploy.yml`**, on `push` to `main` and on `workflow_dispatch`.
  - **`verify`** reruns `typecheck`, `lint`, `unit` and `acceptance` on the merged commit. These are
    the same jobs, reused through a `workflow_call` from the CI workflow rather than copied.
  - **`build`** (needs `verify`) builds with `BASE_PATH=/jvsl.monorepo.agents.iron_squid/`. It writes
    the commit SHA into `<meta name="iron-squid-build">` and uploads the artifact with
    `actions/upload-pages-artifact`.
  - **`deploy`** (needs `build`) publishes it with `actions/deploy-pages`. It runs only for `main`;
    a `workflow_dispatch` from another branch stops after `build`, which is how the workflow is
    tried without publishing.
  - **`smoke`** (needs `deploy`) runs the `@deployed` scenarios against the live URL.
- **Pages is configured to deploy from GitHub Actions**, through the API, in this task.
- **Concurrency:** `group: pages`, `cancel-in-progress: false`. Deployments queue rather than overlap,
  and a run that is underway is never cancelled halfway through publishing.
- **The `@deployed` steps** wait for the live page's `iron-squid-build` meta to equal the commit being
  deployed. They poll for at most 10 minutes, then fail, naming the SHA expected and the SHA found,
  so a stale cache never passes as the new version.
- **The scheme scenario** (*Plain HTTP is upgraded*) is run here against `github.io`, which upgrades
  on its own. `custom-domain` reruns it against the domain, where the upgrade is ours to enforce.

Scenarios this task turns green: *A merged change reaches the domain*, against `github.io` for now,
and *Plain HTTP is upgraded*.

## Three worst failure scenarios

| # | Scenario | How it manifests | Test that catches it |
|---|---|---|---|
| 1 | **A broken `main` is published.** Two green PRs conflict in meaning once merged. | The live site breaks for everyone, with every PR green. | `deploy` needs `verify`, which reruns every check on the merged commit. Under *Verification*: a `workflow_dispatch` on a branch with a deliberately failing unit test, showing `build` and `deploy` never start. |
| 2 | **The smoke test passes against the old version.** Pages or a CDN serves the previous build for a while. | "Deployed and verified" while visitors still get the old site; a broken deploy hides behind a cached good one. | The `@deployed` steps compare the live `iron-squid-build` SHA with `GITHUB_SHA` and fail, naming both, if they never match. |
| 3 | **Deploys overlap, or one is cut off.** Two quick merges race, or a new push cancels a deploy partway. | An older build ends up live after a newer one, or Pages is left serving a half-switched version. | `concurrency` with `cancel-in-progress: false`. The smoke test of the later run fails if the live SHA is the earlier one. |

## Blast radius

- [x] A dependency fetched at build time — `actions/upload-pages-artifact`, `actions/deploy-pages`, pinned to commit SHAs.
- [x] Another story or task — depends on `project-scaffold`. `custom-domain` changes `BASE_PATH` and the smoke URL.
- [x] Repository settings — Pages enabled, with source "GitHub Actions"; a `github-pages` environment restricted to `main`.

## Alternatives considered

- **Deploying the PR's artifact without re-verifying** — rejected: failure 1.
- **Publishing from a `gh-pages` branch** — rejected: it is a second branch to protect, and it holds a
  generated tree in git. The Actions source publishes an artifact and keeps no history of builds.
- **Previews per pull request** — rejected for now: Pages has one site per repository. A preview host
  would be another operator in the data map.

## Verification

Filled while implementing.

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
