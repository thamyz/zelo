#!/usr/bin/env bash
# Joins the readable source into the two files the app loads:
#   app/[0-9][0-9]-*.js   ->  script.js
#   css/[0-9][0-9]-*.css  ->  style.css
#
# WHY A JOIN AND NOT 33 <script>/<link> TAGS:
# this code was written as ONE script and relies on that. Top-level data
# structures reference functions declared further down the file (CINE_STEPS
# points at cineRunIntroEntrance, for example). In one file that works, because
# a function declaration is hoisted to the top of its script. Split into
# separate <script> tags it breaks: each tag hoists only itself. Joining them
# hands the browser exactly the file it had before, so the running app is
# byte-for-byte what it always was, while the source you read stays in small,
# named files.
#
# The number in each filename IS the load order. `ls app/` shows it.
set -euo pipefail
cd "$(dirname "$0")/.."
export COPYFILE_DISABLE=1

# Guard: script.js and style.css are generated. If one was edited by hand that
# edit is about to be destroyed, so stop and say so rather than silently
# overwriting it. .build-checksums records what this script last produced.
STAMPS=".build-checksums"
if [ -f "$STAMPS" ]; then
  for f in script.js style.css; do
    [ -f "$f" ] || continue
    want=$(grep " $f\$" "$STAMPS" | awk '{print $1}' || true)
    have=$(shasum -a 1 "$f" | awk '{print $1}')
    if [ -n "$want" ] && [ "$want" != "$have" ]; then
      echo "STOP: $f has been edited by hand since the last build."
      case "$f" in script.js) src=app ;; *) src=css ;; esac
      echo "      It is generated from $src/ and your change would be lost."
      echo "      Move the change into the matching file, then run this again."
      echo "      To discard the hand edit instead: rm $STAMPS && bash scripts/sync.sh"
      exit 1
    fi
  done
fi

{
  echo "// GENERATED FILE - do not edit."
  echo "// Built from app/ by scripts/build.sh - edit the files in app/ instead,"
  echo "// then run: bash scripts/sync.sh"
  echo "// What lives where: app/README.md"
  echo ""
  cat app/[0-9][0-9]-*.js
} > script.js

{
  echo "/* GENERATED FILE - do not edit."
  echo "   Built from css/ by scripts/build.sh - edit the files in css/ instead,"
  echo "   then run: bash scripts/sync.sh"
  echo "   What lives where: app/README.md */"
  echo ""
  cat css/[0-9][0-9]-*.css
} > style.css

node --check script.js
{ shasum -a 1 script.js; shasum -a 1 style.css; } | sed 's#  \./#  #' > "$STAMPS"

echo "Built script.js ($(wc -l < script.js | tr -d ' ') lines from $(ls app/[0-9][0-9]-*.js | wc -l | tr -d ' ') files)"
echo "Built style.css ($(wc -l < style.css | tr -d ' ') lines from $(ls css/[0-9][0-9]-*.css | wc -l | tr -d ' ') files)"
