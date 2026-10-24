#!/usr/bin/env bash
# Checks that iron-squid.top's DNS is exactly what the custom-domain task (is-82z.1.3) set up, and
# names every record that differs. Run before the domain is published and on every deploy's smoke
# run, so drift shows up on the next deployment instead of in a player's browser.
#
# The A and AAAA records must be GitHub Pages' own addresses: Cloudflare's addresses there mean a
# record was left proxied, which puts Cloudflare between every visitor and the site (SRS, data map).
# There must be no DS record: the registrar cannot publish DNSSEC, and a stray DS without a signed
# zone behind it makes the domain unresolvable for validating resolvers.
set -u
domain=${DOMAIN:-iron-squid.top}
server=${DNS_SERVER:+@$DNS_SERVER}
problems=0

answer() { dig +short "$1" "$2" $server | sort | tr '\n' ' ' | sed 's/ $//'; }

expect() { # type, name, expected answer (sorted, space-separated)
  local got
  got=$(answer "$1" "$2")
  if [ "$got" != "$3" ]; then
    echo "check-dns: $1 $2 is \"${got:-<none>}\", expected \"${3:-<none>}\"" >&2
    problems=$((problems + 1))
  fi
}

ns=$(answer NS "$domain")
if [ -z "$ns" ] || grep -qvE '\.ns\.cloudflare\.com\.$' <<<"$(tr ' ' '\n' <<<"$ns")"; then
  echo "check-dns: NS $domain is \"${ns:-<none>}\", expected Cloudflare's nameservers" >&2
  problems=$((problems + 1))
fi
expect A "$domain" "185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153"
expect AAAA "$domain" "2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153"
expect CNAME "www.$domain" "thehefty.github.io."
expect TXT "$domain" '"v=spf1 -all"'
expect TXT "_dmarc.$domain" '"v=DMARC1; p=reject;"'
expect DS "$domain" ""
mx=$(answer MX "$domain")
if [ -n "$mx" ] && [ "$mx" != "0 ." ]; then
  echo "check-dns: MX $domain is \"$mx\", expected none or a null MX (\"0 .\"): the domain takes no mail" >&2
  problems=$((problems + 1))
fi

if [ "$problems" -gt 0 ]; then
  echo "check-dns: $problems record(s) differ from the custom-domain task; see above" >&2
  exit 1
fi
echo "check-dns: $domain is configured as expected"
