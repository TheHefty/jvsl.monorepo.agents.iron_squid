# Security policy

Iron Squid is a hobby project run by a single maintainer, and this policy says so plainly rather
than promising a response time it cannot keep. Reports are taken seriously and handled as fast as
one person reasonably can.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Use GitHub's private vulnerability
reporting on this repository — the *Security* tab → *Report a vulnerability*. That creates a private
advisory only the maintainer can see, and it is the preferred channel.

A useful report says what an attacker can do, not just what looks wrong: the affected URL or file,
the steps to reproduce it, and what an attacker gets out of it. A proof of concept is welcome.
Please report against your own challenge rather than someone else's.

You will get an acknowledgement when the report is read. If a fix is warranted it ships as a normal
`fix` release, and the advisory is published with credit to the reporter unless you ask otherwise.

## Scope

In scope: this repository, and the deployed site at [iron-squid.top](https://www.iron-squid.top).

The classes of bug that matter most here follow directly from how the product works:

- **Anything that exposes a secret edit link.** It is the only credential in the system — it grants
  full write and delete access to a challenge, with no second factor. Leaking one through a
  referrer, a log, a link preview, a cache, an error page or a public run page is a real
  vulnerability.
- **Editing or deleting a challenge without holding its secret link**, in any form: guessing a
  token, enumerating them, or reaching a write path that fails to check one.
- **Client-controlled randomness.** Draws are generated and persisted server-side on purpose. Any
  way to influence, replay or re-roll a draw from the client defeats the challenge and counts as a
  vulnerability, not a feature request.
- The usual web classes: injection, XSS (player-chosen handles are untrusted text), SSRF, broken
  access control, dependency vulnerabilities that are actually reachable here.

## Out of scope

- **False results.** Reporting a win you did not get is possible by design — match results are
  self-reported on the honour system, and the run page shows every entry so that dishonesty is
  visible rather than prevented. This is documented in [`docs/CHALLENGE.md`](docs/CHALLENGE.md) and
  is not a vulnerability.
- **A public run page being public.** Sharing is the point of the product.
- Missing hardening headers, cookie flags or scanner output with no demonstrated impact.
- Denial of service through volume, automated scanning, and social engineering of the maintainer.
- Vulnerabilities in third-party services the site depends on — report those to the service.

## Safe harbour

Testing done in good faith under this policy is welcome and will not be pursued: stay within your
own data, do not access or modify anyone else's challenge, do not degrade the service for others,
and give the maintainer a reasonable chance to fix an issue before disclosing it publicly.

## Supported versions

Only the currently deployed version is supported. There are no maintained release branches, and
fixes land on `master` and deploy from there.
