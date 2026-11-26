/* Brawl Rush - EFFETS VISUELS AVANCÉS (purement graphiques, côté client : aucun effet sur la simulation ni le réseau)
   1. Éclairage dynamique : ambiance teintée par thème + lumières (brawlers, tirs, explosions, gemmes, flammes) en multiplication.
   2. Particules : onde de choc et étincelles aux impacts, poussière des pas, éclair de bouche au tir, élimination (explosion,
      onde, esprit qui s'élève), anneau d'énergie quand la super est lancée, éclats de couleur à la réapparition.
   Qualité haute : tout ; moyenne : particules + éclairage allégé ; économie : rien (aucun coût). */
(function () {
  const G = window.G, R = G.Render, Sim = G.Sim; if (!R || !Sim) return;
  const AMB = { desert: [232, 214, 190], snow: [206, 218, 240], night: [150, 150, 208], meadow: [214, 226, 200], volcano: [210, 150, 130], jungle: [180, 210, 175] };
  const TEAM = ['#5ab8ff', '#ff6070', '#ffd84a'];
  const q = () => R.q || 0;
  function push(M, o) { if (M.parts.length < 520) M.parts.push(Object.assign({ t: 0, vx: 0, vy: 0, drag: 0, r1: 0 }, o)); }

  /* ---------- détection des évènements visuels (fonctionne hors ligne et en ligne) ---------- */
  function scan(M, dt) {
    const st = M._vfx || (M._vfx = { alive: [], sup: [], ammo: [], projs: new WeakSet(), step: [], rsp: [] });
    for (const b of M.ents) {
      if (!b) continue; const i = b.idx, col = TEAM[b.team === 0 ? 0 : b.team === 1 ? 1 : 2];
      // élimination : explosion + onde + esprit
      if (st.alive[i] && !b.alive && !b.isBoss) {
        Sim.burst(M, b.x, b.y, col, 16, 260, 7, 0.7);
        push(M, { type: 'ring', x: b.x, y: b.y, dur: 0.55, r0: 18, r1: 120, color: col });
        push(M, { type: 'soul', x: b.x, y: b.y - 20, vy: -60, dur: 1.2, r0: 16, color: col });
        push(M, { type: 'flash', x: b.x, y: b.y, dur: 0.22, r0: 38, color: col });
      }
      // réapparition : éclats de couleur
      if (st.alive[i] === false && b.alive) { push(M, { type: 'ring', x: b.x, y: b.y, dur: 0.5, r0: 70, r1: 14, color: col }); push(M, { type: 'pillar', x: b.x, y: b.y, dur: 0.6, r0: 26, color: col }); }
      st.alive[i] = !!b.alive;
      // super lancée : anneau d'énergie
      const sc = b.superCharge || 0; if ((st.sup[i] || 0) >= 1 && sc < 0.5 && b.alive) { push(M, { type: 'ring', x: b.x, y: b.y, dur: 0.45, r0: 20, r1: 150, color: '#ffd21f', w: 7 }); push(M, { type: 'flash', x: b.x, y: b.y, dur: 0.3, r0: 90, color: '#fff3a0' }); }
      st.sup[i] = sc;
      // poussière des pas
      if (b.alive && b.moving && q() >= 1 && !b.hidden) { st.step[i] = (st.step[i] || 0) - dt; if (st.step[i] <= 0) { st.step[i] = 0.16 + Math.random() * 0.08; push(M, { type: 'dust', x: b.x + (Math.random() - 0.5) * 12, y: b.y + 14, vx: (Math.random() - 0.5) * 20, vy: -8, dur: 0.45, r0: 5 + Math.random() * 3, color: 'rgba(255,255,255,0.55)' }); } }
    }
    // éclair de bouche : chaque nouveau projectile
    for (const p of M.projs) { if (st.projs.has(p)) continue; st.projs.add(p); if (p.lob) continue; const sz = (p.r || 6); push(M, { type: 'flash', x: p.x, y: p.y - (p.z || 0), dur: 0.09, r0: sz * 3.2, color: p.color || '#fff' }); }
  }
  // impacts : onde de choc + étincelles en plus de la gerbe d'origine
  const baseBurst = Sim.burst;
  Sim.burst = function (M, x, y, color, n, spd, size, dur, type) {
    baseBurst.apply(this, arguments);
    if (M.online || q() < 1) return;
    if (n >= 8) push(M, { type: 'ring', x, y, dur: 0.32, r0: size * 1.2, r1: size * 6 + n * 2, color: typeof color === 'string' ? color : '#fff', w: 4 });
    if (n >= 5 && q() >= 2) for (let i = 0; i < Math.min(6, n >> 1); i++) { const a = Math.random() * 6.283, s = spd * (0.8 + Math.random()); push(M, { type: 'spark', x, y, vx: Math.cos(a) * s * 1.4, vy: Math.sin(a) * s * 1.4, dur: 0.22 + Math.random() * 0.15, r0: 2, color: '#fff7c8', drag: 4 }); }
  };

  /* ---------- rendu des nouvelles particules (appelé avant le rendu standard) ---------- */
  function drawExtra(c, M) {
    for (const p of M.parts) {
      const k = p.t / p.dur;
      if (p.type === 'ring') { c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = p.color; c.lineWidth = (p.w || 5) * (1 - k * 0.6); c.beginPath(); c.arc(p.x, p.y, Math.max(1, p.r0 + (p.r1 - p.r0) * (1 - (1 - k) * (1 - k))), 0, 6.283); c.stroke(); }
      else if (p.type === 'dust') { c.globalAlpha = (1 - k) * 0.6; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.r0 * (1 + k * 1.6), 0, 6.283); c.fill(); }
      else if (p.type === 'soul') { const r = p.r0 * (1 - k * 0.3); c.globalAlpha = (1 - k) * 0.8; const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, r * 2); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 2, 0, 6.283); c.fill(); }
      else if (p.type === 'pillar') { const h = 220 * (1 - k * 0.2), w = p.r0 * (1 - k); c.globalAlpha = (1 - k) * 0.7; const g = c.createLinearGradient(0, p.y - h, 0, p.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, p.color); c.fillStyle = g; c.fillRect(p.x - w / 2, p.y - h, w, h); }
    }
    c.globalAlpha = 1;
  }
  const EXTRA = { ring: 1, dust: 1, soul: 1, pillar: 1 };

  /* ---------- éclairage dynamique (multiplication d'une carte de lumière) ---------- */
  let LC = null, lx = null;
  function lighting(c, M, tf) {
    const cw = c.canvas.width, ch = c.canvas.height, k = q() >= 2 ? 0.5 : 0.33, w = Math.max(64, Math.round(cw * k)), h = Math.max(36, Math.round(ch * k));
    if (!LC) { LC = document.createElement('canvas'); lx = LC.getContext('2d'); }
    if (LC.width !== w || LC.height !== h) { LC.width = w; LC.height = h; }
    const th = (M.map && M.map.theme) || 'meadow', a = AMB[th] || AMB.meadow, sx = w / cw;
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')'; lx.fillRect(0, 0, w, h);
    lx.globalCompositeOperation = 'lighter';
    const P = (x, y) => [(tf.a * x + tf.c * y + tf.e) * sx, (tf.b * x + tf.d * y + tf.f) * sx], S = Math.hypot(tf.a, tf.b) * sx;
    const light = (x, y, r, col, i) => { const [X, Y] = P(x, y), R0 = r * S; if (X < -R0 || Y < -R0 || X > w + R0 || Y > h + R0) return; const g = lx.createRadialGradient(X, Y, 0, X, Y, R0); g.addColorStop(0, col.replace('A', i)); g.addColorStop(1, col.replace('A', 0)); lx.fillStyle = g; lx.fillRect(X - R0, Y - R0, R0 * 2, R0 * 2); };
    for (const b of M.ents) if (b && b.alive && !(b.hidden && b !== M.player)) light(b.x, b.y - 10, b === M.player ? 210 : 150, b.team === 0 ? 'rgba(170,210,255,A)' : b.team === 1 ? 'rgba(255,180,170,A)' : 'rgba(255,230,170,A)', b === M.player ? 0.55 : 0.38);
    for (const p of M.projs) light(p.x, p.y - (p.z || 0), (p.r || 6) * 9, 'rgba(255,230,180,A)', 0.55);
    for (const p of M.parts) { if (p.type === 'fire' || p.type === 'flash') light(p.x, p.y, (p.r0 || 10) * 4, 'rgba(255,200,120,A)', 0.6 * (1 - p.t / p.dur)); else if (p.type === 'ring' || p.type === 'soul') light(p.x, p.y, 120, 'rgba(255,255,255,A)', 0.35 * (1 - p.t / p.dur)); }
    for (const it of M.items || []) light(it.x, it.y, 70, it.type === 'gem' ? 'rgba(220,160,255,A)' : 'rgba(160,255,200,A)', 0.4);
    if (M.mine) light(M.mine.x, M.mine.y, 160, 'rgba(210,150,255,A)', 0.35);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply'; c.imageSmoothingEnabled = true; c.drawImage(LC, 0, 0, cw, ch); c.restore();
  }

  /* ---------- branchement dans le rendu existant ---------- */
  const baseDraw = R.drawMatch;
  let lastT = 0;
  R.drawMatch = function (c, M, W, H, time) {
    const now = performance.now(), dt = Math.min(0.1, (now - (lastT || now)) / 1000); lastT = now;
    if (q() >= 1 && M && M.ents) { try { scan(M, dt); } catch (e) { /* ignorer */ } }
    return baseDraw.apply(this, arguments);
  };
  // les nouvelles particules sont dessinées par-dessus les standard (dans l'espace du monde), puis l'éclairage
  R.vfxHook = function (c, M) {
    if (q() < 1) return;
    try { drawExtra(c, M); } catch (e) { /* ignorer */ }
    if (G.Save.data.settings.lighting === false) return;
    try { lighting(c, M, c.getTransform()); } catch (e) { /* ignorer */ }
  };
  R.vfxSkip = (p) => !!EXTRA[p.type]; // le rendu standard ignore ces types
  G.VFX = { scan, lighting };
})();
