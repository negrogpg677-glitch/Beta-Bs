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
