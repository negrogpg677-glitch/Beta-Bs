#!/usr/bin/env bash
# Compile l'APK en local (Linux/macOS). Nécessite Java 17+ et le SDK Android (ANDROID_HOME ou local.properties).
set -e
cd "$(dirname "$0")"
if [ -z "$ANDROID_HOME" ] && [ ! -f local.properties ]; then
  echo "SDK Android introuvable : définissez ANDROID_HOME ou créez local.properties (sdk.dir=/chemin/vers/sdk)"; exit 1
fi
chmod +x gradlew
./gradlew assembleRelease --no-daemon
mkdir -p dist && cp app/build/outputs/apk/release/app-release.apk dist/BrawlRush.apk
echo "APK prêt : dist/BrawlRush.apk"
