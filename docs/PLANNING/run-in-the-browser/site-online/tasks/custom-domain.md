---
status: Draft
story: run-in-the-browser/site-online
epic: run-in-the-browser
pr:
depends-on: [pages-deploy]
---

# Task: custom-domain

## Summary

Moves the site from `thehefty.github.io/jvsl.monorepo.agents.iron_squid/` to
**`https://iron-squid.top/`**, with `www` redirecting to it and HTTPS enforced. The domain is
verified on the GitHub account so nobody else can claim it, and it is closed to e-mail, so nobody
can send mail as it. The DNS changes are made by the owner in HostGator's panel, from the exact list
below; the agent has no access to it.

## Problem

NFR-D7 puts the site on its own domain, and every link a player shares carries that address. As of
2026-10-24, `iron-squid.top` is registered, with DNS at HostGator (`dns3/dns4.hostgator.com.br`), and
it points somewhere else:

| Record | Today | Note |
|---|---|---|
| `@` A | `162.240.81.81` | HostGator hosting. The owner confirmed it can be replaced. |
| `@` MX | `0 iron-squid.top.` | Mail to the apex host. The owner confirmed the domain receives no mail. |
| `www` CNAME | `green-ground-0d403d10f.4.azurestaticapps.net.` | An Azure Static Web App. The owner confirmed it can be replaced. |
| TXT, AAAA, CAA | none | |

## Proposal

The steps happen in this order, because a step out of order takes the site down (failure 1).

1. **Verify the domain on the GitHub account** (owner). In *Settings → Pages → Verified domains*,
   add `iron-squid.top`; GitHub shows a TXT record to create, at
   `_github-pages-challenge-TheHefty.iron-squid.top`. Create it, then press *Verify*.
2. **Change the DNS in HostGator** (owner):

   | Action | Name | Type | Value |
   |---|---|---|---|
   | remove | `@` | A | `162.240.81.81` |
   | add | `@` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
   | add | `@` | AAAA | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
   | replace | `www` | CNAME | `thehefty.github.io.` |
   | replace | `@` | MX | `0 .` (a *null MX*, RFC 7505: this domain accepts no mail) |
   | add | `@` | TXT | `v=spf1 -all` (no host may send mail as this domain) |
   | add | `_dmarc` | TXT | `v=DMARC1; p=reject;` (receivers reject mail that claims to be from it) |

   If HostGator's panel refuses a null MX, removing the MX record is the fallback; the SPF and DMARC
   records still stop spoofing.
3. **`site/scripts/check-dns.sh`** checks that what DNS answers is exactly the table above: the four
   A, the four AAAA, the `www` CNAME, the null MX, SPF and DMARC. It exits non-zero, naming each
   record that differs and what it found. It has a `check-dns.test.sh` beside it, which runs it
   against a stub resolver. This task's PR is merged only after the script passes against real DNS.
4. **The PR** adds `site/public/CNAME` (`iron-squid.top`), sets `BASE_PATH=/` in `deploy.yml`,
   points the smoke run at `https://iron-squid.top/`, and sets the Pages custom domain through the
   API. Once GitHub has issued the certificate, `https_enforced` is set to `true`.
5. **The smoke job** also asserts that `gh api repos/{repo}/pages` reports `cname: iron-squid.top`
   and `https_enforced: true`, and runs `check-dns.sh`, so DNS drift shows up on the next deploy.
6. **The SRS data map** names HostGator as the DNS provider, replacing "named once the domain is
   registered". The privacy notice is written in `notices`, and says the same.

Scenarios this task turns green, now against the domain: *A merged change reaches the domain* and
*Plain HTTP is upgraded*.

## Three worst failure scenarios

| # | Scenario | How it manifests | Test that catches it |
|---|---|---|---|
| 1 | **The site goes down during the move.** The `CNAME` and `BASE_PATH=/` are published before DNS points at GitHub, so `github.io` redirects to a domain that still resolves to HostGator. | Every visit lands on the old host or fails, for as long as DNS takes to propagate. | The merge waits for `check-dns.sh` to pass against real DNS, recorded under *Verification*. After deploy, the smoke run's `@deployed` scenarios hit `https://iron-squid.top/`. |
| 2 | **Someone else claims the domain.** If the Pages custom domain is ever removed while DNS still points at GitHub, any GitHub user can publish a site on `iron-squid.top`. | Players' shared links serve a stranger's content under our name. | Verifying the domain on the account (step 1) is what prevents it: only `TheHefty` can then use it. The verification cannot be read back through the public API, so it is checked by hand and recorded under *Verification*, with a screenshot of *Verified domains*. |
| 3 | **HTTPS is not enforced, or the certificate is missing.** GitHub issues the certificate asynchronously, and enforcement can only be switched on afterwards; it is easy to stop half-way. | The site answers over plain HTTP, or with a certificate error that browsers block. | The `@deployed` scenario *Plain HTTP is upgraded* against the domain. The smoke job asserts `https_enforced: true`, and its HTTPS request fails on any invalid certificate. |

## Blast radius

- [x] Repository settings — Pages custom domain and HTTPS enforcement.
- [x] Outside this repository — DNS at HostGator (made by the owner), and domain verification on the
  GitHub account. **The HostGator hosting at `162.240.81.81` and the Azure Static Web App at `www` stop
  receiving traffic for this domain.** The owner confirmed both can be replaced. Deleting them, if
  wanted, is the owner's step, outside this task.
- [x] Another story or task — depends on `pages-deploy`. `notices` names HostGator in the privacy notice.
- [x] The SRS — the data map row for DNS.

## Alternatives considered

- **Keeping `github.io`** — rejected at the story grilling: the address is long, and it is what every
  shared link carries.
- **Serving only `www`, with the apex redirecting** — rejected: the apex is shorter in shared links,
  and GitHub redirects `www` to it on its own once both resolve to Pages.
- **A CAA record limiting certificates to Let's Encrypt** — rejected for now: GitHub's issuer is not
  ours to pin, and a wrong CAA blocks the certificate. That is failure 3, caused by the fix.
- **Leaving the MX as it is** — rejected: it would point mail at GitHub's addresses, which accept
  none, and leave the domain open to spoofing.

## Verification

Filled while implementing: `check-dns.sh` output against real DNS before the merge, the domain
verification, and the smoke run's result against `https://iron-squid.top/`.

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

None. The owner confirmed on 2026-10-24 that the apex hosting and the Azure app at `www` can be
replaced, and that the domain receives no mail.

## Outcome

Filled in when the status leaves `Draft`.
