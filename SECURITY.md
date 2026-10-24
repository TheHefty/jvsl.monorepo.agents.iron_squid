# Security policy

## Reporting a vulnerability

**Do not open a public issue, pull request or discussion for a security problem.** Anything posted
there is visible to everyone, and stays visible in notifications and caches after it is deleted.

Report it privately through GitHub instead:
[**Report a vulnerability**](https://github.com/TheHefty/jvsl.monorepo.agents.iron_squid/security/advisories/new)
(the repository's *Security* tab → *Report a vulnerability*). Only the maintainer sees the report,
and the fix can be prepared in a private fork before anything is disclosed.

A useful report says:

- what is affected — the file, endpoint or version, and the commit if you know it;
- how to reproduce it, step by step, or a proof of concept;
- what an attacker gains from it, as you understand it;
- whether you have told anyone else, and whether you intend to publish.

Please do not include real personal data belonging to anyone else in the report. If it is needed to
show the problem, describe it instead.

## What happens next

The project is maintained by one person, so there is no guaranteed response time. What you can
expect:

- an acknowledgement that the report was received;
- an assessment of whether it is a vulnerability and how severe it is;
- a fix, and a GitHub security advisory published once the fix is available, crediting you unless
  you ask not to be named.

If a report is declined, the reason is given.

## Supported versions

Nothing has been released yet. Until a first release, only the latest commit on `main` receives
fixes. This section will name the supported versions once there are any.

## Scope

In scope: the code and configuration in this repository, and whatever is built and deployed from it.

Out of scope: vulnerabilities in third-party dependencies that are not exploitable through this
project — report those upstream — and findings that require physical access to a user's device or
an already compromised account.
