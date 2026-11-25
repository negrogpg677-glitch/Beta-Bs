# Mettre le multijoueur en ligne

Le serveur (`server/`) est prêt et testé. Il suffit de l'héberger, puis j'intègre son adresse dans l'application : les joueurs n'ont plus rien à configurer.

## Recommandé : Render.com — gratuit, sans carte bancaire (≈ 5 minutes)
1. Ouvrez https://dashboard.render.com/register et créez un compte (« GitHub » ou e-mail). **Aucune carte bancaire n'est demandée.**
2. En haut : **+ New** → **Web Service**.
3. Choisissez l'onglet **Public Git Repository** et collez :
   `https://github.com/negrogpg677-glitch/Beta-Bs` → **Connect**.
4. Remplissez :
   - **Name** : `brawl-rush` (l'adresse sera du type `brawl-rush-xxxx.onrender.com`)
   - **Region** : **Frankfurt (EU Central)** (le plus proche de la France)
   - **Branch** : laissez celle proposée (`claude/brawl-stars-mobile-game-wilijn`)
   - **Language / Runtime** : **Docker** (détecté automatiquement grâce au `Dockerfile`)
   - **Instance Type** : **Free**
   - (facultatif) **Advanced → Health Check Path** : `/health`
5. **Deploy Web Service**. Attendez 3 à 6 minutes que l'état passe à **Live**.
6. Copiez l'adresse affichée en haut de la page (`https://….onrender.com`) et envoyez-la-moi : ce n'est pas un secret.
   Je l'intègre au jeu, je recompile l'APK et je vérifie le serveur avec `tools/test-online.js`.

Vérification par vous-même : `https://<adresse>/health` doit afficher `{"ok":true,…}`, et `https://<adresse>/` lance le jeu dans le navigateur.

### Ce qu'il faut savoir sur l'offre gratuite
- Le serveur **s'endort après 15 minutes sans joueur**. Le premier joueur qui se connecte le réveille (≈ 30 à 60 s) : le jeu affiche « Réveil du serveur… » et lance la partie automatiquement dès qu'il est prêt.
- Pas de disque permanent : les **amis et clubs** enregistrés sur le serveur sont remis à zéro à chaque redémarrage/mise à jour. La **progression des joueurs** n'est pas concernée (téléphone + comptes Supabase).
- Pour un serveur toujours allumé avec disque : offre payante Render (≈ 7 $/mois) ou Fly.io ci-dessous.

## Alternative : Fly.io (toujours allumé, disque permanent, ≈ 2 à 5 €/mois, carte bancaire demandée)
```bash
curl -L https://fly.io/install.sh | sh      # installe flyctl
fly auth login
./deploy/fly-deploy.sh                       # crée l'app + le disque, déploie, affiche l'adresse
SERVER_URL=<app>.fly.dev ./build-apk.sh      # recompile les APK avec l'adresse intégrée
```

## Tester un serveur en ligne
`node tools/test-online.js <adresse>` : santé, réveil, 2 joueurs, équipe avec code, matchmaking, match, déplacement, tir, gadget, ping.
