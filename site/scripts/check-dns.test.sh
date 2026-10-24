#!/usr/bin/env bash
# Drives the real check-dns.sh against a stub resolver: a fake `dig` that answers from a table, so
# each record the script checks can be made right or wrong on purpose.
set -u
here=$(cd "$(dirname "$0")" && pwd)
stub=$(mktemp -d)
trap 'rm -rf "$stub"' EXIT
fails=0

# The answers of a correctly configured domain, one "TYPE NAME|answer" per line.
good() {
  cat <<'ANSWERS'
NS iron-squid.top|ali.ns.cloudflare.com.
NS iron-squid.top|garret.ns.cloudflare.com.
A iron-squid.top|185.199.108.153
A iron-squid.top|185.199.109.153
A iron-squid.top|185.199.110.153
A iron-squid.top|185.199.111.153
AAAA iron-squid.top|2606:50c0:8000::153
AAAA iron-squid.top|2606:50c0:8001::153
AAAA iron-squid.top|2606:50c0:8002::153
AAAA iron-squid.top|2606:50c0:8003::153
CNAME www.iron-squid.top|thehefty.github.io.
TXT iron-squid.top|"v=spf1 -all"
TXT _dmarc.iron-squid.top|"v=DMARC1; p=reject;"
ANSWERS
}

cat > "$stub/dig" <<'DIG'
#!/usr/bin/env bash
# Called as: dig +short TYPE NAME [@server]
type=$2 name=$3
grep "^$type $name|" "$ANSWERS" | cut -d'|' -f2
DIG
chmod +x "$stub/dig"

run() { # name, expected exit (0 or 1), expected text in output, answers on stdin
  local name=$1 want=$2 text=$3 out code
  cat > "$stub/answers"
  out=$(ANSWERS="$stub/answers" PATH="$stub:$PATH" "$here/check-dns.sh" 2>&1); code=$?
  if [ "$code" -ne "$want" ] || ! grep -qF -- "$text" <<<"$out"; then
    echo "FAIL: $name (exit $code, wanted $want and \"$text\")"; echo "$out" | sed 's/^/    /'
    fails=$((fails + 1))
  else
    echo "ok: $name"
  fi
}

good | run "a correct domain passes" 0 "check-dns: iron-squid.top is configured as expected"
good | grep -v '185.199.111.153' | run "a missing A record fails, naming it" 1 "A iron-squid.top"
good | sed 's/^A iron-squid.top|185.199.108.153/A iron-squid.top|104.21.46.160/' |
  run "a proxied record fails, naming what it found" 1 "104.21.46.160"
good | sed 's/v=spf1 -all/v=spf1 ~all/' | run "a soft SPF fails" 1 "TXT iron-squid.top"
good | grep -v '^CNAME' | run "a missing www fails" 1 "CNAME www.iron-squid.top"
good | sed 's/ns.cloudflare.com/hostgator.com.br/' | run "nameservers elsewhere fail" 1 "NS iron-squid.top"
{ good; echo 'DS iron-squid.top|2371 13 2 ABCDEF'; } | run "a stray DS fails" 1 "DS iron-squid.top"
{ good; echo 'MX iron-squid.top|10 mail.example.com.'; } | run "a mail server fails" 1 "MX iron-squid.top"
{ good; echo 'MX iron-squid.top|0 .'; } | run "a null MX passes" 0 "configured as expected"

[ "$fails" -eq 0 ] || { echo "$fails failure(s)"; exit 1; }
