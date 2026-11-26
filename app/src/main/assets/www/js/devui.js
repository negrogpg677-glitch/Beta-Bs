/* Brawl Rush - INTERFACE DU MODE DÉVELOPPEUR (refonte « Dev Hub »)
   Design moderne et espaces strictement séparés : chaque domaine a son propre espace, ses pages et sa couleur.
   Accueil · Supervision · Modération · Labo en ligne · Bac à sable (hors ligne) · Création · Debug · Profils & réglages.
   Aucune fonction supprimée : les outils de devpro.js (I) et de devconsole.js (vues serveur) sont rangés dans ces espaces.
   Les droits (observer / administrer / développer) restent vérifiés par le serveur ; l'interface affiche des verrous. */
(function () {
  const G = window.G, DP = G.DevPro; if (!DP) return;
  const Net = G.Net;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } } };
  const SV = (p, w) => `<svg viewBox="0 0 24 24" width="${w || 22}" height="${w || 22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const IC = {
    home: SV('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    monitor: SV('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
    shield: SV('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
    flask: SV('<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 19l-6-10V3"/><path d="M7 15h10"/>'),
    gamepad: SV('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13h.01"/>'),
    brush: SV('<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>'),
    bug: SV('<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 7V4M8 4l2 3M16 4l-2 3M3 12h4M17 12h4M4 18l3-2M20 18l-3-2"/>'),
    user: SV('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
    search: SV('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'), x: SV('<path d="M6 6l12 12M18 6L6 18"/>', 24),
    star: SV('<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>', 20), lock: SV('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 16),
    chev: SV('<path d="M9 6l6 6-6 6"/>', 18), bolt: SV('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', 20),
  };
  const B = { off: ['Hors ligne', 'b-off'], lab: ['En ligne · labo / privé', 'b-lab'], srv: ['Serveur', 'b-srv'], blocked: ['Bloqué en public', 'b-blk'], dev: ['Droit : développer', 'b-role'], obs: ['Droit : observer', 'b-role'], adm: ['Droit : administrer', 'b-role'] };
  const badge = (k) => `<span class="dh-b ${B[k][1]}">${B[k][0]}</span>`;

  /* ---------- espaces et pages ---------- */
  // page : { id, t (titre), d (description), role, view: 'console:clé' | 'item:id' | 'items:a,b' | fonction }
  const toggles = (list, scope) => () => list.map(([k, title, desc, sc]) => `<div class="dh-row"><div class="dh-rt"><b>${title}</b><small>${desc}</small><span class="dh-bs">${(sc || scope).map(badge).join('')}</span></div><button class="dh-sw ${G.Dev.cfg[k] ? 'on' : ''}" data-tg="${k}" aria-label="${title}"><i></i></button></div>`).join('');
  const sliders = (list) => list.map(([k, l, a, b, s]) => `<div class="dh-row"><div class="dh-rt"><b>${l} <span class="dp-v">${G.Dev.cfg[k]}</span></b></div><input type="range" data-r="${k}" min="${a}" max="${b}" step="${s}" value="${G.Dev.cfg[k]}"></div>`).join('');
  const CHEATS = [['god', 'Invincible', 'Aucun dégât reçu.'], ['ammo', 'Munitions infinies', 'Trois munitions en permanence.'], ['sup', 'Super toujours prête', 'La super se recharge instantanément.'], ['ohk', 'Un coup = élimination', 'Chaque tir élimine.'], ['aim', 'Aimbot', 'Vise l\'ennemi le plus proche (anticipation en ligne).'], ['dodge', 'Esquive automatique', 'Roulade quand un projectile va toucher.'], ['auto', 'Tir automatique', 'Tire dès qu\'un ennemi est à portée.'], ['gad', 'Gadgets infinis', 'Le gadget se recharge sans limite.']];
  const W = [
    { k: 'home', n: 'Accueil', s: 'Vue d\'ensemble', ic: 'home', c: '#7c8cff', pages: [{ id: 'home', t: 'Accueil', d: 'État, droits, favoris et accès rapide aux espaces.', view: () => homeView() }] },
    { k: 'monitor', n: 'Supervision', s: 'Joueurs, parties, replays', ic: 'monitor', c: '#22d3ee', role: 'observe', pages: [
      { id: 'dash', t: 'Tableau de bord', d: 'Données réelles du serveur, en direct.', role: 'observe', view: 'console:dash' },
      { id: 'players', t: 'Joueurs', d: 'Connectés et récents, recherche, profil, historique.', role: 'observe', view: 'console:players' },
      { id: 'matches', t: 'Parties en direct', d: 'Observer une partie en spectateur (caméra libre).', role: 'observe', view: 'console:matches' },
      { id: 'replays', t: 'Replays', d: 'Revoir les dernières parties terminées.', role: 'observe', view: 'console:replays' },
      { id: 'srvstate', t: 'Serveur', d: 'Parties, groupes, mémoire, sessions.', role: 'observe', view: 'item:srvstate' }] },
    { k: 'moderation', n: 'Modération', s: 'Sanctions, signalements, journal', ic: 'shield', c: '#f87171', role: 'admin', pages: [
      { id: 'mplayers', t: 'Joueurs', d: 'Avertir, déconnecter, sanctionner (confirmation + journal).', role: 'admin', view: 'console:players' },
      { id: 'mmatches', t: 'Interventions', d: 'Arrêter une partie en cas de problème grave.', role: 'admin', view: 'console:matches' },
      { id: 'reports', t: 'Signalements', d: 'Signalements envoyés par les joueurs.', role: 'admin', view: 'console:reports' },
      { id: 'bans', t: 'Sanctions', d: 'Comptes suspendus, levée des sanctions.', role: 'admin', view: 'console:bans' },
      { id: 'audit', t: 'Journal', d: 'Toutes les interventions, enregistrées dans la base.', role: 'admin', view: 'console:audit' },
      { id: 'grant', t: 'Droits & cadeaux', d: 'Accorder des droits (compte principal), offrir des brawlers.', role: 'admin', view: 'item:grant' }] },
    { k: 'lab', n: 'Labo en ligne', s: 'Parties de test sur le serveur', ic: 'flask', c: '#a78bfa', role: 'dev', pages: [
      { id: 'lab', t: 'Partie de test', d: 'Mode, carte, équipes, bots, carte modifiée ; réglages en direct.', role: 'dev', view: 'console:lab' },
      { id: 'cheats', t: 'Triches en ligne', d: 'Appliquées par le serveur, seulement dans le labo et vos parties privées.', role: 'dev', view: 'console:cheats' },
      { id: 'testers', t: 'Joueurs de test', d: 'Simuler des joueurs, groupes, invitations, déconnexions.', role: 'dev', view: 'items:simgroup,simnet,privtest' },
      { id: 'livecfg', t: 'Paramètres serveur', d: 'Délai d\'inactivité, fenêtre de reconnexion.', role: 'dev', view: 'item:livecfg' },
      { id: 'selftest', t: 'Tests serveur', d: 'Tous les modes simulés par le serveur.', role: 'dev', view: 'console:selftest' }] },
    { k: 'sandbox', n: 'Bac à sable', s: 'Hors ligne, contre les bots', ic: 'gamepad', c: '#34d399', pages: [
      { id: 'play', t: 'Lancer', d: 'N\'importe quel mode et carte, ou l\'entraînement.', view: 'items:launch,training' },
      { id: 'scheats', t: 'Triches', d: 'Hors ligne contre les bots. Les mêmes réglages servent dans le labo en ligne.', view: () => toggles(CHEATS.concat([['passive', 'Ennemis passifs', 'Les bots ne tirent plus.']]), ['off'])() + sliders([['dmg', 'Dégâts ×', 0.25, 10, 0.25], ['speed', 'Vitesse du joueur ×', 0.5, 3, 0.1], ['ts', 'Vitesse du jeu ×', 0.2, 3, 0.1]]) },
      { id: 'acts', t: 'Actions en partie', d: 'Soigner, éliminer, ajouter des bots, gagner…', view: () => actsView() },
      { id: 'mods', t: 'Mods', d: 'Géants, minis… et mods JavaScript personnalisés.', view: () => modsView() }] },
    { k: 'create', n: 'Création', s: 'Cartes, personnages, commandes', ic: 'brush', c: '#fb923c', pages: [
      { id: 'mapedit', t: 'Éditeur de cartes', d: 'Créer, modifier, valider, publier vers le labo.', view: 'item:mapedit' },
      { id: 'charedit', t: 'Personnages', d: 'Vie, vitesse, dégâts, portée, recharge ; déblocages.', view: 'items:charedit,unlock' },
      { id: 'controls', t: 'Commandes', d: 'Joystick (mode, sensibilité, taille) et position des boutons.', view: () => `<div class="dh-actions"><button class="btn small blue" data-x="ctrl">Modifier la position des commandes</button><button class="btn small" data-x="joy">Réglages du joystick</button></div>` }] },
    { k: 'debug', n: 'Debug', s: 'Diagnostics et outils techniques', ic: 'bug', c: '#60a5fa', pages: [
      { id: 'diag', t: 'Diagnostics', d: 'FPS, ping, pertes, mémoire, erreurs, synchronisation.', view: 'item:diag_live' },
      { id: 'overlays', t: 'Superpositions', d: 'Informations affichées pendant la partie.', view: toggles([['fps', 'Compteur FPS', 'FPS et nombre d\'entités.'], ['hit', 'Hitbox, murs et portées', 'Zones de collision et de portée.'], ['ai', 'IA visible', 'Cibles, chemins, objectifs des bots.'], ['esp', 'Vision des cachés', 'Ennemis dans les buissons.']], ['off']) },
      { id: 'errors', t: 'Erreurs', d: 'Erreurs JavaScript récentes.', view: 'item:errors' },
      { id: 'traffic', t: 'Réseau', d: 'Messages reçus et envoyés.', view: 'item:traffic' },
      { id: 'console', t: 'Console', d: 'Exécuter du code dans le jeu.', view: 'item:console' },
      { id: 'autotests', t: 'Tests client', d: 'Tous les modes joués dans l\'appareil.', view: 'item:autotests' },
      { id: 'export', t: 'Rapport', d: 'Exporter un rapport de diagnostic (sans secret).', view: 'item:export' },
      { id: 'flags', t: 'Options', d: 'Fonctionnalités activables.', view: 'item:flags' }] },
    { k: 'profiles', n: 'Profils & réglages', s: 'Profils de test, configurations', ic: 'user', c: '#94a3b8', pages: [
      { id: 'testprof', t: 'Profils de test', d: 'Profils locaux jamais envoyés dans le cloud.', view: 'item:testprof' },
      { id: 'teststats', t: 'Statistiques', d: 'Trophées, pièces, gemmes, progression.', view: 'item:teststats' },
      { id: 'device', t: 'Appareil', d: 'Identifiant d\'appareil, simulation d\'un autre appareil.', view: 'item:device' },
      { id: 'configs', t: 'Configurations', d: 'Jeux de réglages : enregistrer, restaurer, comparer.', view: () => slotsView() + itemHtml('configs') },
      { id: 'prefs', t: 'Préférences', d: 'Niveau d\'affichage, pause en partie, réinitialisation.', view: 'item:uiprefs' }] },
  ];
  const PAGES = []; W.forEach((w) => w.pages.forEach((p) => PAGES.push(Object.assign({ ws: w.k }, p))));
  const roles = () => (G.DevConsole ? G.DevConsole.roles() : []);
  const locked = (r) => r && !roles().includes(r);
  const itemHtml = (id) => { const it = DP._I.find((x) => x.id === id); if (!it) return ''; try { return it.html(); } catch (e) { return '<div class="dh-note">Erreur : ' + esc(e.message) + '</div>'; } };

  /* ---------- vues spéciales ---------- */
  function homeView() {
    const r = roles(), on = Net.status === 'online', me = Net.me;
    const favs = PAGES.filter((p) => DP.fav.includes(p.id));
    return `<div class="dh-hero"><div><h2>Bonjour ${esc((me && me.name) || G.Save.data.name || '')}</h2><p>${on ? 'Connecté au serveur · ' + (Net.ping || '?') + ' ms' : 'Hors ligne'} · ${r.length ? 'Droits : ' + r.map((x) => ({ observe: 'observer', admin: 'administrer', dev: 'développer' }[x])).join(', ') : (G.DEV ? 'Édition DEV (outils hors ligne)' : 'Aucun droit serveur')}</p></div>
      <div class="dh-pills"><span class="dh-pill ${on ? 'ok' : 'ko'}">${on ? '● Serveur en ligne' : '● Serveur injoignable'}</span>${G.App.state === 'match' ? '<span class="dh-pill">En partie</span>' : ''}</div></div>
      <div class="dh-sec">Espaces</div><div class="dh-tiles">${W.filter((w) => w.k !== 'home').map((w) => `<button class="dh-tile" data-ws="${w.k}" style="--ac:${w.c}"><i>${IC[w.ic]}</i><b>${esc(w.n)}${locked(w.role) ? ' ' + IC.lock : ''}</b><small>${esc(w.s)}</small><span>${w.pages.length} outils</span></button>`).join('')}</div>
      <div class="dh-sec">Favoris</div>${favs.length ? `<div class="dh-favs">${favs.map((p) => { const w = W.find((x) => x.k === p.ws); return `<button class="dh-fav" data-go="${p.id}" style="--ac:${w.c}">${IC[w.ic]}<b>${esc(p.t)}</b><small>${esc(w.n)}</small></button>`; }).join('')}</div>` : '<div class="dh-note">Touchez ☆ en haut d\'une page pour l\'épingler ici.</div>'}`;
  }
  function actsView() {
    const inM = G.App.state === 'match' && G.App.M && !G.App.M.net;
    return (inM ? '' : '<div class="dh-note">Lancez une partie hors ligne (Bac à sable → Lancer) pour utiliser ces actions.</div>') + `<div class="dh-actions">${[['heal', 'Soigner'], ['superNow', 'Super prête'], ['maxhp', '+5000 PV max'], ['killAll', 'Éliminer les ennemis'], ['center', 'Aller au centre'], ['skipTime', '−30 s'], ['botFriend', '+ Bot allié'], ['botFoe', '+ Bot ennemi'], ['cubes', '+5 cubes'], ['win', 'Gagner'], ['lose', 'Perdre']].map(([a, l]) => `<button class="btn small" data-a="${a}" ${inM ? '' : 'disabled'}>${l}</button>`).join('')}</div>`;
  }
  function modsView() {
    const mods = (G.Dev && G.Dev.BUILTIN) || [];
    return mods.map((m) => `<div class="dh-row"><div class="dh-rt"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small><span class="dh-bs">${badge('off')}</span></div><button class="dh-sw ${(G.Dev.cfg.mods || {})[m.id] ? 'on' : ''}" data-mod="${m.id}"><i></i></button></div>`).join('') + `<div class="dh-actions"><button class="btn small" data-a="legacy">Éditeur de mods JavaScript</button></div>`;
  }
  function slotsView() {
    const cur = LS.get('br_dev_prof', 1), all = LS.get('br_dev_profiles', {});
    return `<div class="dh-sub">Jeux de réglages rapides</div><div class="dh-seg">${[1, 2, 3].map((n) => `<button class="${cur === n ? 'on' : ''}" data-slot="${n}">Réglages ${n}${all[n] ? '' : ' (vide)'}</button>`).join('')}</div><div class="dh-note">Changer d'emplacement enregistre l'actuel puis charge le suivant.</div>`;
  }
  function setSlot(n) {
    const all = LS.get('br_dev_profiles', {}), cur = LS.get('br_dev_prof', 1), cfg = G.Dev.cfg;
    all[cur] = JSON.parse(JSON.stringify(cfg));
    if (all[n]) { const keep = cfg.custom; Object.keys(cfg).forEach((k) => delete cfg[k]); Object.assign(cfg, JSON.parse(JSON.stringify(all[n])), { custom: keep }); }
    LS.set('br_dev_profiles', all); LS.set('br_dev_prof', n); G.Dev.persist && G.Dev.persist(); G.UI.toast('Réglages ' + n + (all[n] ? ' chargés' : ' créés'), 1600);
  }
  function viewHtml(p) {
    if (locked(p.role)) return `<div class="dh-locked">${IC.lock}<b>Accès réservé</b><p>Cette page demande le droit « ${{ observe: 'observer', admin: 'administrer', dev: 'développer' }[p.role]} ». Il est vérifié par le serveur : se connecter avec le compte développeur.</p></div>`;
    const v = p.view;
    if (typeof v === 'function') return v();
    if (v.startsWith('console:')) return G.DevConsole ? G.DevConsole.render(v.slice(8)) : '';
    if (v.startsWith('item:')) return itemHtml(v.slice(5));
    if (v.startsWith('items:')) return v.slice(6).split(',').map((id) => { const it = DP._I.find((x) => x.id === id); return it ? `<div class="dh-card"><div class="dh-ct">${esc(it.title)}</div>${itemHtml(id)}</div>` : ''; }).join('');
    return '';
  }

  /* ---------- état ---------- */
  const U = { ws: 'home', page: 'home', q: '', detail: null };
  const pageOf = (id) => PAGES.find((p) => p.id === id);
  function go(id) {
    const p = pageOf(id); if (!p) return; U.ws = p.ws; U.page = p.id; U.q = '';
    const v = typeof p.view === 'string' && p.view.startsWith('console:') ? p.view.slice(8) : null;
    U.detail = v; // compatibilité devconsole : actualisation en direct des vues serveur
    if (v && G.DevConsole && !locked(p.role)) { if (v === 'players') G.DevConsole.view.pid = null; G.DevConsole.open(v); }
    render(); const b = DP.panel && DP.panel.querySelector('#rgBody'); if (b) b.scrollTop = 0;
  }

  /* ---------- rendu ---------- */
  function render() {
    const o = DP.panel; if (!o) return;
    const w = W.find((x) => x.k === U.ws), p = pageOf(U.page) || w.pages[0];
    o.style.setProperty('--ac', w.c);
    o.querySelectorAll('.dh-ws').forEach((b) => b.classList.toggle('on', b.dataset.ws === U.ws));
    const net = o.querySelector('#dhNet'); if (net) { const on = Net.status === 'online'; net.className = 'dh-net ' + (on ? 'ok' : 'ko'); net.textContent = on ? 'En ligne · ' + (Net.ping || '?') + ' ms' : 'Hors ligne'; }
    const head = o.querySelector('#dhHead'), tabs = o.querySelector('#dhTabs'), body = o.querySelector('#rgBody');
    if (U.q) {
      const q = U.q.toLowerCase(), hits = PAGES.filter((x) => (x.t + ' ' + x.d + ' ' + W.find((y) => y.k === x.ws).n).toLowerCase().includes(q));
      const tg = CHEATS.filter(([, t, d]) => (t + ' ' + d).toLowerCase().includes(q));
      head.innerHTML = `<div class="dh-ht"><span class="dh-ic">${IC.search}</span><div><h1>Recherche</h1><p>${hits.length + tg.length} résultat(s) pour « ${esc(U.q)} »</p></div></div>`; tabs.innerHTML = '';
      body.innerHTML = hits.map((x) => { const ww = W.find((y) => y.k === x.ws); return `<button class="dh-res" data-go="${x.id}" style="--ac:${ww.c}"><i>${IC[ww.ic]}</i><div><b>${esc(x.t)}</b><small>${esc(ww.n)} — ${esc(x.d)}</small></div>${IC.chev}</button>`; }).join('') +
        (tg.length ? `<div class="dh-sec">Triches (bac à sable et labo)</div>` + toggles(tg, ['off'])() : '') || '<div class="dh-note">Aucun résultat.</div>';
      return;
    }
    const fav = DP.fav.includes(p.id);
    head.innerHTML = `<div class="dh-ht"><span class="dh-ic">${IC[w.ic]}</span><div><h1>${esc(p.t)}</h1><p>${esc(w.n)} · ${esc(p.d)}</p></div>${p.id !== 'home' ? `<button class="dh-star ${fav ? 'on' : ''}" data-fav2="${p.id}" aria-label="Épingler">${IC.star}</button>` : ''}</div>`;
    tabs.innerHTML = w.pages.length > 1 ? w.pages.map((x) => `<button class="dh-tab ${x.id === p.id ? 'on' : ''}" data-go="${x.id}">${esc(x.t)}${locked(x.role) ? IC.lock : ''}</button>`).join('') : '';
    if (w.k === 'lab' || p.id === 'scheats') tabs.insertAdjacentHTML('beforeend', `<span class="dh-scope">${w.k === 'lab' ? badge('lab') + badge('blocked') : badge('off')}</span>`);
    body.innerHTML = `<div class="dh-page" data-page="${p.id}">${viewHtml(p)}</div>`;
    if (DP._meDraw) DP._meDraw(); const con = body.querySelector('#dpCon'); if (con) con.scrollTop = 1e9; // carte de l'éditeur, console
  }

  /* ---------- interactions ---------- */
  function onClick(e) {
    const t = e.target.closest('[data-ws],[data-go],[data-tg],[data-fav2],[data-x],[data-slot],[data-close],[data-mod]');
    if (!t) return false; const d = t.dataset; G.Audio.unlock && G.Audio.unlock();
    if (d.close !== undefined) { G.Audio.sfx('back'); DP.close(); return true; }
    if (d.ws) { G.Audio.sfx('ui'); const w = W.find((x) => x.k === d.ws); go(w.pages[0].id); return true; }
    if (d.go) { G.Audio.sfx('ui'); go(d.go); return true; }
    if (d.tg) { const cfg = G.Dev.cfg; cfg[d.tg] = !cfg[d.tg]; G.Dev.persist && G.Dev.persist(); G.Audio.sfx(cfg[d.tg] ? 'pickup' : 'back'); if (roles().includes('dev')) Net.send({ t: 'dv_cheats', cheats: cfg }); render(); return true; }
    if (d.mod) { const cfg = G.Dev.cfg; cfg.mods = cfg.mods || {}; cfg.mods[d.mod] = !cfg.mods[d.mod]; G.Dev.persist && G.Dev.persist(); G.Audio.sfx('ui'); render(); return true; }
    if (d.fav2) { const i = DP.fav.indexOf(d.fav2); if (i >= 0) DP.fav.splice(i, 1); else DP.fav.push(d.fav2); LS.set('br_dev_fav', DP.fav); G.Audio.sfx('ui'); render(); return true; }
    if (d.slot) { setSlot(+d.slot); render(); return true; }
    if (d.x === 'ctrl') { DP.close(); G.UI.ACT.ctrlEdit && G.UI.ACT.ctrlEdit(); return true; }
    if (d.x === 'joy') { DP.close(); G.UI.ACT.settings(); return true; }
    return false;
  }
  function open(where) {
    if (DP.panel) { DP.close(); return; }
    DP._hookNet(); DP._hookDev();
    const inM = G.App.state === 'match' && G.App.M;
    DP.wasPaused = G.App.paused;
    if (inM && !G.App.M.net && DP.pause) { G.App.paused = true; G.Input.reset(); }
    const o = document.createElement('div'); o.className = 'dh-ov' + (inM ? ' inmatch' : '');
    o.innerHTML = `<div class="dh"><aside class="dh-rail"><div class="dh-brand"><span>BR</span><div><b>Dev Hub</b><small>Brawl Rush ${esc(G.VERSION_NAME || '4.0')}</small></div></div>
        <nav>${W.map((w) => `<button class="dh-ws" data-ws="${w.k}" style="--wc:${w.c}"><i>${IC[w.ic]}</i><span><b>${esc(w.n)}</b><small>${esc(w.s)}</small></span>${locked(w.role) ? '<em>' + IC.lock + '</em>' : ''}</button>`).join('')}</nav>
        <div class="dh-net" id="dhNet"></div></aside>
      <section class="dh-main"><header class="dh-top"><div class="dh-search">${IC.search}<input id="dhQ" placeholder="Rechercher un outil, une page…" autocomplete="off"></div><button class="dh-x" data-close="1" aria-label="Fermer">${IC.x}</button></header>
        <div class="dh-head" id="dhHead"></div><div class="dh-tabs" id="dhTabs"></div><div class="dh-body" id="rgBody"></div></section></div>`;
    document.getElementById('ui').appendChild(o); DP._setPanel(o);
    o.addEventListener('click', (e) => { if (!onClick(e)) DP._click(e); });
    o.addEventListener('input', (e) => { if (e.target.id === 'dhQ') { U.q = e.target.value.trim(); render(); return; } DP._input(e); });
    o.addEventListener('change', () => G.Dev.persist && G.Dev.persist());
    o.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'dpIn') DP._runCon(); if (e.key === 'Escape') DP.close(); });
    o.addEventListener('pointerdown', (e) => { const cv = e.target.closest('#meCv'); if (!cv) return; if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId); cv._down = true; DP._mePaint({ currentTarget: cv, clientX: e.clientX, clientY: e.clientY, first: true }); });
    o.addEventListener('pointermove', (e) => { const cv = e.target.closest('#meCv'); if (cv && cv._down) DP._mePaint({ currentTarget: cv, clientX: e.clientX, clientY: e.clientY }); });
    o.addEventListener('pointerup', () => { const cv = o.querySelector('#meCv'); if (cv && cv._down) { cv._down = false; DP._meUp(); DP._render(); } });
    if (G.Account && G.Account.loggedIn && G.Account.loggedIn()) Net.send({ t: 'dv_state' });
    go(typeof where === 'string' && pageOf(where) ? where : U.page || 'home');
    DP._live(() => { if (!DP.panel) return; const k = DP.panel.querySelector('#dpKpis'); if (k) { const it = DP._I.find((x) => x.id === 'diag_live'), tmp = document.createElement('div'); tmp.innerHTML = it.html(); const nk = tmp.querySelector('#dpKpis'); if (nk) k.innerHTML = nk.innerHTML; } const n = DP.panel.querySelector('#dhNet'); if (n) { const on = Net.status === 'online'; n.className = 'dh-net ' + (on ? 'ok' : 'ko'); n.textContent = on ? 'En ligne · ' + (Net.ping || '?') + ' ms' : 'Hors ligne'; } });
  }
  DP.renderHook = render; DP.open = open; DP.ui = U; DP.go = go; DP.pages = () => PAGES;
  Net.on('me', () => { if (DP.panel) render(); });

  /* ---------- en partie : « Accès rapide » + FPS ---------- */
  function quick() {
    let q = document.getElementById('rgQuick');
    if (!q) {
      q = document.createElement('div'); q.id = 'rgQuick';
      q.innerHTML = `<button class="rg-qa" aria-label="Accès rapide">${IC.bolt}<span>Accès rapide</span></button><span class="rg-fps">— FPS</span>`;
      document.getElementById('app').appendChild(q);
      q.querySelector('.rg-qa').addEventListener('click', () => { if (G.Dev) open(G.App.M && G.App.M.net ? (G.App.M.lab ? 'lab' : 'diag') : 'acts'); });
    }
    return q;
  }
  setInterval(() => {
    if (!G.Dev || !G.DevReady) return;
    const q = quick(), on = G.App.state === 'match' && !!G.App.M; q.hidden = !on;
    if (on) q.querySelector('.rg-fps').textContent = Math.round(G.Dev.fps || 0) + ' FPS';
  }, 500);
})();
