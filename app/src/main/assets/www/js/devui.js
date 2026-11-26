/* Brawl Rush - interface du MENU DÉVELOPPEUR « verre sombre » (modèle : vidéo de référence)
   En-tête (logo, version, Bibliothèque, Amis, Paramètres, Modifier l'interface, fermer) · colonne de catégories avec compteurs
   et recherche · onglets en pilules avec compteurs · sélecteur de profil · grille de cartes OUI/NON avec ⓘ et réglages ·
   page de détail (Activé, description, PARAMÈTRES, Retour) · « Accès rapide » + FPS en partie.
   Toutes les fonctions du menu développeur (devpro.js) sont reprises : chaque outil est une carte. */
(function () {
  const G = window.G, DP = G.DevPro; if (!DP) return;
  const Net = G.Net;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } } };
  const SV = (p, w) => `<svg viewBox="0 0 24 24" width="${w || 24}" height="${w || 24}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const IC = {
    battle: SV('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
    eye: SV('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    globe: SV('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'),
    wrench: SV('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
    search: SV('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
    info: SV('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
    sliders: SV('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
    chev: SV('<path d="M6 9l6 6 6-6"/>', 18), back: SV('<path d="M15 6l-6 6 6 6"/>', 20), x: SV('<path d="M6 6l12 12M18 6L6 18"/>', 30),
    friends: SV('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5"/>'),
    gear: SV('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
    brush: SV('<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>'), layout: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>', 20),
    bolt: SV('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', 20), star: SV('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>', 22),
  };
  const GROUPS = [
    { k: 'observe', n: 'Observer', ic: 'eye', tabs: [['dash', 'Tableau de bord'], ['players', 'Joueurs'], ['games', 'Parties'], ['diag', 'Diagnostics']] },
    { k: 'admin', n: 'Administrer', ic: 'gear', tabs: [['mod', 'Modération'], ['log', 'Journal']] },
    { k: 'studio', n: 'Studio', ic: 'battle', tabs: [['lab', 'Labo'], ['combat', 'Triches de test'], ['modes', 'Modes'], ['chars', 'Personnages'], ['maps', 'Cartes'], ['overlay', 'Affichage'], ['mods', 'Mods'], ['adv', 'Avancé']] },
  ];
  /* ---------- cartes : chaque outil du menu développeur ---------- */
  const C = [];
  const card = (id, g, tab, title, desc, o) => C.push(Object.assign({ id, g, tab, title, desc, lvl: 1 }, o || {}));
  const OFF = 'Hors ligne contre les bots · en ligne : labo et parties privées (serveur) · bloqué en public';
  const T = (id, g, tab, title, desc, key, lvl, scope) => card(id, g, tab, title, desc, { key, lvl: lvl || 1, scope });
  // 1. OBSERVER ET ANALYSER (données réelles du serveur)
  card('dash', 'observe', 'dash', 'Tableau de bord', 'Joueurs connectés, en partie, groupes, parties, état des services, latence, erreurs, alertes, statistiques et activité en direct.', { custom: 'dash', role: 'observe' });
  card('players', 'observe', 'players', 'Joueurs', 'Liste des joueurs connectés et récents, recherche, profil, session, historique, groupe, modération.', { custom: 'players', role: 'observe' });
  card('matches', 'observe', 'games', 'Parties en cours', 'Joueurs, équipes, carte, mode, état ; observer en spectateur (caméra libre).', { custom: 'matches', role: 'observe' });
  card('replays', 'observe', 'games', 'Replays', 'Revoir les dernières parties : évènements, joueur à suivre, résultats ; recherche par joueur, date ou mode.', { custom: 'replays', role: 'observe' });
  card('diag_live', 'observe', 'diag', 'Diagnostics client', 'FPS, ping, pertes de paquets, mémoire, erreurs et synchronisation.', { item: 'diag_live' });
  card('srvstate', 'observe', 'diag', 'État du serveur', 'Parties, équipes, mémoire, sessions et relais d\'appareil.', { item: 'srvstate', role: 'observe' });
  card('errors', 'observe', 'diag', 'Erreurs du client', 'Erreurs JavaScript récentes.', { item: 'errors', lvl: 2 });
  card('traffic', 'observe', 'diag', 'Trafic réseau', 'Messages reçus et envoyés, derniers évènements.', { item: 'traffic', lvl: 2 });
  card('export', 'observe', 'diag', 'Rapport de diagnostic', 'Exporter un rapport complet (sans secret).', { item: 'export' });
  // 2. ADMINISTRER ET INTERVENIR (droit « administrer », confirmation + journal)
  card('players_adm', 'admin', 'mod', 'Gestion des joueurs', 'Avertir, déconnecter une session, sanctionner (avec confirmation et journal).', { custom: 'players', role: 'admin', alias: 'players' });
  card('matches_adm', 'admin', 'mod', 'Interventions sur les parties', 'Arrêter une partie en cas de problème grave.', { custom: 'matches', role: 'admin', alias: 'matches' });
  card('reports', 'admin', 'mod', 'Signalements', 'Signalements des joueurs, à traiter.', { custom: 'reports', role: 'admin' });
  card('bans', 'admin', 'mod', 'Sanctions actives', 'Comptes suspendus et levée des sanctions.', { custom: 'bans', role: 'admin' });
  card('audit', 'admin', 'log', 'Journal d\'activité', 'Toutes les interventions (qui, quoi, quand, pourquoi), enregistrées dans la base.', { custom: 'audit', role: 'admin' });
  card('grant', 'admin', 'log', 'Droits développeur', 'Accorder ou retirer des droits (compte principal uniquement).', { item: 'grant', lvl: 3, role: 'admin' });
  // 3. STUDIO DE DÉVELOPPEMENT
  card('lab', 'studio', 'lab', 'Laboratoire de test (en ligne)', 'Partie de test : mode, carte, équipes, bots, niveau, carte modifiée ; réglages en direct, réinitialisation, déconnexion/inactivité.', { custom: 'lab', role: 'dev' });
  card('cheats', 'studio', 'lab', 'Triches de test en ligne', 'Aimbot, esquive auto, invincible… appliqués par le serveur en labo et en privé.', { custom: 'cheats', role: 'dev' });
  card('selftest', 'studio', 'lab', 'Tests serveur', 'Simule tous les modes avec la simulation du serveur.', { custom: 'selftest', role: 'dev' });
  card('autotests', 'studio', 'lab', 'Tests automatiques (client)', 'Joue tous les modes dans l\'appareil, avec historique.', { item: 'autotests' });
  card('simgroup', 'studio', 'lab', 'Bots et joueurs de test', 'Joueurs de test, invitations, départs, chef, demandes d\'ami (identifiés TEST).', { item: 'simgroup', role: 'dev' });
  card('simnet', 'studio', 'lab', 'Connexion et partie', 'Déconnexion, inactivité, reprise, victoire, défaite, abandon.', { item: 'simnet', role: 'dev', lvl: 2 });
  card('livecfg', 'studio', 'lab', 'Paramètres serveur en direct', 'Délai d\'inactivité et fenêtre de reconnexion.', { item: 'livecfg', role: 'dev', lvl: 2 });
  T('god', 'studio', 'combat', 'Invincible', 'Vous ne subissez aucun dégât.', 'god', 1, OFF);
  T('ammo', 'studio', 'combat', 'Munitions infinies', 'Vos trois munitions sont toujours pleines.', 'ammo', 1, OFF);
  T('sup', 'studio', 'combat', 'Super toujours prête', 'La super est rechargée en permanence.', 'sup', 1, OFF);
  T('ohk', 'studio', 'combat', 'Un coup = élimination', 'Chaque tir élimine la cible.', 'ohk', 1, OFF);
  T('aim', 'studio', 'combat', 'Aimbot', 'Chaque tir vise l\'ennemi le plus proche (avec anticipation en ligne).', 'aim', 1, OFF);
  T('dodge', 'studio', 'combat', 'Esquive automatique', 'Roulade automatique quand un projectile ennemi va vous toucher.', 'dodge', 1, OFF);
  T('auto', 'studio', 'combat', 'Tir automatique', 'Tire tout seul dès qu\'un ennemi est à portée.', 'auto', 1, OFF);
  T('gad', 'studio', 'combat', 'Gadgets infinis', 'Le gadget se recharge sans limite.', 'gad', 1, OFF);
  T('passive', 'studio', 'combat', 'Ennemis passifs', 'Les adversaires ne tirent plus (hors ligne ; en ligne : option du labo).', 'passive', 1, 'Hors ligne · en ligne via le labo');
  card('mult', 'studio', 'combat', 'Multiplicateurs', 'Dégâts, vitesse de votre brawler et vitesse du jeu.', { custom: 'mult', scope: OFF });
  card('matchacts', 'studio', 'combat', 'Actions en partie', 'Soigner, super immédiate, éliminer, ajouter des bots, gagner ou perdre.', { custom: 'acts', scope: 'Hors ligne (contre les bots)' });
  card('launch', 'studio', 'modes', 'Lancer un mode', 'Toutes les cartes de tous les modes, hors ligne.', { item: 'launch' });
  card('training', 'studio', 'modes', 'Entraînement', 'Ennemis passifs et invincibilité, puis lancement.', { item: 'training' });
  card('privtest', 'studio', 'modes', 'Partie privée de test', 'Partie réelle sur le serveur avec 2 joueurs de test.', { item: 'privtest', lvl: 2, role: 'dev' });
  card('charedit', 'studio', 'chars', 'Éditeur de personnages', 'Vie, vitesse, dégâts, portée et recharge (hors ligne et labo en ligne).', { item: 'charedit' });
  card('unlock', 'studio', 'chars', 'Déblocages', 'Tout débloquer, niveau maximum.', { item: 'unlock' });
  card('joy', 'studio', 'chars', 'Joystick', 'Mode, sensibilité, taille et position des commandes.', { act: 'joyOpen' });
  card('mapedit', 'studio', 'maps', 'Éditeur de cartes', 'Créer, modifier, annuler/rétablir, versions, validation, test hors ligne ou dans le labo en ligne.', { item: 'mapedit' });
  T('fps', 'studio', 'overlay', 'Compteur FPS', 'Affiche les FPS et le nombre d\'entités en jeu.', 'fps');
  T('hit', 'studio', 'overlay', 'Hitbox, murs et portées', 'Affiche les zones de collision et de portée.', 'hit');
  T('aiov', 'studio', 'overlay', 'IA visible', 'Cibles, chemins et objectifs des bots.', 'ai', 2);
  T('esp', 'studio', 'overlay', 'Vision des cachés', 'Montre les ennemis dans les buissons (hors ligne).', 'esp');
  card('flags', 'studio', 'overlay', 'Options de fonctionnalités', '3D en combat, aide à la visée, gaucher, vibrations…', { item: 'flags', lvl: 2 });
  card('testprof', 'studio', 'adv', 'Profils de test', 'Profils locaux jamais envoyés dans le cloud.', { item: 'testprof' });
  card('teststats', 'studio', 'adv', 'Statistiques du profil', 'Trophées, pièces, gemmes, progression, récompenses.', { item: 'teststats' });
  card('device', 'studio', 'adv', 'Multi-appareils', 'Identifiant d\'appareil et simulation d\'un autre appareil.', { item: 'device', lvl: 2 });
  card('console', 'studio', 'adv', 'Console JavaScript', 'Exécuter du code dans le jeu.', { item: 'console', lvl: 3 });
  card('configs', 'studio', 'adv', 'Configurations', 'Enregistrer, restaurer et comparer des réglages.', { item: 'configs', lvl: 3 });
  card('legacy', 'studio', 'adv', 'Mods personnalisés', 'Éditeur de mods JavaScript (ancien panneau).', { act: 'legacy', lvl: 3 });
  card('uiprefs', 'studio', 'adv', 'Préférences du menu', 'Niveau d\'affichage, pause en partie, réinitialisation.', { item: 'uiprefs' });
  const modCards = () => (G.Dev && G.Dev.BUILTIN ? G.Dev.BUILTIN.map((m) => ({ id: 'mod_' + m.id, g: 'studio', tab: 'mods', title: m.name, desc: m.desc, mod: m.id, lvl: 1 })) : []);
  const all = () => C.concat(modCards()).filter((c) => c.lvl <= DP.lvl);
  const isOn = (c) => (c.key ? !!G.Dev.cfg[c.key] : c.mod ? !!(G.Dev.cfg.mods || {})[c.mod] : false);
  const itemOf = (id) => DP._I.find((x) => x.id === id);

  /* ---------- état de l'interface ---------- */
  const U = { g: 'observe', tab: 'dash', detail: null, search: false, q: '', view: 'lib', pop: null };
  const PROF = { cur: () => LS.get('br_dev_prof', 1), all: () => LS.get('br_dev_profiles', {}) };

  const pill = (c) => c.key || c.mod ? `<span class="rg-pill ${isOn(c) ? 'on' : ''}">${isOn(c) ? 'OUI' : 'NON'}</span>` : `<span class="rg-pill tool">${c.act ? 'ACTION' : 'OUTIL'}</span>`;
  const locked = (c) => c.role && !(G.DevConsole && G.DevConsole.roles().includes(c.role));
  const cardHtml = (c) => `<div class="rg-card ${isOn(c) ? 'on' : ''} ${locked(c) ? 'lock' : ''}" data-card="${c.id}"><div class="rg-ct"><b>${locked(c) ? '🔒 ' : ''}${esc(c.title)}</b>${pill(c)}${c.scope ? `<small class="rg-scope">${esc(c.scope)}</small>` : ''}</div>
    <div class="rg-cb"><button class="rg-ib" data-info="${c.id}" aria-label="Infos">${IC.info}</button>${c.key || c.mod ? '' : `<button class="rg-ib" data-info="${c.id}" aria-label="Réglages">${IC.sliders}</button>`}</div></div>`;
  function section(title, list) { return `<div class="rg-sec"><div class="rg-sh">${esc(title)}</div><div class="rg-grid">${list.map(cardHtml).join('') || '<div class="rg-empty">Aucun outil à ce niveau d\'affichage (Paramètres → niveau Expert).</div>'}</div></div>`; }
  function customHtml(c) {
    const cfg = G.Dev.cfg;
    if (c.custom === 'mult') return ['dmg', 'speed', 'ts'].map((k) => { const lab = { dmg: 'Dégâts ×', speed: 'Vitesse du joueur ×', ts: 'Vitesse du jeu ×' }[k], mm = { dmg: [0.25, 10, 0.25], speed: [0.5, 3, 0.1], ts: [0.2, 3, 0.1] }[k];
      return `<div class="rg-row"><span>${lab} <b class="dp-v">${cfg[k]}</b></span><input type="range" data-r="${k}" min="${mm[0]}" max="${mm[1]}" step="${mm[2]}" value="${cfg[k]}"></div>`; }).join('');
    if (c.custom === 'acts') { const inM = G.App.state === 'match' && G.App.M && !G.App.M.net;
      return (inM ? '' : '<div class="rg-note">Lancez une partie hors ligne (Bataille → Modes de test) pour utiliser ces actions.</div>') +
        `<div class="dp-chips">${[['heal', 'Soigner'], ['superNow', 'Super prête'], ['maxhp', '+5000 PV max'], ['killAll', 'Éliminer les ennemis'], ['center', 'Aller au centre'], ['skipTime', '−30 s'], ['botFriend', '+ Bot allié'], ['botFoe', '+ Bot ennemi'], ['cubes', '+5 cubes'], ['win', 'Gagner'], ['lose', 'Perdre']].map(([a, l]) => `<button class="btn small" data-a="${a}" ${inM ? '' : 'disabled'}>${l}</button>`).join('')}</div>`; }
    if (G.DevConsole && G.DevConsole.render(c.custom)) return G.DevConsole.render(c.custom);
    return '';
  }
  function detailHtml(c) {
    let body = '';
    if (c.item) { const it = itemOf(c.item); try { body = it ? it.html() : ''; } catch (e) { body = '<div class="rg-note">Erreur : ' + esc(e.message) + '</div>'; } }
    else if (c.custom) body = customHtml(c);
    else if (c.act) body = `<div class="dp-chips"><button class="btn small" data-a="${c.act}">Ouvrir</button></div>`;
    else body = '<div class="rg-note">Aucun paramètre supplémentaire : utilisez l\'interrupteur « Activé ».</div>';
    const fav = DP.fav.includes(c.id);
    return `<div class="rg-dt"><div class="rg-dh"><h3>${esc(c.title)}</h3><button class="rg-fav ${fav ? 'on' : ''}" data-favc="${c.id}" aria-label="Favori">${IC.star}</button>
      ${c.key || c.mod ? `<label class="rg-act">Activé <span class="rg-tg ${isOn(c) ? 'on' : ''}" data-tgc="${c.id}"><i></i></span></label>` : ''}</div>
      <div class="rg-desc">${IC.info}<span>${esc(c.desc)}${c.scope ? '<br><b>Où :</b> ' + esc(c.scope) : ''}${c.role ? '<br><b>Droit requis :</b> ' + ({ observe: 'observer', admin: 'administrer', dev: 'développer' }[c.role]) + ' (vérifié par le serveur)' : ''}</span></div>
      <div class="rg-sec"><div class="rg-sh">${c.custom && ['dash', 'players', 'matches', 'replays', 'reports', 'bans', 'audit'].includes(c.custom) ? 'DONNÉES DU SERVEUR (EN DIRECT)' : 'PARAMÈTRES'}</div><div class="rg-params">${body}</div></div>
      <div class="rg-foot"><button class="rg-back" data-back="1">${IC.back} Retour</button></div></div>`;
  }
  function counts(g) { return all().filter((c) => c.g === g).length; }
  function render() {
    const o = DP.panel; if (!o) return;
    const body = o.querySelector('#rgBody'), tabs = o.querySelector('#rgTabs'), g = GROUPS.find((x) => x.k === U.g);
    o.querySelectorAll('.rg-side .rg-cat').forEach((b) => { b.classList.toggle('on', b.dataset.g === U.g && !U.search && U.view === 'lib'); const n = b.querySelector('.rg-n'); if (n) n.textContent = counts(b.dataset.g); });
    o.querySelector('.rg-sbtn').classList.toggle('on', U.search);
    o.querySelector('#rgLib').firstChild.textContent = U.view === 'fav' ? 'Favoris ' : 'Bibliothèque ';
    o.querySelector('#rgProf').firstChild.nextSibling.textContent = ' Profil ' + PROF.cur() + ' ';
    o.querySelector('.rg-content').classList.toggle('detail', !!U.detail);
    if (U.detail) { const c = all().concat(C).find((x) => x.id === U.detail); tabs.innerHTML = ''; tabs.hidden = true; body.innerHTML = c ? detailHtml(c) : ''; return; }
    tabs.hidden = false;
    if (U.search) {
      tabs.innerHTML = `<div class="rg-search">${IC.search}<input id="rgQ" placeholder="Rechercher un outil…" value="${esc(U.q)}" autocomplete="off"></div>`;
      const q = U.q.trim().toLowerCase(), hits = all().filter((c) => (c.title + ' ' + c.desc).toLowerCase().includes(q));
      body.innerHTML = section(q ? hits.length + ' résultat(s)' : 'Tous les outils', q ? hits : all());
      const i = tabs.querySelector('#rgQ'); i.addEventListener('input', () => { U.q = i.value; const p = i.selectionStart; render(); const j = DP.panel.querySelector('#rgQ'); if (j) { j.focus(); try { j.setSelectionRange(p, p); } catch (e) { /* ignore */ } } }); setTimeout(() => i.focus(), 30);
      return;
    }
    if (U.view === 'fav') { tabs.innerHTML = '<span class="rg-tab on">★ Favoris</span>'; body.innerHTML = section('FAVORIS', all().filter((c) => DP.fav.includes(c.id))); return; }
    tabs.innerHTML = g.tabs.map(([k, n]) => { const cnt = all().filter((c) => c.g === g.k && c.tab === k).length; return `<button class="rg-tab ${U.tab === k ? 'on' : ''}" data-tab="${k}">${n}${cnt ? `<span class="rg-c">${cnt}</span>` : ''}</button>`; }).join('');
    // toutes les sections du groupe, l'onglet choisi en premier (comme la référence : on fait défiler les sections)
    const order = g.tabs.slice().sort((a, b) => (a[0] === U.tab ? -1 : b[0] === U.tab ? 1 : 0));
    body.innerHTML = order.map(([k, n]) => section(n.toUpperCase(), all().filter((c) => c.g === g.k && c.tab === k))).join('');
    body.scrollTop = 0;
  }
  function popup(kind, anchor) {
    const o = DP.panel; o.querySelectorAll('.rg-pop').forEach((x) => x.remove());
    if (U.pop === kind) { U.pop = null; return; } U.pop = kind;
    const r = anchor.getBoundingClientRect(), pr = o.querySelector('.rg').getBoundingClientRect();
    const items = kind === 'lib' ? [['lib', 'Bibliothèque'], ['fav', 'Favoris'], ['legacy', 'Ancien panneau']] : [1, 2, 3].map((n) => ['p' + n, 'Profil ' + n + (PROF.all()[n] ? '' : ' (vide)')]);
    const d = document.createElement('div'); d.className = 'rg-pop';
    d.style.left = (r.left - pr.left) + 'px'; d.style.top = (r.bottom - pr.top + 6) + 'px'; d.style.minWidth = r.width + 'px';
    d.innerHTML = items.map(([k, l]) => `<button data-popk="${k}">${esc(l)}</button>`).join('');
    o.querySelector('.rg').appendChild(d);
  }
  function setProfile(n) {
    const all0 = PROF.all(), cur = PROF.cur(), cfg = G.Dev.cfg;
    all0[cur] = JSON.parse(JSON.stringify(cfg)); // le profil actuel garde ses réglages
    if (all0[n]) { const keep = cfg.custom; Object.keys(cfg).forEach((k) => delete cfg[k]); Object.assign(cfg, JSON.parse(JSON.stringify(all0[n])), { custom: keep }); }
    LS.set('br_dev_profiles', all0); LS.set('br_dev_prof', n); G.Dev.persist && G.Dev.persist();
    G.UI.toast('Profil ' + n + (all0[n] ? ' chargé' : ' créé (copie des réglages actuels)'), 1800);
  }
  function toggleCard(c) {
    const cfg = G.Dev.cfg;
    if (c.key) cfg[c.key] = !cfg[c.key]; else if (c.mod) { cfg.mods = cfg.mods || {}; cfg.mods[c.mod] = !cfg.mods[c.mod]; }
    G.Dev.persist && G.Dev.persist();
  }
  function onClick(e) {
    const t = e.target.closest('[data-g],[data-tab],[data-card],[data-info],[data-back],[data-tgc],[data-favc],[data-hdr],[data-popk],[data-sbtn]');
    if (!t) { if (U.pop && !e.target.closest('.rg-pop')) { U.pop = null; DP.panel.querySelectorAll('.rg-pop').forEach((x) => x.remove()); } return false; }
    const d = t.dataset; G.Audio.unlock && G.Audio.unlock();
    if (d.g) { G.Audio.sfx('ui'); U.g = d.g; U.tab = GROUPS.find((x) => x.k === d.g).tabs[0][0]; U.detail = null; U.search = false; U.view = 'lib'; }
    else if (d.tab) { G.Audio.sfx('ui'); U.tab = d.tab; }
    else if (d.sbtn) { G.Audio.sfx('ui'); U.search = !U.search; U.detail = null; U.view = 'lib'; }
    else if (d.info) { G.Audio.sfx('ui'); U.detail = d.info; openView(d.info); }
    else if (d.back) { G.Audio.sfx('back'); U.detail = null; }
    else if (d.tgc) { const c = all().concat(modCards()).find((x) => x.id === d.tgc); if (c) { toggleCard(c); G.Audio.sfx(isOn(c) ? 'pickup' : 'back'); if (G.Net.me && G.Net.me.roles && G.Net.me.roles.includes('dev')) G.Net.send({ t: 'dv_cheats', cheats: G.Dev.cfg }); } }
    else if (d.favc) { const i = DP.fav.indexOf(d.favc); if (i >= 0) DP.fav.splice(i, 1); else DP.fav.push(d.favc); LS.set('br_dev_fav', DP.fav); G.Audio.sfx('ui'); }
    else if (d.card) {
      if (e.target.closest('button, input, .rg-tg')) return true;
      const c = all().find((x) => x.id === d.card); if (!c) return true;
      if (c.key || c.mod) { toggleCard(c); G.Audio.sfx(isOn(c) ? 'pickup' : 'back'); if (G.Net.me && G.Net.me.roles && G.Net.me.roles.includes('dev')) G.Net.send({ t: 'dv_cheats', cheats: G.Dev.cfg }); } else if (c.act === 'joyOpen') { closeUI(); G.UI.ACT.settings(); return true; } else if (c.act) { const b = document.createElement('button'); b.dataset.a = c.act; DP._click({ target: b }); return true; } else { G.Audio.sfx('ui'); U.detail = c.id; openView(c.id); }
    } else if (d.hdr) {
      G.Audio.sfx('ui');
      if (d.hdr === 'close') { closeUI(); return true; }
      if (d.hdr === 'friends') { closeUI(); G.UI.devPanel && G.UI.devPanel(); return true; }
      if (d.hdr === 'settings') { U.detail = 'uiprefs'; }
      if (d.hdr === 'iface') { closeUI(); G.UI.ACT.ctrlEdit && G.UI.ACT.ctrlEdit(); return true; }
      if (d.hdr === 'lib' || d.hdr === 'prof') { popup(d.hdr, t); return true; }
    } else if (d.popk) {
      U.pop = null; DP.panel.querySelectorAll('.rg-pop').forEach((x) => x.remove()); G.Audio.sfx('ui');
      if (d.popk === 'legacy') { closeUI(); DP.legacy && DP.legacy(); return true; }
      if (d.popk === 'lib' || d.popk === 'fav') { U.view = d.popk; U.detail = null; U.search = false; }
      else setProfile(+d.popk.slice(1));
    }
    render(); return true;
  }
  function closeUI() { DP.close(); }
  function openView(id) { const c = C.find((x) => x.id === id); if (c && c.custom && G.DevConsole) { if (c.alias === 'players' || c.custom === 'players') G.DevConsole.view.pid = null; G.DevConsole.open(c.custom); } }

  /* ---------- ouverture ---------- */
  function open() {
    if (DP.panel) { DP.close(); return; }
    DP._hookNet(); DP._hookDev();
    const inM = G.App.state === 'match' && G.App.M;
    DP.wasPaused = G.App.paused;
    if (inM && !G.App.M.net && DP.pause) { G.App.paused = true; G.Input.reset(); }
    const o = document.createElement('div'); o.className = 'rg-ov' + (inM ? ' inmatch' : '');
    o.innerHTML = `<div class="rg"><header class="rg-hd"><div class="rg-logo">BR</div><div class="rg-name"><b>Brawl Rush DEV</b><small>BRDEV ${esc(G.VERSION_NAME || '3.8')}</small></div>
        <button class="rg-dd" id="rgLib" data-hdr="lib">Bibliothèque ${IC.chev}</button><div class="rg-sp"></div>
        <button class="rg-hb purple" data-hdr="friends">${IC.friends}<span>Amis</span></button><button class="rg-hb orange" data-hdr="settings">${IC.gear}<span>Paramètres</span></button>
        <button class="rg-hb blue" data-hdr="iface">${IC.brush}<span>Modifier l'interface</span></button><button class="rg-hb red rg-close" data-hdr="close" aria-label="Fermer">${IC.x}</button></header>
      <div class="rg-main"><nav class="rg-side">${GROUPS.map((g) => `<button class="rg-cat" data-g="${g.k}"><span class="rg-n">0</span>${IC[g.ic]}<b>${g.n}</b></button>`).join('')}<div class="rg-fill"></div><button class="rg-cat rg-sbtn" data-sbtn="1" aria-label="Rechercher">${IC.search}</button></nav>
        <section class="rg-content"><div class="rg-top"><div class="rg-tabs" id="rgTabs"></div><button class="rg-dd" id="rgProf" data-hdr="prof">${IC.layout} Profil 1 ${IC.chev}</button></div><div class="rg-body" id="rgBody"></div></section></div></div>`;
    document.getElementById('ui').appendChild(o); DP._setPanel(o);
    o.addEventListener('click', (e) => { if (!onClick(e)) DP._click(e); });
    o.addEventListener('input', (e) => DP._input(e));
    o.addEventListener('change', () => G.Dev.persist && G.Dev.persist());
    o.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'dpIn') DP._runCon(); });
    o.addEventListener('pointerdown', (e) => { const cv = e.target.closest('#meCv'); if (!cv) return; if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); cv._down = true; DP._mePaint({ currentTarget: cv, clientX: e.clientX, clientY: e.clientY }); });
    o.addEventListener('pointermove', (e) => { const cv = e.target.closest('#meCv'); if (cv && cv._down) DP._mePaint({ currentTarget: cv, clientX: e.clientX, clientY: e.clientY }); });
    o.addEventListener('pointerup', () => { const cv = o.querySelector('#meCv'); if (cv) cv._down = false; });
    if (G.Account && G.Account.loggedIn && G.Account.loggedIn()) Net.send({ t: 'dv_state' });
    DP._render();
    DP._live(() => { if (!DP.panel) return; const k = DP.panel.querySelector('#dpKpis'); if (k) { const it = itemOf('diag_live'), tmp = document.createElement('div'); tmp.innerHTML = it.html(); const nk = tmp.querySelector('#dpKpis'); if (nk) k.innerHTML = nk.innerHTML; } });
  }
  DP.renderHook = render;
  DP.open = open;
  DP.ui = U; DP.cards = () => all();

  /* ---------- en partie : « Accès rapide » + FPS ---------- */
  function quick() {
    let q = document.getElementById('rgQuick');
    if (!q) {
      q = document.createElement('div'); q.id = 'rgQuick';
      q.innerHTML = `<button class="rg-qa" aria-label="Accès rapide">${IC.bolt}<span>Accès rapide</span></button><span class="rg-fps">— FPS</span>`;
      document.getElementById('app').appendChild(q);
      q.querySelector('.rg-qa').addEventListener('click', () => { if (G.Dev) { U.view = DP.fav.length ? 'fav' : 'lib'; U.detail = null; U.search = false; open(); } });
    }
    return q;
  }
  setInterval(() => {
    if (!G.Dev || !G.DevReady) return;
    const q = quick(), on = G.App.state === 'match' && !!G.App.M; q.hidden = !on;
    if (on) q.querySelector('.rg-fps').textContent = Math.round(G.Dev.fps || 0) + ' FPS';
  }, 500);
})();
