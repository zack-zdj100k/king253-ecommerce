#!/usr/bin/env bash
# Builds the production bundle for DZSecurity (cPanel + Passenger, Linux x86-64).
# Usage: npm run package:dzsecurity      → dist/king253.zip
# Upload the zip to the application root (e.g. ~/king253) with cPanel File Manager and extract it.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_URL="${NEXT_PUBLIC_SITE_URL_PROD:-https://king253.com}"
SHARP_VERSION="$(node -p "JSON.parse(require('fs').readFileSync('node_modules/sharp/package.json','utf8')).version")"
LIBVIPS_VERSION="$(node -p "JSON.parse(require('fs').readFileSync('node_modules/sharp/package.json','utf8')).optionalDependencies['@img/sharp-libvips-linux-x64']")"
OUT=dist/king253

echo "→ Building for $SITE_URL"
rm -rf .next dist
# A real env var wins over .env.local, so the public URL baked into the build is production's.
NEXT_PUBLIC_SITE_URL="$SITE_URL" npx next build

echo "→ Assembling $OUT"
mkdir -p dist
cp -R .next/standalone "$OUT"
cp -R public "$OUT/public"
cp -R .next/static "$OUT/.next/static"
cp app.js "$OUT/app.js"
cp -R drizzle "$OUT/drizzle"
mkdir -p "$OUT/scripts"
cp scripts/migrate.mjs scripts/create-admin.mjs "$OUT/scripts/"
# The app bundles drizzle/postgres into its chunks; the terminal scripts need the packages themselves.
cp -R node_modules/drizzle-orm node_modules/postgres "$OUT/node_modules/"
# Never ship local env files.
rm -f "$OUT"/.env*

echo "→ Swapping sharp binaries for Linux x64 (sharp $SHARP_VERSION)"
rm -rf "$OUT"/node_modules/@img/sharp-darwin-* "$OUT"/node_modules/@img/sharp-libvips-darwin-*
TMP="$(mktemp -d)"
# `npm pack` fetches the tarballs without npm's "wrong platform" check (we are on macOS).
for pkg in "sharp-linux-x64@$SHARP_VERSION" "sharp-libvips-linux-x64@$LIBVIPS_VERSION"; do
  name="${pkg%@*}"
  tgz="$(cd "$TMP" && npm pack --silent "@img/$pkg")"
  mkdir -p "$OUT/node_modules/@img/$name"
  tar -xzf "$TMP/$tgz" -C "$OUT/node_modules/@img/$name" --strip-components=1
done
rm -rf "$TMP"

echo "→ Zipping"
find "$OUT" -name .DS_Store -delete
(cd dist && zip -qr king253.zip king253)
du -sh dist/king253.zip
echo "Done: dist/king253.zip"
