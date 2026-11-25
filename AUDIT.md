# Audit technique — Brawl Rush (v4)

Toutes les valeurs ci-dessous ont été **mesurées** avec des outils ajoutés au dépôt, pas estimées.

| Outil | Rôle |
|---|---|
| `tools/lagproxy.js` | proxy WebSocket qui simule latence + gigue (ex. 90 ± 50 ms) |
| `tools/soak.js` | test de charge du serveur (N parties simultanées de vrais clients WebSocket) |
| `server/test/run.js` | 34 tests d'intégration (équipes, codes, matchmaking, jeu, roulade, reconnexion, amis, clubs…) |
| scripts Playwright | profilage du rendu, parties complètes des 8 modes, fuites mémoire, captures |

## 1. Problèmes trouvés et corrigés

| Domaine | Problème (mesuré) | Correction | Résultat |
|---|---|---|---|
| Rendu | ~70 % du temps d'image passait à redessiner le décor statique (≈250 dessins de tuiles par image) : **23–33 ms/image** (rendu logiciel) | Nouveau moteur `world.js` : décor (sol, eau, ombres, marquages, murs, buissons) pré-dessiné dans des blocs 8×8 mis en cache à la résolution de l'écran ; reconstruction étalée (2 blocs/image max) quand une caisse est détruite | **~1,5 ms/image** (×20). Coût unique ~100 ms au début du match, pendant le compte à rebours |
| Rendu | Vignette plein écran recalculée (dégradé radial) à chaque image | Pré-calculée une fois | — |
| Réseau | Autres joueurs qui « téléportent » de **228 à 438 px** à ~150–250 ms de ping | (1) état discret et position appliqués au même instant ; (2) extrapolation qui divisait par un intervalle ≈ 0 (horodatages arrondis) → vitesse bornée, intervalle minimal, horodatage à la milliseconde | Saut max des autres joueurs **19 px/image**, aucun > 40 px |
| Gameplay | Recul (knockback) à 1 800 px/s, et **le recul de chaque plomb d'une rafale s'additionnait** (Bumper ×3) | Même distance de recul, poussée plus douce (×4,2 au lieu de ×7) et plafonnée | Déplacements brusques > 30 px/tick : **606 → 120** (restants = supers de recul volontaires) |
| Gameplay | Les tirs d'un joueur distant partaient avec tout son retard | Compensation de latence : le serveur avance les nouveaux projectiles de la moitié du ping (100 ms max) | Tirs plus fidèles à ce que voit le tireur |
| Gameplay | Duel d'élite : **plantage** à la fin d'une manche (le code supposait un ballon) | Garde ajoutée | Corrigé (trouvé par le test de fuites mémoire) |
| Gameplay | Jongleur : l'IA n'utilisait jamais son super (0 fois) | Règle d'IA pour les supers de rage | Utilisé |
| Équilibrage | Mégabot : 3 défaites sur 3 en 30–46 s, puis trop facile après un 1er réglage | Dégâts réduits, réapparition des héros (6 s), PV ajustés | Combats de ~1 min 45 en moyenne |
| Gameplay | Projectiles à explosion qui infligeaient **deux fois** leurs dégâts (v2) | Dégâts uniquement via l'explosion | Corrigé |
| Collisions | Brawlers pouvant rester coincés dans un mur (poussées, reculs) | Déblocage automatique (spirale vers la case libre la plus proche) | Corrigé |

## 2. Nouveautés de gameplay (cette version)
- **Roulade d'esquive** (mécanique absente de Brawl Stars) : bouton dédié, 2,7 tuiles, invulnérable 0,24 s, recharge 3,2 s, impossible de tirer pendant. Synchronisée en ligne, utilisée par les bots (~50 fois/min de jeu), touche **F** au clavier.
- Décor bien plus riche sans coût : variations organiques du terrain, herbe/fleurs/fissures/neige/braises selon le thème, écume sur les berges, occlusion ambiante au pied des murs, neige et mousse sur les blocs.

## 3. Capacité et stabilité
- **Serveur** : 40 parties simultanées / 240 joueurs réels → **37 % d'un cœur**, latence de boucle moyenne 1,2 ms, **aucune fuite** (tas 8 Mo après 80 s), ~18 Ko/s par joueur.
- **Client** : mémoire stable sur 16 parties d'affilée (3 → 4 Mo), nombre d'éléments DOM constant.
- **8 modes** simulés de bout en bout : aucune erreur, aucune valeur invalide (NaN).

