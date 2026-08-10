# Current state

Where the work actually stands, and what comes next. Kept short and rewritten rather than appended
to — it describes the present, not the history. `git log` is the history, and
[ARCHITECTURE.md](ARCHITECTURE.md) is the decisions.

Read this first when picking the project back up after a break.

_Last updated: 2026-08-10._

## What runs today

Five screens in five locales, both themes resolved on the server, the accessibility baseline and its
four user options, and the real 162-weapon roster read from the generated catalogue.

**The loop is closed.** A visitor opens a challenge from the landing, lands on their edit page, picks
a mode and reports a win or a loss, and the page comes back with the next weapon dealt. Every screen
reads a stored challenge; nothing renders anything invented.

There is no invented data left anywhere. The played challenge that used to feed the screens is now a
test fixture in `test/played-challenge.ts`, kept because it exercises something the unit tests cannot:
whether the rules hold together across 188 matches and seven runs.

Because those pages take their state from a database, the app no longer runs without one. In this dev
container that means it does not run at all until there is a Neon branch: the local Postgres is not
reachable from `next dev`, for the networking reason below. `src/lib/demo.ts` *plays* a fixed challenge
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
| Route handlers (`src/app/api/`) | written and tested; rate limiting decided, applied at deploy |
| Caching | the public read is cached and tag-invalidated; editing pages are not |
| Every page, landing included | reading from the store |
| Offline queue, PWA | not started |
| Hosting | decided (Vercel + Neon), nothing deployed |

The live site at [iron-squid.top](https://www.iron-squid.top) is still the old Angular app. Nothing
here has been deployed.

## Next steps

In order. Each one is small enough to finish in a sitting.

1. **Prove the production wiring.** The handlers are tested against the fake, and the store against
   a local Postgres, but nothing has run against a Neon endpoint — there is no account yet, so the
   WebSocket pool in `src/db/client.ts` is the one piece of this that has never executed.
2. **The offline queue and the PWA layer.**
3. **The inked re-skin.** Turns 3 and 4, six screens across both themes. Half lands in
   `nocturne.css`; the blots, turf bars and stickers are new markup. Measure the light set first.

## Before the first deployment

Things the code cannot bring with it, and that are easy to discover only after they were needed.

- **Create the Vercel WAF rate-limit rule.** `/api`, IP key, 60s window, 30 requests, deny.
  [RULES.md](RULES.md#security) requires creation to be limited and nothing in the repository
  enforces it — the rule is the enforcement. [ARCHITECTURE.md](ARCHITECTURE.md#persistence) records
  why it covers the whole API rather than only creation.
- **Set `DATABASE_URL`** in the Vercel project. It is read on first use, so a build without it
  succeeds and the first request fails, which is the intended order.
- **Point `iron-squid.top` at the new deployment.** It currently serves the frozen Angular app.

## Open questions

None outstanding. The three that were here — whether a challenge can be unlisted, whether the inked
design is adopted, and what a growing roster does to a live run — are answered in
[CHALLENGE.md](CHALLENGE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

Two things are still owed. The inked **light** mode has not been checked for contrast, because those
screens theme through a class that redefines the custom properties and a static analysis cannot
follow it — that has to happen before the re-skin ships. And the production database connection has
never been executed against a real Neon endpoint.

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
- **Only one `npm run test:db` at a time.** The suite truncates the database between cases, so two
  concurrent runs delete each other's rows mid-test and fail in ways that look exactly like real
  regressions. `fileParallelism: false` covers one run, not two.
- **`npm test` does not type-check.** vitest transpiles without checking, so a type error passes it
  and fails `next build`. One reached `master` that way. `npm run typecheck` exists for this and now
  runs ahead of the tests on `pre-push`.
- **`drizzle-kit` cannot resolve the `@/` alias.** `src/db/schema.ts` imports the domain relatively
  for that reason, the same trap as `scripts/generate-catalogue.mts`.
