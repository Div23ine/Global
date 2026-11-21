#!/usr/bin/env bash
# Syntax-check every frontend script.
# - classic scripts (.js): node --check
# - JSX view modules (.jsx): esbuild parse (from ../backend/node_modules)
# The frontend has no build step in normal operation — this script is a
# verification tool only (AGENTS.md L0).
set -u
cd "$(dirname "$0")"

ESBUILD="../backend/node_modules/.bin/esbuild"
FAIL=0

echo "== node --check: classic scripts =="
for f in js/*.js js/services/*.js; do
  if node --check "$f"; then echo "  ok  $f"; else echo "  FAIL $f"; FAIL=1; fi
done

echo "== esbuild parse: JSX view modules =="
if [ -x "$ESBUILD" ]; then
  for f in js/components/*.jsx js/app/*.jsx js/admin/*.jsx; do
    if "$ESBUILD" "$f" --loader:.jsx=jsx --log-level=error --outfile=/dev/null 2>/tmp/esb.err; then
      echo "  ok  $f"
    else
      echo "  FAIL $f"; cat /tmp/esb.err; FAIL=1
    fi
  done
else
  echo "  (esbuild not found in backend/node_modules — skipping JSX parse)"
fi

exit $FAIL
