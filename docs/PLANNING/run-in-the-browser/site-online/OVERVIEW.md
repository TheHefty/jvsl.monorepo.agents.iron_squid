# Story: The site is online

| | |
|---|---|
| **Status** | Accepted |
| **Epic** | `run-in-the-browser` |
| **Date** | 2026-10-24 |

## Summary

Anyone can open Iron Squid at its own domain, and nothing reaches `main` that breaks the build, the
tests or the accessibility check.

## Why

Every other story needs somewhere to be seen and a gate that keeps it working. Delivers NFR-D1,
NFR-D2, NFR-D5, NFR-D7 and NFR-A8, and lays the seams NFR-I1 and NFR-I8 depend on: every string in a
catalogue, and every page under a locale's address, from the first commit.

## Acceptance criteria

In [`site-online.feature`](site-online.feature), beside this file.

## Tasks

| Order | Task | Status |
|---|---|---|
| 1 | [`tasks/project-scaffold.md`](tasks/project-scaffold.md) | Draft |
| 2 | [`tasks/pages-deploy.md`](tasks/pages-deploy.md) | Draft |
| 3 | [`tasks/custom-domain.md`](tasks/custom-domain.md) | Draft |
| 4 | [`tasks/release-please.md`](tasks/release-please.md) | Draft |

## Out of scope

- Anything on the page beyond a home page that names the site — the run is `draw-a-set` onward.
- Languages other than `en-US` — `every-language`.
- The notices and the fan disclaimer — `notices`.
- Registering the domain. That is the owner's to buy; this story points it at the site.

## Outcome

Agreed on 2026-10-24 by João Lima at the story gate (PR #17), with its scenarios as written. What
shipped is recorded here when the story is done.
