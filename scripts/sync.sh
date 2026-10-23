#!/usr/bin/env bash
# The one command to run after editing anything in app/, css/, services/ or
# index.html. It:
#   1. joins app/ -> script.js and css/ -> style.css   (scripts/build.sh)
#   2. copies the web files into the two folders the app runs from
#   3. deletes the ._* junk this exFAT drive creates on every write
#   4. checks the copies really match
#
# It does NOT touch assets/. Images, video, fonts, native plugins and
# capacitor.config.json still go through `npx cap copy ios`.
set -euo pipefail
cd "$(dirname "$0")/.."
export COPYFILE_DISABLE=1

bash scripts/build.sh

DESTS=("www" "ios/App/App/public")
FILES=(index.html script.js style.css config.js data.js words-dict.txt
       personas.js personas-roster.js personas-posts.js
       personas-about.js personas-men.js personas-threads.js)

for d in "${DESTS[@]}"; do
  mkdir -p "$d/services"
  for f in "${FILES[@]}"; do [ -f "$f" ] && cp "$f" "$d/$f"; done
  cp services/*.js "$d/services/"
  # app/ and css/ are source only: the app loads the joined bundles, so a stale
  # copy of the split files in the bundle would just be dead weight.
  rm -rf "$d/app" "$d/css"
done

find . www ios/App/App/public -name '._*' -not -path './node_modules/*' -delete 2>/dev/null || true

a=$(find www -type f | wc -l | tr -d ' ')
b=$(find ios/App/App/public -type f | wc -l | tr -d ' ')
echo "www: $a files   ios public: $b files   (public should have exactly 2 more: Capacitor's own empty cordova files)"
[ $((b - a)) -eq 2 ] || { echo "MISMATCH in file counts"; exit 1; }

for f in index.html script.js style.css services/auth.js; do
  cmp -s "$f" "www/$f" && cmp -s "$f" "ios/App/App/public/$f" || { echo "NOT identical: $f"; exit 1; }
done
echo "Synced. Source, www and ios public match."
