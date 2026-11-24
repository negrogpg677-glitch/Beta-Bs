# Brawl Rush — notes de projet (mémoire)

## Structure
- `app/` : application Android (WebView plein écran) — `MainActivity.java`, manifeste (INTERNET, VIBRATE, cleartext autorisé pour tests LAN).
- `app/src/main/assets/www/` : le jeu (HTML5 canvas, JS classique, objet global `G`).
  - `util.js` (maths, sauvegarde localStorage, audio synthétisé) · `data.js` (brawlers, modes, arènes, boutique) · `maps.js` (génération symétrique)
  - `game.js` (simulation partagée client/serveur : `Sim`) · `ai.js` (bots, A*) · `render.js` + `chars.js` (rendu, personnages animés v2)
  - `input.js` (tactile/clavier) · `main.js` (boucle, fin de match) · `ui.js` + `ui_online.js` (menus) · `net.js` + `netmatch.js` (multijoueur côté client)
- `server/` : serveur Node (`ws`) autoritatif — exécute la même `Sim`. Équipes/codes, matchmaking, salle d'attente, reconnexion, classement. Tests : `npm test`.
- `dist/BrawlRush.apk` : APK prêt à installer. CI : `.github/workflows/`.

## Multijoueur (protocole v1, JSON/WebSocket)
- Client -> serveur : `hello{pid,token,name}`, `profile`, `party_create/join/leave/kick/set/start`, `queue_cancel`, `input{seq,mx,my,face,a?,s?}`, `lb`, `ping`, `match_leave`, `lobby_leave`.
- Serveur -> client : `welcome`, `party`, `queue`, `lobby`, `match{roster,seed,tiles}`, `snap` (20 Hz : entités compactes + évènements `ev`), `end`, `lb`, `error`.
- Le serveur ne simule JAMAIS de faux joueurs : les places vides sont des bots étiquetés (`Bot-…`), jamais présentés comme humains.
- Client : interpolation 100 ms des autres joueurs, prédiction + réconciliation (`ack`) du joueur local ; évènements rejoués en effets visuels/sons.
- Reconnexion : 90 s (l'IA prend le brawler), reprise via `pid/token`.
- Adresse serveur : Réglages > Serveur en ligne, ou `G.DEFAULT_SERVER` dans `data.js`, ou `?server=` en test navigateur.

## Modes
gemgrab, brawlball, heist, bounty, hotzone (Zone stratégique), boss (Assaut du Mégabot, coop), showdown (survie 10).

## État / limites connues
- Testé : simulation (7 modes), serveur (tests d'intégration), E2E navigateur à 2 clients (équipe+code, matchmaking, jeu, reconnexion).
- NON testé : sur vrai téléphone Android, réseau mobile réel, charge à grande échelle, serveur déployé sur Internet (je n'ai pas d'hébergement).
- Les graphismes sont vectoriels générés par code (pas d'assets d'artiste) : qualité « jeu indépendant soigné », pas équivalente à Brawl Stars.
- Push GitHub bloqué dans la session (app Claude non installée sur le dépôt) : commits locaux.
