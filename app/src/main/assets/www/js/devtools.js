/* Brawl Rush — OUTILS DU COMPTE DÉVELOPPEUR (activés quand le serveur reconnaît le compte ; identiques à l'édition DEV)
   Panneau DEV (bouton en haut à gauche) : ressources, déblocages, triche de combat, lancement direct de n'importe quel
   mode/arène, superpositions de debug, gestionnaire de MODS (intégrés + vos propres mods en JavaScript) et console.
   Les outils de combat ne fonctionnent qu'HORS-LIGNE : en ligne, le serveur reste seul juge (aucune triche possible). */
(function () {
  const G = window.G;
  const KEY = 'brawlrush_dev_v1';
  const def = { god: false, ammo: false, sup: false, ohk: false, passive: false, aim: false, auto: false, gad: false, esp: false, dmg: 1, speed: 1, ts: 1, fps: false, hit: false, ai: false, mods: {}, custom: [] };
  let cfg = Object.assign({}, def);
  try { cfg = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } };
  const Dev = { cfg, panel: null, tab: 'player', logs: [], fps: 60, _f: 0, _t: 0, wasPaused: false }; // activé seulement pour un compte développeur vérifié par le serveur

  /* ----- skins supplémentaires (édition dev) ----- */
  [['abyss', 'Abysse', 250], ['rose', 'Rose', 320], ['ember', 'Braise', 30]].forEach(([id, name, hue]) => { const s = { id, name, price: 0, hue }; G.SKINS.push(s); G.SKIN[id] = s; });

  /* ----- mods intégrés ----- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const BUILTIN = [
    { id: 'vampire', name: 'Vampires', desc: 'Chaque dégât infligé soigne l\'attaquant de 30 %.', onDamage(M, t, a, s) { if (s && s !== t && s.alive) s.hp = Math.min(s.maxhp, s.hp + a * 0.3); return a; } },
    { id: 'fast', name: 'Mode turbo', desc: 'Tout le monde court 40 % plus vite.', speedMul() { return 1.4; } },
    { id: 'supercharge', name: 'Supers express', desc: 'Les supers se chargent 3 fois plus vite.', onDamage(M, t, a, s) { if (s && s !== t) s.superCharge = Math.min(1, s.superCharge + (a / s.def.superCost) * 2); return a; } },
    { id: 'giants', name: 'Géants', desc: 'Brawlers 35 % plus grands et 40 % plus costauds.', onMatchStart(M) { M.ents.forEach((e) => { if (e.isBoss) return; e.big = 1.35; e.r = 26; e.maxhp *= 1.4; e.hp = e.maxhp; }); } },
    { id: 'minis', name: 'Mini-brawlers', desc: 'Tout petits, un peu plus rapides.', onMatchStart(M) { M.ents.forEach((e) => { if (e.isBoss) return; e.big = 0.7; e.r = 15; }); }, speedMul() { return 1.15; } },
    { id: 'gemrain', name: 'Pluie de cristaux', desc: 'Des cristaux tombent toute la partie (Razzia).', onUpdate(M, dt) { M._gr = (M._gr || 0) - dt; if (M._gr <= 0 && M.mode === 'gemgrab' && M.state === 'play') { M._gr = 1.2; M.items.push({ type: 'gem', x: rand(2, M.w - 2) * G.T, y: rand(2, M.h - 2) * G.T, vx: 0, vy: 0, age: 0, z: 0, bob: rand(0, 6), lock: 0.2 }); } } },
    { id: 'fastshots', name: 'Balles rapides', desc: 'Les projectiles volent 60 % plus vite.', onUpdate(M) { for (const p of M.projs) if (!p.dm && !p.lob) { p.dm = 1; p.vx *= 1.6; p.vy *= 1.6; p.speed *= 1.6; } } },
    { id: 'regen', name: 'Régénération', desc: 'Tout le monde récupère de la vie en continu.', onUpdate(M, dt) { for (const e of M.ents) if (e.alive && !e.isBoss) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.025 * dt); } },
  ];
  const custom = [];
  function compileCustom() {
    custom.length = 0;
    cfg.custom.forEach((m) => { try { const o = new Function('G', 'Dev', m.code)(G, Dev); if (o && typeof o === 'object') { o.id = 'c:' + m.name; o.name = m.name; custom.push(o); } } catch (e) { log('Mod "' + m.name + '" invalide : ' + e.message); } });
  }
  const active = () => BUILTIN.filter((m) => cfg.mods[m.id]).concat(custom.filter((m) => cfg.mods[m.id]));
  function log(s) { Dev.logs.push(String(s)); if (Dev.logs.length > 40) Dev.logs.shift(); const o = document.getElementById('devLog'); if (o) { o.textContent = Dev.logs.join('\n'); o.scrollTop = 1e9; } }
  const me = (M) => M && M.player;
  const safe = (fn) => { try { return fn(); } catch (e) { log('Erreur mod : ' + e.message); } };

  /* ----- crochets appelés par la simulation ----- */
  Dev.onDamage = function (M, t, a, s) {
    const p = me(M);
    if (cfg.god && t === p) return 0;
    if (s === p && s) a *= cfg.dmg * (cfg.ohk ? 1000 : 1);
    for (const m of active()) if (m.onDamage) { const r = safe(() => m.onDamage(M, t, a, s)); if (typeof r === 'number') a = r; }
    return a;
  };
  Dev.speedMul = function (M, b) { let k = b === me(M) ? cfg.speed : 1; for (const m of active()) if (m.speedMul) k *= safe(() => m.speedMul(M, b)) || 1; return k; };
  Dev.passive = (M, b) => cfg.passive && me(M) && b.team !== me(M).team;
  Dev.onMatchStart = function (M) { M.devMods = true; for (const m of active()) if (m.onMatchStart) safe(() => m.onMatchStart(M)); };
  Dev.onUpdate = function (M, dt) {
    const p = me(M); if (!p) return;
    if (cfg.ammo) p.ammo = 3;
    if (cfg.sup) p.superCharge = 1;
    if (cfg.god && p.alive) p.hp = Math.max(p.hp, p.maxhp * 0.999);
    for (const m of active()) if (m.onUpdate) safe(() => m.onUpdate(M, dt));
  };

  /* ----- superpositions de debug ----- */
  Dev.draw = function (c, M, dt) {
    const P = M.player;
    if (P && P.alive && M.state === 'play' && !M.net) {
      if (cfg.gad) { P.gadgets = 3; P.gadgetCd = 0; }
      if (cfg.esp) M.ents.forEach((e) => { if (e.team !== P.team) e.revealT = Math.max(e.revealT || 0, 0.3); });
      if (cfg.auto && P.ammo >= 1 && (P.atkCd || 0) <= 0) { const t = G.Sim.autoTarget(M, P, (P.def.atk.range || 7) * G.T); if (t && !G.Input.pending.length) G.Input.pending.push({ kind: 'atk', auto: true }); }
    }
    Dev._f++; Dev._t += dt;
    if (Dev._t > 0.5) { Dev.fps = Dev._f / Dev._t; Dev._f = 0; Dev._t = 0; }
    const cam = G.Render.lastCam;
    if (cam && (cfg.hit || cfg.ai)) {
      c.save(); c.translate(cam.W / 2, cam.H / 2); c.scale(cam.sc, cam.sc); c.translate(-cam.cx, -cam.cy);
      c.lineWidth = 2 / cam.sc;
      if (cfg.hit) {
        c.strokeStyle = '#00ff88'; for (const e of M.ents) if (e.alive) { c.beginPath(); c.arc(e.x, e.y, e.r, 0, 6.3); c.stroke(); }
        c.strokeStyle = '#ffee00'; for (const p of M.projs) { c.beginPath(); c.arc(p.x, p.y, p.r || 6, 0, 6.3); c.stroke(); }
        c.strokeStyle = 'rgba(255,60,60,0.7)'; const x0 = Math.max(0, Math.floor((cam.cx - cam.vw / 2) / G.T)), x1 = Math.min(M.w - 1, Math.ceil((cam.cx + cam.vw / 2) / G.T)), y0 = Math.max(0, Math.floor((cam.cy - cam.vh / 2) / G.T)), y1 = Math.min(M.h - 1, Math.ceil((cam.cy + cam.vh / 2) / G.T));
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (G.isSolidTile(M.map.tiles[ty * M.w + tx])) c.strokeRect(tx * G.T, ty * G.T, G.T, G.T);
      }
      if (cfg.ai) for (const e of M.ents) {
        if (!e.alive || e.isPlayer || !e.ai) continue;
        c.strokeStyle = '#ff8aff'; c.fillStyle = '#ff8aff';
        if (e.ai.target && e.ai.target.alive) { c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.ai.target.x, e.ai.target.y); c.stroke(); }
        if (e.ai.path) { c.strokeStyle = '#66ccff'; c.beginPath(); c.moveTo(e.x, e.y); e.ai.path.forEach((q) => c.lineTo(q.x, q.y)); c.stroke(); }
        if (e.ai.obj) { c.beginPath(); c.arc(e.ai.obj.x, e.ai.obj.y, 7 / cam.sc * 2, 0, 6.3); c.fill(); }
      }
      c.restore();
    }
    c.save(); c.font = '13px monospace'; c.textAlign = 'left'; c.fillStyle = '#ff5ad2'; c.fillText('DEV', 10, 100);
    if (cfg.fps) { c.fillStyle = Dev.fps < 40 ? '#ff6a6a' : '#7dff7a'; c.fillText(Math.round(Dev.fps) + ' fps · ' + M.ents.length + ' ent · ' + M.projs.length + ' proj · ' + M.parts.length + ' part · q' + G.Render.q, 10, 118); }
    const flags = ['god', 'ammo', 'sup', 'ohk', 'passive'].filter((k) => cfg[k]).join(' '); if (flags) { c.fillStyle = '#ffd21f'; c.fillText(flags + (cfg.dmg !== 1 ? ' dmgx' + cfg.dmg : '') + (cfg.ts !== 1 ? ' t×' + cfg.ts : ''), 10, 136); }
    c.restore();
  };

  /* ----- actions ----- */
  const S = () => G.Save.data;
  function unlockAll() {
    const s = S();
    G.BRAWLERS.forEach((b) => { if (!s.unlocked.includes(b.id)) { s.unlocked.push(b.id); s.trophies[b.id] = s.trophies[b.id] || 0; } s.levels[b.id] = G.MAX_LEVEL; s.ownedSkins[b.id] = G.SKINS.filter((k) => k.id !== 'classic').map((k) => k.id); });
    G.Save.commit(); log('Tout est débloqué : ' + G.BRAWLERS.length + ' brawlers, ' + G.SKINS.length + ' apparences, niveau max.');
  }
  Dev.unlockAll = unlockAll;
  function startMatch(mode, mapKey) {
    const s = S(), id = s.selected;
    G.UI.hideAll(); close(true);
    const M = G.Sim.create({ mode, mapKey: mapKey || G.pick(G.MODES[mode].maps), brawlerId: id, skin: s.skins[id] || 'classic', level: s.levels[id] || 1, trophies: s.trophies[id] || 0, name: s.name });
    G.App.begin(M);
  }
  const inMatch = () => G.App.state === 'match' && G.App.M && !G.App.M.net;
  const act = {
    coins: () => { S().coins += 10000; }, gems: () => { S().gems += 1000; }, boxes: () => { S().boxes += 5; },
    unlock: unlockAll,
    tr100: () => { const id = S().selected; S().trophies[id] = (S().trophies[id] || 0) + 100; },
    tr1000: () => { const id = S().selected; S().trophies[id] = (S().trophies[id] || 0) + 1000; },
    tr0: () => { S().trophies[S().selected] = 0; },
    lvl: () => { S().levels[S().selected] = G.MAX_LEVEL; },
    quests: () => { G.Quests.ensure().forEach((q) => { const d = G.QUEST_POOL.find((x) => x.id === q.id); q.progress = d.goal; }); },
    daily: () => { S().lastDaily = 0; },
    heal: (M) => { const p = M.player; p.hp = p.maxhp; },
    superNow: (M) => { M.player.superCharge = 1; },
    maxhp: (M) => { const p = M.player; p.maxhp += 5000; p.hp = p.maxhp; },
    killAll: (M) => { M.ents.forEach((e) => { if (e.alive && e.team !== M.player.team) G.Sim.damage(M, e, 1e9, M.player); }); },
    win: (M) => { G.Sim.finish(M, M.player.team); },
    lose: (M) => { G.Sim.finish(M, 1 - M.player.team); },
    center: (M) => { const p = M.player; p.x = M.w * G.T / 2; p.y = M.h * G.T / 2; },
    cubes: (M) => { const p = M.player; p.cubes += 5; const add = p.def.hp * p.dmgMul * 0.5; p.maxhp += add; p.hp += add; },
    botFriend: (M) => spawn(M, M.player.team), botFoe: (M) => spawn(M, 1 - M.player.team),
    skipTime: (M) => { M.left = Math.max(5, M.left - 30); },
    reset: () => { G.Save.reset(); G.Save.commit(); location.reload(); },
  };
  function spawn(M, team) {
    if (M.mode === 'showdown' || M.ents.length >= 14) { log('Impossible dans ce mode / trop d\'entités.'); return; }
    const d = G.pick(G.BRAWLERS), p = M.player, idx = M.ents.length;
    const b = G.Sim.mkBrawler(M, d, team, 'Dev-' + d.name, p.level, 'classic', false, { x: p.x + 80, y: p.y + 40 }, idx);
    b.spawnIdx = idx % 3; b.spawn = { x: p.x, y: p.y }; M.ents.push(b); log('Bot ' + (team === p.team ? 'allié' : 'ennemi') + ' ajouté : ' + d.name);
  }

  /* ----- interface ----- */
  const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function close(silent) {
    if (Dev.panel) { Dev.panel.remove(); Dev.panel = null; }
    if (!silent && inMatch()) G.App.paused = Dev.wasPaused;
  }
  const tgl = (k, label) => `<div class="setrow"><span>${label}</span><div class="toggle ${cfg[k] ? 'on' : ''}" data-d="${k}"></div></div>`;
  const sld = (k, label, min, max, step) => `<div class="setrow"><span>${label} <b id="v_${k}" style="color:#ffd21f">${cfg[k]}</b></span><input type="range" data-r="${k}" min="${min}" max="${max}" step="${step}" value="${cfg[k]}" style="width:42rem"></div>`;
  const btn = (a, label, cls) => `<button class="btn small ${cls || ''}" data-a="${a}">${label}</button>`;
  const TABS = [['player', 'Joueur'], ['combat', 'Combat'], ['world', 'Monde'], ['mods', 'Mods'], ['console', 'Console']];
  function render() {
    if (!Dev.panel) return;
    const body = Dev.panel.querySelector('#devBody'), M = G.App.M, om = inMatch();
    let h = '';
    if (Dev.tab === 'player') {
      const s = S(), id = s.selected;
      h = `<div class="row">${btn('coins', '+10 000 pièces')}${btn('gems', '+1 000 gemmes', 'blue')}${btn('boxes', '+5 coffres')}${btn('unlock', 'Tout débloquer', 'green')}</div>
        <div class="row" style="margin-top:1.4rem">${btn('tr100', '+100 trophées')}${btn('tr1000', '+1000 trophées')}${btn('tr0', 'Trophées à 0', 'gray')}${btn('lvl', 'Niveau max')}</div>
        <div class="row" style="margin-top:1.4rem">${btn('quests', 'Terminer les quêtes')}${btn('daily', 'Réarmer cadeau')}${btn('reset', 'Reset sauvegarde', 'red')}</div>
        <div class="row" style="margin-top:2rem;font-size:2.4rem">Brawler : <b style="color:#ffd21f">${G.BRAWLER[id].name}</b> · ${s.coins} pièces · ${s.gems} gemmes · ${G.Save.totalTrophies()} 🏆 · ${s.unlocked.length}/${G.BRAWLERS.length} brawlers</div>`;
    } else if (Dev.tab === 'combat') {
      h = (om ? '' : '<div class="row" style="color:#ff9a9a;font-size:2.4rem;margin-bottom:1rem">Lancez un match hors-ligne (onglet Monde) pour utiliser les actions de combat. Les options ci-dessous restent actives.</div>') +
        tgl('god', 'Invincible') + tgl('ammo', 'Munitions infinies') + tgl('sup', 'Super toujours prêt') + tgl('ohk', 'Éliminations en un coup') + tgl('aim', 'Aimbot (visée automatique parfaite)') + tgl('auto', 'Tir automatique') + tgl('gad', 'Gadgets infinis') + tgl('esp', 'Voir les ennemis dans les buissons') + tgl('passive', 'Ennemis passifs (ne bougent/tirent pas)') +
        sld('dmg', 'Multiplicateur de dégâts ×', 0.25, 10, 0.25) + sld('speed', 'Vitesse du joueur ×', 0.5, 3, 0.1) + sld('ts', 'Vitesse du jeu ×', 0.2, 3, 0.1) +
        (om ? `<div class="row" style="margin-top:1.4rem">${btn('heal', 'Soigner', 'green')}${btn('superNow', 'Super prêt')}${btn('maxhp', '+5000 PV max')}${btn('killAll', 'Tuer les ennemis', 'red')}${btn('center', 'Centre')}${btn('skipTime', '-30 s')}</div>
        <div class="row" style="margin-top:1.2rem">${btn('botFriend', '+ Bot allié', 'blue')}${btn('botFoe', '+ Bot ennemi', 'red')}${btn('cubes', '+5 cubes')}${btn('win', 'Gagner maintenant', 'green')}${btn('lose', 'Perdre', 'gray')}</div>` : '');
    } else if (Dev.tab === 'world') {
      const mode = Dev.mode || 'gemgrab';
      h = `<div class="row" style="font-size:2.4rem">Lancer directement (sans matchmaking), avec le brawler sélectionné :</div>
        <div class="row" style="margin:1.2rem 0">${G.MODE_ORDER.map((m) => `<button class="btn small ${mode === m ? 'green' : 'gray'}" data-m="${m}">${esc(G.MODES[m].short)}</button>`).join('')}</div>
        <div class="row">${Object.entries(G.MAPS).filter(([, v]) => v.mode === mode).map(([k, v]) => `<button class="btn small blue" data-map="${k}">${esc(v.name)}</button>`).join('')}<button class="btn small" data-map="">Aléatoire</button></div>
        <div class="row" style="margin-top:2rem;font-size:2.2rem">Superpositions de debug :</div>${tgl('fps', 'Compteur FPS / entités')}${tgl('hit', 'Hitbox & murs')}${tgl('ai', 'IA : cibles, chemins, objectifs')}`;
    } else if (Dev.tab === 'mods') {
      h = '<div style="font-size:2.2rem;margin-bottom:1rem;color:#c8d0ff">Mods actifs au prochain match hors-ligne :</div>' +
        BUILTIN.map((m) => `<div class="setrow"><span>${esc(m.name)}<br><small style="font-size:1.9rem;color:#9aa7c8">${esc(m.desc)}</small></span><div class="toggle ${cfg.mods[m.id] ? 'on' : ''}" data-mod="${m.id}"></div></div>`).join('') +
        cfg.custom.map((m, i) => `<div class="setrow"><span>★ ${esc(m.name)} <small style="color:#9aa7c8">(perso)</small></span><span style="display:flex;gap:1rem;align-items:center"><button class="btn small red" data-del="${i}">✕</button><div class="toggle ${cfg.mods['c:' + m.name] ? 'on' : ''}" data-mod="c:${esc(m.name)}"></div></span></div>`).join('') +
        `<div style="margin-top:1.6rem;font-size:2.2rem">Créer un mod (JavaScript). Retournez un objet avec <code>onMatchStart(M)</code>, <code>onUpdate(M,dt)</code>, <code>onDamage(M,cible,degats,source)</code> → nombre, <code>speedMul(M,brawler)</code> → nombre :</div>
        <input class="txt" id="modName" placeholder="Nom du mod" style="width:40rem;margin:.8rem 0;font-size:2.6rem">
        <textarea id="modCode" spellcheck="false" style="width:100%;height:16rem;font:2.1rem monospace;background:#0e1030;color:#9dffb4;border:.3rem solid var(--navy);border-radius:1.2rem;padding:1rem;text-shadow:none;user-select:text;-webkit-user-select:text">return {\n  onDamage(M, t, a, s) { return a * 2; } // exemple : dégâts x2\n};</textarea>
        <div class="row" style="margin-top:1rem">${btn('addmod', 'Ajouter / mettre à jour', 'green')}</div>`;
    } else {
      h = `<div id="devLog" style="height:24rem;overflow:auto;background:#0e1030;border-radius:1.2rem;padding:1rem;font:2.1rem monospace;text-shadow:none;white-space:pre-wrap;user-select:text;-webkit-user-select:text;color:#9dffb4">${esc(Dev.logs.join('\n'))}</div>
        <div class="row" style="margin-top:1rem"><input class="txt" id="devIn" placeholder="ex: G.App.M.player.hp = 99999" style="width:80rem;font:2.4rem monospace" autocapitalize="none" autocomplete="off">${btn('run', 'Exécuter', 'green')}</div>
        <div style="font-size:2rem;color:#9aa7c8;margin-top:1rem">Variables : <code>G</code> (jeu), <code>M</code> (match en cours), <code>P</code> (votre brawler). Les modes en ligne ne sont pas affectés.</div>`;
    }
    body.innerHTML = h;
    Dev.panel.querySelectorAll('.tabs .tab').forEach((t) => t.classList.toggle('act', t.dataset.tab === Dev.tab));
  }
  function open() {
    if (Dev.panel) { close(); return; }
    Dev.wasPaused = G.App.paused;
    if (inMatch()) { G.App.paused = true; G.Input.reset(); }
    const o = el(`<div class="overlay" style="z-index:95"><div class="modal" style="min-width:120rem;width:130rem;max-height:94%"><button class="x" data-a="close">✕</button><h2 style="margin-bottom:1rem">🛠 Outils développeur</h2>
      <div class="tabs" style="justify-content:center">${TABS.map(([k, l]) => `<button class="tab" data-tab="${k}">${l}</button>`).join('')}</div><div id="devBody"></div></div></div>`);
    document.getElementById('ui').appendChild(o); Dev.panel = o;
    o.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab],[data-d],[data-a],[data-m],[data-map],[data-mod],[data-del]'); if (!t) return;
      G.Audio.unlock(); G.Audio.sfx('ui');
      const d = t.dataset;
      if (d.tab) { Dev.tab = d.tab; }
      else if (d.d) { cfg[d.d] = !cfg[d.d]; persist(); }
      else if (d.m) { Dev.mode = d.m; }
      else if (d.map !== undefined) { startMatch(Dev.mode || 'gemgrab', d.map); return; }
      else if (d.mod) { cfg.mods[d.mod] = !cfg.mods[d.mod]; persist(); }
      else if (d.del) { const m = cfg.custom.splice(+d.del, 1)[0]; if (m) delete cfg.mods['c:' + m.name]; persist(); compileCustom(); }
      else if (d.a === 'close') { close(); return; }
      else if (d.a === 'addmod') {
        const name = (o.querySelector('#modName').value || '').trim(), code = o.querySelector('#modCode').value;
        if (!name) { G.UI.toast('Donnez un nom au mod'); return; }
        try { new Function('G', 'Dev', code)(G, Dev); } catch (er) { G.UI.toast('Erreur : ' + er.message, 4000); return; }
        const i = cfg.custom.findIndex((m) => m.name === name); if (i >= 0) cfg.custom[i].code = code; else cfg.custom.push({ name, code });
        cfg.mods['c:' + name] = true; persist(); compileCustom(); G.UI.toast('Mod "' + name + '" ajouté et activé');
      }
      else if (d.a === 'run') { runConsole(); return; }
      else if (act[d.a]) { try { act[d.a](G.App.M); } catch (er) { log('Erreur : ' + er.message); } G.UI.refreshCur && G.UI.refreshCur(); }
      render();
    });
    o.addEventListener('input', (e) => { const r = e.target.dataset.r; if (r) { cfg[r] = +e.target.value; persist(); const v = o.querySelector('#v_' + r); if (v) v.textContent = cfg[r]; } });
    o.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'devIn') runConsole(); });
    render();
  }
  function runConsole() {
    const i = Dev.panel.querySelector('#devIn'), code = i.value.trim(); if (!code) return;
    log('> ' + code);
    try { const M = G.App.M, P = M && M.player; const r = new Function('G', 'M', 'P', 'return (' + code + ')')(G, M, P); log(r === undefined ? 'ok' : typeof r === 'object' ? JSON.stringify(r, (k, v) => (k === 'def' || k === 'ai' || k === 'map' ? undefined : v)).slice(0, 400) : String(r)); }
    catch (e1) { try { const M = G.App.M, P = M && M.player; const r = new Function('G', 'M', 'P', code)(G, M, P); log(r === undefined ? 'ok' : String(r)); } catch (e2) { log('Erreur : ' + e2.message); } }
    i.value = '';
  }
  Dev.open = open;
  Dev.act = act; Dev.startMatch = startMatch; Dev.log = log; Dev.persist = persist; Dev.BUILTIN = BUILTIN; // utilisés par le menu professionnel (devpro.js)

  /* ----- activation (compte développeur reconnu par le serveur) ----- */
  G.DevTools = { activate(force, label) {
    if (G.DevReady || (G.DEV && !force)) return; // l'édition DEV active les outils d'office (force)
    G.Dev = Dev;
    try {
      compileCustom();
      const st = document.createElement('style');
      st.textContent = '#devBtn{position:fixed;left:2rem;top:9.6rem;z-index:96;padding:.5rem 1.6rem;font-size:2.4rem;border-radius:1.2rem;background:linear-gradient(#ff7ae0,#a82ad0);border:.3rem solid #14123a;box-shadow:0 .4rem 0 #5a1a8a} .skins{flex-wrap:wrap}.skin{flex:1 1 22%} .devbadge{position:fixed;right:1.6rem;bottom:1rem;z-index:5;font-size:2rem;color:#ff7ae0;pointer-events:none}';
      document.head.appendChild(st);
      const b = document.createElement('button'); b.id = 'devBtn'; b.className = 'dh-launch'; b.setAttribute('aria-label', 'Mode développeur'); b.title = 'Mode développeur'; b.innerHTML = '<span>BR</span>'; b.onclick = open; document.getElementById('app').appendChild(b); // logo carré du Dev Hub, en bas à gauche
      // (les cadeaux de brawlers sont dans Dev Hub → Modération → Droits & cadeaux)
      const badge = document.createElement('div'); badge.className = 'devbadge'; badge.textContent = label || 'COMPTE DÉVELOPPEUR'; document.getElementById('app').appendChild(badge);
      G.DevReady = true;
    } catch (e) { console.error('dev init', e); }
  } };
})();
