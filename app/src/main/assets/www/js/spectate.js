/* Brawl Rush - SPECTATEUR et REPLAYS (mode développeur, droit « observer » vérifié par le serveur)
   Spectateur : le serveur envoie les instantanés de la partie (comme aux joueurs) ; aucune commande n'est envoyée.
   Suivre un joueur, passer d'un joueur à l'autre, caméra libre (glisser au doigt / souris, zoom à 2 doigts ou boutons),
   retour rapide au joueur suivi. Replays : les parties enregistrées par le serveur sont rejouées avec le même moteur
   (lecture/pause, vitesse, barre de temps, évènements, joueur à suivre). */
(function () {
  const G = window.G, Net = G.Net, T = G.T;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MODE = (id) => (G.MODES[id] || {}).name || id;
  let ui = null, timer = 0;

  /* ---------- interface commune (spectateur + replay) ---------- */
  function build(kind) {
    close(); document.body.classList.add('spectating');
    ui = document.createElement('div'); ui.id = 'specUI'; ui.className = kind;
    ui.innerHTML = `<div class="sp-pad" id="spPad"></div>
      <div class="sp-top"><span class="sp-badge">${kind === 'replay' ? '⏵ REPLAY' : '👁 SPECTATEUR'}</span><span class="sp-info" id="spInfo"></span><button class="sp-btn red" data-sp="exit">✕ Quitter</button></div>
      <div class="sp-list" id="spList"></div>
      <div class="sp-cam"><button class="sp-btn" data-sp="free" id="spFree">🎥 Caméra libre</button><button class="sp-btn" data-sp="zin">＋</button><button class="sp-btn" data-sp="zout">－</button><button class="sp-btn" data-sp="back">↺ Joueur suivi</button>
        <span class="sp-note">Rotation : vue 2D du dessus (à développer)</span></div>
      ${kind === 'replay' ? `<div class="sp-time"><button class="sp-btn" data-sp="play" id="rpPlay">⏸</button><input type="range" id="rpBar" min="0" max="1000" value="0"><span id="rpT">0:00</span>
        <button class="sp-btn" data-sp="speed" id="rpSpeed">×1</button><button class="sp-btn" data-sp="events">⚑ Évènements</button></div><div class="sp-events" id="rpEv" hidden></div>` : ''}`;
    document.getElementById('app').appendChild(ui);
    ui.addEventListener('click', onClick);
    bindPad(ui.querySelector('#spPad'));
    if (kind === 'replay') { const bar = ui.querySelector('#rpBar'); bar.addEventListener('input', () => RP.seek(+bar.value / 1000 * RP.dur)); }
    clearInterval(timer); timer = setInterval(refresh, 400);
  }
  function close() { clearInterval(timer); if (ui) ui.remove(); ui = null; document.body.classList.remove('spectating'); }
  function M() { return G.App && G.App.M && G.App.M.spectate ? G.App.M : null; }
  function refresh() {
    const m = M(); if (!m || !ui) return;
    const info = ui.querySelector('#spInfo'), sc = m.score ? m.score.join(' – ') : '', left = m.left != null ? Math.max(0, Math.ceil(m.left)) : 0;
    info.textContent = MODE(m.mode) + ' · ' + ((G.MAPS[m.mapKey] || {}).name || '') + ' · ' + (sc ? sc + ' · ' : '') + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + ' · ' + (m.state === 'play' ? 'en cours' : m.state);
    const list = ui.querySelector('#spList');
    list.innerHTML = m.ents.filter(Boolean).map((b) => `<button class="sp-pl t${b.team === 0 ? 0 : b.team === 1 ? 1 : 2} ${m.player === b && !m.freeCam ? 'on' : ''} ${b.alive ? '' : 'dead'}" data-follow="${b.idx}">
      <b>${esc(b.name)}</b><small>${esc((G.BRAWLER[b.id] || {}).name || b.id)}${b.isBot ? ' · bot' : ''} · ${b.kills || 0} élim. · ${Math.max(0, Math.round(b.hp))} PV</small></button>`).join('');
    const fr = ui.querySelector('#spFree'); if (fr) fr.classList.toggle('on', !!m.freeCam);
  }
  function onClick(e) {
    const t = e.target.closest('[data-sp],[data-follow],[data-ev]'); if (!t) return;
    const m = M(); G.Audio && G.Audio.sfx('ui');
    if (t.dataset.follow !== undefined) { if (!m) return; const b = m.ents[+t.dataset.follow]; if (b) { m.player = b; m.stats = b.st; m.freeCam = null; refresh(); } return; }
    if (t.dataset.ev !== undefined) { RP.seek(+t.dataset.ev); return; }
    const a = t.dataset.sp;
    if (a === 'exit') { exit(); return; }
    if (!m) return;
    if (a === 'free') { m.freeCam = m.freeCam ? null : { x: m.cam.x, y: m.cam.y, zoom: m.zoomMul || 1 }; }
    if (a === 'zin' || a === 'zout') { const z = G.clamp((m.freeCam ? m.freeCam.zoom : (m.zoomMul || 1)) * (a === 'zin' ? 1.2 : 1 / 1.2), 0.45, 2.2); if (m.freeCam) m.freeCam.zoom = z; else m.zoomMul = z; }
    if (a === 'back') { m.freeCam = null; m.zoomMul = 1; }
    if (a === 'play') RP.toggle(); if (a === 'speed') RP.cycle(); if (a === 'events') { const ev = ui.querySelector('#rpEv'); ev.hidden = !ev.hidden; }
    refresh();
  }
  // caméra libre : glisser (1 doigt / souris) pour se déplacer, pincer (2 doigts) pour zoomer
  function bindPad(pad) {
    const pts = new Map(); let pinch = 0;
    pad.addEventListener('pointerdown', (e) => { const m = M(); if (!m) return; if (!m.freeCam) m.freeCam = { x: m.cam.x, y: m.cam.y, zoom: m.zoomMul || 1 }; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { pad.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } refresh(); });
    pad.addEventListener('pointermove', (e) => {
      const m = M(), p = pts.get(e.pointerId); if (!m || !p || !m.freeCam) return;
      if (pts.size === 1) { const sc = (G.Render.lastCam && G.Render.lastCam.sc) || 1; m.freeCam.x -= (e.clientX - p.x) * (window.devicePixelRatio || 1) / sc * (G.App.resScale || 1); m.freeCam.y -= (e.clientY - p.y) * (window.devicePixelRatio || 1) / sc * (G.App.resScale || 1); }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) m.freeCam.zoom = G.clamp(m.freeCam.zoom * d / pinch, 0.45, 2.2); pinch = d; }
      const W = m.w * T, H = m.h * T; m.freeCam.x = G.clamp(m.freeCam.x, 0, W); m.freeCam.y = G.clamp(m.freeCam.y, 0, H);
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    pad.addEventListener('wheel', (e) => { const m = M(); if (!m) return; e.preventDefault(); if (!m.freeCam) m.freeCam = { x: m.cam.x, y: m.cam.y, zoom: 1 }; m.freeCam.zoom = G.clamp(m.freeCam.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.45, 2.2); }, { passive: false });
  }
  function enterMatch(init) {
    if (G.DevPro && G.DevPro.panel) G.DevPro.close();
    while (G.UI.modals.length) G.UI.closeModal();
    G.UI.hideAll(); const m = G.NetMatch.begin(init); m.spectate = true; G.App.begin(m); G.Input.enabled = false; return m;
  }
  function exit() {
    if (RP.active) RP.stop(); else Net.send({ t: 'dv_unspectate' });
    close(); if (G.App.state === 'match' && G.App.M && G.App.M.spectate) G.App.leaveOnline();
  }

  /* ---------- spectateur en direct ---------- */
  const SP = G.Spectate = {
    start(init) { RP.active = false; enterMatch(init); build('live'); refresh(); G.UI.toast('👁 Mode spectateur : touchez un joueur pour le suivre, glissez pour la caméra libre', 3200); },
    ended() { if (RP.active) { RP.pause(); return; } G.UI.toast('La partie observée est terminée.', 2600); setTimeout(exit, 1800); },
    watch(opt) { Net.send(Object.assign({ t: 'dv_spectate' }, opt)); },
    exit, close,
  };
  Net.on('spec_end', () => { if (M() && !RP.active) SP.ended(); });

  /* ---------- replays ---------- */
  const RP = G.Replay = {
    active: false, frames: [], parsed: [], idx: 0, t: 0, dur: 1, speed: 1, playing: true, last: 0, events: [],
    time() { return RP.t; },
    start(init, meta, frames) {
      RP.active = true; RP.frames = frames; RP.parsed = new Array(frames.length); RP.meta = meta;
      const f0 = RP.get(0), fl = RP.get(frames.length - 1); RP.t0 = f0.tm; RP.dur = Math.max(1, fl.tm - f0.tm); RP.t = f0.tm; RP.idx = 0; RP.playing = true; RP.speed = 1; RP.last = performance.now();
      const m = enterMatch(Object.assign({}, init, { you: 0, spectate: true, replay: true })); m.replay = true;
      build('replay'); RP.scan(); refresh(); RP.loop();
    },
    get(i) { if (!RP.parsed[i]) { try { RP.parsed[i] = JSON.parse(RP.frames[i]); } catch (e) { RP.parsed[i] = { tm: 0, e: [] }; } } return RP.parsed[i]; },
    loop() {
      cancelAnimationFrame(RP.raf);
      const step = () => {
        if (!RP.active) return; RP.raf = requestAnimationFrame(step);
        const now = performance.now(), dt = Math.min(0.1, (now - RP.last) / 1000); RP.last = now;
        if (RP.playing) RP.t = Math.min(RP.t0 + RP.dur, RP.t + dt * RP.speed);
        const NM = G.NetMatch;
        while (RP.idx < RP.frames.length && RP.get(RP.idx).tm <= RP.t + NM.delay + 0.05) { NM.off = null; NM.onSnap(RP.get(RP.idx)); RP.idx++; }
        if (RP.t >= RP.t0 + RP.dur && RP.playing) { RP.playing = false; const b = ui && ui.querySelector('#rpPlay'); if (b) b.textContent = '⏵'; }
        if (ui) { const bar = ui.querySelector('#rpBar'), tt = ui.querySelector('#rpT'); if (bar && document.activeElement !== bar) bar.value = Math.round((RP.t - RP.t0) / RP.dur * 1000); if (tt) { const s = Math.round(RP.t - RP.t0); tt.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' / ' + Math.floor(RP.dur / 60) + ':' + String(Math.round(RP.dur) % 60).padStart(2, '0'); } }
      };
      RP.raf = requestAnimationFrame(step);
    },
    seek(rel) { // rel = secondes depuis le début
      const tgt = RP.t0 + G.clamp(rel, 0, RP.dur), NM = G.NetMatch, m = M(); if (!m) return;
      let i = 0; while (i + 1 < RP.frames.length && RP.get(i + 1).tm <= tgt) i++;
      NM.queue = []; NM.A = null; NM.prev = null; NM.off = null; m.projs.length = 0; m.parts.length = 0; NM.projs = {};
      RP.t = RP.get(i).tm; RP.idx = i; NM.onSnap(RP.get(i)); NM.apply(m, RP.get(i)); RP.idx = i + 1;
    },
    toggle() { RP.playing = !RP.playing; if (RP.playing && RP.t >= RP.t0 + RP.dur - 0.05) RP.seek(0); const b = ui && ui.querySelector('#rpPlay'); if (b) b.textContent = RP.playing ? '⏸' : '⏵'; },
    pause() { RP.playing = false; const b = ui && ui.querySelector('#rpPlay'); if (b) b.textContent = '⏵'; },
    cycle() { const S = [0.5, 1, 2, 4]; RP.speed = S[(S.indexOf(RP.speed) + 1) % S.length]; const b = ui && ui.querySelector('#rpSpeed'); if (b) b.textContent = '×' + RP.speed; },
    stop() { RP.active = false; cancelAnimationFrame(RP.raf); },
    scan() { // évènements importants : éliminations et points marqués
      const ev = [], m = M(); let prevA = null, prevS = null;
      for (let i = 0; i < RP.frames.length; i += 1) {
        const f = RP.get(i), rel = f.tm - RP.t0;
        if (prevA) f.e.forEach((a, k) => { const al = a[6] & 1; if (prevA[k] && !al) { const b = m && m.ents[k]; ev.push({ t: rel, txt: '✖ ' + (b ? b.name : 'joueur ' + k) + ' éliminé', team: b ? b.team : -1 }); } });
        prevA = f.e.map((a) => a[6] & 1);
        const sc = JSON.stringify(f.sc || null); if (prevS !== null && sc !== prevS) ev.push({ t: rel, txt: '★ Score ' + (f.sc ? f.sc.join(' – ') : ''), team: -1 }); prevS = sc;
        if (i % 400 === 399) RP.parsed.fill(undefined, Math.max(0, i - 800), i - 400); // mémoire : on libère au fur et à mesure
      }
      RP.events = ev;
      const box = ui && ui.querySelector('#rpEv'); if (box) box.innerHTML = ev.length ? ev.map((x) => `<button class="sp-ev t${x.team}" data-ev="${Math.max(0, x.t - 2).toFixed(1)}"><i>${Math.floor(x.t / 60)}:${String(Math.round(x.t) % 60).padStart(2, '0')}</i> ${esc(x.txt)}</button>`).join('') : '<div class="sp-note">Aucun évènement.</div>';
    },
  };
  // réception d'un replay (en plusieurs morceaux)
  let pending = null;
  Net.on('dv_replay', (m) => {
    if (m.part === 0) { pending = { init: m.init, meta: m.meta, frames: [], n: m.n }; G.UI.toast('Chargement du replay…', 1500); return; }
    if (!pending) return; pending.frames.push(...(m.frames || []));
    if (m.last) { const p = pending; pending = null; if (p.frames.length > 5) RP.start(p.init, p.meta, p.frames); else G.UI.toast('Replay vide.', 2000); }
  });
})();
