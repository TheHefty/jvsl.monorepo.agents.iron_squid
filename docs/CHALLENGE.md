# The Iron Squid challenge

The canonical statement of the challenge Iron Squid tracks. This file is the source of truth for
behaviour: when the code, the UI copy or a design mock disagrees with this document, this document
is what gets implemented — or this document gets changed first, deliberately.

## Vocabulary

These four words are used with exactly these meanings everywhere in the codebase, the UI and the
docs. They are worth reading carefully, because the obvious English reading of "run" is *not* the
one used here.

| Term | Meaning |
| --- | --- |
| **Challenge** | Everything one player does, from the first draw until every weapon is cleared. A player has one challenge; its public page is what gets shared. |
| **Run** | One life-cycle inside a challenge: starts with 1 life and an empty board, ends when lives hit 0. A challenge is a sequence of runs, all but (hopefully) the last one failed. |
| **Draw** | One randomly assigned weapon + gear set. Belongs to exactly one run. |
| **Match** | One game played while a draw is active. A draw is cleared by winning a match with it; losing a match costs a life but keeps the draw. |

"Run #7" therefore means the seventh attempt, which is how the design mocks use it too.

> Vocabulary note: in the conversation that produced this document the words *run* and *attempt*
> were used with the outer/inner meanings swapped. The table above is what won, because it matches
> both the design mocks ("Run #7 — day 12") and the existing Angular app's `runsHistory` field.

## The rules

1. **The draw.** A weapon and a gear set are assigned at random. The player does not choose, and
   cannot re-roll.
2. **Single use.** A drawn weapon leaves the pool for the rest of the run. So does the gear — see
   [Open questions](#open-questions) for the one detail still unsettled.
3. **Win before advancing.** The active draw stays active until the player wins a match with it.
   There is no skipping, for any reason.
4. **Lives.** A run starts with 1 life and earns +1 for every 10 wins within that run. Losing a
   match spends a life.
5. **The reset.** At 0 lives the run ends. A new run begins from nothing: 1 life, 0 wins, the full
   weapon pool and the full gear pool restored, everything re-drawn. Weapons cleared in the dead run
   carry no credit into the new one — they must be won again.
6. **The end.** The challenge is complete when a *single run* has cleared every weapon in the game.

Rule 5 is the whole difficulty of the challenge, and the reason a tracker is worth building: the
cost of one loss late in a run is enormous, and the record of the runs that died is the interesting
part of a player's page.

## Consequences worth stating outright

- **Lives and the win counter both reset.** A new run starts at 1 life and 0 wins toward the next
  life, regardless of how far the previous run got.
- **A losing match is not the end of a draw.** With lives remaining, a loss costs a life and the
  same weapon stays up. Every match is recorded, wins and losses alike, so the log can show deaths.
- **Every kit is a weapon.** The Splattershot and the Tentatek Splattershot are two entries, not
  one, because they are different kits. Side Order replicas do not count. Everything else playable
  in Versus does — currently **162 weapons**.
- **The weapon count is data, not a constant.** Splatoon 3 has gained weapons through updates and
  may gain more, so 162 is a fact about today's roster, not a rule. The number to clear is derived
  from the dataset — the previous Angular implementation hardcoded `129` and silently went stale.
  How the roster is generated, and the exact filter, are in
  [ARCHITECTURE.md](ARCHITECTURE.md#game-data).
- **Reporting is on the honour system.** Nothing verifies that a reported win happened; the player
  types it in. What the server *does* own is the randomness (see
  [ARCHITECTURE.md](ARCHITECTURE.md) and [RULES.md](RULES.md)), because a client that can re-roll
  makes rules 1 and 3 meaningless. A run page shows every entry, so dishonesty is visible rather
  than prevented.

## Open questions

These are unsettled. Nothing that depends on them should be implemented until they are closed.

- **Scope of gear single-use.** Two readings are live. *Per piece*: each head/clothes/shoes item
  leaves the pool individually — this is what the Angular app implements and what the design mocks
  show (slots labelled "single use", a gear ledger counting burned items per slot). *Per set*: the
  drawn combination does not recur but individual pieces may — this is what was chosen in the design
  conversation. The design and the existing code agree with each other and disagree with that
  choice, so it needs an explicit decision. The dataset supports either — there are hundreds of
  items in each of the three slots against 162 weapons, so per-piece never exhausts the pool.
- **Which modes count.** The Angular app allows only the four Anarchy modes (Splat Zones, Tower
  Control, Rainmaker, Clam Blitz); the design's run log shows a Turf War win. One of them is wrong.
- **Identity.** The design shows handles (`@ika_no_9`), a leaderboard and a "Follow this run"
  button, all of which imply persistent accounts. The decision taken was secret-link ownership with
  no accounts at all. See [ARCHITECTURE.md](ARCHITECTURE.md).
