# Mettre le multijoueur en ligne (une seule fois)

Le jeu se connecte automatiquement à un serveur : plus aucune adresse à saisir pour les joueurs. Il faut simplement héberger `server/` quelque part et intégrer son adresse dans l'application.

## Ce qu'il faut (je ne peux pas le créer à votre place)
1. **Un compte d'hébergement.** Recommandé : **Fly.io** (toujours allumé, WebSocket, ~2-5 €/mois, carte bancaire demandée). Alternative gratuite : **Render.com** (`render.yaml` fourni ; s'endort après 15 min d'inactivité).
2. **Un jeton d'accès** (Fly : `fly tokens create deploy` ou https://fly.io/user/personal_access_tokens).

## Option A — depuis votre ordinateur
```bash
curl -L https://fly.io/install.sh | sh      # installe flyctl
fly auth login
./deploy/fly-deploy.sh                       # crée l'app + le disque, déploie, affiche l'adresse
SERVER_URL=<app>.fly.dev ./build-apk.sh      # recompile les APK avec l'adresse intégrée
```
## Option B — automatique via GitHub
1. Sur GitHub : *Settings > Secrets and variables > Actions* : secret `FLY_API_TOKEN` = votre jeton ; variable `SERVER_URL` = `<app>.fly.dev`.
2. *Actions > Déployer le serveur > Run workflow*, puis *Actions > Compiler l'APK > Run workflow* : l'APK téléchargé contient l'adresse du serveur.

## Option C — je le fais pour vous
Donnez-moi un jeton Fly.io (formulaire sécurisé, jamais affiché) et autorisez l'accès réseau à `api.fly.io` : je déploie, intègre l'adresse et recompile les APK.

## Vérifier
`https://<app>.fly.dev/health` doit répondre `{"ok":true,…}`. Ouvrir `https://<app>.fly.dev/` dans un navigateur lance le jeu (installable en PWA, aussi sur iPhone : Partager > Sur l'écran d'accueil).
