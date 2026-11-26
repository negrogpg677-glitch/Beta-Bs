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

## v3.3 — comptes côté serveur : identifiants, amis, pseudo, classé, développeur
Le serveur de jeu se connecte à Supabase avec la clé secrète (variable Render `SUPABASE_SECRET`, jamais dans l'application) et vérifie chaque joueur avec son jeton de session. Toutes les règles sont appliquées côté serveur (module `server/accounts.js`, base : `supabase/v2.sql`).
- **Identifiant unique en lettres** (ex. `PHENIXDORE`) généré automatiquement, consultable/copiable, recherche de joueurs ; **une seule modification à vie** (contrainte serveur + déclencheur SQL qui interdit aux joueurs de toucher ce champ), déblocage par joueur ou global depuis le compte développeur.
- **Amis avec demandes** (reçues / envoyées, accepter, refuser, annuler, retirer), statut en direct (disponible, dans le salon, en partie) et « hors ligne depuis … », invitations entre amis du compte.
- **Pseudo** : premier changement 31 jours après la création, puis 31 jours entre deux changements ; prix 20 💎, doublé à chaque changement des 12 derniers mois (max 640) ; gemmes débitées par le serveur.
- **Mode classé ELO** : 5 modes, matchmaking par ELO (fenêtre qui s'élargit avec l'attente, bots si nécessaire), gains/pertes selon l'écart de niveau (K = 48 pour les 10 premières parties, puis 32), 7 rangs × 3 divisions, historique, classement ; **ouverture le 26/11/2026 à 11 h (Paris)** contrôlée par le serveur, **accès anticipé** pour le compte développeur (`DEV_EMAILS`).
- **Cadeaux de brawlers** (développeur uniquement) : recherche par identifiant, vérification « déjà possédé », réception immédiate ou à la reconnexion, notification.
Tests : `tools/test-social.js` (35/35, serveur réel + base imitée), `tools/test-social-ui.js` (12/12, 2 téléphones à travers l'interface), serveur 44/44, comptes 20/20.

## v3.4 — menu développeur lié au compte
- Le menu DEV (outils de triche hors-ligne + bouton « 🎁 Joueurs ») s'active automatiquement dès que le serveur reconnaît le compte développeur (`DEV_EMAILS`), sur toutes les versions (APK normal, site/iPhone) ; `js/devtools.js`.
- Réglages : état du mode développeur, avec l'e-mail exact du compte si ce n'est pas reconnu (diagnostic de `DEV_EMAILS`).
- Cadeaux / déblocage : recherche par identifiant **ou par pseudo**, envoi par identifiant interne (plus robuste), message clair si le joueur ne s'est pas encore connecté avec la nouvelle version.
- Base : déclencheur de protection plus robuste avec la clé secrète (`supabase/v2b.sql`) ; la connexion n'échoue plus si la création d'identifiant est refusée (message de diagnostic).
Tests : `tools/test-social-ui.js` 16/16, `tools/test-social.js` 35/35, serveur 44/44.

## v3.5 — rouleau des modes, 3 nouveaux modes, duel entre amis, session périmée
- **Rouleau des événements** (`js/modesui.js`) : cartes animées en perspective qui défilent au doigt (aimantation au centre, son de cran), aperçu de la carte actuelle, personnage 3D, format (3c3 / 1c1 / solo / coop), badge « NOUVEAU », points de position.
- **Bombe-patate** : la bombe passe à l'ennemi touché, revient au tueur de son porteur, explose au bout de 20 s (point pour l'équipe adverse, dégâts de zone) ; premier à 3. IA : le porteur chasse, les autres fuient la bombe.
- **Éclipse** : nuit, seul le phare tournant (et la proximité) révèle les ennemis ; tirer trahit sa position ; 10 éliminations.
- **Duel 1c1** : premier à 3 éliminations, deux arènes ; IA de traque ; matchmaking 1 contre 1.
- **Défi en duel entre amis** : bouton « ⚔ Défier » (liste d'amis et invitations), fenêtre « DÉFI EN DUEL », salon face à face (cartes 3D), choix de l'arène par le chef, « PRÊT » des deux joueurs → lancement automatique côté serveur.
- **Session périmée** (diagnostic serveur : « session_id … does not exist ») : le jeu renouvelle la session ou redemande la connexion au lieu de rester bloqué.
Tests : `tools/test-duel.js` 7/7, modes simulés jusqu'au bout (11 modes), serveur 44/44, comptes 35/35, équipe 9/9, tactile, visée 4/4.

## v3.6 — stabilité multijoueur, iPhone, menu développeur professionnel
**Bugs trouvés et corrigés**
- iPhone : le rouleau des modes utilisait le défilement natif + `scroll-snap` + transformations 3D, peu fiable sous Safari/WKWebView → rouleau piloté au doigt (pointer events, élan, aimantation, toucher pour choisir), indépendant du défilement natif. Listes : `-webkit-overflow-scrolling`, `overscroll-behavior: contain`, `touch-action`.
- **Joystick bloqué après une pause** : `showPause` mettait `#ui` en `pointer-events: auto` sans jamais le remettre → toute l'interface captait les touchers des parties suivantes. Remis à zéro à la reprise et au début de chaque partie.
- **Classement mondial** : il lisait `players.json` sur le serveur Render (effacé à chaque redémarrage, trophées « en ligne » seulement). Il lit désormais la table `profiles` (vrais comptes, persistant), avec mon rang exact (`count=exact`), le total, et un rang estimé pour les invités.
- Écran Amis : le texte tapé dans la recherche et le résultat étaient effacés par les mises à jour en direct (nouvel élément créé, ancien rempli) → saisie, défilement et résultat conservés.
- Fiche joueur (journal des combats) : l'état « demande reçue » affichait « Ajouter » → Accepter/Refuser, Annuler pour une demande envoyée, « Déjà amis », mise à jour automatique.

**Nouvelles règles côté serveur (testées)**
- Un seul appareil par compte : identifiant d'appareil + connexion « fraîche » ; l'appareil actif est enregistré dans `app_metadata` (Auth admin) ; l'ancien appareil reçoit `session_taken`, perd l'accès et n'envoie pas sa sauvegarde ; `logout?scope=others` révoque ses jetons ; la déconnexion normale est locale (`scope=local`).
- Pas d'abandon volontaire : `match_leave` refusé (sauf duel entre amis = défaite). Coupure involontaire : l'IA tient le brawler ; retour automatique si l'écran de combat est encore ouvert, sinon bouton « Reprendre la partie » (état complet renvoyé par le serveur). Partie terminée : pas de bouton, récapitulatif.
- Inactivité (AFK) : sortie de la partie avec message, la partie continue, reprise possible, pas compté comme un abandon. Délais (inactivité, reconnexion) modifiables en direct par le développeur, enregistrés dans `game_config`. Duel : absence > fenêtre de reconnexion = défaite.
- Équipes : restent groupées après la partie (même chef), l'inviteur reste chef, seul le chef invite et lance, le chef peut passer la main (`party_promote`), messages en direct (arrivée, départ, nouveau chef).
- Outils développeur serveur (`dv_*`) : refusés sans compte développeur ; joueurs de test uniquement en mémoire ; le développeur principal (DEV_EMAILS) peut autoriser d'autres comptes (`dev_grant`), qui ne peuvent pas en autoriser d'autres.

**Menu développeur professionnel** (compte développeur, APK DEV et nouvelle IPA DEV) : accueil, recherche, favoris, niveaux débutant/avancé/expert, utilisable en partie (panneau latéral). A. modes de test (hors ligne, entraînement, partie privée en ligne avec joueurs de test) · B. éditeur de personnages (vie, vitesse, dégâts, portée, recharge) · C. éditeur de cartes (peinture, symétrie, jouable) · D. diagnostics (FPS, ping, pertes, mémoire, erreurs, synchro, rapport) · E. outils multijoueur (simulations, paramètres en direct, état du serveur) · F. comptes de test (profils locaux jamais envoyés dans le cloud, statistiques, multi-appareils, autorisations) · G. avancé (console, trafic réseau, options, configurations enregistrées/comparées, tests automatiques avec historique, export) · H. interface.

**Modes** : format **2 contre 2** pour tous les modes en équipe (file d'attente séparée côté serveur, hors ligne aussi ; bug corrigé : la file 2c2 était recopiée dans la file 3c3), **1 contre 1 classé** (duel en ELO, impossible à quitter), **Entraînement** (mannequins immobiles, sans gain ni perte), duel entre amis (seul mode qu'on peut quitter), coop contre bots (Mégabot), survie, événement du jour, parties privées.

**Sécurité des tests** : `tools/test-accounts.js` ne redirigeait pas le domaine Supabase vers la base imitée → il pouvait créer un compte de test (alice@test.fr) dans le vrai projet. Corrigé : toutes les requêtes Supabase des tests sont interceptées.

**Limites connues** : la progression hors ligne (contre les bots) reste calculée par l'appareil ; `supabase/v3.sql` (facultatif) limite la vitesse de montée des trophées pour protéger le classement.

**Tests** : serveur 61 · comptes 53 · interface comptes/dev 33 · v3.6 iPhone émulé 19 · équipe, duel, toucher, visée.

## v3.7 — vue verticale (comme sur la photo de référence)
- Les cartes sont tournées d'un quart de tour **dans les données** (pas une image tournée) : tuiles, points d'apparition, buts, coffres, zones, ballon, mine de cristaux. L'équipe bleue est en bas et attaque vers le haut ; la caméra défile verticalement et regarde un peu vers l'avant ; mini-carte et aperçus des cartes au format portrait.
- Joystick et tirs : la direction du doigt est la direction dans le monde (haut = vers l'adversaire), aucune conversion.
- IA réécrite dans un repère « vers l'ennemi / sur le côté » (valable dans les deux orientations) ; le porteur du ballon vise le but adverse réel.
- Brawlers tournés vers l'adversaire à l'apparition ; ligne médiane du foot horizontale.
- Protocole 2 : le serveur refuse les parties aux anciennes versions (cartes horizontales) avec le message « mettez le jeu à jour ».
- Vérifié : les 11 modes simulés 3 fois jusqu'à la fin, sans erreur (buts et coffres dans les deux sens).
- Reste à faire : pour l'équipe rouge (en haut), la vue n'est pas encore retournée (elle attaque vers le bas).

## v3.8 — refonte visuelle « NEO 2030 » et menu développeur façon référence
- **Menu développeur** au style de la vidéo de référence (verre sombre) : en-tête logo + version, « Bibliothèque » (Bibliothèque / Favoris / ancien panneau), boutons Amis (joueurs, cadeaux), Paramètres, Modifier l'interface, fermer ; colonne Bataille / Affichage / En ligne / Divers avec compteurs + recherche ; onglets en pilules avec compteurs ; « Profil 1/2/3 » (jeux de réglages) ; cartes OUI/NON avec ⓘ et réglages ; page de détail (Activé, description, PARAMÈTRES, Retour) ; en partie « ⚡ Accès rapide » + FPS. Toutes les fonctions précédentes sont des cartes (42), aucune supprimée.
- **Salon** : fond animé (aurore, grille néon en perspective qui défile, faisceaux, particules), plateforme holographique (anneaux, scan, faisceau), panneaux en verre aux bordures néon avec reflet, bouton JOUER lumineux avec balayage, entrées animées en cascade ; écrans et fenêtres au même style. Fond allégé en qualité « éco ».
- **Combat** : annonces néon des séries (DOUBLE / TRIPLE / MÉGA / INARRÊTABLE), éclair doré sur les bords quand la super est prête.

## v3.9 — mode développeur complet (serveur + interface), en trois espaces
**Sécurité** : droits séparés vérifiés par le serveur (`server/devops.js`) — observer / administrer / développer. Le compte DEV_EMAILS a les trois ; tout autre compte n'a rien (les droits peuvent être accordés un par un par le compte principal). Un joueur qui modifie son client reçoit « forbidden » : rien n'est seulement caché. Aucune donnée privée envoyée (ni e-mail, ni jeton, ni identifiant d'appareil, ni IP).
**Observer** : tableau de bord en direct (joueurs connectés / en partie / absents / en groupe, parties, labo, temps de calcul du serveur, mémoire, base de données, sessions, ping moyen et max, connexions lentes, statistiques, alertes, erreurs serveur, activité), joueurs (liste connectés + sessions récentes, recherche, filtre de statut, profil : session, plateforme, ping, reconnexions, groupe, partie, historique des parties et des déconnexions, signalements, sanction), parties en cours, **spectateur** (le serveur envoie les mêmes instantanés qu'aux joueurs ; aucune commande ; suivre un joueur, passer à un autre, caméra libre au doigt, zoom au pincement ou boutons, retour au joueur suivi), **replays** (le serveur enregistre les 8 dernières parties à 15 images/s en mémoire ; lecture/pause, vitesse ×0,5 à ×4, barre de temps, évènements cliquables, joueur à suivre, résultats ; recherche par joueur, mode, date), diagnostics.
**Administrer** (confirmation + journal en base) : avertir, déconnecter une session, sanctionner (1 h à 30 jours, reconnexion refusée par le serveur), lever une sanction, arrêter une partie (aucun trophée en jeu), signalements (bouton « Signaler » sur la fiche d'un joueur, limité), journal d'activité.
**Studio** : laboratoire de test en ligne (mode, carte, joueurs par équipe, joueurs de test identifiés, alliés, niveau des bots, habileté de l'IA, bots passifs, carte modifiée, éditeur de personnages ; en direct : vitesse de partie, soigner, éliminer les bots, réinitialiser, terminer, déconnexion/inactivité), **triches de test appliquées par le serveur** dans le labo et les parties privées d'un développeur — aimbot avec anticipation, esquive automatique, invincible, munitions/super/gadgets infinis, un coup, tir auto, dégâts ×, vitesse × (la prédiction du client suit) — et **bloquées côté serveur en public et en classé** (chaque option l'indique), tests automatiques serveur et client, éditeur de cartes (annuler/rétablir, pinceaux 1-3, rectangle, collisions, nouvelle carte, versions, vérification avant publication, test hors ligne ou dans le labo en ligne).
**Limites / à développer** : déplacement des points d'apparition, rotation de la caméra (vue 2D du dessus), replays conservés seulement depuis le dernier démarrage du serveur (mémoire).
**Tests** : serveur 62 · comptes + mode développeur serveur 82 · interface développeur 37 · console (spectateur, replay, modération) 28 · iPhone émulé · duel · équipe · toucher · visée · comptes 20.

## v4.0 — « Dev Hub » : refonte complète de l'interface développeur
- Nouveau design (graphite, une couleur par espace, lignes de réglages avec interrupteurs, badges de portée) remplaçant le style « verre sombre ».
- **Espaces strictement séparés** : Accueil (état, droits, favoris) · Supervision (tableau de bord, joueurs, parties en direct, replays, serveur) · Modération (joueurs, interventions, signalements, sanctions, journal, droits & cadeaux) · Labo en ligne (partie de test, triches en ligne, joueurs de test, paramètres serveur, tests serveur) · Bac à sable hors ligne (lancer, triches, actions en partie, mods) · Création (cartes, personnages, commandes) · Debug (diagnostics, superpositions, erreurs, réseau, console, tests client, rapport, options) · Profils & réglages (profils de test, statistiques, appareil, configurations, préférences).
- Chaque option affiche où elle s'applique (Hors ligne / En ligne · labo / Bloqué en public) ; pages verrouillées selon les droits du serveur.
- Recherche globale (pages + triches), favoris épinglés à l'accueil, 3 jeux de réglages rapides, rail compact avec libellés sur téléphone.
- Toutes les fonctions précédentes sont conservées (37 pages).

## v4.1 — écran « Nouveautés » après chaque mise à jour
- Fenêtre automatique au premier lancement après une mise à jour : « Pour tous les joueurs » + « Développeurs » (compte développeur / édition DEV uniquement) ; versions sautées rattrapées ; rien à la toute première installation ; au-dessus des autres fenêtres (jamais sur l'écran de connexion).
- Consultable : Réglages → « Nouveautés » ; Dev Hub → Accueil → « Notes de version ».
- Règle permanente ajoutée dans PROJECT_NOTES.md. Test : `tools/test-changelog.js` (9 vérifications).

## v4.2 — accès au mode développeur
- Bouton « DEV » (en haut à gauche) et bouton « 🎁 Joueurs » retirés ; remplacés par le **logo carré du Dev Hub** (« BR », dégradé indigo → cyan, petite étiquette « DEV ») **en bas à gauche** du salon, respectant les zones sûres de l'écran.
- Caché en partie et en spectateur (le joystick reste libre ; accès par « ⚡ Accès rapide ») ; étiquette « COMPTE DÉVELOPPEUR » retirée (elle chevauchait les boutons).
- Cadeaux de brawlers : Dev Hub → Modération → Droits & cadeaux.
