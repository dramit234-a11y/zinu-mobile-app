#!/usr/bin/env bash
# Explains why a Codespaces forwarded-port address (https://<codespace>-<port>.app.github.dev) does not open on a phone:
# GitHub forwarding problem, or DNS on the phone's / Mac's network. Read-only: changes nothing.
#   pnpm phone:diagnose [port]     (default port 8081)
set -uo pipefail
PORT=${1:-8081}
[ -n "${CODESPACE_NAME:-}" ] || { echo "Run this inside a GitHub Codespace."; exit 1; }
DOMAIN=${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}
HOST="${CODESPACE_NAME}-${PORT}.${DOMAIN}"
doh() { curl -s --max-time 8 -H 'accept: application/dns-json' "$1?name=$2&type=A" | grep -oE '"data":"[0-9.]+"' | head -1 | cut -d'"' -f4; }

echo "Forwarded address : https://$HOST"
echo "Host name length  : ${#HOST} characters (first label ${#CODESPACE_NAME}+$((${#PORT} + 1)), DNS limit 63 per label)"
echo
echo "DNS, as the internet sees it (from inside this Codespace):"
G=$(doh https://dns.google/resolve "$HOST"); C=$(doh https://cloudflare-dns.com/dns-query "$HOST")
echo "  Google DNS     : ${G:-NOT FOUND}"
echo "  Cloudflare DNS : ${C:-NOT FOUND}"
echo "  This machine   : $(getent hosts "$HOST" | awk '{print $1}' | head -1 || true)"
echo
CODE=$(curl -s -o /dev/null --max-time 10 -w '%{http_code}' "https://$HOST/")
echo "HTTPS to the forwarded address: ${CODE} (200 = public; 302/401 = private, sign-in needed; 000 = unreachable)"
echo "Port visibility (GitHub):"
gh codespace ports -c "$CODESPACE_NAME" 2>/dev/null | sed 's/^/  /' || echo "  (gh could not list ports)"
echo
if [ -n "$G$C" ] && [ "$CODE" != 000 ]; then
  echo "Verdict: GitHub's forwarding and public DNS are working. If your iPhone/Mac says the server can't be found,"
  echo "         the DNS server of YOUR network is not resolving *.${DOMAIN}. Try mobile data, or set the iPhone's"
  echo "         Wi-Fi DNS to 1.1.1.1. 'pnpm phone' avoids this by using a Cloudflare tunnel address instead."
elif [ -z "$G$C" ]; then
  echo "Verdict: public DNS has no record for this address: GitHub is not forwarding port $PORT right now."
  echo "         Check the PORTS tab, and that something is listening on port $PORT."
else
  echo "Verdict: DNS works, but GitHub's forwarding service did not answer. Check the PORTS tab and try again."
fi
