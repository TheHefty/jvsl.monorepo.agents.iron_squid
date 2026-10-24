# Story: The catalogue

| | |
|---|---|
| **Status** | Draft |
| **Epic** | `run-in-the-browser` |
| **Date** | 2026-10-24 |

## Summary

The site knows every Splatoon 3 kit and every gear piece a player can wear online, each with its
name and its image, and says which game version that is.

## Why

The draw is only fair if what it draws from is complete and correct. Delivers FR-1 to FR-4, NFR-D3,
NFR-D4 and NFR-D6: the catalogue generated from a pinned datamine commit, the images fetched at
build and checked against their digests, and a build that refuses to publish a catalogue the rules
cannot be played with.

## Acceptance criteria

In [`catalogue.feature`](catalogue.feature), beside this file.

## Tasks

Written once every story of this round is agreed.

| Order | Task | Status |
|---|---|---|
| — | — | — |

## Out of scope

- Names in locales other than `en-US` — `localized-names`.
- A page to browse the catalogue. The catalogue is what draws are made from, not a wiki.
- Keeping more than one catalogue version. Only one exists until the first pin move; FR-33 is
  `keep-progress`.

## Outcome

Filled in when the status leaves `Draft`.
