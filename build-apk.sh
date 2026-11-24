#!/usr/bin/env bash
# Compile l'APK en local (Linux/macOS). Nécessite Java 17+ et le SDK Android (ANDROID_HOME ou local.properties).
set -e
cd "$(dirname "$0")"
if [ -z "$ANDROID_HOME" ] && [ ! -f local.properties ]; then
  echo "SDK Android introuvable : définissez ANDROID_HOME ou créez local.properties (sdk.dir=/chemin/vers/sdk)"; exit 1
fi
chmod +x gradlew
./gradlew assembleProdRelease assembleDevRelease --no-daemon
mkdir -p dist && cp app/build/outputs/apk/prod/release/app-prod-release.apk dist/BrawlRush.apk && cp app/build/outputs/apk/dev/release/app-dev-release.apk dist/BrawlRush-DEV.apk
echo "APK prêts : dist/BrawlRush.apk et dist/BrawlRush-DEV.apk"
