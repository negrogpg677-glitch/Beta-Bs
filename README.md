# Brawl Rush — jeu mobile Android (vue du dessus)

Jeu d'arène complet inspiré des jeux de « brawlers », 100 % hors-ligne, écrit en HTML5/Canvas et embarqué dans une application Android native (WebView).

## Installer le jeu sur votre téléphone (le plus simple)
1. Téléchargez **`dist/BrawlRush.apk`** sur votre téléphone (depuis GitHub : ouvrir le fichier → « Download »).
2. Ouvrez-le ; autorisez « Installer des applications inconnues » pour votre navigateur si Android le demande.
3. Lancez **Brawl Rush**.

## Contenu
- **10 brawlers** originaux (+ le boss Mégabot), chacun avec attaque, super, carrure et animations propres ; 4 apparences, niveaux 1-10
- **7 modes** : Razzia de cristaux, Foot brawl, Braquage, Chasse aux primes, **Zone stratégique**, **Assaut du Mégabot** (coopératif) — en 3 contre 3 — et Survie (10 joueurs, gaz toxique)
- **19 arènes** symétriques (5 thèmes), buissons, caisses destructibles, eau, zones à capturer
- **Multijoueur en ligne** (serveur autoritatif) : équipes privées avec **code à 5 caractères**, rejoindre/quitter/exclure, matchmaking, salle d'attente, match privé (équipe contre bots ou amis contre amis), reconnexion automatique, classement mondial
- **Bots** (A*, esquive, visée prédictive) utilisés hors-ligne et pour compléter les places vides en ligne (toujours étiquetés « Bot-… »)
- Personnages animés (attente, course, attaque, dégâts, élimination, victoire, défaite), lumière/ombres, particules, explosions ; 3 niveaux de qualité + réglage automatique si ça rame
- Trophées, route des trophées, coffres, boutique, quêtes, profil, sauvegarde automatique

## Jouer en ligne avec vos amis (il faut un serveur)
Le serveur est dans `server/`. Le jeu fonctionne hors-ligne sans lui ; le multijoueur nécessite qu'il tourne quelque part sur Internet.

**Option la plus simple — Render.com (gratuit)** : créez un compte, *New > Blueprint*, choisissez ce dépôt GitHub (le fichier `render.yaml` fait tout). Vous obtenez une adresse du type `brawl-rush-server.onrender.com`. (L'offre gratuite s'endort après ~15 min d'inactivité : la 1ʳᵉ connexion peut prendre ~1 min.)
**Autres** : n'importe quel hébergeur Docker (`Dockerfile` fourni : Fly.io, Railway, VPS) ou `cd server && npm ci && npm start` (port 8080, variable `PORT`).

**Dans le jeu** : Réglages > *Serveur en ligne* > saisissez l'adresse (ex. `brawl-rush-server.onrender.com`) > *Enregistrer et tester*. Chaque ami fait pareil, puis **Équipe** > *Créer une équipe* et partage le code (bouton *Partager*) ; l'ami choisit **Équipe** > saisit le code.
Pour que l'adresse soit préconfigurée dans l'APK, renseignez `G.DEFAULT_SERVER` dans `app/src/main/assets/www/js/data.js` avant de recompiler.
Test en réseau local : `cd server && npm start`, puis l'adresse `192.168.x.x:8080` (IP de l'ordinateur) dans le jeu.
Le serveur sert aussi le jeu dans un navigateur à `http://adresse/` et expose `/health`.

## Contrôles
Joystick à gauche pour bouger · bouton jaune : toucher = tir automatique, glisser = viser · éclair = super · bouton bleu (en haut à droite) = **roulade d'esquive** (invulnérable un instant).
(PC : ZQSD/flèches, clic = tir, Espace, Maj/E = super, F = esquive, Échap = pause.)

## Recompiler l'APK
- **Sans rien installer** : sur GitHub, onglet *Actions* → « Compiler l'APK » → *Run workflow* → téléchargez l'artefact `BrawlRush-APK`.
- **En local** : `./build-apk.sh` (Java 17 + SDK Android 34).
Le jeu se trouve dans `app/src/main/assets/www/`.

## Édition développeur (`dist/BrawlRush-DEV.apk`)
Application séparée « Brawl Rush DEV » (s'installe à côté de la normale, sauvegarde distincte). Bouton **DEV** en haut à gauche, utilisable aussi en plein match :
- **Joueur** : pièces/gemmes/coffres, tout débloquer (10 brawlers, 7 apparences dont 3 exclusives, niveau max), trophées, quêtes, reset.
- **Combat** (hors-ligne) : invincible, munitions/super infinis, éliminations en un coup, dégâts ×0,25–10, vitesse du joueur, vitesse du jeu ×0,2–3, ennemis passifs, soigner, tuer les ennemis, ajouter des bots, gagner/perdre immédiatement.
- **Monde** : lancer n'importe quel mode sur n'importe quelle arène sans matchmaking ; superpositions FPS, hitboxes, chemins/cibles de l'IA.
- **Mods** : 8 mods intégrés (vampires, turbo, supers express, géants, minis, pluie de cristaux, balles rapides, régénération) + **vos propres mods en JavaScript** (crochets `onMatchStart`, `onUpdate`, `onDamage`, `speedMul`), sauvegardés et activables.
- **Console** JavaScript (`G`, `M`, `P`).
En ligne, les outils de combat sont sans effet : le serveur reste seul juge. Pour compiler : `./build-apk.sh` produit les deux APK (`assembleDevRelease` pour la seule édition DEV).

## Audit technique
Voir `AUDIT.md` : problèmes mesurés, corrections, capacité du serveur et limites connues.
