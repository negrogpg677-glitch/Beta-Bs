# Brawl Rush — jeu mobile Android (vue du dessus)

Jeu d'arène complet inspiré des jeux de « brawlers », 100 % hors-ligne, écrit en HTML5/Canvas et embarqué dans une application Android native (WebView).

## Installer le jeu sur votre téléphone (le plus simple)
1. Téléchargez **`dist/BrawlRush.apk`** sur votre téléphone (depuis GitHub : ouvrir le fichier → « Download »).
2. Ouvrez-le ; autorisez « Installer des applications inconnues » pour votre navigateur si Android le demande.
3. Lancez **Brawl Rush**.

## Contenu
- **10 brawlers** uniques (attaque + super chacun), 4 apparences, niveaux 1-10
- **5 modes** : Razzia de cristaux, Foot brawl, Braquage, Chasse aux primes (3v3) et Survie (10 joueurs, gaz toxique)
- **16 arènes** générées de façon symétrique (5 thèmes : prairie, désert, toundra, volcan, nuit), buissons, caisses destructibles, eau
- **Bots** avec pathfinding A*, esquive, visée prédictive, rôles tactiques par mode, difficulté selon vos trophées
- Trophées, route des trophées, coffres, boutique (offres du jour), quêtes, cadeau quotidien, sauvegarde automatique
- Menus animés, musique et effets synthétisés, vibrations, mode gaucher

## Contrôles
Joystick à gauche pour bouger · bouton jaune : toucher = tir automatique, glisser = viser · éclair = super.
(PC : ZQSD/flèches, clic = tir, Espace, Maj/E = super, Échap = pause.)

## Recompiler l'APK
- **Sans rien installer** : sur GitHub, onglet *Actions* → « Compiler l'APK » → *Run workflow* → téléchargez l'artefact `BrawlRush-APK`.
- **En local** : `./build-apk.sh` (Java 17 + SDK Android 34).
Le jeu se trouve dans `app/src/main/assets/www/`.
