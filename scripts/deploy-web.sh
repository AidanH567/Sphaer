#!/usr/bin/env bash
#
# Build the Expo web bundle and deploy it to Vercel as a static site.
#
#   npm run deploy:web
#
# Why the font shuffle: `expo export` emits the @expo/vector-icons fonts under
# `dist/assets/node_modules/...`, and Vercel refuses to upload anything under a
# `node_modules` path — so the icon fonts 404 on the deploy and every icon
# renders as a tofu box. We move them to `dist/assets/vendor/` and repoint the
# bundle's references before deploying. Re-run this whenever you want the public
# link to reflect new code. Requires `vercel login` (one-time).
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DIST="$ROOT/dist"
STABLE_URL="https://dist-one-xi-6l5bcv6rkc.vercel.app"

echo "▶ Exporting web bundle…"
rm -rf "$DIST"
npx expo export --platform web

echo "▶ Moving icon fonts out of the node_modules path (Vercel won't upload those)…"
if [ -d "$DIST/assets/node_modules" ]; then
  mv "$DIST/assets/node_modules" "$DIST/assets/vendor"
  # Repoint every reference in the JS + CSS bundles.
  find "$DIST/_expo/static" -type f \( -name '*.js' -o -name '*.css' \) \
    -exec perl -pi -e 's#assets/node_modules/#assets/vendor/#g' {} +
  if grep -rq 'assets/node_modules/' "$DIST/_expo" 2>/dev/null; then
    echo "✗ Some assets/node_modules references survived — icons may break." >&2
    exit 1
  fi
  echo "  fonts → assets/vendor, references repointed ✓"
else
  echo "  (no assets/node_modules dir — Expo output may have changed; nothing to move)"
fi

echo "▶ Writing SPA rewrite config…"
printf '%s\n' '{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }' > "$DIST/vercel.json"

echo "▶ Deploying to Vercel (production)…"
npx vercel deploy "$DIST" --prod --yes

echo ""
echo "✓ Deployed. Stable link: $STABLE_URL"
