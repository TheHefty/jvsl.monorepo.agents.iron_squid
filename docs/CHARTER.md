# Project Charter: Iron Squid

| | |
|---|---|
| **Status** | Draft |
| **Date** | 2026-10-24 |
| **Author** | João Lima, with Claude |
| **Kind** | new |

The terms of reference the whole project is built against. Amended only by another grilling,
because everything downstream assumes it.

## Purpose

**Iron Squid** is a Splatoon 3 challenge, and this project is the website that runs it. The
challenge: win consecutively with every weapon in the game, each paired with randomly drawn gear,
and start over — replaying every weapon already conquered — whenever a defeat costs the last life.
The website does what a player cannot do fairly by hand: it draws the weapon and the gear, keeps
the run honest to the rules, remembers where the player is, and gives them a link that shows the
run to anyone they share it with. It exists for Splatoon players who want a long, visible test of
how well they play with *everything*, not only with their main.

### The rules the site enforces

- Each match is assigned a random weapon, and a random piece of headgear, clothing and shoes.
- Each piece of gear is used at most once in a run.
- A win must be secured with the drawn weapon and gear before the next draw. Nothing is skipped.
- The player starts with **1 life** and earns **1 more for every 10 wins**. Wins during a replay
  count toward that.
- A loss costs a life, and the player tries the same weapon and gear again.
- At **0 lives**, the run returns to the beginning: the player replays the weapons already won, in
  the same order and with the same gear, and lives go back to 1.
- The run is complete when every weapon in the game has been won with.

## In scope / out of scope

**In scope**

- The random draw of weapon and gear from the **full Splatoon 3 catalogue** — every gear piece in
  the game, not only those a given player owns.
- The run itself: the rules above, applied by the site rather than remembered by the player.
- Progress kept **in the player's own browser**, with export and import so it survives a cleared
  browser or a change of device.
- A **share link** that encodes the run, which anyone can open to see it, read-only. This is how
  achievements reach the community: through the places players already post, not a feed of our own.
- Weapon and gear **images from the game**.
- The interface in **every language Splatoon 3 ships in, plus Brazilian Portuguese**. In pt-BR,
  weapon and gear names stay in English, because the game has no official Portuguese names.
- A static site, published on **GitHub Pages**.

**Out of scope — deliberately**

- **Accounts, a server, a leaderboard or a community feed.** Sharing is a link; nothing is stored
  anywhere but the player's browser. This is the decision that keeps the site free of personal data.
- **Verifying wins.** The site cannot see the game; it records what the player reports. Honesty is
  the player's, and the share link is the social check.
- **Filtering gear by what the player owns.**
- **Splatoon and Splatoon 2.** Splatoon 3 only.
- **Which modes count as a match.** The site does not police Turf War against Anarchy or private
  battles; that is the community's rule to set.
- **Analytics, cookies, advertising and tracking of any kind.**
- **A native or mobile app.** The site works on a phone's browser; there is no app.
- **Any affiliation with Nintendo.** This is a fan project, and it says so.

## Stakeholders

- **João Lima** — owner and sole maintainer. Decides what "done" means and is the only person who
  has to agree a change of scope.
- **Players** — the audience: anyone attempting the challenge, and anyone opening a run someone
  shared. Not consulted before scope changes, but the reason for every one.
- **Nintendo** — owner of Splatoon, its names and its images. Not a stakeholder the project
  consults, but the one whose rights constrain what the site may show and how.

## Standing decisions

- **Mode of work — Pair Programming.** The agent drives and the owner navigates: direction, risk
  and what ships stay with the owner.
- **Documentation language — English**, commit messages included. The interface is localized
  separately; that is a product requirement, not the documentation's language.
- **Long-term memory — on.** The project carries `.ai-memory.toml`. It buys handoffs across sessions
  and search over what was already decided; it costs prompts and tool excerpts captured to disk, on
  this machine and for this project only. No LLM provider is configured, so nothing leaves the
  machine.
- **Licence — MIT**, for the code and the documentation, chosen while the project is one author and
  relicensing costs nothing. **It does not cover Nintendo's assets**: the weapon and gear images and
  names belong to Nintendo, cannot be relicensed by this project, and are excluded from it
  explicitly. How the images are obtained and served is decided in the SRS.
- **Audience — public.** The site is reachable by anyone, so LGPD and the Marco Civil da Internet
  apply. The project is designed to process **no personal data** of its own; the SRS records that as
  a data map, including what GitHub Pages processes as host.
- **Accessibility and internationalization from the first screen.** Both are requirements in the
  SRS, not a later pass.

## What would change this charter

- **Adding anything that stores data off the player's device** — accounts, a leaderboard, comments,
  a server of any kind. That brings personal data, and with it LGPD obligations the site was not
  designed for.
- **Adding analytics, ads or donations.** Tracking brings consent; money brings an economic purpose.
- **A rights holder's objection**, such as a takedown notice about the images.
- **A new Splatoon game**, or a decision to cover the earlier ones.
- **A change to the challenge's rules.** The rules above are the product.

## Outcome

Filled in when the status leaves `Draft`.