## 4. Limites connues (honnêtement)
- **Pas testé sur un vrai téléphone** (ni Android ni iPhone) : les mesures sont faites dans Chromium sans GPU. Sur téléphone le rendu est accéléré par le GPU, mais seule une vraie mesure le confirmera. Les niveaux de qualité (Haute/Moyenne/Économie) et la baisse automatique en cas de ralentissement sont en place.
- **Multijoueur non hébergé** : le serveur fonctionne et est testé, mais il doit être déployé (voir `DEPLOY.md` — compte + jeton requis).
- **Compensation de latence partielle** : pas de « retour dans le temps » complet des positions côté serveur.
- **Graphismes vectoriels générés par code** : soignés et animés, mais pas au niveau d'un studio avec des artistes 2D/3D.
- **Architecture** : JavaScript sans modules ni typage (objet global `G`). Fonctionne et reste testable, mais un passage à TypeScript + bundler (Vite) faciliterait la croissance du projet.

## 5. Recommandations pour viser le haut du marché
1. **Héberger le serveur** (Fly.io, ~2–5 €/mois) : c'est le seul blocage pour le multijoueur réel.
2. **Direction artistique** : pour un rendu de niveau commercial, faire produire des sprites/animations par un artiste (ou des modèles 3D) ; le moteur actuel peut afficher des sprites à la place des personnages vectoriels.
3. **3D** : seulement avec un moteur dédié (Godot ou Unity) et des artistes 3D — c'est une réécriture complète, pas une amélioration progressive.
4. **Tests sur appareils réels** (un Android d'entrée de gamme + un iPhone) avant toute publication.

## v5 — comptes, accueil, sensations de combat

| Problème trouvé | Correction |
|---|---|
| Le bouton « + » (inviter un ami) à gauche du personnage était **recouvert par le dessin du personnage** : impossible à toucher | Ordre d'empilement corrigé, le personnage ne capte plus les touchers |
| Deux actions définies avant la déclaration de leur objet (zone morte JavaScript) : **l'interface entière ne se chargeait plus** | Déplacées après la déclaration (détecté par les tests avant livraison) |
| Le stockage local du WebView Android écrit sur le disque **en différé** : une session ou une sauvegarde peut être perdue si Android tue l'application juste après | Stockage natif `SharedPreferences.commit()` (écriture immédiate) pour la sauvegarde et la session, via le pont Java |
| Conflit de nom de classe CSS (`.mm`) entre l'accueil et l'écran de recherche | Classe renommée |

Nouveau : comptes Supabase (`COMPTES.md`, `supabase/schema.sql` validé par l'analyseur PostgreSQL), accueil refait, effets K.O. + fil des éliminations + marqueurs de touche + éclair de bouche + à-coup de caméra, qualité graphique choisie selon la puissance du téléphone, rotation horaire des arènes, niveau joueur (XP).

## v6 — gadgets, émotes, Pass Rush
- **Gadgets** (3e capacité, 3 utilisations par partie, 7 s entre deux) : soin, turbo, bouclier, onde répulsive, recharge éclair. Vérifié : utilisés par les bots dans les 8 modes (simulations complètes sans valeur invalide), refusés pendant la recharge, synchronisés par le serveur (tests en ligne).
- **Émotes** : roue de 8 émotes, bulle animée au-dessus du brawler, diffusion en ligne vérifiée, anti-spam.
- **Pass Rush** : 30 paliers mensuels, récompenses vérifiées (pièces, brawler, skin légendaire), paliers non atteints verrouillés, remise à zéro à chaque nouvelle saison, XP affichée dans l'écran de résultats.
- Non-régression : 37/37 tests serveur, 20/20 tests de comptes, aucune erreur JavaScript.

## v7 — prise en main façon jeu mobile pro
| Problème constaté | Correction |
|---|---|
| Vitesse proportionnelle à l'écart du doigt : petit geste = personnage lent, sensation de mollesse | Joystick flottant : pleine vitesse dès 32 % du rayon (≈ 20 px), zone morte de 10 % |
| Joystick pouvant rester bloqué (doigt sorti de l'écran, notification, appel) | Relâchement sur `pointercancel`, perte de capture, perte de focus, passage en arrière-plan |
| Impossible d'annuler un tir visé | Revenir au centre de la manette annule (✕ rouge + vibration) |
| La visée traversait les murs | Indicateurs découpés par les murs (rayons), arc de trajectoire pour les tirs en cloche |
| Le personnage accrochait les coins de mur | Glissement automatique autour des coins (jusqu'à un rayon) — vérifié : +86 px au lieu de 0 |
| Boutons super/attaque qui se touchaient ; commandes géantes sur tablette | Nouvelle disposition sans chevauchement (vérifiée à 640×360 et 1024×768), taille plafonnée, réglage de taille |
| Ralentissements sur téléphones modestes | Résolution dynamique avant réduction des effets |

Ajouts : alerte vie basse, direction des dégâts, son plus percutant (compresseur, réverbération, variations).
Tests : `tools/test-touch.js` (11 vérifications tactiles), 37/37 serveur, 20/20 comptes, 8 modes simulés sans erreur.

## v2.1 — joystick fiabilisé, carnet de combat, fiches de joueur
| Problème | Correction |
|---|---|
| Doigt parfois « non détecté » sur le joystick | Geste « retour » d'Android désactivé en bas des bords (là où sont les pouces) ; un nouveau doigt reprend toujours le joystick/les boutons (relâchement manqué = plus de blocage) ; démarrage au mouvement si l'appui a été manqué |
| Direction fausse quand on pose le doigt près du bord | Direction calculée depuis le vrai point de contact (le cercle reste affiché à l'écran) |
Test d'endurance : 400 séquences tactiles aléatoires dont 134 relâchements perdus → joystick actif 400/400, bonne direction 396/400 (4 glissements très courts légèrement sous le seuil d'intensité), aucune erreur.
Nouveau : carnet de combat (25 dernières parties, joueurs de chaque camp), fiche de joueur animée (depuis le carnet et la liste d'amis : statut, trophées, club, ajout en ami, invitation), serveur `profile_get` + code public dans la composition, animations des menus (apparition des fenêtres, appui des boutons, listes).

## v3.0 — personnages 3D, salon et profil refaits
- **Vraie 3D (three.js r149, intégré à l'APK, hors-ligne)** : `js/char3d.js` génère pour chaque brawler un modèle chibi toon avec contours (couleurs, 20 chapeaux, 12 armes) et l'anime : attente (respiration, clignement, regard), course, tir, roulade, victoire, défaite, élimination, réaction au toucher. Repli 2D automatique si WebGL est indisponible.
- Salon : héros 3D au centre (on peut le toucher), fond animé, entrées animées des panneaux, bouton Jouer pulsant.
- Profil complet (deux panneaux) : carte 3D, niveau, rang, code ami, trophées/record, victoires équipe/survie, meilleure série, collection de brawlers (changement de personnage animé), statistiques, accès au carnet de combat.
- 3D en combat : option « expérimental » (désactivée par défaut) — un rendu 3D par personnage et par image est coûteux sur Android ; à optimiser (atlas en une passe) avant de l'activer par défaut.

## v3.1 — tirs précis, vrais personnages animés, équipe dans le salon, invitations, chat
| Problème | Correction |
|---|---|
| Tirs « incontrôlables » : direction calculée depuis le centre du bouton (pas depuis le doigt) | Visée mesurée depuis le point où le doigt se pose |
| L'aide à la visée détournait le tir manuel vers l'ennemi voisin (et changeait de cible) | Visée manuelle = exactement la direction du doigt ; l'aide ne sert qu'au tir par simple toucher |
Test `tools/test-aim.js` : 4 brawlers (tir droit, fusil à pompe, cloche, rafale), 8 directions, doigt hors centre, ennemis à côté de la ligne → écart ≤ 2° (le tremblement simulé).
- **Vrais personnages 3D animés** : 20 modèles avec squelette et animations (attente, course, tir, victoire, défaite, mort, roulade) issus de `@netforge/asset-library-files` (MIT, modèles déclarés CC0, voir `www/models/LICENCE.txt`), chargés à la demande ; décodeur meshopt + GLTFLoader (three.js r149, MIT) convertis en scripts classiques. Rotation du personnage au doigt dans le salon.
- **Équipe dans le salon** : les coéquipiers apparaissent en 3D à côté de son personnage (synchronisé par le serveur), carte « INVITATION » en attente avec annulation, bandeau code d'équipe / quitter.
- **Invitations** : liste d'amis avec statut + INVITER, fenêtre « Invitation d'équipe » (carte du joueur en 3D, REFUSER / ACCEPTER, masquer 10 min), refus et annulation signalés en temps réel.
- **Chat d'équipe en ligne** (serveur `party_chat`) : messages écrits, discussion rapide, émojis, bulles au-dessus des personnages, badge non lus, historique de 20 messages.
Tests : `tools/test-team.js` (2 téléphones + serveur : 9/9), serveur 43/43, tactile 11/11.

## v3.2 — commandes d'après la photo de référence, éditeur, chat en partie, écran VS
- Disposition : joystick bas-gauche, gros bouton de tir à droite, super à sa gauche, gadget dessous, roulade au-dessus, bouton « … » de discussion rapide ; commandes translucides (transparence réglable) pour ne pas masquer la map.
- Éditeur de commandes (Réglages → Personnaliser) : déplacer au doigt, taille par bouton (60–160 %), transparence (25–100 %), chevauchements signalés et refusés, Enregistrer / Annuler / Réinitialiser ; positions gardées dans l'écran.
- Discussion rapide en partie : 8 messages + 8 émotes ; en ligne, envoyée aux coéquipiers par le serveur (`mchat`, nettoyée, anti-spam) ; bulle au-dessus du personnage.
- Écran VS pendant le compte à rebours : cartes des joueurs (personnages 3D), « VS », « Début dans 3 ».
- Correctif : l'écran VS n'intercepte plus les touchers ; le toucher qui ouvre la discussion n'envoie plus d'émote par erreur.
Tests : tactile 11/11, visée 4/4 (≤ 2°), serveur 44/44, équipe en ligne 9/9.
