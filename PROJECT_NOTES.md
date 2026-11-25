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

## Édition DEV
Product flavors Gradle `prod`/`dev` (dimension `edition`, `.dev` en suffixe d'applicationId). `src/dev/assets/www/js/{flavor,dev}.js` remplacent les stubs de `src/main`. Crochets `G.Dev.*` dans `game.js`/`main.js` (inactifs si `G.Dev` absent, ni côté serveur ni en ligne).

## v3 (refonte) — résumé
- Réseau : horloge serveur recalée, file d'instantanés (30 Hz), délai d'interpolation adaptatif à la gigue, tirs fantômes immédiats, prédiction + réconciliation. Banc de test : `tools/lagproxy.js` (latence/gigue simulées), `tools/soak.js` (charge : 40 parties / 240 joueurs ≈ 37 % d'un cœur).
- Serveur : `server/social.js` (amis par code, invitations, clubs + chat, persistés), PWA servie par le serveur, `fly.toml`, `deploy/fly-deploy.sh`, workflows CI, `DEPLOY.md`. Adresse intégrable : `G.DEFAULT_SERVER` / `SERVER_URL=… ./build-apk.sh`. Sans adresse : si la page est servie en http(s), le jeu se connecte à son propre serveur.
- Contenu : 19 brawlers (+ boss), skins légendaires à effets, victoires personnalisées, événements du jour (règles réelles), météo, mode Duel d'élite, voix/hauteur des sons par brawler.
- UI : Social (amis/club/classement), profil détaillé, bannière d'événement, résultats animés, effets tactiles, rotation/PWA.
- Bugs corrigés : téléportations en ligne (désynchronisation état/position), double dégâts des projectiles à explosion, anti-blocage dans les murs, remise en place du Duel d'élite.
- À faire / limites : serveur non déployé (compte+jeton requis), pas de test sur vrai téléphone/iPhone, pas de compensation de latence côté serveur pour les tirs, graphismes vectoriels (pas d'artiste).

## v4
- `js/world.js` : décor en blocs mis en cache (×20 sur le rendu). `R.World.occlude` fait passer le haut des murs devant les personnages.
- Roulade d'esquive (`Sim.tryDodge`, drapeau 4096, champ 16 de l'instantané = recharge ×10, message `input.d`).
- Compensation de latence : `Sim.advanceProjs` + `input.rtt`.
- Corrections réseau (extrapolation bornée, horodatage ms) et recul (×4,2, plafonné). Détails : `AUDIT.md`.

## v5
- `js/account.js` (Supabase REST : auth + table `profiles`), `js/ui_account.js` (écrans), `supabase/schema.sql`. `G.Store` = stockage durable (natif Android via `AndroidBridge.kvGet/kvSet/kvDel`).
- Tests : `tools/supabase-mock.js` + `tools/test-accounts.js` (20 vérifs) + `tools/test-session-refresh.js`.
- Accueil refait (`UI.build.home`), `UI.currentMap` (rotation horaire), `G.playerLevel`, `Sim.koFx`, `M.feed`, `M.hitmarks`, `cam.kick`.
- Config comptes : `G.SUPABASE` dans data.js (vide tant que l'utilisateur n'a pas créé son projet).

## v6
- Gadgets : `G.GADGETS`/`G.GADGET_OF` (data.js), `Sim.tryGadget` (3 charges, `Sim.GADGET_CD` = 7 s), champs d'instantané 17 (charges) et 18 (recharge ×10), entrée réseau `gd: 1`. Bots : usage situationnel dans ai.js.
- Émotes : `G.EMOTES`, `Sim.emote` (anti-spam 2,5 s), évènement réseau `['em', idx, i]`, entrée `em: i`. Roue : `R.emoteSlots`, `In.emoteOpen`.
- Pass Rush : `js/pass.js` (`G.Pass`, `UI.passModal`), donnée `save.pass = { season: 'AAAA-MM', xp, claimed[] }` (synchronisée avec le compte), XP ajoutée dans `App.finish`.
- Tests : `server/test/run.js` (37 vérifs, dont gadget/émote en ligne).

## v7 (prise en main)
- `input.js` : joystick flottant (`joyMove` : zone morte 10 %, pleine vitesse à 32 % du rayon, base qui suit le doigt), manettes d'action (`stickStart`, `b.cancel` = retour au centre), `In.release` (doigt perdu / appli en arrière-plan).
- `render.js` : `R.layout` (taille plafonnée, réglage `settings.ctrlScale`), `actionStick`, `R.drawAim` avec `rayLen` (visée arrêtée par les murs), alerte vie basse, `M.dmgDir` (direction des dégâts).
- `game.js` : `nudge` glisse autour des coins jusqu'à un rayon.
- `main.js` : résolution dynamique `App.resScale` (0,65 → 1) avant la baisse de qualité.
- `util.js` : compresseur + réverbération courte, variation de hauteur, anti-cacophonie (35 ms).
- Test : `tools/test-touch.js` (toucher multipoint réel émulé).
