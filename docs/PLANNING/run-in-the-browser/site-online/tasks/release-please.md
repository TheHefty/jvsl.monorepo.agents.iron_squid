---
status: Draft
story: run-in-the-browser/site-online
epic: run-in-the-browser
pr:
depends-on: [project-scaffold]
---

# Task: release-please

## Summary

Cuts releases from the commit history, as the ground rules require. release-please keeps a release
pull request open, with the next version and the changelog. Merging that PR tags the release, and
only `feat` and `fix` commits reach the changelog. The release PR is opened with a GitHub App token,
so the required checks run on it. A required `pr-title` check keeps every squash commit
conventional, because the squash commit takes the PR's title and that title is what release-please
reads.

## Problem

There is no release discipline yet. The ground rules make conventional commits load-bearing: "a
`chore` that should have been a `fix` is a release that never happens". Nothing here checks that.
And a release PR opened by the workflow's own `GITHUB_TOKEN` triggers no other workflow, so it would
carry none of the four required checks, and `main`'s protection would block it forever.

## Proposal

- **One package at the root.** `release-please-config.json` with `release-type: simple`, the
  changelog at `CHANGELOG.md`, tags `vX.Y.Z`, and `site/package.json`'s `version` kept in step
  through `extra-files`. `.release-please-manifest.json` starts at `0.0.0`. The first `feat` proposes
  `0.1.0`.
- **`.github/workflows/release-please.yml`**, on push to `main`:
  1. `actions/create-github-app-token` mints a one-hour installation token from the App.
  2. `googleapis/release-please-action` uses that token.

  Both actions are pinned to commit SHAs.
- **The App** (the owner creates it; the agent never sees its key):
  - *Iron Squid Release*, owned by `TheHefty`, with no webhook;
  - repository permissions *Contents: read & write*, *Pull requests: read & write* and *Metadata:
    read*, and nothing else;
  - installed on **this repository only**;
  - its App ID in the repository variable `RELEASE_APP_ID`, its private key in the repository secret
    `RELEASE_APP_PRIVATE_KEY`, both pasted through GitHub's interface.
- **`pr-title`**, a new required check: `amannn/action-semantic-pull-request` (pinned) rejects a PR
  whose title is not a conventional commit with one of the types this repository uses.
- **Squash commits take the PR title.** The repository setting `squash_merge_commit_title` is set to
  `PR_TITLE`. Without it, GitHub uses the commit's own message when a PR has one commit, and the
  title check guards the wrong text.
- **`repo-settings`**, a CI job: it reads the repository through the API and fails if
  `squash_merge_commit_title` is not `PR_TITLE`, if the main branch protection is missing any of the
  five required checks, or if `enforce_admins` is off. Settings that drift silently are the ones this
  whole chain relies on.
- `CHANGELOG.md` is written by release-please and exempt from `check-md-size`, as the rules say.

This task delivers no scenario of the story. It is the release discipline the ground rules require
of every project, and it is placed here because `site-online` is where the repository's machinery is
built.

## Three worst failure scenarios

| # | Scenario | How it manifests | Test that catches it |
|---|---|---|---|
| 1 | **The release PR has no checks.** It is opened with a token that does not trigger workflows: the App token is missing or wrong, and the action falls back. | The release PR sits blocked by branch protection; nobody can release without an admin bypass, and the bypass becomes habit. | The workflow fails if the App token cannot be minted, never falling back to `GITHUB_TOKEN`. Under *Verification*: the first release PR, showing the five checks ran on it. |
| 2 | **A `fix` lands as something else.** A PR titled freely, or squashed under its commit's message, puts a non-conventional or wrongly typed commit on `main`. | The fix ships with no release proposed, and the changelog never mentions it. This repository already learned that through the template. | The required `pr-title` check. The `repo-settings` job asserts `squash_merge_commit_title` is `PR_TITLE`. |
| 3 | **The App can do more than release.** It is installed on every repository, or given more than contents and pull requests, or its key leaks into a log. | One leaked key writes to every repository of the account. | `create-github-app-token` scopes the token to this repository and masks it in logs. The installation scope and permissions cannot be read with the workflow's own token, so they are checked by hand on the App's settings page and recorded under *Verification*. |

## Blast radius

- [x] The release/versioning discipline — this is it.
- [x] Repository settings — the squash title, a sixth required check (`pr-title`), the variable and the secret.
- [x] Outside this repository — a GitHub App on the owner's account, installed on this repository only.
- [x] A dependency fetched at build time — three actions, pinned to commit SHAs.
- [x] Another story or task — depends on `project-scaffold`, whose four required checks this reads.

## Alternatives considered

- **A fine-grained personal access token** — rejected at the grilling: it expires and has to be
  renewed, it acts as the owner, and it is tied to a personal account.
- **Opening the release PR with `GITHUB_TOKEN` and merging with an admin bypass** — rejected: it makes
  bypassing protection a routine step.
- **Checking every commit message instead of the PR title** — rejected: squash merges keep only the
  title, so that is the text that reaches `main`.
- **No releases until there is something to release** — rejected: the first `feat` should propose
  `0.1.0` on its own, and the machinery is cheapest to get right before anything depends on it.

## Verification

Filled while implementing: the App's permissions and installation scope, as checked by hand; a PR
with a non-conventional title failing `pr-title`; the `repo-settings` job failing when a setting is
changed back; the first release PR with its checks.

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
