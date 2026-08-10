# Current state

Where the work actually stands, and what comes next. Kept short and rewritten rather than appended
to — it describes the present, not the history. `git log` is the history, and
[ARCHITECTURE.md](ARCHITECTURE.md) is the decisions.

Read this first when picking the project back up after a break.

_Last updated: 2026-08-10._

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
| The challenge store (`src/db/store*.ts`) | done — two implementations, one shared contract |
| The service over it (`src/service/`) | done — creates, reads, reports; owns the clock and the CSPRNG |
| Route handlers, offline queue, PWA | not started |
| Hosting | decided (Vercel + Neon), nothing deployed |

The live site at [iron-squid.top](https://www.iron-squid.top) is still the old Angular app. Nothing
here has been deployed.

## Next steps

In order. Each one is small enough to finish in a sitting.

1. **Route handlers.** Create a challenge, report a match. Every one tested for its happy path, its
   rejected input and its idempotent replay. Read `node_modules/next/dist/docs/` first — the
   generated `apps/web/AGENTS.md` warns that this Next has breaking changes against what an agent is
   likely to assume, and Middleware being renamed to Proxy has already caught us once.
2. **Wire the pages to the store,** replacing `demo.ts` as the source. `view()` in that file is pure
   and stays; only `play()` is replaced.
3. **Caching the public page.** Not an optimisation: the state is rebuilt by replay on every read,
   and Neon's free tier suspends compute for the rest of the month when its CU-hours run out.
4. **The offline queue and the PWA layer.**
5. **The inked re-skin.** Turns 3 and 4, six screens across both themes. Half lands in
   `nocturne.css`; the blots, turf bars and stickers are new markup. Measure the light set first.

## Open questions

None outstanding. The three that were here — whether a challenge can be unlisted, whether the inked
design is adopted, and what a growing roster does to a live run — are answered in
[CHALLENGE.md](CHALLENGE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

One measurement is still owed: the inked **light** mode has not been checked for contrast, because
those screens theme through a class that redefines the custom properties and a static analysis cannot
follow it. That has to happen before the re-skin ships.

## Things that will bite you

Learned the hard way, and cheaper to read than to rediscover.

- **Nothing in the dev container reaches a container over the network.** The Docker daemon is behind
  a socket and its containers are in another network namespace; a published port does not listen
  here, and the daemon's bridge shares this container's `172.17.0.0/16`, so a container's own IP
  resolves back to us. Use the `db:*` commands, which run the work inside the database's network. A
  direct `drizzle-kit migrate` from here hangs and then reports success against nothing.
- **`npm run format` and `lint-staged` only reach `apps/web`.** The Markdown under `docs/` is
  deliberately outside Prettier's scope — do not reformat it while editing it.
- **Both the branch's commits and the pull request title reach the changelog.** Merges use a merge
  commit, so release-please reads each commit on the branch — and the merge commit too, which carries
  the pull request title in its body. Write that title as an ordinary sentence, not as a `feat:` or
  `fix:`, or it becomes an extra entry summarising the real ones.
- **`npm test` does not type-check.** vitest transpiles without checking, so a type error passes it
  and fails `next build`. One reached `master` that way. `npm run typecheck` exists for this and now
  runs ahead of the tests on `pre-push`.
- **`drizzle-kit` cannot resolve the `@/` alias.** `src/db/schema.ts` imports the domain relatively
  for that reason, the same trap as `scripts/generate-catalogue.mts`.
