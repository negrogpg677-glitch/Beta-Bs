/* Brawl Rush - MENU DÉVELOPPEUR PROFESSIONNEL
   Accueil, recherche, catégories, favoris, niveaux (débutant / avancé / expert), utilisable en partie.
   A. Modes de test · B. Éditeur de personnages · C. Éditeur de cartes · D. Diagnostics · E. Outils multijoueur
   F. Comptes de test · G. Avancé · H. Interface.
   Sécurité : ce menu n'apparaît que pour un compte développeur reconnu par le serveur (ou l'édition DEV) ; toutes les actions
   en ligne (dv_*) sont revérifiées par le serveur. Les triches de combat ne touchent que les parties hors ligne ; les profils de
   test sont locaux et ne sont jamais envoyés dans le cloud. */
(function () {
  const G = window.G, Net = G.Net;
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DP = (G.DevPro = { cat: 'home', q: '', lvl: LS.get('br_dev_lvl', 2), fav: LS.get('br_dev_fav', ['launch', 'diag_live', 'god']), errs: [], net: { in: {}, out: {}, log: [], lost: 0, snaps: 0, lastN: 0, lastSnapAt: 0 }, srv: null, tests: LS.get('br_dev_tests', []), pause: LS.get('br_dev_pause', true) });

  /* ---------- capteurs : erreurs, trafic réseau, pertes de paquets ---------- */
  window.addEventListener('error', (e) => { DP.errs.push({ t: Date.now(), m: String(e.message || e), at: String(e.filename || '').split('/').pop() + ':' + (e.lineno || '') }); if (DP.errs.length > 80) DP.errs.shift(); });
  window.addEventListener('unhandledrejection', (e) => { DP.errs.push({ t: Date.now(), m: 'Promesse : ' + String((e.reason && e.reason.message) || e.reason), at: '' }); if (DP.errs.length > 80) DP.errs.shift(); });
  const QUIET = { snap: 1, input: 1, pong: 1, ping: 1 };
  function rec(dir, m) {
    if (!m || !m.t) return;
    const n = DP.net, k = n[dir][m.t] || (n[dir][m.t] = { n: 0, b: 0 }); k.n++;
    if (!QUIET[m.t]) { try { k.b += JSON.stringify(m).length; } catch (e) { /* ignore */ } n.log.push({ t: Date.now(), d: dir, ty: m.t, code: m.code || m.act || '' }); if (n.log.length > 150) n.log.shift(); }
    if (dir === 'in' && m.t === 'snap') { if (n.lastN && m.n > n.lastN + 2 && m.n - n.lastN < 400) n.lost += (m.n - n.lastN) / 2 - 1; n.lastN = m.n; n.snaps++; n.lastSnapAt = performance.now(); }
    if (dir === 'in' && m.t === 'match') n.lastN = 0;
  }
  let hooked = false;
  function hookNet() {
    if (hooked || !Net) return; hooked = true;
    const h = Net.handle; Net.handle = function (m) { rec('in', m); return h.apply(this, arguments); };
    const s = Net.send; Net.send = function (o) { rec('out', o); return s.apply(this, arguments); };
    Net.on('error', (m) => { if (DP.panel && (m.code === 'forbidden' || m.code === 'dev')) G.UI.toast(m.msg, 2600); });
    Net.on('dv_state', (m) => { DP.srv = m; if (DP.panel && (DP.cat === 'multi' || DP.cat === 'diag')) render(); });
  }

  /* ---------- éditeur de personnages : multiplicateurs appliqués aux parties hors ligne ---------- */
  const CE = () => (G.Dev.cfg.charEdit = G.Dev.cfg.charEdit || {});
  function hookDev() {
    const Dev = G.Dev; if (!Dev || Dev._pro) return; Dev._pro = true;
    const sm = Dev.speedMul, od = Dev.onDamage, oms = Dev.onMatchStart;
    Dev.speedMul = (M, b) => sm(M, b) * (((CE()[b.id] || {}).speed) || 1);
    Dev.onDamage = (M, t, a, s) => { let v = od(M, t, a, s); const e = s && CE()[s.id]; if (e && e.dmg) v *= e.dmg; return v; };
    Dev.onMatchStart = (M) => {
      oms(M);
      for (const b of M.ents) {
        const e = CE()[b.id]; if (!e) continue;
        if (e.hp && e.hp !== 1) { b.maxhp = Math.round(b.maxhp * e.hp); b.hp = b.maxhp; }
        if ((e.range && e.range !== 1) || (e.reload && e.reload !== 1)) { // copie du profil : les autres parties ne sont pas touchées
          const d = b.def; b.def = Object.assign({}, d, { atk: Object.assign({}, d.atk, { range: d.atk.range * (e.range || 1), reload: d.atk.reload * (e.reload || 1) }) });
        }
      }
    };
  }

  /* ---------- éditeur de cartes : tuiles peintes par-dessus une carte de base ---------- */
  const baseGen = G.genMap;
  G.genMap = function (def, seed) {
    const mp = baseGen.apply(this, arguments);
    if (mp && def && def.override && def.override.length === mp.tiles.length) for (let i = 0; i < mp.tiles.length; i++) { const t = def.override[i]; mp.tiles[i] = t; mp.hp[i] = t === 2 ? 2400 : t === 6 ? 3600 : 0; }
    return mp;
  };
  const ME = { base: null, tiles: null, w: 0, h: 0, tool: 1, lock: null, saved: LS.get('br_dev_maps2', {}) };
  const TCOL = { 0: '#86c96a', 1: '#6b4f36', 2: '#c98a4a', 3: '#2f8f3a', 4: '#3a8ad6', 5: '#ffd21f', 6: '#d9a24a' };
  function meLoad(key) {
    const def = G.MAPS[key]; if (!def) return; const mp = baseGen(def);
    ME.base = key; ME.w = mp.w; ME.h = mp.h; ME.tiles = Array.from((ME.saved[key] && ME.saved[key].length === mp.tiles.length) ? ME.saved[key] : mp.tiles);
    ME.lock = new Uint8Array(mp.w * mp.h);
    for (let y = 0; y < mp.h; y++) for (let x = 0; x < mp.w; x++) { const i = y * mp.w + x; if (x === 0 || y === 0 || x === mp.w - 1 || y === mp.h - 1 || mp.tiles[i] === 5) ME.lock[i] = 1; }
    const sp = Array.isArray(mp.spawns[0]) ? [].concat(mp.spawns[0], mp.spawns[1] || []) : mp.spawns;
    for (const p of sp) { if (!p || p.x === undefined) continue; const cx = Math.floor(p.x / G.T), cy = Math.floor(p.y / G.T); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < mp.w && y < mp.h) ME.lock[y * mp.w + x] = 1; } }
  }
  function meDraw() {
    const cv = DP.panel && DP.panel.querySelector('#meCv'); if (!cv || !ME.tiles) return;
    const s = Math.max(4, Math.floor(Math.min(720 / ME.w, 520 / ME.h))); cv.width = ME.w * s; cv.height = ME.h * s; const c = cv.getContext('2d');
    for (let y = 0; y < ME.h; y++) for (let x = 0; x < ME.w; x++) { const i = y * ME.w + x; c.fillStyle = TCOL[ME.tiles[i]] || '#86c96a'; c.fillRect(x * s, y * s, s, s); if (ME.lock[i]) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x * s, y * s, s, s); } }
    c.strokeStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x <= ME.w; x++) { c.beginPath(); c.moveTo(x * s, 0); c.lineTo(x * s, ME.h * s); c.stroke(); }
    cv._s = s;
  }
  function mePaint(e) {
    const cv = e.currentTarget, r = cv.getBoundingClientRect(), s = cv._s || 8;
    const x = Math.floor(((e.clientX - r.left) / r.width) * cv.width / s), y = Math.floor(((e.clientY - r.top) / r.height) * cv.height / s);
    if (x < 0 || y < 0 || x >= ME.w || y >= ME.h) return; const i = y * ME.w + x; if (ME.lock[i]) return;
    const j = ME.h > ME.w ? (ME.h - 1 - y) * ME.w + x : y * ME.w + (ME.w - 1 - x); // symétrie miroir (haut/bas en vue verticale) : la carte reste équitable
    ME.tiles[i] = ME.tool; if (DP.mirror && !ME.lock[j]) ME.tiles[j] = ME.tool; meDraw();
  }

  /* ---------- comptes de test (profils locaux, jamais envoyés dans le cloud) ---------- */
  const TP = { list: () => LS.get('br_test_profiles', []), save: (l) => LS.set('br_test_profiles', l), active: () => LS.get('br_test_active', null) };
  function tpGuardCloud() { // tant qu'un profil de test est actif, la synchronisation du compte réel est coupée
    const A = G.Account; if (!A || A._tpGuard) return; A._tpGuard = true;
    const push = A.push; A.push = function () { if (TP.active()) return Promise.resolve(); return push.apply(this, arguments); };
    const sch = A.schedule; A.schedule = function () { if (TP.active()) return; return sch.apply(this, arguments); };
  }
  function tpBanner() {
    let b = document.getElementById('tpBanner'); const a = TP.active();
    if (!a) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'tpBanner'; document.getElementById('app').appendChild(b); }
    b.textContent = '🧪 PROFIL DE TEST : ' + a + ' — rien n\'est envoyé dans le cloud';
  }
  function tpSwitch(name) {
    const l = TP.list(), cur = TP.active();
    if (cur) { const it = l.find((x) => x.name === cur); if (it) it.save = JSON.parse(JSON.stringify(G.Save.data)); } // garde la progression du profil de test
    else LS.set('br_real_save', G.Save.data); // sauvegarde réelle mise de côté
    TP.save(l);
    let data;
    if (name) { const it = l.find((x) => x.name === name); if (!it) return; data = it.save; LS.set('br_test_active', name); }
    else { data = LS.get('br_real_save', null); LS.set('br_test_active', null); }
    if (!data) return;
    data = JSON.parse(JSON.stringify(data)); const def = G.Save.defaults(); // profil complet (valeurs par défaut pour les champs manquants)
    for (const k in def) if (data[k] === undefined) data[k] = def[k];
    for (const k of ['settings', 'stats']) for (const j in def[k]) if (data[k][j] === undefined) data[k][j] = def[k][j];
    Object.keys(G.Save.data).forEach((k) => delete G.Save.data[k]); Object.assign(G.Save.data, data); G.Save.commit();
    tpBanner(); G.UI.refreshCur && G.UI.refreshCur(); if (G.UI.screen === 'home') G.UI.build.home();
    G.UI.toast(name ? '🧪 Profil de test « ' + name + ' » actif' : 'Retour à votre vrai profil', 2400);
  }

  /* ---------- tests automatiques (simulation sans affichage) ---------- */
  async function runAutoTests(onProgress) { // asynchrone : l'interface reste fluide pendant les tests
    const res = [], t0 = performance.now(), pause = () => new Promise((r) => setTimeout(r, 0));
    const step = async (name, fn) => { await pause(); const s = performance.now(); try { const d = fn(); res.push({ name, ok: true, d, ms: Math.round(performance.now() - s) }); } catch (e) { res.push({ name, ok: false, d: e.message, ms: Math.round(performance.now() - s) }); } if (onProgress) onProgress(res.length); };
    for (const mode of G.MODE_ORDER) await step('Mode ' + G.MODES[mode].name, () => {
      const M = G.Sim.create({ mode, mapKey: G.MODES[mode].maps[0], brawlerId: G.Save.data.selected, skin: 'classic', level: 5, trophies: 300, name: 'Test', event: 'none' });
      M.player.isPlayer = false; // l'IA joue aussi le joueur
      let n = 0; while (M.state !== 'end' && n < 20 * 200) { G.Sim.update(M, 1 / 20); n++; }
      if (M.state !== 'end') { G.Sim.finish(M, -1); return 'pas de fin en 200 s simulées (égalité forcée)'; }
      return 'terminé en ' + Math.round(M.t) + ' s simulées';
    });
    await step('Joystick (réglages)', () => { const c = G.Input.joyCfg ? G.Input.joyCfg() : null; if (!c || !(c.DZ < c.FULL)) throw new Error('réglages incohérents'); return 'zone morte ' + c.DZ.toFixed(2) + ', pleine vitesse ' + c.FULL.toFixed(2); });
    await step('Sauvegarde', () => { JSON.parse(JSON.stringify(G.Save.data)); return Object.keys(G.Save.data).length + ' champs'; });
    await step('Connexion serveur', () => { if (Net.status !== 'online') throw new Error('hors ligne (' + Net.status + ')'); return 'ping ' + Net.ping + ' ms'; });
    const run = { at: Date.now(), ms: Math.round(performance.now() - t0), ok: res.filter((r) => r.ok).length, n: res.length, res };
    DP.tests.unshift(run); DP.tests = DP.tests.slice(0, 10); LS.set('br_dev_tests', DP.tests);
    return run;
  }

  /* ---------- rapport ---------- */
  function report() {
    const M = G.App.M;
    return { at: new Date().toISOString(), version: (G.VERSION || ''), ua: navigator.userAgent, screen: innerWidth + 'x' + innerHeight + '@' + devicePixelRatio,
      fps: Math.round(G.Dev.fps || 0), net: { status: Net.status, ping: Net.ping, lost: DP.net.lost, snaps: DP.net.snaps, in: DP.net.in, out: DP.net.out },
      match: M ? { mode: M.mode, net: !!M.net, t: Math.round(M.t || 0), ents: (M.ents || []).length } : null, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' Mo' : 'n/d',
      errors: DP.errs.slice(-30), server: DP.srv, tests: DP.tests[0] || null, cfg: G.Dev.cfg, settings: G.Save.data.settings };
  }
  function exportReport() {
    const txt = JSON.stringify(report(), null, 2);
    try { navigator.clipboard.writeText(txt); } catch (e) { /* ignore */ }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'brawlrush-rapport-' + Date.now() + '.json'; a.click(); } catch (e) { /* ignore */ }
    G.UI.toast('Rapport copié (et téléchargé si possible)', 2400);
  }

  /* ---------- éléments du menu ---------- */
  const tg = (k, label) => `<div class="dp-row"><span>${label}</span><div class="toggle ${G.Dev.cfg[k] ? 'on' : ''}" data-d="${k}"></div></div>`;
  const sl = (k, label, min, max, step, obj) => { const v = obj ? obj[k] : G.Dev.cfg[k]; return `<div class="dp-row"><span>${label} <b class="dp-v">${v}</b></span><input type="range" data-r="${k}" ${obj ? 'data-o="1"' : ''} min="${min}" max="${max}" step="${step}" value="${v}"></div>`; };
  const bt = (a, label, cls) => `<button class="btn small ${cls || ''}" data-a="${a}">${label}</button>`;
  const sv = (a, label, cls) => `<button class="btn small ${cls || ''}" data-s="${a}">${label}</button>`;
  const CATS = [
    ['modes', 'A', '🎮', 'Modes de test'], ['chars', 'B', '🧍', 'Éditeur de personnages'], ['maps', 'C', '🗺', 'Éditeur de cartes'], ['diag', 'D', '📊', 'Diagnostics'],
    ['multi', 'E', '🌐', 'Outils multijoueur'], ['accounts', 'F', '👤', 'Comptes de test'], ['adv', 'G', '⚙', 'Avancé'], ['ui', 'H', '🧭', 'Interface'],
  ];
  // chaque élément : id, catégorie, niveau (1 débutant, 2 avancé, 3 expert), titre (pour la recherche), contenu
  const I = [];
  const add = (id, cat, lvl, title, html) => I.push({ id, cat, lvl, title, html });
  add('launch', 'modes', 1, 'Lancer un mode hors ligne (toutes les cartes)', () => { const mode = DP.mode || G.Save.data.mode || 'gemgrab';
    return `<div class="dp-chips">${G.MODE_ORDER.map((m) => `<button class="btn small ${mode === m ? 'green' : 'gray'}" data-m="${m}">${esc(G.MODES[m].short || G.MODES[m].name)}</button>`).join('')}</div>
      <div class="dp-chips">${G.MODES[mode].maps.map((k) => `<button class="btn small blue" data-map="${k}">${esc(G.MAPS[k].name)}</button>`).join('')}<button class="btn small" data-map="">Aléatoire</button></div>`; });
  add('training', 'modes', 1, 'Entraînement : ennemis passifs + invincible', () => `<div class="dp-chips">${bt('trainOn', '▶ Démarrer l\'entraînement', 'green')}${bt('trainOff', '■ Arrêter', 'gray')}</div>`);
  add('privtest', 'modes', 2, 'Partie privée en ligne avec joueurs de test', () => `<div class="dp-chips">${bt('privTest', '▶ Lancer (2 joueurs de test + bots)', 'green')}</div><div class="dp-note">Partie réelle sur le serveur, les joueurs de test sont joués par l'IA et ne sont enregistrés nulle part.</div>`);
  add('passive', 'modes', 1, 'Ennemis passifs', () => tg('passive', 'Ennemis passifs (ne tirent pas)'));
  add('timescale', 'modes', 2, 'Vitesse du jeu', () => sl('ts', 'Vitesse du jeu ×', 0.2, 3, 0.1));
  add('mods', 'modes', 2, 'Mods de partie (géants, minis…)', () => G.Dev.BUILTIN ? G.Dev.BUILTIN.map((m) => `<div class="dp-row"><span>${esc(m.name)}<small>${esc(m.desc)}</small></span><div class="toggle ${G.Dev.cfg.mods[m.id] ? 'on' : ''}" data-mod="${m.id}"></div></div>`).join('') : '');
  add('charedit', 'chars', 1, 'Éditeur de personnages (vie, vitesse, dégâts, portée, recharge)', () => {
    const id = DP.char || G.Save.data.selected, e = Object.assign({ hp: 1, speed: 1, dmg: 1, range: 1, reload: 1 }, CE()[id] || {}), d = G.BRAWLER[id];
    return `<div class="dp-chips dp-scroll">${G.BRAWLERS.filter((b) => b.id !== 'robot').map((b) => `<button class="btn small ${b.id === id ? 'green' : 'gray'}" data-ch="${b.id}">${esc(b.name)}</button>`).join('')}</div>
      <div class="dp-note">${esc(d.name)} — vie ${d.hp}, vitesse ${d.speed}, dégâts ${d.atk.dmg}×${d.atk.n || 1}, portée ${d.atk.range}, recharge ${d.atk.reload} s. Les réglages s'appliquent aux parties hors ligne.</div>
      ${['hp', 'speed', 'dmg', 'range', 'reload'].map((k) => `<div class="dp-row"><span>${{ hp: 'Vie', speed: 'Vitesse', dmg: 'Dégâts', range: 'Portée', reload: 'Temps de recharge' }[k]} × <b class="dp-v">${e[k]}</b></span><input type="range" data-ce="${k}" min="0.25" max="4" step="0.05" value="${e[k]}"></div>`).join('')}
      <div class="dp-chips">${bt('ceReset', 'Réinitialiser ce brawler', 'gray')}${bt('ceTest', '▶ Tester en partie', 'green')}</div>`; });
  add('unlock', 'chars', 1, 'Débloquer / niveau max', () => `<div class="dp-chips">${bt('unlock', 'Tout débloquer', 'green')}${bt('lvl', 'Niveau max du brawler')}</div>`);
  add('mapedit', 'maps', 1, 'Éditeur de cartes (peindre murs, buissons, eau, caisses)', () => {
    if (!ME.tiles || !G.MAPS[ME.base]) meLoad(DP.mapBase || G.MODES[G.Save.data.mode || 'gemgrab'].maps[0]);
    return `<div class="dp-chips dp-scroll">${Object.keys(G.MAPS).filter((k) => G.MAPS[k].mode !== 'showdown').map((k) => `<button class="btn small ${k === ME.base ? 'green' : 'gray'}" data-mb="${k}">${esc(G.MAPS[k].name)}</button>`).join('')}</div>
      <div class="dp-chips">${[[0, 'Sol'], [1, 'Mur'], [3, 'Buisson'], [4, 'Eau'], [2, 'Caisse']].map(([t, n]) => `<button class="btn small dp-tile ${ME.tool === t ? 'on' : ''}" data-tool="${t}" style="--tc:${TCOL[t]}">${n}</button>`).join('')}<div class="dp-row dp-inl"><span>Symétrie</span><div class="toggle ${DP.mirror ? 'on' : ''}" data-mirror="1"></div></div></div>
      <canvas id="meCv" class="dp-map"></canvas>
      <div class="dp-chips">${bt('meSave', '💾 Enregistrer', 'blue')}${bt('mePlay', '▶ Jouer cette carte', 'green')}${bt('meReset', '↺ Carte d\'origine', 'gray')}</div><div class="dp-note">Les cases grisées (bords, apparitions, coffres) sont protégées.</div>`; });
  add('diag_live', 'diag', 1, 'Diagnostics en direct (FPS, ping, pertes, mémoire, erreurs, synchro)', () => {
    const M = G.App.M, n = DP.net, age = n.lastSnapAt ? Math.round(performance.now() - n.lastSnapAt) : null, lossPct = n.snaps ? (100 * n.lost / (n.snaps + n.lost)).toFixed(1) : '0.0';
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' Mo' : (DP.srv ? 'serveur ' + DP.srv.mem.heap + ' Mo' : 'n/d');
    const cell = (k, v, bad) => `<div class="dp-kpi ${bad ? 'bad' : ''}"><b>${v}</b><span>${k}</span></div>`;
    return `<div class="dp-kpis" id="dpKpis">${cell('FPS', Math.round(G.Dev.fps || 0), G.Dev.fps < 40)}${cell('Ping', Net.status === 'online' ? Net.ping + ' ms' : '—', Net.ping > 180)}${cell('Pertes', lossPct + ' %', +lossPct > 3)}${cell('Dernier instantané', age == null ? '—' : age + ' ms', age > 400 && M && M.net)}
      ${cell('Joueurs en ligne', DP.srv ? DP.srv.online : '?')}${cell('Mémoire', mem)}${cell('Erreurs', DP.errs.length, DP.errs.length > 0)}${cell('Synchro', Net.status)}${cell('Partie', M ? (M.net ? 'en ligne · ' : 'hors ligne · ') + (G.MODES[M.mode] || {}).short : '—')}</div>
      ${tg('fps', 'Afficher FPS / entités en jeu')}${tg('hit', 'Hitbox et murs')}${tg('ai', 'IA : cibles et chemins')}
      <div class="dp-chips">${bt('report', '📄 Exporter le rapport', 'blue')}${sv('state', '↻ État du serveur')}</div>`; });
  add('errors', 'diag', 2, 'Erreurs JavaScript', () => `<div class="dp-log">${DP.errs.length ? DP.errs.slice(-30).reverse().map((e) => `<div><i>${new Date(e.t).toLocaleTimeString()}</i> ${esc(e.m)} <small>${esc(e.at)}</small></div>`).join('') : 'Aucune erreur 👍'}</div>${bt('clearErr', 'Vider', 'gray')}`);
  add('srvstate', 'multi', 1, 'État du serveur (parties, équipes, mémoire, sessions)', () => { const s = DP.srv; if (!s) return `<div class="dp-note">Connectez-vous à votre compte développeur puis actualisez.</div>${sv('state', '↻ Actualiser', 'blue')}`;
    return `<div class="dp-kpis">${[['En ligne', s.online], ['Clients', s.players], ['Équipes', s.parties], ['Parties', s.matches.length], ['Uptime', Math.round(s.uptime / 60) + ' min'], ['Mémoire', s.mem.heap + ' Mo'], ['Sessions', (s.accounts && s.accounts.sessions) || '?'], ['Relais d\'appareil', (s.accounts && s.accounts.takeovers) || 0]].map(([k, v]) => `<div class="dp-kpi"><b>${esc(v)}</b><span>${k}</span></div>`).join('')}</div>
      <div class="dp-log">${s.matches.map((m) => `<div>${m.mine ? '⭐ ' : ''}${esc((G.MODES[m.mode] || {}).name || m.mode)} · ${m.state} · ${m.t} s · ${m.humans} humain(s)${m.ranked ? ' · classé' : ''}</div>`).join('') || 'Aucune partie en cours'}</div>${sv('state', '↻ Actualiser', 'blue')}`; });
  add('simgroup', 'multi', 1, 'Simuler joueurs, groupes, invitations, chef, demandes d\'ami', () => `<div class="dp-chips">${sv('join', '+ Joueur de test dans mon équipe', 'green')}${sv('invite', '📩 Invitation simulée')}${sv('leave', '− Un joueur part')}${sv('leader', '👑 Changer de chef')}${sv('friend_req', '👋 Demande d\'ami simulée')}${sv('clear', 'Supprimer les joueurs de test', 'gray')}</div>
    <div class="dp-note">${DP.srv && DP.srv.fakes ? DP.srv.fakes.length + ' joueur(s) de test actifs' : ''}</div>`);
  add('simnet', 'multi', 2, 'Simuler déconnexion, reconnexion, inactivité, reprise, fin de partie', () => `<div class="dp-chips">${sv('disconnect', '🔌 Me déconnecter (reconnexion auto)')}${sv('afk', '⏸ Me rendre inactif (AFK)')}${sv('win', '🏆 Gagner la partie', 'green')}${sv('lose', 'Perdre la partie', 'gray')}${sv('forfeit', 'Abandon (duel)', 'red')}${bt('lb', '🌍 Classement')}</div>`);
  add('livecfg', 'multi', 2, 'Paramètres en direct : délai d\'inactivité, fenêtre de reconnexion', () => { const c = (DP.srv && DP.srv.cfg) || { afkSec: 45, reconnectSec: 90 }; DP.lc = DP.lc || Object.assign({}, c);
    return `${sl('afkSec', 'Inactivité avant sortie (s)', 10, 300, 5, DP.lc)}${sl('reconnectSec', 'Fenêtre de reconnexion (s)', 15, 600, 5, DP.lc)}<div class="dp-chips">${bt('cfgApply', 'Appliquer sur le serveur', 'green')}</div><div class="dp-note">Actuel serveur : inactivité ${c.afkSec} s, reconnexion ${c.reconnectSec} s. Enregistré dans la base.</div>`; });
  add('testprof', 'accounts', 1, 'Profils de test (créer, basculer, supprimer, réinitialiser)', () => { const l = TP.list(), a = TP.active();
    return `<div class="dp-note">${a ? '🧪 Profil actif : <b>' + esc(a) + '</b>' : 'Profil réel actif'}. Les profils de test restent sur cet appareil et ne sont jamais envoyés dans le cloud.</div>
      <div class="dp-log">${l.map((p) => `<div class="dp-tp"><b>${esc(p.name)}</b> · ${G.Save.totalTrophies ? '' : ''}${(p.save && p.save.unlocked || []).length} brawlers <span>${a === p.name ? '<i>actif</i>' : `<button class="btn small blue" data-tp="${esc(p.name)}">Utiliser</button>`}<button class="btn small red" data-tpdel="${esc(p.name)}">✕</button></span></div>`).join('') || 'Aucun profil de test.'}</div>
      <div class="dp-chips">${bt('tpNew', '+ Nouveau (vierge)', 'green')}${bt('tpCopy', '+ Copie de mon profil')}${a ? bt('tpReal', '↩ Revenir à mon vrai profil', 'yellow') + bt('tpResetCur', 'Réinitialiser ce profil', 'red') : ''}</div>`; });
  add('teststats', 'accounts', 1, 'Modifier les statistiques (trophées, pièces, gemmes, progression, récompenses)', () => { const s = G.Save.data;
    return `${TP.active() ? '' : '<div class="dp-note">⚠ Vous modifiez votre VRAI profil. Utilisez un profil de test pour expérimenter.</div>'}
      <div class="dp-chips">${bt('coins', '+10 000 pièces')}${bt('gems', '+1 000 gemmes', 'blue')}${bt('boxes', '+5 coffres')}${bt('tr100', '+100 trophées')}${bt('tr1000', '+1000 trophées')}${bt('tr0', 'Trophées à 0', 'gray')}${bt('simProg', '+10 victoires simulées', 'green')}${bt('quests', 'Terminer les quêtes')}${bt('daily', 'Réarmer le cadeau')}</div>
      <div class="dp-note">${s.coins} pièces · ${s.gems} gemmes · ${G.Save.totalTrophies()} 🏆 · ${s.unlocked.length}/${G.BRAWLERS.length} brawlers · ${(s.stats && s.stats.matches) || 0} parties</div>`; });
  add('device', 'accounts', 2, 'Multi-appareils (identifiant d\'appareil)', () => { const A = G.Account; return `<div class="dp-note">Appareil : <code>${esc(A && A.deviceId ? A.deviceId() : '?')}</code>. Un compte ne peut être connecté que sur un appareil : se connecter ailleurs déconnecte celui-ci.</div><div class="dp-chips">${bt('newDevice', 'Simuler un nouvel appareil')}</div>`; });
  add('grant', 'accounts', 3, 'Autoriser un autre compte développeur (compte principal)', () => `<div class="dp-row"><input class="txt" id="dpGrant" placeholder="Identifiant (lettres)" autocapitalize="characters"><span class="dp-chips">${bt('grant', 'Autoriser', 'green')}${bt('revoke', 'Retirer', 'red')}</span></div><div class="dp-chips">${bt('gifts', '🎁 Offrir des brawlers à un joueur')}</div>`);
  add('console', 'adv', 3, 'Console JavaScript', () => `<div class="dp-log" id="dpCon">${esc((G.Dev.logs || []).join('\n'))}</div><div class="dp-row"><input class="txt" id="dpIn" placeholder="ex : P.hp = 99999" autocapitalize="none" autocomplete="off"><span class="dp-chips">${bt('run', 'Exécuter', 'green')}</span></div>`);
  add('traffic', 'adv', 2, 'Trafic réseau et événements internes', () => { const n = DP.net, row = (d) => Object.entries(n[d]).sort((a, b) => b[1].n - a[1].n).slice(0, 14).map(([k, v]) => `<div>${esc(k)} <b>${v.n}</b>${v.b ? ' · ' + Math.round(v.b / 1024) + ' ko' : ''}</div>`).join('');
    return `<div class="dp-2col"><div><h4>Reçus</h4><div class="dp-log">${row('in') || '—'}</div></div><div><h4>Envoyés</h4><div class="dp-log">${row('out') || '—'}</div></div></div><h4>Derniers événements</h4><div class="dp-log">${n.log.slice(-25).reverse().map((e) => `<div><i>${new Date(e.t).toLocaleTimeString()}</i> ${e.d === 'in' ? '⬇' : '⬆'} ${esc(e.ty)} ${esc(e.code)}</div>`).join('') || '—'}</div>`; });
  add('flags', 'adv', 2, 'Options de fonctionnalités (feature flags)', () => { const s = G.Save.data.settings; return [['chars3dMatch', 'Personnages 3D en combat'], ['aimAssist', 'Aide à la visée'], ['lefty', 'Mode gaucher'], ['vibrate', 'Vibrations'], ['showPing', 'Afficher le ping en jeu']].map(([k, l]) => `<div class="dp-row"><span>${l}</span><div class="toggle ${s[k] ? 'on' : ''}" data-flag="${k}"></div></div>`).join(''); });
  add('liveparams', 'adv', 2, 'Paramètres en direct (dégâts, vitesse, jeu)', () => sl('dmg', 'Dégâts ×', 0.25, 10, 0.25) + sl('speed', 'Vitesse du joueur ×', 0.5, 3, 0.1) + sl('ts', 'Vitesse du jeu ×', 0.2, 3, 0.1) + tg('god', 'Invincible') + tg('ammo', 'Munitions infinies') + tg('sup', 'Super toujours prêt') + tg('ohk', 'Un coup = élimination') + tg('aim', 'Aimbot') + tg('auto', 'Tir automatique'));
  add('configs', 'adv', 3, 'Configurations : enregistrer, restaurer, comparer', () => { const all = LS.get('br_dev_cfgs', {}), names = Object.keys(all);
    return `<div class="dp-row"><input class="txt" id="dpCfgName" placeholder="Nom de la configuration"><span class="dp-chips">${bt('cfgSave', '💾 Enregistrer', 'green')}</span></div>
      <div class="dp-log">${names.map((n) => `<div class="dp-tp"><b>${esc(n)}</b><span><button class="btn small blue" data-cfgload="${esc(n)}">Restaurer</button><button class="btn small" data-cfgcmp="${esc(n)}">Comparer</button><button class="btn small red" data-cfgdel="${esc(n)}">✕</button></span></div>`).join('') || 'Aucune configuration enregistrée.'}</div><div id="dpCmp" class="dp-note">${DP.cmp || ''}</div>`; });
  add('autotests', 'adv', 2, 'Tests automatiques et historique', () => `<div class="dp-chips">${bt('autoTest', '▶ Lancer les tests (tous les modes)', 'green')}</div>
    <div class="dp-log">${DP.tests.map((r, i) => `<div><b>${new Date(r.at).toLocaleString('fr-FR')}</b> — ${r.ok}/${r.n} réussis (${r.ms} ms)${i === 0 ? r.res.map((x) => `<div class="${x.ok ? 'ok' : 'ko'}">${x.ok ? '✔' : '✘'} ${esc(x.name)} : ${esc(x.d)}</div>`).join('') : ''}</div>`).join('') || 'Aucun test lancé.'}</div>`);
  add('export', 'adv', 1, 'Exporter un rapport complet', () => `<div class="dp-chips">${bt('report', '📄 Exporter le rapport (JSON)', 'blue')}${bt('legacy', 'Ancien panneau (mods perso, console)')}</div>`);
  add('uiprefs', 'ui', 1, 'Interface du menu (niveau, pause, favoris)', () => `<div class="dp-row"><span>Niveau d'affichage</span><div class="dp-seg">${[[1, 'Débutant'], [2, 'Avancé'], [3, 'Expert']].map(([v, l]) => `<button class="${DP.lvl === v ? 'on' : ''}" data-lvl="${v}">${l}</button>`).join('')}</div></div>
    <div class="dp-row"><span>Mettre en pause la partie hors ligne à l'ouverture</span><div class="toggle ${DP.pause ? 'on' : ''}" data-pause="1"></div></div>${bt('resetAll', 'Réinitialiser tous les réglages développeur', 'red')}`);

  /* ---------- rendu ---------- */
  function itemHtml(it) {
    let body = ''; try { body = it.html(); } catch (e) { body = '<div class="dp-note">Erreur : ' + esc(e.message) + '</div>'; }
    return `<div class="dp-item" data-id="${it.id}"><div class="dp-ih"><b>${esc(it.title)}</b><span class="dp-lv l${it.lvl}">${['', 'débutant', 'avancé', 'expert'][it.lvl]}</span><button class="dp-star ${DP.fav.includes(it.id) ? 'on' : ''}" data-fav="${it.id}" aria-label="Favori">★</button></div>${body}</div>`;
  }
  function render() {
    const p = DP.panel; if (!p) return;
    const body = p.querySelector('#dpBody'), q = DP.q.trim().toLowerCase();
    p.querySelectorAll('.dp-cat').forEach((b) => b.classList.toggle('on', b.dataset.cat === DP.cat));
    let h = '';
    if (q) { const hits = I.filter((it) => (it.title + ' ' + it.cat).toLowerCase().includes(q)); h = `<div class="dp-sec">🔎 ${hits.length} résultat(s)</div>` + hits.map(itemHtml).join(''); }
    else if (DP.cat === 'home') {
      h = `<div class="dp-tiles">${CATS.map(([k, L, e, n]) => `<button class="dp-tile2" data-cat="${k}"><i>${e}</i><b>${L}. ${n}</b><small>${I.filter((x) => x.cat === k && x.lvl <= DP.lvl).length} outils</small></button>`).join('')}</div>
        <div class="dp-sec">★ Favoris</div>${I.filter((it) => DP.fav.includes(it.id)).map(itemHtml).join('') || '<div class="dp-note">Touchez ★ sur un outil pour l\'épingler ici.</div>'}`;
    } else {
      const c = CATS.find((x) => x[0] === DP.cat), its = I.filter((it) => it.cat === DP.cat && it.lvl <= DP.lvl), hidden = I.filter((it) => it.cat === DP.cat && it.lvl > DP.lvl).length;
      h = `<div class="dp-sec">${c[2]} ${c[1]}. ${c[3]}</div>` + its.map(itemHtml).join('') + (hidden ? `<div class="dp-note">${hidden} outil(s) masqué(s) au niveau actuel — passez en « Expert » (catégorie H).</div>` : '');
    }
    body.innerHTML = h; meDraw();
    const con = body.querySelector('#dpCon'); if (con) con.scrollTop = 1e9;
  }
  let liveT = 0;
  function open() {
    if (DP.panel) { close(); return; }
    hookNet(); hookDev();
    const inM = G.App.state === 'match' && G.App.M;
    DP.wasPaused = G.App.paused;
    if (inM && !G.App.M.net && DP.pause) { G.App.paused = true; G.Input.reset(); }
    const o = document.createElement('div'); o.className = 'dp-ov' + (inM ? ' inmatch' : '');
    o.innerHTML = `<div class="dp"><div class="dp-top"><b>🛠 Développeur</b><input class="dp-q" id="dpQ" placeholder="Rechercher un outil…" value="${esc(DP.q)}" autocomplete="off"><div class="dp-seg dp-lvls">${[[1, 'Déb.'], [2, 'Avancé'], [3, 'Expert']].map(([v, l]) => `<button class="${DP.lvl === v ? 'on' : ''}" data-lvl="${v}">${l}</button>`).join('')}</div><button class="dp-x" data-a="close">✕</button></div>
      <div class="dp-main"><nav class="dp-nav"><button class="dp-cat" data-cat="home">🏠 Accueil</button>${CATS.map(([k, L, e, n]) => `<button class="dp-cat" data-cat="${k}">${e} ${L}. ${n}</button>`).join('')}</nav><div class="dp-body" id="dpBody"></div></div></div>`;
    document.getElementById('ui').appendChild(o); DP.panel = o;
    o.addEventListener('click', onClick);
    o.addEventListener('input', onInput);
    o.addEventListener('change', () => G.Dev.persist && G.Dev.persist());
    o.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'dpIn') runCon(); });
    const q = o.querySelector('#dpQ'); q.addEventListener('input', () => { DP.q = q.value; render(); });
    o.addEventListener('pointerdown', (e) => { const cv = e.target.closest('#meCv'); if (!cv) return; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); cv._down = true; mePaint({ currentTarget: cv, clientX: e.clientX, clientY: e.clientY }); });
    o.addEventListener('pointermove', (e) => { const cv = e.target.closest('#meCv'); if (cv && cv._down) mePaint({ currentTarget: cv, clientX: e.clientX, clientY: e.clientY }); });
    o.addEventListener('pointerup', (e) => { const cv = o.querySelector('#meCv'); if (cv) cv._down = false; });
    if (G.Account && G.Account.loggedIn && G.Account.loggedIn()) Net.send({ t: 'dv_state' });
    render();
    clearInterval(liveT); liveT = setInterval(() => { if (!DP.panel) return clearInterval(liveT); const k = DP.panel.querySelector('#dpKpis'); if (k && !DP.q) { const it = I.find((x) => x.id === 'diag_live'); const tmp = document.createElement('div'); tmp.innerHTML = it.html(); const nk = tmp.querySelector('#dpKpis'); if (nk) k.innerHTML = nk.innerHTML; } }, 700);
  }
  function close() { if (!DP.panel) return; DP.panel.remove(); DP.panel = null; clearInterval(liveT); if (G.App.state === 'match' && G.App.M && !G.App.M.net) G.App.paused = DP.wasPaused; }
  function runCon() {
    const i = DP.panel.querySelector('#dpIn'), code = (i.value || '').trim(); if (!code) return; const log = (s) => G.Dev.log ? G.Dev.log(s) : null;
    log('> ' + code);
    try { const M = G.App.M, P = M && M.player; const r = new Function('G', 'M', 'P', 'return (' + code + ')')(G, M, P); log(r === undefined ? 'ok' : typeof r === 'object' ? JSON.stringify(r, (k, v) => (k === 'def' || k === 'ai' || k === 'map' ? undefined : v)).slice(0, 600) : String(r)); }
    catch (e1) { try { const M = G.App.M, P = M && M.player; const r = new Function('G', 'M', 'P', code)(G, M, P); log(r === undefined ? 'ok' : String(r)); } catch (e2) { log('Erreur : ' + e2.message); } }
    i.value = ''; render();
  }
  const save = () => { G.Dev.persist && G.Dev.persist(); };
  function onInput(e) {
    const t = e.target, d = t.dataset;
    if (d.r) { const v = +t.value; if (d.o) DP.lc[d.r] = v; else { G.Dev.cfg[d.r] = v; save(); } const b = t.parentNode.querySelector('.dp-v'); if (b) b.textContent = v; }
    if (d.ce) { const id = DP.char || G.Save.data.selected, e2 = (CE()[id] = Object.assign({ hp: 1, speed: 1, dmg: 1, range: 1, reload: 1 }, CE()[id] || {})); e2[d.ce] = +t.value; save(); const b = t.parentNode.querySelector('.dp-v'); if (b) b.textContent = t.value; }
  }
  function onClick(e) {
    const t = e.target.closest('[data-a],[data-s],[data-cat],[data-d],[data-m],[data-map],[data-mod],[data-fav],[data-lvl],[data-ch],[data-mb],[data-tool],[data-mirror],[data-tp],[data-tpdel],[data-flag],[data-pause],[data-cfgload],[data-cfgcmp],[data-cfgdel]'); if (!t) return;
    G.Audio.unlock && G.Audio.unlock(); G.Audio.sfx('ui');
    const d = t.dataset, Dev = G.Dev, cfg = Dev.cfg, act = Dev.act || {};
    if (d.cat) { DP.cat = d.cat; DP.q = ''; const q = DP.panel.querySelector('#dpQ'); if (q) q.value = ''; }
    else if (d.d) { cfg[d.d] = !cfg[d.d]; save(); }
    else if (d.m) DP.mode = d.m;
    else if (d.map !== undefined) { close(); Dev.startMatch(DP.mode || G.Save.data.mode || 'gemgrab', d.map); return; }
    else if (d.mod) { cfg.mods[d.mod] = !cfg.mods[d.mod]; save(); }
    else if (d.fav) { const i = DP.fav.indexOf(d.fav); if (i >= 0) DP.fav.splice(i, 1); else DP.fav.push(d.fav); LS.set('br_dev_fav', DP.fav); }
    else if (d.lvl) { DP.lvl = +d.lvl; LS.set('br_dev_lvl', DP.lvl); DP.panel.querySelectorAll('[data-lvl]').forEach((b) => b.classList.toggle('on', +b.dataset.lvl === DP.lvl)); }
    else if (d.ch) DP.char = d.ch;
    else if (d.mb) { DP.mapBase = d.mb; meLoad(d.mb); }
    else if (d.tool !== undefined) ME.tool = +d.tool;
    else if (d.mirror) DP.mirror = !DP.mirror;
    else if (d.tp) tpSwitch(d.tp);
    else if (d.tpdel) { if (TP.active() === d.tpdel) tpSwitch(null); TP.save(TP.list().filter((x) => x.name !== d.tpdel)); }
    else if (d.flag) { const s = G.Save.data.settings; s[d.flag] = !s[d.flag]; G.Save.commit(); }
    else if (d.pause) { DP.pause = !DP.pause; LS.set('br_dev_pause', DP.pause); }
    else if (d.cfgload) { const c = LS.get('br_dev_cfgs', {})[d.cfgload]; if (c) { Object.assign(cfg, JSON.parse(JSON.stringify(c))); save(); G.UI.toast('Configuration « ' + d.cfgload + ' » restaurée'); } }
    else if (d.cfgcmp) { const c = LS.get('br_dev_cfgs', {})[d.cfgcmp] || {}, diffs = []; for (const k of new Set(Object.keys(c).concat(Object.keys(cfg)))) { const a = JSON.stringify(cfg[k]), b = JSON.stringify(c[k]); if (a !== b) diffs.push(k + ' : ' + esc(b) + ' → ' + esc(a)); } DP.cmp = diffs.length ? 'Différences avec « ' + esc(d.cfgcmp) + ' » :<br>' + diffs.join('<br>') : 'Identique à « ' + esc(d.cfgcmp) + ' ».'; }
    else if (d.cfgdel) { const all = LS.get('br_dev_cfgs', {}); delete all[d.cfgdel]; LS.set('br_dev_cfgs', all); }
    else if (d.s) { // actions serveur : le serveur vérifie le compte développeur
      if (d.s === 'state') Net.send({ t: 'dv_state' });
      else Net.send({ t: 'dv_sim', act: d.s, mode: G.Save.data.mode });
    } else if (d.a) {
      const a = d.a, M = G.App.M;
      if (a === 'close') { close(); return; }
      if (a === 'trainOn') { cfg.passive = true; cfg.god = true; save(); close(); Dev.startMatch(G.Save.data.mode === 'showdown' ? 'gemgrab' : (G.Save.data.mode || 'gemgrab'), ''); return; }
      if (a === 'trainOff') { cfg.passive = false; cfg.god = false; save(); }
      else if (a === 'privTest') { Net.send({ t: 'dv_sim', act: 'join', mode: 'gemgrab' }); Net.send({ t: 'dv_sim', act: 'join' }); setTimeout(() => Net.send({ t: 'party_start', kind: 'private', mode: 'gemgrab' }), 500); close(); return; }
      else if (a === 'ceReset') { delete CE()[DP.char || G.Save.data.selected]; save(); }
      else if (a === 'ceTest') { G.Save.data.selected = DP.char || G.Save.data.selected; G.Save.commit(); close(); Dev.startMatch(G.Save.data.mode && G.Save.data.mode !== 'showdown' ? G.Save.data.mode : 'gemgrab', ''); return; }
      else if (a === 'meSave') { ME.saved[ME.base] = ME.tiles.slice(); LS.set('br_dev_maps2', ME.saved); G.UI.toast('Carte enregistrée'); }
      else if (a === 'meReset') { delete ME.saved[ME.base]; LS.set('br_dev_maps2', ME.saved); meLoad(ME.base); }
      else if (a === 'mePlay') { const b = G.MAPS[ME.base]; G.MAPS.dev_custom = Object.assign({}, b, { name: b.name + ' (perso)', override: ME.tiles.slice() }); close(); Dev.startMatch(b.mode || 'gemgrab', 'dev_custom'); return; }
      else if (a === 'report') exportReport();
      else if (a === 'clearErr') DP.errs.length = 0;
      else if (a === 'lb') { close(); G.UI.ACT.leaderboard(); return; }
      else if (a === 'cfgApply') Net.send({ t: 'dv_cfg', cfg: DP.lc });
      else if (a === 'tpNew' || a === 'tpCopy') { const l = TP.list(), name = 'Test ' + (l.length + 1); const base = a === 'tpCopy' ? JSON.parse(JSON.stringify(G.Save.data)) : Object.assign(G.Save.defaults(), { name, tutorialDone: true, guestChoice: true, settings: JSON.parse(JSON.stringify(G.Save.data.settings)) }); l.push({ name, save: base }); TP.save(l); tpSwitch(name); }
      else if (a === 'tpReal') tpSwitch(null);
      else if (a === 'tpResetCur') { const n = TP.active(), l = TP.list(), it = l.find((x) => x.name === n); if (it) { it.save = Object.assign(G.Save.defaults(), { name: n, tutorialDone: true, guestChoice: true, settings: JSON.parse(JSON.stringify(G.Save.data.settings)) }); TP.save(l); LS.set('br_test_active', null); tpSwitch(n); } }
      else if (a === 'simProg') { const s = G.Save.data; s.stats = s.stats || {}; s.stats.matches = (s.stats.matches || 0) + 10; s.stats.wins = (s.stats.wins || 0) + 10; const id = s.selected; s.trophies[id] = (s.trophies[id] || 0) + 80; G.Save.commit(); G.UI.refreshCur && G.UI.refreshCur(); }
      else if (a === 'newDevice') { try { localStorage.removeItem('br_device'); } catch (er) { /* ignore */ } G.Store && G.Store.del && G.Store.del('br_device'); G.UI.toast('Nouvel identifiant d\'appareil : reconnectez-vous pour simuler un autre appareil', 3000); }
      else if (a === 'grant' || a === 'revoke') { const h = (DP.panel.querySelector('#dpGrant') || {}).value; if (h) Net.send({ t: 'dev_grant', handle: h, revoke: a === 'revoke' }); }
      else if (a === 'gifts') { close(); G.UI.devPanel && G.UI.devPanel(); return; }
      else if (a === 'run') { runCon(); return; }
      else if (a === 'cfgSave') { const n = ((DP.panel.querySelector('#dpCfgName') || {}).value || '').trim() || 'Config ' + new Date().toLocaleTimeString(); const all = LS.get('br_dev_cfgs', {}); all[n] = JSON.parse(JSON.stringify(cfg)); LS.set('br_dev_cfgs', all); G.UI.toast('Configuration « ' + n + ' » enregistrée'); }
      else if (a === 'autoTest') { G.UI.toast('Tests en cours…', 1200); runAutoTests((k) => { const b = DP.panel && DP.panel.querySelector('[data-a=autoTest]'); if (b) b.textContent = '⏳ ' + k + ' / ' + (G.MODE_ORDER.length + 3); }).then((r) => { G.UI.toast('Tests : ' + r.ok + '/' + r.n + ' réussis', 2600); render(); }); }
      else if (a === 'legacy') { close(); DP.legacy && DP.legacy(); return; }
      else if (a === 'resetAll') { const keep = cfg.custom; Object.keys(cfg).forEach((k) => { if (typeof cfg[k] === 'boolean') cfg[k] = false; }); cfg.dmg = 1; cfg.speed = 1; cfg.ts = 1; cfg.mods = {}; cfg.charEdit = {}; cfg.custom = keep; save(); G.UI.toast('Réglages développeur réinitialisés'); }
      else if (act[a]) { try { act[a](M); } catch (er) { G.Dev.log && G.Dev.log('Erreur : ' + er.message); } G.UI.refreshCur && G.UI.refreshCur(); }
    }
    render();
  }

  /* ---------- branchement sur les outils existants ---------- */
  const baseActivate = G.DevTools && G.DevTools.activate;
  if (G.DevTools) G.DevTools.activate = function (force, label) {
    baseActivate.call(G.DevTools, force, label);
    if (!G.Dev) return;
    hookNet(); hookDev(); tpGuardCloud(); tpBanner();
    if (!DP.legacy) DP.legacy = G.Dev.open;
    G.Dev.open = open;
    const b = document.getElementById('devBtn'); if (b) b.onclick = open;
  };
  // un profil de test reste actif après un redémarrage : la synchronisation du vrai compte reste coupée
  window.addEventListener('load', () => setTimeout(() => { if (TP.active()) { tpGuardCloud(); tpBanner(); } }, 500));
  DP.open = open; DP.close = close; DP.runAutoTests = runAutoTests; DP.report = report;
})();
