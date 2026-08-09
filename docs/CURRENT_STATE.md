# Current state

Where the work actually stands, and what comes next. Kept short and rewritten rather than appended
to — it describes the present, not the history. `git log` is the history, and
[ARCHITECTURE.md](ARCHITECTURE.md) is the decisions.

Read this first when picking the project back up after a break.

_Last updated: 2026-08-09._

## What runs today

The interface, against a demo challenge. Five screens in five locales, both themes resolved on the
server, the accessibility baseline and its four user options, and the real 162-weapon roster read
from the generated catalogue.

Nothing is persisted and no button writes anything. `src/lib/demo.ts` *plays* a fixed challenge
through the domain reducer at request time, so every figure on a page derives from one state and
they cannot contradict each other.

## What exists behind it

| Piece | State |
| --- | --- |
| The rules, as a framework-free domain (`src/domain/`) | done, covered exhaustively |
| The weapon and gear catalogue (`src/data/`) | generated and committed, pinned to game version 1120 |
| Database schema and migrations (`src/db/schema.ts`, `drizzle/`) | done, applied and rehearsed against Postgres 17 |
| Identifier generation and hashing (`src/db/ids.ts`) | done, tested |
| The challenge store | **in progress — the next thing to write** |
| Route handlers, offline queue, PWA | not started |
| Hosting | decided (Vercel + Neon), nothing deployed |

The live site at [iron-squid.top](https://www.iron-squid.top) is still the old Angular app. Nothing
here has been deployed.

## Next steps

In order. Each one is small enough to finish in a sitting.

1. **The challenge store.** Four operations — find by public id, find by the hash of an edit secret,
   create, append a match. The boundary is decided: the store reads and writes and nothing else, and
   a service above it does the read → `applyMatch` → write. That is what keeps the in-memory fake a
   plain `Map`, which is what makes a handler test worth anything.
2. **The contract suite.** The same assertions run against the fake and against a real Postgres, so
   the two cannot drift. `vitest.config.mts` already excludes `*.contract.test.ts` from the default
   run; the `test:db` command that runs them does not exist yet.
3. **Route handlers.** Create a challenge, report a match. Every one tested for its happy path, its
   rejected input and its idempotent replay. Read `node_modules/next/dist/docs/` first — the
   generated `apps/web/AGENTS.md` warns that this Next has breaking changes against what an agent is
   likely to assume, and Middleware being renamed to Proxy has already caught us once.
4. **Wire the pages to the store,** replacing `demo.ts` as the source. `view()` in that file is pure
   and stays; only `play()` is replaced.
5. **Caching the public page.** Not an optimisation: the state is rebuilt by replay on every read,
   and Neon's free tier suspends compute for the rest of the month when its CU-hours run out.
6. **The offline queue and the PWA layer.**

## Open questions

These block nothing right now, but two of them are yours to answer rather than mine.

- **Can a challenge be unlisted?** [CHALLENGE.md](CHALLENGE.md#identity) says public challenges
  appear on the leaderboard, which implies some are not. If they can, the public slug stops being
  merely unenumerable and becomes a quasi-credential.
- **Is the inked design direction adopted?** Turns 3 and 4 of the design doc. Presentational only.
- **Does a mid-run roster change disturb a live run?** A rule of the challenge before it is a schema
  question — see [CHALLENGE.md](CHALLENGE.md#open-questions).

## Things that will bite you

Learned the hard way, and cheaper to read than to rediscover.

- **Nothing in the dev container reaches a container over the network.** The Docker daemon is behind
  a socket and its containers are in another network namespace; a published port does not listen
  here, and the daemon's bridge shares this container's `172.17.0.0/16`, so a container's own IP
  resolves back to us. Use the `db:*` commands, which run the work inside the database's network. A
  direct `drizzle-kit migrate` from here hangs and then reports success against nothing.
- **`npm run format` and `lint-staged` only reach `apps/web`.** The Markdown under `docs/` is
  deliberately outside Prettier's scope — do not reformat it while editing it.
- **The pull request title is not what the changelog quotes any more.** Merges use a merge commit, so
  each commit on the branch reaches `master` on its own and release-please reads them individually.
- **`drizzle-kit` cannot resolve the `@/` alias.** `src/db/schema.ts` imports the domain relatively
  for that reason, the same trap as `scripts/generate-catalogue.mts`.
