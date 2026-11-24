#!/usr/bin/env bash
# Déploie le serveur Brawl Rush sur Fly.io et affiche l'adresse à intégrer dans le jeu.
# Prérequis : un compte Fly.io (carte bancaire demandée par Fly) + flyctl (https://fly.io/docs/flyctl/install/) + `fly auth login` (ou FLY_API_TOKEN).
set -e
cd "$(dirname "$0")/.."
APP="${1:-brawl-rush-$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
sed -i "s/^app = .*/app = \"$APP\"/" fly.toml
fly apps create "$APP" 2>/dev/null || true
fly volumes create brawl_data --size 1 --region cdg --app "$APP" --yes 2>/dev/null || true
fly deploy --app "$APP" --ha=false
echo
echo "Serveur en ligne : https://$APP.fly.dev   (test : https://$APP.fly.dev/health)"
echo "Pour intégrer l'adresse dans l'APK :  SERVER_URL=$APP.fly.dev ./build-apk.sh"
