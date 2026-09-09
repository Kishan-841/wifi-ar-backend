#!/bin/bash
# Build a standalone release APK into dist/.
#
# Usage:
#   ./tools/build-apk.sh                 build with the current version in app.json
#   ./tools/build-apk.sh 1.2.0           set version 1.2.0, bump versionCode, build
#
# Env (optional):
#   API_URL=http://192.168.0.178:4000    backend the APK should talk to
#                                        (default: this Mac's current LAN IP:4000)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

cd "$MOBILE"

# 1. Version. Android refuses to install an update unless versionCode increases.
if [ -n "${1:-}" ]; then
  node -e '
    const fs = require("fs");
    const cfg = JSON.parse(fs.readFileSync("app.json", "utf8"));
    cfg.expo.version = process.argv[1];
    cfg.expo.android.versionCode = (cfg.expo.android.versionCode || 0) + 1;
    fs.writeFileSync("app.json", JSON.stringify(cfg, null, 2) + "\n");
    console.log(`version ${cfg.expo.version} (versionCode ${cfg.expo.android.versionCode})`);
  ' "$1"
fi
VERSION=$(node -p 'require("./app.json").expo.version')
CODE=$(node -p 'require("./app.json").expo.android.versionCode')

# 2. Backend address baked into the JS bundle (release has no Metro to derive it).
MAC_IP=$(ipconfig getifaddr en0 || true)
export EXPO_PUBLIC_API_URL="${API_URL:-http://${MAC_IP}:4000}"
echo "→ API URL baked in: $EXPO_PUBLIC_API_URL"

# 3. Regenerate the native project from app.json (version, permissions, config).
echo "→ prebuild (regenerating android/ from app.json)"
npx expo prebuild -p android --clean >/dev/null

# 4. Compile release variant: native code + the JS bundle embedded in the APK.
echo "→ gradle assembleRelease (this is the slow part)"
( cd android && ./gradlew assembleRelease -q )

# 5. Copy to dist/ with a versioned name.
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/wifi-ar-v${VERSION}.apk"
cp android/app/build/outputs/apk/release/app-release.apk "$OUT"
SIZE=$(du -h "$OUT" | cut -f1)
# Older builds are ~100 MB each and always rebuildable from git: keep only this one.
find "$ROOT/dist" -name 'wifi-ar-v*.apk' ! -name "$(basename "$OUT")" -delete
echo "✓ built $OUT ($SIZE, versionCode $CODE)"
echo "  share it, or install directly:  adb install -r \"$OUT\""
