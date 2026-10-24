# Story: Report a match

| | |
|---|---|
| **Status** | Accepted |
| **Epic** | `run-in-the-browser` |
| **Date** | 2026-10-24 |

## Summary

A player reports each match as a win or a loss, sees their lives rise and fall by the challenge's
rules, and can take back a result reported by mistake.

## Why

Results are what move a run. Delivers FR-15 to FR-17, FR-20, FR-22 and FR-23, and NFR-A4: a result
is announced to a screen reader, not only drawn on the screen. Undo exists because a mistapped
"loss" with one life left would otherwise cost the player a whole reset.

## Acceptance criteria

In [`report-a-match.feature`](report-a-match.feature), beside this file.

## Tasks

Written once every story of this round is agreed.

| Order | Task | Status |
|---|---|---|
| — | — | — |

## Out of scope

- Losing the last life — `reset-and-replay`.
- Winning the last kit — `finish-a-run`.
- Undoing more than the last result. One step back is a correction; more is a way to rewrite a run.

## Outcome

Agreed on 2026-10-24 by João Lima at the story gate (PR #13), with its scenarios as written. What
shipped is recorded here when the story is done.
