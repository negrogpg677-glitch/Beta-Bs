/* Brawl Rush - rendu des personnages v2 : volume (dégradés + lumière de contour), squelette animé
   (jambes, bras, tête), animations par état : attente, course, attaque, dégâts, mort, victoire, défaite. */
(function () {
  const G = window.G, R = G.Render, H = R._h;
  const { HATS, WEAPONS, fillStroke, circ, ell, rrect, poly, OUT } = H;
  const TAU = Math.PI * 2;
  const clamp = G.clamp;

  /* personnalité de chaque brawler : tenue, carrure, style d'animation */
  const EXTRA = {
    sherry: { outfit: 'vest', bulk: 1, tempo: 1.0, bounce: 1.0 },
    rex: { outfit: 'poncho', bulk: 1, tempo: 1.1, bounce: 0.9, sway: 0.5 },
    taurus: { outfit: 'armor', bulk: 1.3, tempo: 0.75, bounce: 1.3, heavy: 1 },
    boomer: { outfit: 'backpack', bulk: 1.05, tempo: 0.9, bounce: 0.9 },
    luna: { outfit: 'dress', bulk: 0.92, tempo: 1.0, bounce: 0.8, sway: 1.4 },
    spiky: { outfit: 'thorns', bulk: 1.02, tempo: 1.2, bounce: 1.2 },
    corbeau: { outfit: 'strap', bulk: 0.94, tempo: 1.5, bounce: 1.3, cape: 1 },
    frost: { outfit: 'robe', bulk: 1, tempo: 0.8, bounce: 0.5, hover: 1, cape: 1, sway: 1 },
    pyro: { outfit: 'flame', bulk: 1.05, tempo: 1.3, bounce: 1.5 },
    volt: { outfit: 'bolt', bulk: 0.98, tempo: 1.4, bounce: 1.1, jitter: 1 },
    robot: { outfit: 'plate', bulk: 1.15, tempo: 0.7, bounce: 0.6, heavy: 1 },
    maree: { outfit: 'dress', bulk: 0.95, tempo: 1.0, bounce: 0.8, sway: 1.2 },
    nimbus: { outfit: 'dress', bulk: 1.05, tempo: 0.9, bounce: 0.6, hover: 1, sway: 0.8 },
    grimm: { outfit: 'robe', bulk: 0.95, tempo: 1.3, bounce: 1.2, cape: 1 },
    tictac: { outfit: 'plate', bulk: 1.05, tempo: 1.6, bounce: 1.4, jitter: 1 },
    zen: { outfit: 'robe', bulk: 1.05, tempo: 0.7, bounce: 0.5, hover: 1 },
    scarab: { outfit: 'strap', bulk: 0.95, tempo: 1.1, bounce: 1.0, cape: 1 },
    bumper: { outfit: 'armor', bulk: 1.2, tempo: 1.0, bounce: 1.5 },
    jongleur: { outfit: 'vest', bulk: 0.98, tempo: 1.5, bounce: 1.6 },
    yeti: { outfit: 'thorns', bulk: 1.35, tempo: 0.7, bounce: 1.2, heavy: 1 },
  };
  const furTuft = (c, x, y, r, col) => { c.fillStyle = col; for (let i = 0; i < 5; i++) { const a = -2.6 + i * 0.55; poly(c, [x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a + 0.2) * (r + 7), y + Math.sin(a + 0.2) * (r + 7), x + Math.cos(a + 0.4) * r, y + Math.sin(a + 0.4) * r]); c.fill(); } };
  Object.assign(HATS, {
    tide(c, L) { c.beginPath(); c.arc(0, -2, 15.4, Math.PI * 1.0, Math.PI * 2.0); c.quadraticCurveTo(8, -8, -2, -9); c.quadraticCurveTo(-10, -9, -15, -2); c.closePath(); fillStroke(c, L.hair); for (const s2 of [-1, 1]) { poly(c, [s2 * 13, -4, s2 * 22, -16, s2 * 15, -13]); fillStroke(c, L.hair, 2); } poly(c, [-3, -12, 0, -24, 4, -12]); fillStroke(c, L.hair, 2); rrect(c, -13, -6, 26, 7, 3.5); fillStroke(c, 'rgba(160,240,255,0.55)', 2); },
    cloud(c, L) { for (const [x, y, r] of [[-9, -15, 8], [0, -19, 9], [9, -15, 8], [-5, -11, 7], [5, -11, 7]]) { circ(c, x, y, r); fillStroke(c, '#eef2ff', 2); } for (const [x, y] of [[-8, -15], [2, -19], [8, -14]]) { circ(c, x, y, 2); c.fillStyle = 'rgba(160,180,230,0.5)'; c.fill(); } poly(c, [3, -3, -2, 2, 2, 2, -1, 8]); c.fillStyle = '#ffe14a'; c.fill(); },
    reaper(c, L) { c.beginPath(); c.moveTo(-17, 9); c.quadraticCurveTo(-20, -15, 0, -27); c.quadraticCurveTo(20, -15, 17, 9); c.quadraticCurveTo(0, -4, -17, 9); c.closePath(); fillStroke(c, L.body); ell(c, 0, 1, 11, 9.5, 0); c.fillStyle = L.body2; c.fill(); circ(c, 0, -17, 5); fillStroke(c, '#f4f0ff', 1.6); c.fillStyle = OUT; c.fillRect(-2.6, -18.4, 1.8, 2); c.fillRect(0.8, -18.4, 1.8, 2); },
    clock(c, L) { circ(c, 0, -20, 11); fillStroke(c, '#ffe9a8'); circ(c, 0, -20, 8.5); fillStroke(c, '#fffdf0', 1.5); c.strokeStyle = OUT; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -26); c.moveTo(0, -20); c.lineTo(5, -18); c.stroke(); for (let i = 0; i < 8; i++) { const a = i * 0.785; circ(c, Math.cos(a) * 15, -2 + Math.sin(a) * 4 - 6, 0); } rrect(c, -15, -6, 30, 5, 2.5); fillStroke(c, '#7a4a12', 2); for (const s2 of [-1, 1]) { circ(c, s2 * 12, -2, 4.5); fillStroke(c, '#d9a24a', 1.8); } },
    monk(c, L) { circ(c, 0, -23, 5.5); fillStroke(c, L.hair, 2); rrect(c, -3, -19, 6, 5, 2); fillStroke(c, L.accent, 1.5); c.beginPath(); c.arc(0, -2, 15.2, Math.PI * 1.15, Math.PI * 1.85); c.quadraticCurveTo(0, -14, -14, -4); c.closePath(); fillStroke(c, L.hair); c.strokeStyle = L.accent; c.lineWidth = 2; for (let i = 0; i < 6; i++) { circ(c, -9 + i * 3.6, 12 + Math.sin(i) * 0.5, 1.6); c.fillStyle = '#c9742a'; c.fill(); } },
    scarab(c, L) { c.beginPath(); c.arc(0, -3, 16, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(14, -2); c.lineTo(-14, -2); c.closePath(); fillStroke(c, '#2a8a74'); c.strokeStyle = L.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -19); c.lineTo(0, -3); c.stroke(); for (const s2 of [-1, 1]) { poly(c, [s2 * 4, -18, s2 * 10, -30, s2 * 7, -17]); fillStroke(c, L.accent, 1.8); } rrect(c, -12, -9, 24, 6, 3); fillStroke(c, 'rgba(255,210,31,0.6)', 2); },
    bumper(c, L) { c.beginPath(); c.arc(0, -3, 16, Math.PI, Math.PI * 2); c.lineTo(15, -2); c.lineTo(-15, -2); c.closePath(); fillStroke(c, '#f4f4fa'); c.fillStyle = L.body; c.fillRect(-15, -9, 30, 4); c.fillStyle = L.accent; for (let i = -2; i <= 2; i++) { circ(c, i * 6, -14 + Math.abs(i), 1.8); c.fill(); } },
    jester(c, L) { for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(s2 * 4, -9); c.quadraticCurveTo(s2 * 22, -16, s2 * 24, -30); c.quadraticCurveTo(s2 * 14, -20, s2 * 2, -13); c.closePath(); fillStroke(c, s2 < 0 ? L.hair : L.accent); circ(c, s2 * 24, -30, 3.6 + Math.sin(performance.now() / 150) * 0.4); fillStroke(c, '#ffd21f', 1.5); } rrect(c, -15, -8, 30, 6, 3); fillStroke(c, L.body, 2); },
    yeti(c, L) { c.beginPath(); c.arc(0, -3, 17, Math.PI * 1.0, Math.PI * 2.0); c.lineTo(15, -1); c.lineTo(10, -7); c.lineTo(-10, -7); c.lineTo(-15, -1); c.closePath(); fillStroke(c, '#f4f9ff'); furTuft(c, 0, -14, 12, '#ffffff'); for (const s2 of [-1, 1]) { poly(c, [s2 * 11, -10, s2 * 20, -22, s2 * 15, -9]); fillStroke(c, '#e8fbff', 2); poly(c, [s2 * 15, 2, s2 * 19, 12, s2 * 12, 8]); fillStroke(c, '#f4f9ff', 1.6); } },
  });
  Object.assign(WEAPONS, {
    scythe(c, L) { rrect(c, -8, -2.5, 40, 5, 2.5); fillStroke(c, '#5a3a1e', 2); c.beginPath(); c.moveTo(30, -3); c.quadraticCurveTo(50, -8, 52, -26); c.quadraticCurveTo(40, -16, 26, -10); c.closePath(); fillStroke(c, '#dfe6f4', 2); },
    sniper(c, L) { rrect(c, -8, -4, 22, 8, 3); fillStroke(c, '#6b4a2a'); rrect(c, 10, -3, 40, 6, 3); fillStroke(c, '#4d5662'); rrect(c, 4, -9, 14, 5, 2); fillStroke(c, '#222', 1.6); circ(c, 11, -6.5, 1.6); c.fillStyle = L.accent; c.fill(); rrect(c, 46, -4, 7, 8, 2); fillStroke(c, L.accent, 1.6); },
  });

  HATS.robot = function (c, L, o) {
    rrect(c, -15, -14, 30, 20, 6); fillStroke(c, '#7d8aa6');
    rrect(c, -12, -8, 24, 8, 3); fillStroke(c, '#ff4a55', 2);
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-9, -6, 6, 2);
    c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -14); c.lineTo(0, -26); c.stroke();
    circ(c, 0, -27, 4); fillStroke(c, '#ffd21f', 2);
  };

  /* ----- tenues (dessinées sur le torse) ----- */
  const OUTFITS = {
    vest(c, L) { poly(c, [-9, -9, 0, 2, 9, -9, 9, 13, -9, 13]); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fill(); c.fillStyle = L.accent; c.fillRect(-1.2, -2, 2.4, 15); },
    poncho(c, L) { c.beginPath(); c.moveTo(-17, -6); c.lineTo(17, -6); c.lineTo(13, 14); c.lineTo(0, 9); c.lineTo(-13, 14); c.closePath(); c.fillStyle = G.shade(L.accent, -0.15); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); c.fillStyle = L.body2; for (let i = -2; i <= 2; i++) c.fillRect(i * 6 - 1.5, 4, 3, 7); },
    armor(c, L) { for (const s of [-1, 1]) { ell(c, s * 15, -6, 8, 6, 0); fillStroke(c, L.accent, 2); } rrect(c, -9, -4, 18, 14, 5); fillStroke(c, 'rgba(240,230,200,0.85)', 2); c.fillStyle = L.body2; circ(c, 0, 3, 3); c.fill(); },
    backpack(c, L) { rrect(c, -16, -6, 6, 14, 3); fillStroke(c, '#7a5a2a', 2); rrect(c, 10, -6, 6, 14, 3); fillStroke(c, '#7a5a2a', 2); rrect(c, -8, -2, 16, 6, 2); fillStroke(c, L.accent, 1.5); },
    dress(c, L) { c.beginPath(); c.moveTo(-12, 4); c.lineTo(12, 4); c.lineTo(17, 15); c.lineTo(-17, 15); c.closePath(); c.fillStyle = G.shade(L.body, 0.15); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); c.fillStyle = L.accent; for (let i = -2; i <= 2; i++) circ(c, i * 6, 12, 1.6), c.fill(); },
    thorns(c, L) { for (let i = -2; i <= 2; i++) poly(c, [i * 6 - 2, -7, i * 6, -13, i * 6 + 2, -7]), fillStroke(c, '#d9ff7a', 1.2); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(-12, 3, 24, 3); },
    strap(c, L) { c.strokeStyle = L.accent; c.lineWidth = 3.5; c.beginPath(); c.moveTo(-12, -7); c.lineTo(11, 12); c.stroke(); for (const s of [-1, 1]) { rrect(c, s * 5 - 2, 4, 4, 6, 1); fillStroke(c, '#c9a36a', 1.2); } },
    robe(c, L) { c.beginPath(); c.moveTo(-13, 2); c.lineTo(13, 2); c.lineTo(18, 15); c.lineTo(-18, 15); c.closePath(); c.fillStyle = G.shade(L.body, 0.12); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); c.strokeStyle = L.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 11); c.lineTo(14, 11); c.stroke(); circ(c, 0, 4, 2.6); c.fillStyle = L.accent; c.fill(); },
    flame(c, L) { c.fillStyle = '#ffd21f'; poly(c, [-10, 13, -6, 3, -2, 9, 2, 0, 6, 9, 10, 13]); c.fill(); c.fillStyle = '#ff5a1a'; poly(c, [-6, 13, -3, 7, 0, 10, 3, 6, 6, 13]); c.fill(); },
    bolt(c, L) { poly(c, [2, -8, -6, 3, 0, 3, -3, 12, 7, 0, 1, 0]); fillStroke(c, L.accent, 1.5); },
    plate(c, L) { rrect(c, -11, -6, 22, 16, 4); fillStroke(c, '#8d9ab4', 2); circ(c, 0, 2, 4); fillStroke(c, '#ff4a55', 1.5); for (const s of [-1, 1]) { circ(c, s * 8, -3, 1.4); c.fillStyle = '#333'; c.fill(); } },
  };

  const TWO_HAND = { shotgun: 1, bigshotgun: 1, rocketlauncher: 1, staff: 1, tesla: 1, cactusgun: 1 };

  R.drawChar = function (c, id, skinId, o) {
    const def = G.BRAWLER[id], X = EXTRA[id] || {};
    const skd = G.SKIN[skinId] || {}, fxk = skd.fx;
    const L = fxk === 'rainbow' ? G.getLook(id, skinId, Math.floor((o.t || 0) * 1.6) % 12) : G.getLook(id, skinId);
    const q = R.q === undefined ? 2 : R.q;
    const sc = o.sc || 1, aim = o.aim || 0, t = o.t || 0, tempo = X.tempo || 1;
    const bulk = X.bulk || 1;
    const dying = o.deathT !== undefined && o.deathT >= 0;
    const k = dying ? clamp(o.deathT / 0.75, 0, 1) : 0;
    const pose = o.pose || null;
    c.save();
    c.translate(o.x, o.y - (o.z || 0));
    c.scale(sc, sc);
    let al = o.alpha !== undefined ? o.alpha : 1;
    if (fxk === 'ghost') al *= 0.78;
    if (dying) al *= 1 - k * k;
    if (al < 1) c.globalAlpha = al;

    /* ombre au sol : douce, avec un décalage de lumière (soleil en haut à gauche) */
    if (o.shadow !== false) {
      const zf = 1 - Math.min(0.55, (o.z || 0) / 170);
      c.save(); c.translate((o.z || 0) * 0.25 / sc * sc, (o.z || 0) / sc + 13);
      c.scale(1, 0.36);
      const sg = c.createRadialGradient(5, 0, 2, 5, 0, 27 * bulk);
      sg.addColorStop(0, 'rgba(0,0,0,' + 0.42 * zf * al + ')'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(5, 0, 27 * bulk, 0, TAU); c.fill(); c.restore();
    }

    /* effets des skins légendaires (derrière le personnage) */
    if (fxk && q > 0 && !dying) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const col = fxk === 'inferno' ? '255,120,30' : fxk === 'crystal' ? '150,230,255' : fxk === 'ghost' ? '160,190,255' : '255,255,255';
      const fg = c.createRadialGradient(0, -4, 6, 0, -4, 38); fg.addColorStop(0, 'rgba(' + col + ',' + (0.3 + 0.12 * Math.sin(t * 5)) + ')'); fg.addColorStop(1, 'rgba(' + col + ',0)');
      c.fillStyle = fg; c.beginPath(); c.arc(0, -4, 38, 0, TAU); c.fill();
      if (fxk === 'inferno') for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 2, fy = -8 - ((t * 38 + i * 13) % 34), fx2 = Math.sin(a) * 12; circ(c, fx2, fy, 4 - (((t * 38 + i * 13) % 34) / 34) * 3); c.fillStyle = 'rgba(255,' + (150 + i * 12) + ',40,0.7)'; c.fill(); }
      if (fxk === 'ghost') for (let i = 1; i <= 3; i++) { c.globalAlpha = 0.22 / i; ell(c, -((o.lean || 0) * i * 6), 14 + i * 3, 14 - i * 2, 5, 0); c.fillStyle = '#9fb8ff'; c.fill(); }
      c.restore();
    }
    /* aura de super prêt (additif) */
    if (o.superReady && q > 0 && !dying) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const pa = 0.35 + 0.2 * Math.sin(t * 7);
      const ag = c.createRadialGradient(0, -2, 8, 0, -2, 40); ag.addColorStop(0, 'rgba(255,220,80,' + pa + ')'); ag.addColorStop(1, 'rgba(255,160,0,0)');
      c.fillStyle = ag; c.beginPath(); c.arc(0, -2, 40, 0, TAU); c.fill(); c.restore();
    }

    /* ----- paramètres de pose ----- */
    const moving = !!o.moving && !dying && !pose;
    const walk = o.walk || 0;
    const wp = walk * (0.9 + 0.1 * tempo);
    const bob = moving ? Math.abs(Math.sin(wp)) * 3.4 * (X.bounce || 1) : Math.sin(t * 2.3 * tempo) * 1.1 + (X.hover ? -3 + Math.sin(t * 2) * 1.6 : 0);
    const breathe = moving ? 1 : 1 + Math.sin(t * 2.3 * tempo) * 0.022;
    const lean = moving ? clamp((o.lean || 0) * 0.1 + Math.sin(wp) * 0.035, -0.22, 0.22) : Math.sin(t * 1.1) * 0.012 * (X.sway || 0);
    const rec = o.recoil || 0;
    const hurt = (o.flash || 0) > 0 ? Math.min(1, o.flash * 8) : 0;
    let jump = 0, armsUp = 0, slump = 0;
    let winRot = 0, winDX = 0, winSX = 1, flex = 0;
    if (pose === 'win') {
      const wv = L.win || 'jump', ph = t * 6 + (o.seed || 0);
      if (wv === 'jump') { jump = Math.abs(Math.sin(ph)) * 12; armsUp = 1; }
      else if (wv === 'flex') { flex = 1; jump = Math.abs(Math.sin(ph * 0.7)) * 3; winSX = 1 + Math.sin(ph * 1.4) * 0.05; }
      else if (wv === 'dance') { winDX = Math.sin(ph * 1.3) * 5; winRot = Math.sin(ph * 1.3) * 0.16; jump = Math.abs(Math.sin(ph * 1.3)) * 4; armsUp = Math.sin(ph * 2.6) > 0 ? 1 : 0; }
      else if (wv === 'spin') { jump = Math.abs(Math.sin(ph * 0.8)) * 14; winSX = Math.cos(ph * 1.6); if (Math.abs(winSX) < 0.15) winSX = 0.15; armsUp = 1; }
      else if (wv === 'bow') { winRot = 0.35 * Math.max(0, Math.sin(ph * 0.5)); flex = 2; }
      else if (wv === 'flip') { const f = (ph * 0.45) % 6.283; jump = Math.sin(Math.min(f, 3.14)) * 30; winRot = f < 3.14 ? -f * 2 : 0; armsUp = 1; }
    }
    if (pose === 'lose') { slump = 1; }
    const jit = X.jitter ? (Math.random() - 0.5) * 1.2 : 0;

    c.translate(jit + winDX, -bob - jump + (slump ? 3 : 0));
    if (winRot) { c.translate(0, 8); c.rotate(winRot); c.translate(0, -8); }
    if (winSX !== 1) c.scale(winSX, 1);
    if (dying) { c.translate(0, 12); c.rotate(-k * 1.35 * (Math.cos(o.deathAng || 0) >= 0 ? 1 : -1)); c.translate(0, -12 + k * 4); }
    c.rotate(lean + hurt * 0.12 * (Math.cos(aim) >= 0 ? -1 : 1) + (slump ? 0.04 : 0));
    const sq = 1 + rec * 0.05 + hurt * 0.04 * (X.heavy ? 0.4 : 1);
    c.scale((1 / sq) * (1 + (X.heavy && moving ? Math.abs(Math.sin(wp)) * 0.02 : 0)), sq * breathe);

    const dx = Math.cos(aim), dy = Math.sin(aim);
    const behind = dy < -0.35;

    /* cape / pan arrière */
    if (X.cape) {
      const sw = Math.sin(t * 3 * tempo + wp) * 2.5 + (moving ? -Math.cos(aim) * 4 : 0) - lean * 30;
      c.beginPath(); c.moveTo(-12 * bulk, -6); c.lineTo(12 * bulk, -6); c.quadraticCurveTo(16 * bulk + sw, 12, 10 * bulk + sw * 1.4, 19 + Math.abs(sw) * 0.3); c.lineTo(-10 * bulk + sw * 1.4, 19 + Math.abs(sw) * 0.3); c.quadraticCurveTo(-16 * bulk + sw, 12, -12 * bulk, -6); c.closePath();
      const cg = c.createLinearGradient(0, -6, 0, 20); cg.addColorStop(0, L.body2); cg.addColorStop(1, G.shade(L.body2, -0.35)); fillStroke(c, cg);
    }

    /* jambes */
    for (const s of [-1, 1]) {
      const ph = wp + (s > 0 ? Math.PI : 0);
      const lift = moving ? Math.max(0, Math.sin(ph)) * 5.5 : 0, sw2 = moving ? Math.cos(ph) * 3.2 : s * 0.4;
      const hx = s * 6.5 * bulk, fx = s * 7.5 * bulk + sw2, fy = 13.5 - lift + bob * 0.3;
      c.lineCap = 'round';
      c.strokeStyle = OUT; c.lineWidth = 8.5; c.beginPath(); c.moveTo(hx, 5); c.lineTo(fx, fy - 3); c.stroke();
      c.strokeStyle = G.shade(L.body2, -0.1); c.lineWidth = 5.5; c.beginPath(); c.moveTo(hx, 5); c.lineTo(fx, fy - 3); c.stroke();
      ell(c, fx + 0.5, fy, 7 * (0.9 + bulk * 0.1), 4.4, 0); const bg = c.createLinearGradient(0, fy - 4, 0, fy + 4); bg.addColorStop(0, G.shade(L.body2, 0.1)); bg.addColorStop(1, G.shade(L.body2, -0.5)); fillStroke(c, bg, 2.2);
    }

    const drawWeapon = () => {
      const W = WEAPONS[L.weapon]; if (!W) return;
      c.save(); c.translate(dx * 3, -2 + dy * 2); c.rotate(aim);
      if (dx < 0) c.scale(1, -1);
      const rc = rec * 9; c.translate(15 - rc, 2 - (dx < 0 ? 4 : 0));
      if (pose === 'win') c.rotate(-0.5 * (dx < 0 ? -1 : 1));
      if (slump) c.rotate(0.6 * (dx < 0 ? -1 : 1));
      W(c, L);
      c.restore();
    };
    const gx = dx * 17 - dx * rec * 7, gy = -1 + dy * 11 - dy * rec * 5; // position de la main d'arme
    const arm = (sx, sy, hx, hy, w) => {
      const mx = (sx + hx) / 2 + (hy - sy) * 0.12, my = (sy + hy) / 2 - (hx - sx) * 0.12;
      c.lineCap = 'round';
      c.strokeStyle = OUT; c.lineWidth = w + 3.2; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, hx, hy); c.stroke();
      c.strokeStyle = L.body; c.lineWidth = w; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, hx, hy); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = w * 0.3; c.beginPath(); c.moveTo(sx - 1, sy - 1.5); c.quadraticCurveTo(mx - 1, my - 1.5, hx - 1, hy - 1.5); c.stroke();
      circ(c, hx, hy, 5.2); fillStroke(c, L.skin, 2);
    };
    if (behind) drawWeapon();

    /* torse */
    const bw = 14 * bulk;
    c.beginPath(); c.moveTo(-bw, -7); c.quadraticCurveTo(-bw - 3, 7, -bw + 1, 14); c.lineTo(bw - 1, 14); c.quadraticCurveTo(bw + 3, 7, bw, -7); c.quadraticCurveTo(0, -12.5, -bw, -7); c.closePath();
    const tg = c.createLinearGradient(-bw, -8, bw, 14); tg.addColorStop(0, G.shade(L.body, 0.28)); tg.addColorStop(0.45, L.body); tg.addColorStop(1, L.body2);
    fillStroke(c, tg, 2.8);
    c.save(); c.clip();
    if (q > 0) { // lumière de contour + ombre portée du menton
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-bw + 1.5, -5); c.quadraticCurveTo(-bw - 1, 6, -bw + 2.5, 13); c.stroke();
      const sh = c.createLinearGradient(0, -10, 0, -2); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(-bw, -10, bw * 2, 9);
    }
    c.fillStyle = L.accent; c.fillRect(-bw, 6.5, bw * 2, 2.8); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-bw, 9.3, bw * 2, 1);
    if (OUTFITS[X.outfit]) OUTFITS[X.outfit](c, L);
    c.restore();
    circ(c, 0, 8, 2.1); c.fillStyle = '#ffe9a8'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.2; c.stroke();

    /* bras */
    const side = dx >= 0 ? 1 : -1; // le bras d'arme est du côté de la visée
    const wsx = side * (bw + 0.5), osx = -side * (bw + 0.5);
    if (flex === 1) { arm(wsx, -4, wsx + side * 11, -13 + Math.sin(t * 5) * 1.5, 8.5); arm(osx, -4, osx - side * 11, -13 + Math.cos(t * 5) * 1.5, 8.5); }
    else if (flex === 2) { arm(wsx, -4, side * 6, 6, 7.5); arm(osx, -4, -side * 6, 6, 7.5); }
    else if (armsUp) { arm(wsx, -4, wsx + side * 5, -24 + Math.sin(t * 12) * 3, 7.5); arm(osx, -4, osx - side * 5, -24 + Math.cos(t * 12) * 3, 7.5); }
    else if (slump) { arm(wsx, -4, wsx + side * 2, 12, 7.5); arm(osx, -4, osx - side * 2, 12, 7.5); }
    else {
      arm(wsx, -4, gx, gy + 1, 7.5);
      if (TWO_HAND[L.weapon]) arm(osx, -4, gx + dx * 14, gy + dy * 8 + 1, 7);
      else { const sw3 = moving ? Math.sin(wp + Math.PI) * 5 : Math.sin(t * 2.3) * 0.8; arm(osx, -4, osx - side * 3 + sw3 * 0.3, 8 + (moving ? Math.cos(wp) * 2 : 0), 7); }
    }
    if (!behind) drawWeapon();
    // main d'arme par-dessus l'arme
    if (!armsUp && !slump && !flex) { circ(c, gx, gy + 1, 5.2); fillStroke(c, L.skin, 2); }

    /* tête */
    const tilt = pose === 'lose' ? 0.18 : hurt * -0.12 * side + Math.sin(t * 1.6) * 0.015 + (moving ? Math.sin(wp) * 0.03 : 0);
    const hdy = -17 + (slump ? 2.5 : 0) + (rec > 0.4 ? 0.8 : 0);
    c.save(); c.translate(0, hdy); c.rotate(tilt);
    // oreilles
    for (const s of [-1, 1]) { circ(c, s * 14.3, 2, 3.4); fillStroke(c, L.skin, 2); }
    const hgrad = c.createRadialGradient(-5, -6, 2, 0, 0, 17); hgrad.addColorStop(0, G.shade(L.hat === 'cactus' ? '#8be07f' : L.skin, 0.3)); hgrad.addColorStop(0.55, L.hat === 'cactus' ? '#6fd16a' : L.skin); hgrad.addColorStop(1, G.shade(L.hat === 'cactus' ? '#6fd16a' : L.skin, -0.28));
    circ(c, 0, 0, 15.2); fillStroke(c, hgrad, 2.8);
    if (L.hat === 'hood' || L.hat === 'reaper') HATS[L.hat](c, L, o);
    // yeux
    const blink = ((t * 0.6 + (o.seed || 0)) % 3.4) < 0.11 && !hurt;
    const lx = dx * 2.4, ly = dy * 2.1 + (slump ? 1.5 : 0);
    const dead = hurt > 0.5 || dying;
    for (const s of [-1, 1]) {
      const ex = s * 5.8, ey = 1.2;
      if (dead) { c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.moveTo(ex - 3, ey - 3); c.lineTo(ex + 3, ey + 3); c.moveTo(ex + 3, ey - 3); c.lineTo(ex - 3, ey + 3); c.stroke(); }
      else if (blink) { c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.moveTo(ex - 3.6, ey + 1); c.quadraticCurveTo(ex, ey + 3, ex + 3.6, ey + 1); c.stroke(); }
      else {
        ell(c, ex, ey, 4.5, 5.5, 0); fillStroke(c, '#fff', 1.8);
        circ(c, ex + lx, ey + ly, 2.7); c.fillStyle = L.hat === 'hood' ? '#c58bff' : G.shade(L.accent, -0.55); c.fill();
        circ(c, ex + lx, ey + ly, 1.5); c.fillStyle = '#0c0a1a'; c.fill();
        circ(c, ex + lx - 0.9, ey + ly - 1.1, 0.95); c.fillStyle = '#fff'; c.fill();
      }
    }
    // sourcils
    c.strokeStyle = OUT; c.lineWidth = 2.3; c.lineCap = 'round';
    if (!dead) {
      const ang = o.angry || rec > 0.15 ? 2.6 : pose === 'win' ? -1.5 : pose === 'lose' ? -2.2 : 0;
      c.beginPath(); c.moveTo(-9.5, -5.6 - (ang < 0 ? 0.5 : 0)); c.lineTo(-3, -5.8 + ang); c.moveTo(9.5, -5.6 - (ang < 0 ? 0.5 : 0)); c.lineTo(3, -5.8 + ang); c.stroke();
    }
    // bouche
    if (dead || rec > 0.35) { ell(c, 0, 9, 3.4, rec > 0.35 && !dead ? 3.2 : 2.6, 0); c.fillStyle = '#5a1620'; c.fill(); c.lineWidth = 1.8; c.stroke(); ell(c, 0, 10.2, 1.8, 1, 0); c.fillStyle = '#ff7a8a'; c.fill(); }
    else if (pose === 'win') { c.beginPath(); c.arc(0, 6, 5.5, 0.05, Math.PI - 0.05); c.closePath(); c.fillStyle = '#5a1620'; c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(-3.5, 6.2, 7, 1.8); }
    else if (pose === 'lose') { c.beginPath(); c.arc(0, 11, 4, Math.PI + 0.3, -0.3); c.stroke(); }
    else if (o.happy || o.angry) { c.beginPath(); c.arc(0, 6.6, 4.8, 0.1, Math.PI - 0.1); c.stroke(); }
    else { c.beginPath(); c.arc(0, 6.8, 3.4, 0.2, Math.PI - 0.2); c.stroke(); }
    // nez + joues
    circ(c, 0, 3.8, 1.4); c.fillStyle = 'rgba(160,80,60,0.45)'; c.fill();
    c.fillStyle = 'rgba(255,90,120,0.3)'; circ(c, -9.3, 6, 2.8); c.fill(); circ(c, 9.3, 6, 2.8); c.fill();
    if (L.hat !== 'hood' && L.hat !== 'reaper' && HATS[L.hat]) HATS[L.hat](c, L, o);
    c.restore();

    if (fxk === 'crystal' && q > 0 && !dying) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const ph2 = (t * 1.3 + i * 0.37) % 1, gx2 = Math.sin(i * 7.1) * 13, gy2 = -22 + Math.cos(i * 3.3) * 18, sz = Math.sin(ph2 * Math.PI) * 4.5; c.fillStyle = 'rgba(210,250,255,' + Math.sin(ph2 * Math.PI) + ')'; poly(c, [gx2, gy2 - sz, gx2 + sz * 0.25, gy2 - sz * 0.25, gx2 + sz, gy2, gx2 + sz * 0.25, gy2 + sz * 0.25, gx2, gy2 + sz, gx2 - sz * 0.25, gy2 + sz * 0.25, gx2 - sz, gy2, gx2 - sz * 0.25, gy2 - sz * 0.25]); c.fill(); } c.restore(); }
    /* flash de dégâts (blanc) */
    if (hurt > 0) { c.globalAlpha = Math.min(0.55, hurt * 0.55) * al; c.fillStyle = '#fff'; circ(c, 0, -17, 15.5); c.fill(); rrect(c, -14 * bulk, -8, 28 * bulk, 22, 7); c.fill(); c.globalAlpha = al; }
    c.restore();
    if (o.frozen) { c.save(); c.translate(o.x, o.y); c.scale(sc, sc); rrect(c, -22, -42, 44, 58, 10); const ig = c.createLinearGradient(-22, -42, 22, 16); ig.addColorStop(0, 'rgba(210,245,255,0.75)'); ig.addColorStop(1, 'rgba(120,200,240,0.5)'); c.fillStyle = ig; c.fill(); c.strokeStyle = '#e8fbff'; c.lineWidth = 2; c.stroke(); c.restore(); }
  };
})();
