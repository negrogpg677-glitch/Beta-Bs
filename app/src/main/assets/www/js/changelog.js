/* Brawl Rush - NOTES DE VERSION
   Après chaque mise à jour, au premier lancement : fenêtre « Nouveautés » avec ce qui a changé
   pour tous les joueurs, et une partie « Développeurs » visible uniquement par le compte développeur / l'édition DEV.
   Si des versions ont été sautées, toutes les nouveautés manquées sont affichées. Pas d'affichage à la toute première
   installation. Consultable à tout moment : Réglages → « Nouveautés » ; Dev Hub → Accueil → « Notes de version ».
   ⚠ À chaque nouvelle version : ajouter une entrée EN TÊTE de G.CHANGELOG et mettre G.VERSION à jour. */
(function () {
  const G = window.G, UI = G.UI;
  G.VERSION = '4.4'; G.VERSION_NAME = G.VERSION;
  G.CHANGELOG = [
    { v: '4.4', date: '2026-11-26', title: 'PRISM : nouveaux héros et nouvelle interface',
      players: [
        '4 nouveaux héros originaux : Ignis le forgeron volcanique, Nyx-7 l\'androïde spectrale, Lumen la mage prismatique et Krank le pilote de marcheur — chacun avec son attaque, sa super et son style.',
        'Animations entièrement nouvelles pour ces héros : course avec du poids, pas chassés, attaque, rechargement, réaction aux coups, victoire, défaite, apparition, élimination et petits gestes quand ils attendent.',
        'Vraies matières en 3D : métal qui reflète la lumière, céramique, tissu brodé, cristal, lignes d\'énergie lumineuses.',
        'Salon : chaque personnage est présenté sur une scène à son image (forge, grille holographique, île de cristal, hangar), avec caméra animée et transition quand on change de personnage.',
        'Flèches ‹ › autour du nom pour changer de brawler directement depuis le salon.',
        'Nouvelle interface « PRISM » : salon, brawlers, boutique, modes, réglages, résultats de victoire et de défaite, tout a été redessiné ; la couleur d\'ambiance suit votre personnage.',
        'Combat : traînées lumineuses des tirs, explosions avec fumée et traces au sol, éclats à l\'élimination, caisses qui volent en éclats, effets uniques des supers, feu d\'artifice à la victoire.',
        'Commandes de combat redessinées (boutons taillés, jauge de super arc-en-ciel).',
        'Mise à jour obligatoire pour jouer en ligne (les nouveaux héros peuvent apparaître dans les parties).',
      ],
      dev: [
        'js/heroes.js : modèles 3D procéduraux (textures dessinées au lancement, carte d\'environnement générée), moteur d\'animation à états mélangés.',
        'En combat, version allégée de chaque héros : géométrie réduite et « squelette rigide » (une seule maille par matériau) → autant d\'appels de dessin que les anciens personnages.',
        'js/stage.js (scènes du salon), js/prism_fx.js (effets de combat, purement visuels), js/prism_ui.js + css/prism.css (interface joueur).',
        'Le Dev Hub n\'est pas modifié. Protocole client v4 (le serveur refuse les anciennes versions pour jouer en ligne).',
        'Qualité « économie » : héros PRISM en 2D, aucun effet supplémentaire.',
      ] },
    { v: '4.3', date: '2026-11-26', title: 'Graphismes nouvelle génération',
      players: [
        'Personnages en 3D animée pendant les combats (course, tir, roulade, victoire, défaite, élimination) — les téléphones moins puissants repassent automatiquement en 2D.',
        'Éclairage dynamique : chaque carte a son ambiance, les tirs, explosions et brawlers éclairent les alentours.',
        'Nouveaux effets de combat : ondes de choc et étincelles aux impacts, poussière des pas, éclair au tir, éliminations spectaculaires, anneau d\'énergie quand la super part.',
        'Transitions : saut néon en entrant en combat, éclair de fin de partie, changements d\'écran plus fluides.',
        'Réglages : « Éclairage dynamique » et « Personnages 3D en combat » activables ou non.',
      ],
      dev: [
        'Rendu 3D en combat groupé : tous les personnages sont dessinés en une seule passe dans un atlas 5×5 (une seule synchronisation GPU par image ; −31 % de temps de rendu mesuré).',
        'Nouveau module js/vfx.js (purement visuel, aucun effet sur la simulation ni le réseau) : carte de lumière multipliée, particules ring/dust/soul/pillar.',
        'Repli automatique : qualité « économie » → ni éclairage ni particules supplémentaires ni 3D en combat.',
      ] },
    { v: '4.2', date: '2026-11-26', title: 'Accès au mode développeur',
      players: [
        'Améliorations techniques de l\'interface.',
      ],
      dev: [
        'Le bouton « DEV » est remplacé par le logo carré du Dev Hub, en bas à gauche du salon.',
        'Le bouton « 🎁 Joueurs » est retiré : les cadeaux sont dans Dev Hub → Modération → Droits & cadeaux.',
        'En partie, le logo se cache (le joystick reste libre) : utilisez « ⚡ Accès rapide » en haut.',
      ] },
    { v: '4.1', date: '2026-11-26', title: 'Écran des nouveautés',
      players: [
        'Nouveau : un écran « Nouveautés » s\'affiche juste après chaque mise à jour, avec tout ce qui a changé.',
        'Si vous avez sauté des mises à jour, toutes les nouveautés manquées sont listées.',
        'Consultable à tout moment : Réglages → « Nouveautés ».',
      ],
      dev: [
        'Notes de version développeur : visibles uniquement par le compte développeur et l\'édition DEV.',
        'Aussi dans Dev Hub → Accueil → « Notes de version ».',
        'Tests automatiques de l\'écran des nouveautés (mise à jour, versions sautées, première installation, développeur).',
      ] },
    { v: '4.0', date: '2026-11-26', title: 'Interface développeur (Dev Hub)',
      players: [
        'Améliorations techniques et de stabilité.',
      ],
      dev: [
        'Dev Hub : refonte complète de l\'interface développeur, design moderne et espaces séparés (Supervision, Modération, Labo en ligne, Bac à sable, Création, Debug, Profils & réglages).',
        'Chaque option indique où elle s\'applique : hors ligne, en ligne (labo / privé) ou bloquée en public.',
        'Recherche globale, favoris épinglés à l\'accueil, 3 jeux de réglages rapides, rail compact sur téléphone.',
      ] },
    { v: '3.9', date: '2026-11-26', title: 'Signalements et outils de supervision',
      players: [
        'Bouton 🚩 « Signaler » sur la fiche d\'un joueur (triche, insultes, anti-jeu…).',
        'Messages de l\'équipe du jeu : avertissements et informations directement dans le jeu.',
      ],
      dev: [
        'Mode développeur côté serveur : droits séparés observer / administrer / développer, vérifiés par le serveur.',
        'Tableau de bord en direct, gestion des joueurs, spectateur avec caméra libre, replays des dernières parties.',
        'Modération journalisée (avertir, déconnecter, sanctionner, arrêter une partie), signalements.',
        'Labo de test en ligne et triches de test appliquées par le serveur (aimbot, esquive auto…), bloquées en public.',
        'Éditeur de cartes complet : annuler/rétablir, rectangle, collisions, versions, validation, publication vers le labo.',
      ] },
    { v: '3.8', date: '2026-11-26', title: 'Salon NEO 2030',
      players: [
        'Nouveau salon futuriste : fond animé, grille néon, plateforme holographique, panneaux en verre.',
        'Bouton JOUER lumineux et apparitions animées.',
        'Combat : annonces DOUBLE / TRIPLE ÉLIMINATION et éclair quand la super est prête.',
      ],
      dev: ['Menu développeur au style de la référence vidéo, accès rapide et FPS en partie.'] },
    { v: '3.7', date: '2026-11-26', title: 'Vue verticale',
      players: [
        'Les cartes sont maintenant verticales : votre équipe en bas, l\'adversaire en haut, la caméra défile vers l\'avant.',
        'Les anciennes versions doivent être mises à jour pour jouer en ligne.',
      ],
      dev: ['Cartes tournées dans les données (pas une image tournée), IA adaptée, protocole 2.'] },
    { v: '3.6', date: '2026-11-25', title: 'Fiabilité du multijoueur',
      players: [
        'iPhone : le rouleau des modes défile correctement.',
        'Correction : le joystick pouvait se bloquer après une pause.',
        '« Reprendre la partie » après une coupure ; inactivité : vous êtes sorti de la partie mais pouvez la reprendre.',
        'Un seul appareil connecté par compte ; vrai classement mondial avec votre rang.',
        'Nouveaux formats : 2 contre 2, duel classé 1 contre 1, Entraînement contre des mannequins.',
        'Réglages du joystick : flottant ou fixe, sensibilité, taille.',
        'On ne peut plus quitter une partie en ligne (sauf le duel entre amis).',
      ],
      dev: ['Menu développeur professionnel (catégories A à H), outils serveur vérifiés, joueurs de test.'] },
  ];
  const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  const isDev = () => !!(G.DEV || G.DevReady || (G.Net && G.Net.me && G.Net.me.dev));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'br_seen_version';
  function entriesSince(seen) { return G.CHANGELOG.filter((e) => !seen || cmp(e.v, seen) > 0); }
  function html(list, dev) {
    return list.map((e, i) => `<div class="cl-v ${i ? 'old' : ''}"><div class="cl-vh"><b>Version ${esc(e.v)}</b><span>${esc(e.title)}</span><small>${new Date(e.date).toLocaleDateString('fr-FR')}</small></div>
      <div class="cl-sec">🎮 Pour tous les joueurs</div><ul>${e.players.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${dev && e.dev && e.dev.length ? `<div class="cl-sec dev">🛠 Développeurs</div><ul class="dev">${e.dev.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`).join('');
  }
  G.Changelog = {
    show(list, opts) {
      opts = opts || {}; list = list && list.length ? list : G.CHANGELOG.slice(0, 1);
      const dev = isDev();
      const o = UI.modal(`<div class="clm"><div class="cl-hd"><span class="cl-new">NOUVEAUTÉS</span><h2>${opts.history ? 'Notes de version' : 'Mise à jour ' + esc(G.VERSION)}</h2>${dev ? '<span class="cl-devb">Développeur</span>' : ''}</div>
        <div class="cl-body">${html(list, dev)}</div><div class="row" style="margin-top:1.6rem"><button class="btn green" data-act="close">C'est parti !</button></div></div>`, { style: 'width:min(130rem,96vw)' });
      o.dataset.changelog = '1'; return o;
    },
    history() { return G.Changelog.show(G.CHANGELOG, { history: true }); },
    seen() { return G.Store.get(KEY); },
    markSeen() { G.Store.set(KEY, G.VERSION); },
    html: (list, dev) => html(list || G.CHANGELOG, dev !== false),
  };
  // au lancement : dès que le salon est affiché et qu'aucune autre fenêtre n'est ouverte
  function check() {
    if (navigator.webdriver && !window.__clTest) return; // tests automatiques : pas de fenêtre (sauf le test dédié)
    const seen = G.Store.get(KEY);
    if (seen === G.VERSION) return;
    const hasSave = !!(G.Save && G.Save.data && G.Save.data.tutorialDone);
    if (!seen && !hasSave) { G.Changelog.markSeen(); return; } // toute première installation : rien à annoncer
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      const ready = UI.screen === 'home' && !(G.App && G.App.state === 'match') && !UI.busy && !document.querySelector('#accBody'); // au-dessus des autres fenêtres (cadeau…), jamais sur la connexion
      if (!ready) { if (tries > 600) clearInterval(iv); return; }
      clearInterval(iv);
      // on laisse 1,8 s au compte développeur pour être reconnu (sa partie « Développeurs » s'affiche alors aussi)
      setTimeout(() => { if (UI.screen !== 'home' || (G.App && G.App.state === 'match') || document.querySelector('#accBody')) { setTimeout(check, 1500); return; } G.Changelog.show(entriesSince(seen)); G.Changelog.markSeen(); }, 1800);
    }, 400);
  }
  window.addEventListener('load', () => setTimeout(check, 1200));
  // Réglages : bouton « Nouveautés »
  const baseSettings = UI.ACT.settings;
  UI.ACT.settings = function () {
    baseSettings.apply(this, arguments);
    const o = UI.modals[UI.modals.length - 1], m = o && o.querySelector('.modal'); if (!m || m.querySelector('[data-act=changelog]')) return;
    m.insertAdjacentHTML('beforeend', `<div class="setrow"><span>Nouveautés de la version ${esc(G.VERSION)}</span><button class="btn small blue" data-act="changelog">Voir</button></div>`);
  };
  UI.ACT.changelog = () => { G.Audio.sfx('ui'); UI.closeModal(); G.Changelog.history(); };
})();
