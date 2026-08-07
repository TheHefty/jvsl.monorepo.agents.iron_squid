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
2. **Single use, per item.** A drawn weapon leaves the pool for the rest of the run, and so does
   each individual piece of gear: the head, the clothes and the shoes each leave their own pool.
   Not the combination — the *item*.
3. **Win before advancing.** The active draw stays active until the player wins a match with it.
   There is no skipping, for any reason. A win is a won match in **Anarchy Battle or X Battle** —
   Splat Zones, Tower Control, Rainmaker or Clam Blitz. Turf War does not count.
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
- **The mode is recorded; the stage is not.** Reporting a match names which of the four ranked modes
  it was played in. That is the only trace rule 3 leaves: results cannot be verified, but a log that
  names the mode makes "this was Anarchy or X Battle" something a reader can check rather than
  simply assume. The stage proves nothing, so it is one more field nobody has to fill in.
- **Reporting is on the honour system.** Nothing verifies that a reported win happened; the player
  types it in. What the server *does* own is the randomness (see
  [ARCHITECTURE.md](ARCHITECTURE.md) and [RULES.md](RULES.md)), because a client that can re-roll
  makes rules 1 and 3 meaningless. A run page shows every entry, so dishonesty is visible rather
  than prevented.

## Why single use is per item

Recorded because the alternative reading was chosen first, and the arithmetic is what overturned it.

Across the three slots there are 245 head, 335 clothes and 226 shoes — **18,548,950** possible
combinations. Over the 162 draws of a complete run, the chance that any combination recurs is
**0.070%**: about one run in fourteen hundred. "The drawn set does not repeat" is therefore a rule
that would essentially never bind. It forbids nothing that was not already going to be true.

Per item does bind. A complete run burns 66% of the head pool, 48% of the clothes and 72% of the
shoes — enough that the ledger of what has been spent is worth showing, which is what the design's
gear ledger was always for. It is also what the Angular app implements, so the two agree.

Those pool sizes are the drawable pools, not the raw dataset — see
[the gear that is out of the pool](#the-gear-that-is-out-of-the-pool) below.

## The gear that is out of the pool

The dataset carries 943 pieces of gear. **806** of them can be drawn. Two cuts get us there, and both
are rules of the challenge rather than data cleanup, which is why they are stated here.

**Gear that cannot be worn in a Versus battle** — 73 pieces, marked `HowToGet: "Impossible"` in the
dataset. These are the Salmon Run work uniforms and the original Hero Mode and Side Order outfits.
The *replicas* of those outfits are separate items that anyone can obtain, and they stay in the pool;
only the originals go.

**Amiibo gear** — 64 pieces, which require buying a physical figure. This is the judgement call, not
the obvious one. Rule 3 forbids skipping a draw for any reason, so drawing a piece a player has no
way to acquire would stall a run indefinitely on a constraint that has nothing to do with playing
Splatoon. Every other hard-to-get family stays in: Splatfest gear, Salmon Run rewards and the Side
Order replicas are all reachable by someone who simply keeps playing, and being *hard* to get is the
challenge working as intended.

## Identity

There are no accounts. A player picks a display name when they create their challenge and it is
never verified — anyone could claim any name. That is consistent rather than careless: results are
already self-reported on the honour system, so an unverified name adds no weakness that the
challenge did not already accept, and it avoids collecting personal data the project has no use for
(see [RULES.md](RULES.md#privacy)).

Public challenges appear on a leaderboard, which needs no login to read or to be listed on. The
design's "Follow this run" button implies an account to attach a subscription to, so it becomes
"copy link" instead.

## Open questions

- **What happens to a live run when Splatoon 3 adds weapons.** Growing the target under a player
  who is part-way through is one answer; pinning a run to the roster version it started on is
  another. This is a rule of the challenge, not a data problem, which is why it is here.
