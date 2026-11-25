/* Brawl Rush - rendu : personnages, tuiles, effets, HUD */
(function () {
  const G = window.G;
  const T = G.T;
  const R = (G.Render = {});
  const OUT = '#1a1530';
  const TAU = Math.PI * 2;

  /* ---------- helpers de dessin ---------- */
  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  G.rrect = rrect;
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function fillStroke(c, fill, lw) { c.fillStyle = fill; c.fill(); c.lineWidth = lw || 2.5; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); }
  function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }

  /* ---------- armes (pointent vers +x depuis la main) ---------- */
  const WEAPONS = {
    shotgun(c, L) {
      rrect(c, -4, -5, 18, 10, 3); fillStroke(c, L.accent === '#ffd54a' ? '#8b5a2b' : '#8b5a2b');
      rrect(c, 10, -4, 28, 8, 3); fillStroke(c, '#5d6673');
      rrect(c, 34, -5, 8, 10, 3); fillStroke(c, '#ffd54a');
    },
    bigshotgun(c, L) {
      rrect(c, -4, -6, 16, 12, 3); fillStroke(c, '#6b4a2a');
      rrect(c, 8, -6, 26, 12, 4); fillStroke(c, '#4d5662');
      rrect(c, 30, -7, 8, 14, 3); fillStroke(c, L.accent);
    },
    revolver(c, L) {
      rrect(c, -5, -4, 12, 12, 3); fillStroke(c, '#7a4a22');
      rrect(c, 5, -4, 24, 7, 3); fillStroke(c, '#c9d1da');
      circ(c, 9, -1, 6); fillStroke(c, '#aab4bf', 2);
      rrect(c, 26, -3, 6, 5, 2); fillStroke(c, L.accent, 2);
    },
    rocketlauncher(c, L) {
      rrect(c, -10, -7, 44, 14, 6); fillStroke(c, '#5b6b3a');
      rrect(c, 30, -9, 10, 18, 4); fillStroke(c, L.accent);
      rrect(c, 2, -11, 10, 5, 2); fillStroke(c, '#333', 2);
    },
    mic(c, L) {
      rrect(c, -4, -3, 26, 6, 3); fillStroke(c, '#d6dce6');
      circ(c, 28, 0, 9); fillStroke(c, L.accent);
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(28, 0, 5, 0, TAU); c.stroke();
    },
    cactusgun(c, L) {
      rrect(c, -4, -6, 36, 12, 6); fillStroke(c, '#3aa756');
      for (let i = 0; i < 4; i++) { poly(c, [4 + i * 8, -6, 8 + i * 8, -12, 11 + i * 8, -6]); fillStroke(c, '#d9ff7a', 1.5); }
      circ(c, 32, 0, 6); fillStroke(c, L.accent);
    },
    daggers(c, L) {
      for (const o of [-6, 6]) {
        rrect(c, 0, o - 2, 8, 4, 2); fillStroke(c, '#5b3a1e', 2);
        poly(c, [8, o - 4, 30, o, 8, o + 4]); fillStroke(c, '#e5e9ef', 2);
      }
    },
    staff(c, L) {
      rrect(c, -10, -3, 44, 6, 3); fillStroke(c, '#8b5a2b');
      const g = c.createRadialGradient(38, 0, 1, 38, 0, 12); g.addColorStop(0, '#fff'); g.addColorStop(1, L.accent);
      circ(c, 38, 0, 10); fillStroke(c, g);
    },
    bomb(c, L) {
      circ(c, 12, 0, 12); fillStroke(c, '#2b2b36');
      rrect(c, 20, -9, 8, 5, 2); fillStroke(c, '#c9a36a', 1.5);
      c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.beginPath(); c.moveTo(26, -8); c.quadraticCurveTo(32, -14, 36, -10); c.stroke();
      circ(c, 37, -10, 3); c.fillStyle = '#ff6a1a'; c.fill();
      circ(c, 8, -4, 3); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
    },
    tesla(c, L) {
      rrect(c, -4, -5, 22, 10, 4); fillStroke(c, '#6b6f82');
      for (let i = 0; i < 3; i++) { ell(c, 22 + i * 6, 0, 3, 8 - i, 0); fillStroke(c, '#b8c0d4', 2); }
      circ(c, 42, 0, 5); c.fillStyle = L.accent; c.fill(); c.shadowColor = L.accent; c.shadowBlur = 10; c.fill(); c.shadowBlur = 0;
    },
  };

  /* ---------- chapeaux / coiffures (repère : centre de la tête = 0,0) ---------- */
  const HATS = {
    ponytail(c, L, o) {
      const sw = Math.sin(o.t * 5) * 3;
      c.save(); c.translate(-12, -3);
      ell(c, -4 + sw, 6, 5, 11, 0.5); fillStroke(c, L.hair, 2);
      c.restore();
      c.beginPath(); c.arc(0, -2, 15.2, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(8, -9, -4, -7); c.quadraticCurveTo(-11, -8, -15, -2); c.closePath(); fillStroke(c, L.hair);
      rrect(c, -15, -8, 30, 5, 2.5); fillStroke(c, L.accent, 2);
    },
    cowboy(c, L) {
      c.beginPath(); c.arc(0, -3, 15, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); fillStroke(c, L.hair, 2);
      ell(c, 0, -9, 25, 7, 0); fillStroke(c, '#8a5a2c');
      rrect(c, -12, -26, 24, 17, 7); fillStroke(c, '#a06a34');
      rrect(c, -12, -14, 24, 5, 1); fillStroke(c, L.accent, 1.5);
    },
    horns(c, L) {
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(s * 11, -8); c.quadraticCurveTo(s * 26, -10, s * 24, -26); c.quadraticCurveTo(s * 16, -14, s * 8, -12); c.closePath(); fillStroke(c, L.accent);
      }
      c.beginPath(); c.arc(0, -2, 15.2, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); fillStroke(c, L.hair);
      rrect(c, -14, -3, 28, 4, 2); fillStroke(c, '#222', 1.5);
      circ(c, 0, 10, 2.2); c.strokeStyle = '#ffd21f'; c.lineWidth = 2; c.stroke(); // anneau de nez
    },
    aviator(c, L) {
      c.beginPath(); c.arc(0, -1, 15.5, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(15, 3); c.lineTo(-15, 3); c.closePath(); fillStroke(c, '#7a4a22');
      for (const s of [-1, 1]) { circ(c, s * 7, -7, 6); fillStroke(c, '#ffe9a8', 2); circ(c, s * 7, -7, 3); c.fillStyle = '#4aa8ff'; c.fill(); }
      rrect(c, -14, -9, 28, 3, 1); c.fillStyle = L.accent; c.fill();
    },
    headphones(c, L) {
      for (const s of [-1, 1]) { circ(c, s * 11, -14, 7); fillStroke(c, L.hair, 2); }
      c.beginPath(); c.arc(0, -2, 15.2, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(0, -10, -15, -2); c.closePath(); fillStroke(c, L.hair);
      c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 17, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      c.strokeStyle = L.accent; c.lineWidth = 3.5; c.beginPath(); c.arc(0, 0, 17, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      for (const s of [-1, 1]) { rrect(c, s * 17 - 5, -6, 10, 15, 5); fillStroke(c, L.accent); }
    },
    cactus(c, L) {
      for (let i = -2; i <= 2; i++) { poly(c, [i * 6 - 3, -11 - Math.abs(i) * -1, i * 6, -22 + Math.abs(i) * 2, i * 6 + 3, -11]); fillStroke(c, '#2a8a3c', 2); }
      circ(c, 0, -22, 5); fillStroke(c, L.accent, 2); circ(c, 0, -22, 2); c.fillStyle = '#ffe14a'; c.fill();
      for (const s of [-1, 1]) { poly(c, [s * 14, -4, s * 22, -6, s * 15, 2]); fillStroke(c, '#d9ff7a', 1.5); }
    },
    hood(c, L) {
      c.beginPath(); c.moveTo(-17, 8); c.quadraticCurveTo(-19, -14, 0, -26); c.quadraticCurveTo(19, -14, 17, 8); c.quadraticCurveTo(0, -6, -17, 8); c.closePath(); fillStroke(c, L.body);
      ell(c, 0, 1, 11, 9, 0); c.fillStyle = L.body2; c.fill();
      poly(c, [-3, 4, 3, 4, 0, 14]); fillStroke(c, '#e8d8a8', 1.5); // bec
    },
    wizard(c, L) {
      c.beginPath(); c.moveTo(-22, -6); c.lineTo(22, -6); c.lineTo(8, -12); c.lineTo(10, -34); c.quadraticCurveTo(0, -48, -4, -38); c.lineTo(-10, -12); c.closePath(); fillStroke(c, L.body);
      ell(c, 0, -7, 23, 6, 0); fillStroke(c, L.body2);
      circ(c, 3, -25, 3); c.fillStyle = L.accent; c.fill(); circ(c, -5, -15, 2); c.fill();
      poly(c, [-12, 10, 12, 10, 8, 26, 0, 32, -8, 26]); fillStroke(c, L.hair); // barbe
    },
    mohawk(c, L) {
      for (let i = -3; i <= 3; i++) { poly(c, [i * 4 - 3, -12, i * 4, -30 + Math.abs(i) * 3 - 3 * (i === 0 ? 1 : 0), i * 4 + 3, -12]); fillStroke(c, i % 2 ? L.hair : L.accent, 2); }
      rrect(c, -15, -10, 30, 8, 4); fillStroke(c, '#333', 2);
      for (const s of [-1, 1]) { circ(c, s * 7, -6, 4.5); fillStroke(c, '#ffe56a', 1.5); }
    },
    spiky(c, L) {
      const pts = [-17, -2, -19, -22, -9, -10, -6, -30, 0, -12, 6, -30, 9, -10, 19, -22, 17, -2];
      poly(c, pts); fillStroke(c, L.hair);
      c.beginPath(); c.arc(0, -2, 15.2, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); fillStroke(c, L.hair);
      rrect(c, -13, -7, 26, 8, 4); fillStroke(c, L.accent, 2);
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-9, -5, 6, 2);
    },
  };

  /* ---------- personnage ---------- */
  /* o : {x,y,sc,aim,t,walk,moving,flash,alpha,shadow,recoil,z,dead,frozen,stun,face,hold} */
  R.drawChar = function (c, id, skinId, o) {
    const def = G.BRAWLER[id], L = G.getLook(id, skinId);
    const sc = o.sc || 1, aim = o.aim || 0;
    c.save();
    c.translate(o.x, o.y - (o.z || 0)); c.scale(sc, sc);
    if (o.alpha !== undefined && o.alpha < 1) c.globalAlpha = o.alpha;
    if (o.shadow !== false) {
      c.save(); c.translate(0, (o.z || 0) / sc); c.globalAlpha *= 0.28 * (1 - Math.min(0.5, (o.z || 0) / 160));
      ell(c, 0, 13, 20, 8, 0); c.fillStyle = '#000'; c.fill(); c.restore();
    }
    const t = o.t || 0, walk = o.walk || 0;
    const bob = o.moving ? Math.abs(Math.sin(walk)) * 3 : Math.sin(t * 2.4) * 1.2;
    const lean = o.moving ? Math.sin(walk) * 0.05 : 0;
    const sq = 1 + (o.recoil || 0) * 0.06;
    c.translate(0, -bob);
    c.rotate(lean);
    c.scale(1 / sq, sq);
    // pieds
    const fs = o.moving ? Math.sin(walk) * 5 : 0;
    ell(c, -8, 12 + fs * 0.5 + bob, 6.5, 4, 0); fillStroke(c, L.body2, 2);
    ell(c, 8, 12 - fs * 0.5 + bob, 6.5, 4, 0); fillStroke(c, L.body2, 2);
    const dirx = Math.cos(aim), diry = Math.sin(aim);
    const behind = diry < -0.35; // l'arme passe derrière si on vise vers le haut
    const drawWeapon = () => {
      if (!WEAPONS[L.weapon]) return;
      c.save(); c.translate(0, 0); c.rotate(aim);
      if (Math.cos(aim) < 0) c.scale(1, -1);
      const rc = (o.recoil || 0) * 8; c.translate(14 - rc, 2 - (Math.cos(aim) < 0 ? 4 : 0));
      WEAPONS[L.weapon](c, L);
      circ(c, 4, 0, 5.5); fillStroke(c, L.skin, 2);
      c.restore();
    };
    if (behind) drawWeapon();
    // corps
    c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-17, 8, -12, 14); c.lineTo(12, 14); c.quadraticCurveTo(17, 8, 14, -6); c.quadraticCurveTo(0, -12, -14, -6); c.closePath();
    const bg = c.createLinearGradient(0, -8, 0, 14); bg.addColorStop(0, L.body); bg.addColorStop(1, L.body2);
    fillStroke(c, bg);
    // détail tenue
    c.save(); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(-16, -8, 32, 6);
    c.fillStyle = L.accent; c.fillRect(-16, 4, 32, 3);
    c.restore();
    // bras arrière
    circ(c, -dirx * 10 - 13 * (dirx >= 0 ? 1 : 0.2), 2, 5); fillStroke(c, L.skin, 2);
    // tête
    const hy = -17;
    c.save(); c.translate(0, hy);
    if (L.hat === 'hood' || L.hat === 'wizard') { /* le capuchon est dessiné après la face */ }
    if (L.hat === 'cactus') { circ(c, 0, 0, 15); fillStroke(c, '#6fd16a'); }
    else { circ(c, 0, 0, 15); fillStroke(c, L.skin); }
    if (L.hat === 'hood') HATS.hood(c, L, o);
    // yeux
    const lx = Math.cos(aim) * 2.2, ly = Math.sin(aim) * 2;
    const hit = (o.flash || 0) > 0 || o.dead;
    for (const s of [-1, 1]) {
      const ex = s * 5.6, ey = 1;
      if (hit) { c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - 3, ey - 3); c.lineTo(ex + 3, ey + 3); c.moveTo(ex + 3, ey - 3); c.lineTo(ex - 3, ey + 3); c.stroke(); }
      else {
        ell(c, ex, ey, 4.2, 5.2, 0); fillStroke(c, '#fff', 1.6);
        circ(c, ex + lx, ey + ly, 2.4); c.fillStyle = L.hat === 'hood' ? '#b36bff' : '#111'; c.fill();
        circ(c, ex + lx - 0.8, ey + ly - 1, 0.9); c.fillStyle = '#fff'; c.fill();
      }
    }
    // sourcils + bouche
    c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
    if (!hit) { c.beginPath(); c.moveTo(-9, -6); c.lineTo(-3, -5 + (o.angry ? 2 : 0)); c.moveTo(9, -6); c.lineTo(3, -5 + (o.angry ? 2 : 0)); c.stroke(); }
    if (hit) { ell(c, 0, 9, 3.2, 2.6, 0); c.fillStyle = '#6b1e2a'; c.fill(); c.stroke(); }
    else if (o.happy || o.angry) { c.beginPath(); c.arc(0, 7, 4.5, 0.1, Math.PI - 0.1); c.stroke(); }
    else { c.beginPath(); c.arc(0, 6.5, 3.2, 0.2, Math.PI - 0.2); c.stroke(); }
    // joues
    c.fillStyle = 'rgba(255,90,120,0.28)'; circ(c, -9, 6, 2.6); c.fill(); circ(c, 9, 6, 2.6); c.fill();
    if (L.hat !== 'hood' && HATS[L.hat]) HATS[L.hat](c, L, o);
    c.restore();
    if (!behind) drawWeapon();
    // bras avant (main sur l'arme déjà dessinée)
    if (o.flash > 0) { // flash de dégâts
      c.globalCompositeOperation = 'source-atop';
    }
    c.restore();
    if (o.flash > 0) {
      c.save(); c.translate(o.x, o.y - (o.z || 0)); c.scale(sc, sc);
      c.globalAlpha = Math.min(0.75, o.flash * 7); circ(c, 0, -4, 22); c.fillStyle = '#fff'; c.fill(); c.restore();
    }
    if (o.frozen) { c.save(); c.translate(o.x, o.y); c.scale(sc, sc); rrect(c, -22, -40, 44, 56, 10); c.fillStyle = 'rgba(170,230,255,0.55)'; c.fill(); c.strokeStyle = '#e8fbff'; c.lineWidth = 2; c.stroke(); c.restore(); }
  };

  /* ambiance : particules flottantes par thème + vignette + éclat des explosions */
  const AMB = { meadow: ['#d8f58a', 3, 18, 14], desert: ['#f4dca0', 2.2, 60, 6], snow: ['#ffffff', 3.2, 6, 50], volcano: ['#ff8a2a', 2.4, 4, -40], night: ['#fff58a', 2.4, 3, -4] };
  /* météo déterministe selon l'arène (purement visuelle) */
  const WEATHER = { meadow: ['clear', 'rain', 'fog', 'clear'], desert: ['clear', 'sand', 'clear', 'sand'], snow: ['snow', 'blizzard', 'aurora', 'snow'], volcano: ['ash', 'ash', 'embers', 'ash'], night: ['fog', 'storm', 'aurora', 'fog'] };
  R.weatherOf = (M) => { const l = WEATHER[M.map.theme] || ['clear']; return l[Math.abs((M.map.seed || 0) + (M.mapKey ? M.mapKey.length : 0)) % l.length]; };
  function drawWeather(c, M, W, H, time) {
    const w = R.weatherOf(M); if (w === 'clear' || R.q === 0) return;
    const n = R.q > 1 ? 1 : 0.5;
    c.save();
    if (w === 'rain' || w === 'storm') {
      c.fillStyle = 'rgba(20,40,80,' + (w === 'storm' ? 0.2 : 0.1) + ')'; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(200,225,255,0.5)'; c.lineWidth = 1.5; c.beginPath();
      for (let i = 0; i < 90 * n; i++) { const x = ((i * 97.3 + time * 220) % (W + 80)) - 40, y = ((i * 61.7 + time * 700) % (H + 40)) - 20; c.moveTo(x, y); c.lineTo(x - 5, y + 16); }
      c.stroke();
      if (w === 'storm') { const ph = (time + (M.map.seed || 0)) % 9; if (ph < 0.18) { c.fillStyle = 'rgba(255,255,255,' + 0.5 * (1 - ph / 0.18) + ')'; c.fillRect(0, 0, W, H); } }
    } else if (w === 'fog') {
      for (let i = 0; i < 4; i++) { const x = ((time * 14 + i * W * 0.4) % (W * 1.6)) - W * 0.3, g = c.createRadialGradient(x, H * (0.25 + i * 0.2), 10, x, H * (0.25 + i * 0.2), W * 0.35); g.addColorStop(0, 'rgba(230,240,255,0.2)'); g.addColorStop(1, 'rgba(230,240,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    } else if (w === 'sand') {
      c.fillStyle = 'rgba(210,160,80,0.14)'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(240,210,150,0.5)'; c.lineWidth = 1.6; c.beginPath();
      for (let i = 0; i < 70 * n; i++) { const x = ((i * 83.1 + time * 420) % (W + 100)) - 50, y = (i * 47.9) % H; c.moveTo(x, y); c.lineTo(x - 26, y + 3); }
      c.stroke();
    } else if (w === 'blizzard' || w === 'snow') {
      if (w === 'blizzard') { c.fillStyle = 'rgba(235,245,255,0.16)'; c.fillRect(0, 0, W, H); }
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < (w === 'blizzard' ? 120 : 50) * n; i++) { const x = ((i * 71.3 + time * (w === 'blizzard' ? 260 : 30) + Math.sin(time + i) * 20) % (W + 40)) - 20, y = ((i * 53.7 + time * (w === 'blizzard' ? 200 : 70)) % (H + 20)) - 10; circ(c, x, y, 1.5 + (i % 3) * 0.7); c.fill(); }
    } else if (w === 'ash' || w === 'embers') {
      for (let i = 0; i < 60 * n; i++) { const x = ((i * 79.9 + Math.sin(time * 0.8 + i) * 30) % W + W) % W, y = H - ((i * 43.3 + time * (w === 'embers' ? 60 : 30)) % (H + 20)); c.fillStyle = w === 'embers' ? 'rgba(255,' + (110 + (i % 5) * 20) + ',30,0.8)' : 'rgba(170,160,160,0.6)'; circ(c, x, y, 1.4 + (i % 3)); c.fill(); }
    } else if (w === 'aurora') {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) { const g = c.createLinearGradient(0, 0, 0, H * 0.45); const hc = [140, 200, 280][i]; g.addColorStop(0, 'hsla(' + hc + ',90%,60%,0.0)'); g.addColorStop(0.5, 'hsla(' + hc + ',90%,60%,' + (0.1 + 0.05 * Math.sin(time * 0.8 + i)) + ')'); g.addColorStop(1, 'hsla(' + hc + ',90%,60%,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); for (let x = 0; x <= W; x += 40) c.lineTo(x, H * 0.18 + Math.sin(x * 0.01 + time * 0.6 + i * 2) * H * 0.06 + i * 10); c.lineTo(W, 0); c.closePath(); c.fill(); }
    }
    c.restore();
  }
  R.finishFx = function (c, M, W, H, time, th) {
    drawWeather(c, M, W, H, time);
    const key = M.map.theme, a = AMB[key];
    if (R.q > 0 && a) {
      const n = R.q > 1 ? 36 : 16;
      c.save(); c.globalAlpha = 0.65; c.fillStyle = a[0];
      for (let i = 0; i < n; i++) {
        const sx = ((i * 97.13) % 1) * 0, ox = (i * 211.7) % W, oy = (i * 131.9) % H;
        const x = ((ox + time * a[2] * (0.6 + (i % 5) * 0.2) + Math.sin(time + i) * 14) % (W + 20) + W + 20) % (W + 20) - 10;
        const y = ((oy + time * a[3] * (0.6 + (i % 4) * 0.25)) % (H + 20) + H + 20) % (H + 20) - 10;
        const tw = key === 'night' ? 0.4 + 0.6 * Math.abs(Math.sin(time * 2 + i)) : 1;
        c.globalAlpha = 0.55 * tw; circ(c, x, y, a[1] * (0.6 + (i % 3) * 0.3)); c.fill();
      }
      c.restore();
    }
    if (R.q > 0) { // vignette teintée par le thème
      const vk = W + 'x' + H + th.fog;
      if (!R._vig || R._vig.k !== vk) { // vignette pré-calculée (un seul dessin par image)
        const cv = document.createElement('canvas'); cv.width = Math.ceil(W / 2); cv.height = Math.ceil(H / 2); const vc = cv.getContext('2d');
        const vg = vc.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.45, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, G.hexA(th.fog, 0.55)); vc.fillStyle = vg; vc.fillRect(0, 0, cv.width, cv.height);
        R._vig = { k: vk, cv };
      }
      c.drawImage(R._vig.cv, 0, 0, W, H);
    }
    // éclat lumineux bref lors des grosses explosions proches
    let fl = 0; for (const r of M.rings) if (r.fill && r.dur <= 0.26 && r.t < 0.1) fl = Math.max(fl, 0.16 * (1 - r.t / 0.1));
    if (fl > 0) { c.fillStyle = 'rgba(255,240,200,' + fl + ')'; c.fillRect(0, 0, W, H); }
  };

  R._h = { HATS, WEAPONS, fillStroke, circ, ell, rrect, poly, OUT };
  R.q = 2; // qualité : 2 haute, 1 moyenne, 0 économie
  const glowCache = {};
  R.glow = function (color) { // sprite de halo (dégradé radial) réutilisable en mode additif
    if (glowCache[color]) return glowCache[color];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (glowCache[color] = cv);
  };
  function glowAt(c, x, y, r, color, a) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a; c.drawImage(R.glow(color), x - r, y - r, r * 2, r * 2); c.restore(); }
  R.glowAt = glowAt;

  /* portrait pour menus */
  R.portrait = function (canvas, id, skinId, t, opts) {
    opts = opts || {};
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    c.clearRect(0, 0, W, H);
    const sc = (Math.min(W, H) / 78) * (opts.zoom || 0.78);
    R.drawChar(c, id, skinId, { x: W / 2, y: H * (opts.y || 0.74), sc, aim: opts.aim !== undefined ? opts.aim : 0.5 + Math.sin(t * 1.2) * 0.2, t, moving: false, shadow: opts.shadow !== false, happy: opts.happy });
  };

  /* ---------- sprites de tuiles ---------- */
  const SS = 2; // super-échantillonnage des sprites
  const spriteCache = {};
  const LIFT = Math.round(T * 0.4);
  function mk(w, h) { const cv = document.createElement('canvas'); cv.width = w * SS; cv.height = h * SS; const c = cv.getContext('2d'); c.scale(SS, SS); return [cv, c]; }
  R.getSprites = function (themeKey) {
    if (spriteCache[themeKey]) return spriteCache[themeKey];
    const th = G.THEMES[themeKey], S = { ground: [], lift: LIFT };
    const rng = G.mulberry32(themeKey.length * 977 + 5);
    // sol (4 variantes)
    for (let v = 0; v < 4; v++) {
      const [cv, c] = mk(T, T);
      c.fillStyle = (v & 1) ? th.g1 : th.g2; c.fillRect(0, 0, T, T);
      c.fillStyle = 'rgba(0,0,0,0.045)'; if (((v >> 1) & 1) === 0) c.fillRect(0, 0, T, 1.5), c.fillRect(0, 0, 1.5, T);
      const dk = G.shade(th.g1, -0.12), lt = G.shade(th.g1, 0.12);
      for (let i = 0; i < 5; i++) {
        const x = rng() * T, y = rng() * T;
        c.fillStyle = rng() < 0.5 ? dk : lt;
        if (th.deco === 'flower' && i < 2) { c.fillStyle = ['#fff', '#ffd1e8', '#ffe27a'][Math.floor(rng() * 3)]; circ(c, x, y, 2.2); c.fill(); c.fillStyle = '#ffcc00'; circ(c, x, y, 0.9); c.fill(); }
        else if (th.deco === 'pebble') { ell(c, x, y, 3.2, 2, 0); c.fillStyle = 'rgba(120,80,40,0.28)'; c.fill(); }
        else if (th.deco === 'snow') { circ(c, x, y, 2.2); c.fillStyle = 'rgba(255,255,255,0.85)'; c.fill(); }
        else if (th.deco === 'ember') { c.fillStyle = 'rgba(255,120,40,0.35)'; c.fillRect(x, y, 3, 1.5); }
        else if (th.deco === 'star') { circ(c, x, y, 1.1); c.fillStyle = 'rgba(190,210,255,0.6)'; c.fill(); }
        else { c.fillRect(x, y, 2, 4); }
      }
      S.ground.push(cv);
    }
    // bloc mur
    const block = (topCol, frontCol, lite, kind) => {
      const [cv, c] = mk(T, T + LIFT);
      const top = G.shade(topCol, 0.1), side = G.shade(frontCol, -0.2);
      rrect(c, 1, 1, T - 2, T + LIFT - 2, 8); c.fillStyle = OUT; c.fill();
      rrect(c, 3, T - 2, T - 6, LIFT, 6); c.fillStyle = side; c.fill();
      rrect(c, 3, 3, T - 6, T - 3, 8); c.fillStyle = top; c.fill();
      const g = c.createLinearGradient(0, 3, 0, T); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.08)'); c.fillStyle = g; rrect(c, 3, 3, T - 6, T - 3, 8); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5;
      if (kind === 'rock') { c.beginPath(); c.moveTo(12, 12); c.lineTo(24, 22); c.lineTo(20, 36); c.moveTo(42, 10); c.lineTo(36, 24); c.stroke(); }
      if (kind === 'ice') { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.moveTo(10, 40); c.lineTo(28, 12); c.moveTo(18, 44); c.lineTo(34, 22); c.stroke(); }
      if (kind === 'lava') { c.strokeStyle = '#ff7a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 14); c.lineTo(24, 26); c.lineTo(20, 40); c.moveTo(44, 12); c.lineTo(38, 30); c.stroke(); }
      if (kind === 'crystal') { poly(c, [30, 8, 40, 26, 30, 44, 20, 26]); c.fillStyle = 'rgba(190,160,255,0.55)'; c.fill(); c.stroke(); }
      if (kind === 'moss') { c.fillStyle = 'rgba(70,160,60,0.5)'; circ(c, 14, 14, 7); c.fill(); circ(c, 44, 18, 5); c.fill(); }
      c.strokeStyle = lite; c.lineWidth = 2; c.beginPath(); c.moveTo(8, 6); c.lineTo(T - 8, 6); c.stroke();
      return cv;
    };
    const kind = { meadow: 'moss', desert: 'rock', snow: 'ice', volcano: 'lava', night: 'crystal' }[themeKey];
    S.wall = block(th.wall, th.wall, 'rgba(255,255,255,0.35)', kind);
    S.border = block(G.shade(th.border, 0.1), th.border, 'rgba(255,255,255,0.15)', 'none');
    // caisse
    {
      const [cv, c] = mk(T, T + LIFT);
      rrect(c, 3, 3, T - 6, T + LIFT - 6, 7); c.fillStyle = OUT; c.fill();
      rrect(c, 5, T - 4, T - 10, LIFT, 5); c.fillStyle = G.shade(th.crate, -0.35); c.fill();
      rrect(c, 5, 5, T - 10, T - 6, 7); c.fillStyle = th.crate; c.fill();
      c.strokeStyle = G.shade(th.crate, -0.3); c.lineWidth = 2;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(7, 5 + i * 13); c.lineTo(T - 7, 5 + i * 13); c.stroke(); }
      c.beginPath(); c.moveTo(7, 7); c.lineTo(T - 7, T - 5); c.moveTo(T - 7, 7); c.lineTo(7, T - 5); c.strokeStyle = G.shade(th.crate, -0.2); c.stroke();
      rrect(c, 5, 5, T - 10, T - 6, 7); c.strokeStyle = G.shade(th.crate, -0.45); c.lineWidth = 3; c.stroke();
      S.crate = cv;
    }
    // boîte à cubes
    {
      const [cv, c] = mk(T, T + LIFT);
      rrect(c, 3, 3, T - 6, T + LIFT - 6, 9); c.fillStyle = OUT; c.fill();
      rrect(c, 5, T - 4, T - 10, LIFT, 6); c.fillStyle = '#3c7a2e'; c.fill();
      rrect(c, 5, 5, T - 10, T - 6, 9); const g = c.createLinearGradient(0, 5, 0, T); g.addColorStop(0, '#8dff6a'); g.addColorStop(1, '#2fae3e'); c.fillStyle = g; c.fill();
      c.strokeStyle = '#1d6e2a'; c.lineWidth = 3; c.stroke();
      // cube
      c.save(); c.translate(T / 2, T / 2 - 1);
      poly(c, [0, -13, 13, -6, 13, 8, 0, 14, -13, 8, -13, -6]); fillStroke(c, '#d6ffb0', 2);
      c.fillStyle = 'rgba(255,255,255,0.7)'; poly(c, [0, -13, 13, -6, 0, 1, -13, -6]); c.fill();
      c.restore();
      S.box = cv;
    }
    // buisson
    {
      const [cv, c] = mk(T + 8, T + 8);
      c.translate(4, 4);
      const base = th.bush, lt = G.shade(base, 0.25), dk = G.shade(base, -0.3);
      const blobs = [[16, 36, 15], [44, 36, 15], [30, 40, 17], [14, 20, 13], [46, 20, 13], [30, 14, 14], [30, 28, 18]];
      for (const [x, y, r] of blobs) { circ(c, x, y, r + 2); c.fillStyle = OUT; c.fill(); }
      for (const [x, y, r] of blobs) { circ(c, x, y, r); c.fillStyle = dk; c.fill(); }
      for (const [x, y, r] of blobs) { circ(c, x, y - 2, r - 3); c.fillStyle = base; c.fill(); }
      for (const [x, y, r] of blobs) { circ(c, x - 3, y - 6, r * 0.35); c.fillStyle = lt; c.fill(); }
      S.bush = cv;
    }
    // eau
    {
      const [cv, c] = mk(T, T);
      c.fillStyle = th.water; c.fillRect(0, 0, T, T);
      c.fillStyle = G.shade(th.water, 0.2); c.globalAlpha = 0.5; c.fillRect(0, 0, T, 8); c.globalAlpha = 1;
      S.water = cv;
    }
    return (spriteCache[themeKey] = S);
  };

  /* ---------- projectiles ---------- */
  function drawProj(c, p) {
    if (R.q > 0 && p.shape !== 'spike' && p.shape !== 'dagger') glowAt(c, p.x, p.y - (p.z || 0), (p.r || 6) * (p.shape === 'bolt' ? 6 : 3.6), p.color, 0.55);
    c.save(); c.translate(p.x, p.y - (p.z || 0));
    const a = p.lob ? 0 : p.ang;
    switch (p.shape) {
      case 'pellet': case 'bigpellet': {
        const r = p.shape === 'bigpellet' ? 8 : 5.5;
        c.strokeStyle = p.color; c.globalAlpha = 0.45; c.lineWidth = r * 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-Math.cos(a) * 18, -Math.sin(a) * 18); c.stroke(); c.globalAlpha = 1;
        circ(c, 0, 0, r); fillStroke(c, p.color, 2); circ(c, -1, -1.5, r * 0.4); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fill(); break;
      }
      case 'bullet': {
        c.rotate(a); c.strokeStyle = p.color; c.globalAlpha = 0.5; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-26, 0); c.lineTo(0, 0); c.stroke(); c.globalAlpha = 1;
        rrect(c, -7, -4, 16, 8, 4); fillStroke(c, p.color, 2); rrect(c, 0, -2, 7, 4, 2); c.fillStyle = '#fff'; c.fill(); break;
      }
      case 'rocket': {
        c.rotate(a);
        for (let i = 0; i < 3; i++) { circ(c, -12 - i * 8, G.rr(-2, 2), 6 - i * 1.5); c.fillStyle = ['#ffd21f', '#ff7a1a', '#777'][i]; c.globalAlpha = 0.8; c.fill(); }
        c.globalAlpha = 1;
        rrect(c, -9, -6, 22, 12, 5); fillStroke(c, '#d9dde3', 2); poly(c, [12, -6, 22, 0, 12, 6]); fillStroke(c, p.color, 2);
        poly(c, [-9, -6, -15, -11, -9, -2]); fillStroke(c, p.color, 1.5); poly(c, [-9, 6, -15, 11, -9, 2]); fillStroke(c, p.color, 1.5); break;
      }
      case 'note': {
        const k = p.age * 14; c.rotate(Math.sin(k) * 0.2);
        c.globalAlpha = 0.5; circ(c, 0, 0, 18); c.fillStyle = p.color; c.fill(); c.globalAlpha = 1;
        circ(c, 0, 0, 12); fillStroke(c, '#fff', 2.5);
        c.fillStyle = '#d6409f'; c.font = 'bold 18px "Lilita One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♪', 0, 1); break;
      }
      case 'spike': {
        c.rotate(a); poly(c, [10, 0, -6, -4, -3, 0, -6, 4]); fillStroke(c, p.color, 1.8); break;
      }
      case 'dagger': {
        c.rotate(a + p.age * 0); poly(c, [14, 0, -3, -4, -6, 0, -3, 4]); fillStroke(c, '#e8e4f5', 1.8); rrect(c, -9, -2.5, 6, 5, 2); fillStroke(c, '#7a2fd0', 1.5); break;
      }
      case 'ice': {
        c.rotate(p.age * 6); c.shadowColor = '#aef0ff'; c.shadowBlur = 14;
        poly(c, [0, -12, 10, 0, 0, 12, -10, 0]); fillStroke(c, '#bff2ff', 2); c.shadowBlur = 0;
        poly(c, [0, -12, 4, 0, 0, 4, -4, 0]); c.fillStyle = '#fff'; c.fill(); break;
      }
      case 'bomb': {
        const big = p.big ? 1.6 : 1; c.scale(big, big); c.rotate(p.age * 7);
        circ(c, 0, 0, 12); fillStroke(c, p.big ? '#a01010' : '#2b2b36'); rrect(c, -3, -17, 6, 6, 2); fillStroke(c, '#c9a36a', 1.5);
        circ(c, 0, -20, 3.5 + Math.sin(p.age * 30) * 1.2); c.fillStyle = '#ffb21a'; c.fill();
        circ(c, -4, -4, 3); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill(); break;
      }
      case 'bolt': {
        c.rotate(a); c.shadowColor = '#7df9ff'; c.shadowBlur = 16;
        c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-30, 0); c.lineTo(-20, -5); c.lineTo(-10, 4); c.lineTo(0, -4); c.lineTo(10, 0); c.stroke();
        c.strokeStyle = p.color; c.lineWidth = 8; c.globalAlpha = 0.5; c.stroke(); c.shadowBlur = 0; break;
      }
      case 'wave': { c.rotate(a); c.globalAlpha = 0.55; c.beginPath(); c.arc(-6, 0, 22, -1.0, 1.0); c.lineWidth = 11; c.strokeStyle = p.color; c.lineCap = 'round'; c.stroke(); c.globalAlpha = 1; c.beginPath(); c.arc(-6, 0, 22, -0.9, 0.9); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); break; }
      case 'scythe': { c.rotate(a + p.age * 14); c.beginPath(); c.arc(0, 0, 13, 0.2, 2.6); c.lineWidth = 7; c.strokeStyle = OUT; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = p.color; c.stroke(); break; }
      case 'orb': { const pu = 1 + Math.sin(p.age * 18) * 0.12; circ(c, 0, 0, 12 * pu); fillStroke(c, '#fff8d8', 2.4); circ(c, 0, 0, 6 * pu); c.fillStyle = p.color; c.fill(); break; }
      case 'gear': { c.rotate(p.age * 16); for (let i = 0; i < 6; i++) { c.rotate(1.047); rrect(c, -2.2, -9.5, 4.4, 5, 1); fillStroke(c, p.color, 1.4); } circ(c, 0, 0, 6.5); fillStroke(c, p.color, 2); circ(c, 0, 0, 2.4); c.fillStyle = OUT; c.fill(); break; }
      default: circ(c, 0, 0, 6); fillStroke(c, p.color, 2);
    }
    c.restore();
  }

  /* ---------- rendu du match ---------- */
  R.viewScale = function (W, H) { return H / (T * 10.4); };

  R.drawMatch = function (c, M, W, H, time) {
    const T0 = T, th = G.THEMES[M.map.theme], S = R.getSprites(M.map.theme);
    const sc = R.viewScale(W, H) * M.cam.zoom;
    // caméra
    const vw = W / sc, vh = H / sc;
    let cx = M.cam.x, cy = M.cam.y;
    const mw = M.w * T, mh = M.h * T;
    cx = G.clamp(cx, vw / 2 - T * 0.6, mw - vw / 2 + T * 0.6); cy = G.clamp(cy, vh / 2 - T * 0.9, mh - vh / 2 + T * 0.6);
    if (mw < vw) cx = mw / 2; if (mh < vh) cy = mh / 2;
    const shk = M.cam.shake, sx = shk ? G.rr(-shk, shk) : 0, sy = shk ? G.rr(-shk, shk) : 0;
    R.lastCam = { cx, cy, sc, W, H };
    c.fillStyle = th.fog; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2 + sx, H / 2 + sy); c.scale(sc, sc); c.translate(-cx, -cy);
    const x0 = Math.max(0, Math.floor((cx - vw / 2) / T) - 1), x1 = Math.min(M.w - 1, Math.ceil((cx + vw / 2) / T) + 1);
    const y0 = Math.max(0, Math.floor((cy - vh / 2) / T) - 1), y1 = Math.min(M.h - 1, Math.ceil((cy + vh / 2) / T) + 2);
    const tiles = M.map.tiles;
    // décor en cache : sol, eau, ombres, marquages, murs (voir world.js)
    const view = { x0, y0, x1, y1 };
    R.World.begin(M, sc, R.dpr || 1);
    R.World.drawGround(c, M, view);
    // reflets animés de l'eau / lave
    c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2; c.lineCap = 'round';
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tiles[ty * M.w + tx] !== 4) continue;
      const ph = time * 1.5 + tx * 1.7 + ty * 0.9;
      if (th.deco === 'ember') { c.fillStyle = 'rgba(255,230,120,' + (0.18 + 0.14 * Math.sin(ph * 2)) + ')'; c.fillRect(tx * T, ty * T, T, T); }
      c.beginPath(); c.moveTo(tx * T + 8, ty * T + 20 + Math.sin(ph) * 3); c.quadraticCurveTo(tx * T + 22, ty * T + 14 + Math.sin(ph) * 3, tx * T + 36, ty * T + 20 + Math.sin(ph) * 3);
      c.moveTo(tx * T + 22, ty * T + 42 + Math.cos(ph) * 3); c.quadraticCurveTo(tx * T + 36, ty * T + 36 + Math.cos(ph) * 3, tx * T + 50, ty * T + 42 + Math.cos(ph) * 3); c.stroke();
    }
    drawCaps(c, M);
    // zones au sol
    for (const z of M.zones) { c.globalAlpha = 0.35 * Math.min(1, z.t / 0.6); circ(c, z.x, z.y, z.r); c.fillStyle = z.color; c.fill(); c.globalAlpha = 0.9 * Math.min(1, z.t / 0.6); c.strokeStyle = z.color; c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -time * 20; c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
    for (const r of M.rings) {
      const k = r.t / r.dur, rad = G.lerp(r.r0, r.r1, G.easeOutCubic(k));
      c.globalAlpha = (1 - k) * (r.fill ? 0.4 : 0.9); circ(c, r.x, r.y, rad);
      if (r.fill) { c.fillStyle = r.color; c.fill(); } else { c.strokeStyle = r.color; c.lineWidth = 4; c.stroke(); }
      c.globalAlpha = 1;
    }
    for (const s of M.strikes) { const k = Math.max(0, s.t / s.delay); if (s.t < 0) continue; c.globalAlpha = 0.25 + 0.3 * k; circ(c, s.x, s.y, s.spec.splash * T * (0.4 + 0.6 * k)); c.fillStyle = '#ff3b2b'; c.fill(); c.globalAlpha = 0.9; c.strokeStyle = '#ff3b2b'; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1; }
    if (M.map.mine) drawMine(c, M.map.mine, time);
    // objets au sol (cachés sous les buissons, comme les cristaux)
    for (const it of M.items) drawItem(c, it, time);
    // buissons (en cache) : ils recouvrent le sol et les objets
    R.World.drawBushes(c, M, view);
    // personnages, ballon, coffres : triés par profondeur ; le haut des murs situés juste devant passe par-dessus
    const viewer = M.player, front = [];
    for (const b of M.ents) {
      if (!b.alive && !(b.deathT >= 0 && b.deathT < 0.8)) continue;
      if (b.alive && b.team !== viewer.team && b.hidden && G.dist(viewer.x, viewer.y, b.x, b.y) > 2.7 * T) continue;
      front.push({ k: 'b', e: b, y: b.y });
      if (b.alive && b.moving && R.q > 0 && Math.random() < 0.08 && G.Sim.tileAt(M, b.x, b.y) === 3) M.parts.length < 480 && M.parts.push({ type: 'circle', x: b.x + G.rr(-16, 16), y: b.y - G.rr(0, 20), vx: G.rr(-40, 40), vy: G.rr(-60, -20), t: 0, dur: 0.5, r0: 3, r1: 0, color: th.bush, drag: 3 });
    }
    if (M.ball) front.push({ k: 'ball', e: M.ball, y: M.ball.y + 10 });
    for (const sf of M.safes) front.push({ k: 's', e: sf, y: sf.y + 60 });
    front.sort((a, b) => a.y - b.y);
    for (const o of front) {
      if (o.k === 'b') { drawBrawler(c, M, o.e, time); R.World.occlude(c, M, o.e, 30 * (o.e.big || 1)); }
      else if (o.k === 'ball') drawBall(c, o.e, time);
      else { drawSafe(c, M, o.e, time); R.World.occlude(c, M, o.e, 95); }
    }
    // projectiles par-dessus tout (lisibilité des combats)
    for (const p of M.projs) drawProj(c, p);
    // gaz toxique
    if (M.zone) drawPoison(c, M, time, x0, y0, x1, y1);
    // particules
    for (const p of M.parts) {
      const k = p.t / p.dur;
      if (p.type === 'smoke') { c.globalAlpha = (1 - k) * 0.45; circ(c, p.x, p.y, p.r0 * (1 + k * 2)); c.fillStyle = '#bbb'; c.fill(); }
      else if (p.type === 'fire') { const r = p.r0 * (1 + k * 0.7) * 2; glowAt(c, p.x, p.y, r, k < 0.35 ? '#ffd86a' : k < 0.7 ? '#ff7a2a' : '#7a2a1a', (1 - k) * 0.95); }
      else if (p.type === 'flash') { glowAt(c, p.x, p.y, p.r0 * 2.2 * (1 - k * 0.4), p.color, (1 - k) * 0.95); }
      else if (p.type === 'spark') { c.globalAlpha = 1 - k; c.strokeStyle = p.color; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); c.stroke(); }
      else if (p.type === 'chunk') { c.globalAlpha = 1 - k; c.fillStyle = p.color; c.fillRect(p.x - p.r0 / 2, p.y - p.r0 / 2, p.r0, p.r0); }
      else { c.globalAlpha = 1 - k; circ(c, p.x, p.y, Math.max(0.1, p.r0 * (1 - k * 0.8))); c.fillStyle = p.color; c.fill(); }
    }
    c.globalAlpha = 1;
    // marqueurs de touche (vos tirs qui touchent)
    for (const h of M.hitmarks || []) { const k = h.t / 0.22, r = (h.big ? 13 : 9) * (1 + k * 0.4); c.globalAlpha = 1 - k; c.strokeStyle = h.big ? '#ffd21f' : '#fff'; c.lineWidth = h.big ? 4 : 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(h.x - r, h.y - r); c.lineTo(h.x - r * 0.4, h.y - r * 0.4); c.moveTo(h.x + r, h.y - r); c.lineTo(h.x + r * 0.4, h.y - r * 0.4); c.moveTo(h.x - r, h.y + r); c.lineTo(h.x - r * 0.4, h.y + r * 0.4); c.moveTo(h.x + r, h.y + r); c.lineTo(h.x + r * 0.4, h.y + r * 0.4); c.stroke(); }
    c.globalAlpha = 1;
    // textes flottants
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const t of M.texts) {
      const k = t.t / t.dur, s = t.size * (k < 0.15 ? 0.6 + k * 3 : 1);
      c.globalAlpha = 1 - Math.max(0, (k - 0.6) / 0.4);
      c.font = s + 'px "Lilita One", "Arial Black", sans-serif'; c.lineWidth = 5; c.strokeStyle = OUT; c.strokeText(t.txt, t.x, t.y); c.fillStyle = t.color; c.fillText(t.txt, t.x, t.y);
    }
    c.globalAlpha = 1;
    // barres de vie et noms (au-dessus de tout)
    for (const b of M.ents) {
      if (!b.alive) continue;
      if (b.team !== viewer.team && b.hidden && G.dist(viewer.x, viewer.y, b.x, b.y) > 2.7 * T) continue;
      drawBars(c, M, b);
    }
    c.restore();
    R.finishFx(c, M, W, H, time, th);
    R.lastCam.vw = vw; R.lastCam.vh = vh;
    return R.lastCam;
  };

  function drawCaps(c, M) {
    for (const cp of M.caps) { // zones à capturer
      const col = cp.state === 0 ? '60,140,255' : cp.state === 1 ? '255,70,70' : cp.state === 2 ? '255,210,31' : '255,255,255';
      c.globalAlpha = 1; circ(c, cp.x, cp.y, cp.r); c.fillStyle = 'rgba(' + col + ',0.22)'; c.fill();
      c.strokeStyle = 'rgba(' + col + ',0.95)'; c.lineWidth = 6; c.setLineDash([26, 16]); c.lineDashOffset = -performance.now() / 40; c.stroke(); c.setLineDash([]);
      circ(c, cp.x, cp.y, 14); c.fillStyle = 'rgba(' + col + ',0.8)'; c.fill();
    }
  }
  R._fieldMarks = (c, M, th) => drawFieldMarks(c, M, th);
  function drawFieldMarks(c, M, th) {
    if (M.mode === 'brawlball') {
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 5; const mx = (M.w / 2) * T, my = (M.h / 2) * T;
      c.beginPath(); c.moveTo(mx, T); c.lineTo(mx, (M.h - 1) * T); c.stroke();
      circ(c, mx, my, T * 2.1); c.stroke(); circ(c, mx, my, 8); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      for (const g of M.map.goals) {
        c.fillStyle = g.team === 0 ? 'rgba(60,140,255,0.38)' : 'rgba(255,70,70,0.38)'; c.fillRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
        c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5;
        for (let x = g.x0; x < g.x1; x += 15) { c.beginPath(); c.moveTo(x, g.y0); c.lineTo(x, g.y1); c.stroke(); }
        for (let y = g.y0; y < g.y1; y += 15) { c.beginPath(); c.moveTo(g.x0, y); c.lineTo(g.x1, y); c.stroke(); }
        c.strokeStyle = g.team === 0 ? '#3c8cff' : '#ff4646'; c.lineWidth = 5; c.strokeRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
      }
    }
    if (M.mode !== 'showdown') {
      // zones d'apparition
      for (let team = 0; team < 2; team++) {
        const sp = M.map.spawns[team];
        c.fillStyle = team === 0 ? 'rgba(70,140,255,0.16)' : 'rgba(255,80,80,0.16)';
        for (const p of sp) { rrect(c, p.x - 28, p.y - 28, 56, 56, 12); c.fill(); }
      }
    }
    if (M.mode === 'heist') {
      for (const s of M.safes) { c.fillStyle = s.team === 0 ? 'rgba(70,140,255,0.18)' : 'rgba(255,80,80,0.18)'; circ(c, s.x, s.y, 150); c.fill(); }
    }
  }
  function drawMine(c, p, time) {
    ell(c, p.x, p.y + 14, 52, 22, 0); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    c.save(); c.translate(p.x, p.y);
    const pulse = 1 + Math.sin(time * 3) * 0.04; c.scale(pulse, pulse);
    c.beginPath(); c.moveTo(-46, 18); c.quadraticCurveTo(-52, -14, -20, -28); c.quadraticCurveTo(0, -38, 20, -28); c.quadraticCurveTo(52, -14, 46, 18); c.quadraticCurveTo(0, 30, -46, 18); fillStroke(c, '#6a5a78');
    c.shadowColor = '#e07bff'; c.shadowBlur = 22;
    for (const [x, y, s] of [[-18, -6, 1], [14, -10, 1.2], [0, 6, 1.4], [26, 8, 0.8], [-30, 8, 0.8]]) {
      c.save(); c.translate(x, y); c.scale(s, s); poly(c, [0, -16, 9, -4, 5, 10, -5, 10, -9, -4]); fillStroke(c, '#d56bff', 2);
      poly(c, [0, -16, 9, -4, 0, 0, -9, -4]); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); c.restore();
    }
    c.restore();
  }
  function drawPoison(c, M, time, x0, y0, x1, y1) {
    const z = M.zone, W = M.w * T, H = M.h * T;
    c.save(); c.beginPath(); c.rect(-200, -200, W + 400, H + 400); c.rect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    c.fillStyle = 'rgba(80,200,40,' + (0.38 + Math.sin(time * 3) * 0.04) + ')'; c.fill('evenodd'); c.restore();
    c.strokeStyle = 'rgba(190,255,90,0.9)'; c.lineWidth = 5; c.setLineDash([22, 14]); c.lineDashOffset = -time * 40; c.strokeRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); c.setLineDash([]);
  }
  function drawItem(c, it, time) {
    const bob = Math.sin(time * 4 + it.bob) * 3;
    ell(c, it.x, it.y + 6, 10, 4, 0); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    c.save(); c.translate(it.x, it.y - 8 + bob);
    if (it.type === 'gem') {
      c.shadowColor = '#e07bff'; c.shadowBlur = 12; poly(c, [0, -13, 10, -3, 0, 12, -10, -3]); fillStroke(c, '#d56bff', 2); c.shadowBlur = 0;
      poly(c, [0, -13, 10, -3, 0, 0, -10, -3]); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
    } else {
      c.shadowColor = '#6dff8a'; c.shadowBlur = 12; poly(c, [0, -11, 11, -5, 11, 7, 0, 12, -11, 7, -11, -5]); fillStroke(c, '#6dff8a', 2); c.shadowBlur = 0;
      poly(c, [0, -11, 11, -5, 0, 1, -11, -5]); c.fillStyle = 'rgba(255,255,255,0.65)'; c.fill();
    }
    c.restore();
  }
  function drawBall(c, B, time) {
    const o = B.owner;
    ell(c, B.x, B.y + 12, 13, 5, 0); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    c.save(); c.translate(B.x, B.y - 4); c.rotate(B.spin);
    circ(c, 0, 0, 14); fillStroke(c, '#fff', 2.5);
    c.fillStyle = '#222'; poly(c, [0, -6, 5, -2, 3, 4, -3, 4, -5, -2]); c.fill();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - Math.PI / 2; c.fillRect(Math.cos(a) * 11 - 2, Math.sin(a) * 11 - 2, 4, 4); }
    c.restore();
  }
  function drawSafe(c, M, s, time) {
    const col = s.team === 0 ? '#3c8cff' : '#ff4646';
    ell(c, s.x, s.y + 62, 88, 26, 0); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fill();
    c.save(); c.translate(s.x, s.y - 6);
    if (s.flash > 0) c.translate(G.rr(-2, 2), 0);
    rrect(c, -80, -76, 160, 150, 20); fillStroke(c, G.shade('#7a8594', s.flash > 0 ? 0.5 : 0), 4);
    rrect(c, -80, 40, 160, 34, 14); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
    rrect(c, -62, -58, 124, 100, 14); fillStroke(c, '#a9b4c2', 3);
    rrect(c, -62, -58, 124, 100, 14); c.strokeStyle = col; c.lineWidth = 6; c.stroke();
    circ(c, 0, -8, 30); fillStroke(c, '#d6dde6', 3); circ(c, 0, -8, 18); fillStroke(c, '#8d98a8', 2);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + (s.flash > 0 ? 0.2 : 0); c.beginPath(); c.moveTo(Math.cos(a) * 6, -8 + Math.sin(a) * 6); c.lineTo(Math.cos(a) * 26, -8 + Math.sin(a) * 26); c.strokeStyle = '#4b5666'; c.lineWidth = 3; c.stroke(); }
    c.fillStyle = col; circ(c, 0, -8, 5); c.fill();
    // billets
    c.fillStyle = '#3ad06e'; rrect(c, 40, -50, 14, 8, 2); c.fill();
    c.restore();
    // barre de pv du coffre
    const k = s.hp / s.maxhp;
    rrect(c, s.x - 70, s.y - 104, 140, 16, 8); c.fillStyle = OUT; c.fill();
    rrect(c, s.x - 67, s.y - 101, 134 * k, 10, 5); c.fillStyle = col; c.fill();
  }

  function drawBrawler(c, M, b, time) {
    const isMe = b === M.player;
    const inBush = b.hidden || Sim_tileBush(M, b);
    let pose = null;
    if (M.state === 'end' && M.result && b.alive) {
      const wt = M.result.winnerTeam;
      pose = M.mode === 'showdown' ? (b.place === 1 || (b === M.player && M.result.win) ? 'win' : 'lose') : (wt === b.team ? 'win' : wt === -1 ? null : 'lose');
    }
    const o = { x: b.x, y: b.y, sc: 1.08 * (b.big || 1), aim: b.ang, t: time + b.idx * 1.7, seed: b.idx * 0.9, walk: b.walkT, moving: b.moving, flash: b.flash, recoil: b.recoil, z: b.z || 0,
      roll: b.roll ? b.roll.t / b.roll.dur : (b.rollT >= 0 && b.rollT < 0.3 ? b.rollT / 0.3 : undefined),
      alpha: b.invuln > 0 && !b.jump && !b.roll && !(b.rollT >= 0 && b.rollT < 0.3) ? 0.6 + Math.sin(time * 30) * 0.2 : (inBush && isMe ? 0.7 : 1), frozen: b.freeze > 0, angry: M.state === 'play',
      lean: b.moving ? Math.sign(Math.cos(b.face)) : 0, superReady: b.superCharge >= 1 && b.alive, deathT: b.alive ? undefined : b.deathT, deathAng: b.deathAng !== undefined ? b.deathAng : b.face, pose };
    if (!b.alive) { // animation d'élimination : le brawler tombe et s'efface
      R.drawChar(c, b.id, b.skin, Object.assign(o, { shadow: true }));
      return;
    }
    // anneau d'équipe au sol
    const tcol = isMe ? '#43e86a' : b.team === M.player.team ? '#3c9bff' : '#ff4a55';
    if (M.mode === 'showdown' && !isMe) c.strokeStyle = '#ff4a55'; else c.strokeStyle = tcol;
    c.globalAlpha = 0.9; c.lineWidth = 3.5; ell(c, b.x, b.y + 12, 25, 10, 0); c.stroke(); c.globalAlpha = 0.18; c.fillStyle = c.strokeStyle; c.fill(); c.globalAlpha = 1;
    if (b.dash) { c.globalAlpha = 0.4; R.drawChar(c, b.id, b.skin, Object.assign({}, o, { x: b.x - b.dash.ax * 30, y: b.y - b.dash.ay * 30, shadow: false })); c.globalAlpha = 1; }
    R.drawChar(c, b.id, b.skin, o);
    if (b.stun > 0) { for (let i = 0; i < 3; i++) { const a = time * 6 + i * 2.1; c.fillStyle = '#ffe14a'; c.font = '16px sans-serif'; c.textAlign = 'center'; c.fillText('★', b.x + Math.cos(a) * 16, b.y - 46 + Math.sin(a) * 4); } }
    if (b.poison > 0) { circ(c, b.x + Math.sin(time * 5) * 8, b.y - 30 - ((time * 30) % 12), 3); c.fillStyle = '#c15bff'; c.fill(); }
    if (b.slowT > 0 && b.slowF < 1) { c.strokeStyle = 'rgba(160,230,255,0.8)'; c.lineWidth = 2; ell(c, b.x, b.y + 12, 28, 11, 0); c.stroke(); }
    if (b.hasBall) { /* la balle est dessinée à part */ }
    if (b.boostT > 0) { c.globalAlpha = 0.5; c.strokeStyle = '#ffd21f'; c.lineWidth = 3; c.beginPath(); c.arc(b.x, b.y - 4, 28, 0, TAU); c.stroke(); c.globalAlpha = 1; }
    if (b.emoteT > 0 && b.emote) {
      const k = Math.min(1, (2 - b.emoteT) * 8, b.emoteT * 4), ey = b.y - 92 - (1 - b.emoteT / 2) * 8;
      c.save(); c.globalAlpha = Math.max(0, Math.min(1, k)); c.translate(b.x, ey); c.scale(0.6 + 0.4 * Math.min(1, k), 0.6 + 0.4 * Math.min(1, k));
      c.beginPath(); c.arc(0, 0, 25, 0, TAU); c.moveTo(-7, 22); c.lineTo(0, 34); c.lineTo(7, 22); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
      c.font = '30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(b.emote, 0, 2); c.restore();
    }
  }
  function Sim_tileBush(M, b) { return G.Sim.tileAt(M, b.x, b.y) === 3; }

  function drawBars(c, M, b) {
    const isMe = b === M.player, ally = b.team === M.player.team;
    const col = isMe ? '#43e86a' : ally ? '#3c9bff' : '#ff4a55';
    const w = 54, x = b.x - w / 2, y = b.y - 56 - (b.z || 0);
    // pv
    rrect(c, x - 2, y - 2, w + 4, 12, 6); c.fillStyle = OUT; c.fill();
    const k = G.clamp(b.hp / b.maxhp, 0, 1);
    rrect(c, x, y, w, 8, 4); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
    if (k > 0) { rrect(c, x, y, Math.max(8, w * k), 8, 4); c.fillStyle = col; c.fill(); rrect(c, x, y, Math.max(8, w * k), 3, 2); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill(); }
    c.font = '13px "Lilita One", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3.5; c.strokeStyle = OUT; c.lineJoin = 'round';
    const hpTxt = Math.ceil(b.hp);
    c.strokeText(String(hpTxt), b.x, y + 4); c.fillStyle = '#fff'; c.fillText(String(hpTxt), b.x, y + 4);
    // nom
    c.font = '14px "Lilita One", "Arial Black", sans-serif';
    c.strokeText(b.name, b.x, y - 10); c.fillStyle = isMe ? '#9dffb4' : ally ? '#a6d2ff' : '#ffb0b6'; c.fillText(b.name, b.x, y - 10);
    // munitions pour le joueur
    if (isMe) {
      for (let i = 0; i < 3; i++) {
        const f = G.clamp(b.ammo - i, 0, 1);
        rrect(c, x + i * (w / 3) + 1, y + 13, w / 3 - 3, 6, 3); c.fillStyle = OUT; c.fill();
        if (f > 0) { rrect(c, x + i * (w / 3) + 2, y + 14, (w / 3 - 5) * f, 4, 2); c.fillStyle = f >= 1 ? '#ffb21a' : '#c98a1a'; c.fill(); }
      }
    }
    // indicateurs (gemmes / cubes / primes)
    let ix = b.x - 27;
    if (b.gems > 0) { poly(c, [ix + 4, y - 31, ix + 10, y - 26, ix + 4, y - 20, ix - 2, y - 26]); fillStroke(c, '#d56bff', 1.5); c.fillStyle = '#fff'; c.font = '13px "Lilita One", sans-serif'; c.strokeText('x' + b.gems, ix + 20, y - 25); c.fillText('x' + b.gems, ix + 20, y - 25); }
    if (b.cubes > 0) { c.fillStyle = '#6dff8a'; c.strokeText('◆' + b.cubes, b.x + 28, y + 4); c.fillText('◆' + b.cubes, b.x + 28, y + 4); }
    if (M.mode === 'bounty' && b.bounty > 0) { c.fillStyle = '#ffd21f'; c.strokeText('★' + b.bounty, b.x + 30, y + 4); c.fillText('★' + b.bounty, b.x + 30, y + 4); }
    if (b.superCharge >= 1 && isMe) { c.fillStyle = '#ffd21f'; c.font = '12px "Lilita One", sans-serif'; }
  }

  /* ---------- indicateur de visée au sol ---------- */
  // longueur libre d'un rayon avant le premier mur (les tirs s'y arrêtent)
  function rayLen(M, x, y, ang, len) {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    for (let d = 14; d < len; d += 8) if (G.isBulletTile(G.Sim.tileAt(M, x + cx * d, y + cy * d))) return Math.max(14, d - 4);
    return len;
  }
  R.drawAim = function (c, M, b, ang, dist, isSuper) {
    const spec = isSuper ? b.def.sup : b.def.atk, type = isSuper ? spec.type : 'proj';
    const rgb = isSuper ? '255,214,40' : '255,255,255', col = 'rgba(' + rgb + ',';
    c.save(); c.translate(b.x, b.y); c.lineJoin = 'round'; c.lineCap = 'round';
    if ((type === 'proj' || type === 'pierce' || type === 'beam') && !spec.lob) {
      const len = (spec.range || 7) * T;
      if ((spec.n || 1) > 1 && spec.spread > 3) { // éventail découpé par les murs
        const half = (spec.spread * Math.PI) / 360, n = Math.max(8, Math.ceil(spec.spread / 4));
        c.beginPath(); c.moveTo(0, 0);
        for (let i = 0; i <= n; i++) { const a = ang - half + (2 * half * i) / n, d = rayLen(M, b.x, b.y, a, len); c.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
        c.closePath();
        const g = c.createRadialGradient(0, 0, 16, 0, 0, len); g.addColorStop(0, col + '0.42)'); g.addColorStop(1, col + '0.16)');
        c.fillStyle = g; c.fill(); c.strokeStyle = col + '0.75)'; c.lineWidth = 2.5; c.stroke();
      } else { // trajectoire droite qui s'arrête au mur
        const w = Math.max(16, (spec.r || 6) * 2 + 8), L0 = rayLen(M, b.x, b.y, ang, len);
        c.rotate(ang);
        const g = c.createLinearGradient(0, 0, L0, 0); g.addColorStop(0, col + '0.5)'); g.addColorStop(1, col + '0.22)');
        c.beginPath(); c.moveTo(24, -w / 2); c.lineTo(L0 - w / 2, -w / 2); c.arc(L0 - w / 2, 0, w / 2, -Math.PI / 2, Math.PI / 2); c.lineTo(24, w / 2); c.closePath();
        c.fillStyle = g; c.fill(); c.strokeStyle = col + '0.8)'; c.lineWidth = 2.5; c.stroke();
        for (let x = 46; x < L0 - 20; x += 34) { c.beginPath(); c.moveTo(x, -w * 0.22); c.lineTo(x + 9, 0); c.lineTo(x, w * 0.22); c.strokeStyle = col + '0.55)'; c.lineWidth = 3; c.stroke(); }
        if (L0 < len - 4) { c.strokeStyle = 'rgba(255,90,90,0.9)'; c.lineWidth = 4; c.beginPath(); c.moveTo(L0 + 2, -w * 0.6); c.lineTo(L0 + 2, w * 0.6); c.stroke(); }
      }
    } else if (type === 'dash' || type === 'jump') {
      const len = (spec.dist || 4) * T; c.rotate(ang);
      c.beginPath(); c.moveTo(24, -20); c.lineTo(len - 30, -20); c.lineTo(len - 30, -32); c.lineTo(len, 0); c.lineTo(len - 30, 32); c.lineTo(len - 30, 20); c.lineTo(24, 20); c.closePath();
      c.fillStyle = col + '0.32)'; c.fill(); c.strokeStyle = col + '0.85)'; c.lineWidth = 3; c.stroke();
      if (type === 'jump') { circ(c, len, 0, (spec.splash || 2) * T); c.fillStyle = 'rgba(255,90,90,0.22)'; c.fill(); c.strokeStyle = 'rgba(255,120,100,0.9)'; c.setLineDash([10, 8]); c.stroke(); c.setLineDash([]); }
    } else if (type === 'aura') {
      circ(c, 0, 0, Math.max(0.6, spec.radius || 0.6) * T); c.fillStyle = col + '0.16)'; c.fill(); c.strokeStyle = col + '0.8)'; c.lineWidth = 3; c.stroke();
    } else { // tirs en cloche / zones : arc de trajectoire + zone d'impact
      const rng = (spec.range || 7) * T, d = G.clamp(dist == null ? rng : dist, 1.5 * T, rng);
      const px = Math.cos(ang) * d, py = Math.sin(ang) * d, h = Math.min(120, d * 0.35);
      c.beginPath(); c.arc(0, 0, rng, 0, TAU); c.strokeStyle = col + '0.22)'; c.lineWidth = 3; c.setLineDash([12, 10]); c.stroke(); c.setLineDash([]);
      for (let i = 1; i < 12; i++) { const t = i / 12; circ(c, px * t, py * t - Math.sin(Math.PI * t) * h, 4.5); c.fillStyle = col + (0.35 + 0.5 * t) + ')'; c.fill(); }
      const rad = (spec.splash || spec.area || 1) * T;
      circ(c, px, py, rad); c.fillStyle = 'rgba(255,90,60,0.26)'; c.fill(); c.strokeStyle = 'rgba(255,140,90,0.95)'; c.lineWidth = 3; c.stroke();
      circ(c, px, py, rad * 0.35); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.stroke();
    }
    c.restore();
  };

  /* ---------- HUD (dessiné en pixels écran) ---------- */
  R.drawHUD = function (c, M, W, H, input, time) {
    const p = M.player;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const u = Math.min(W, H) / 100; // unité d'interface
    const text = (str, x, y, size, fill, stroke) => {
      c.font = size + 'px "Lilita One", "Arial Black", sans-serif'; c.lineWidth = Math.max(3, size / 5); c.strokeStyle = stroke || OUT; c.strokeText(str, x, y); c.fillStyle = fill || '#fff'; c.fillText(str, x, y);
    };
    // --- alerte vie basse (bords rouges pulsants) ---
    if (p && p.alive && p.hp / p.maxhp < 0.35 && M.state !== 'end') {
      const k = 1 - p.hp / p.maxhp / 0.35, pulse = 0.55 + 0.45 * Math.sin(time * (5 + 4 * k));
      if (!R._lowVig || R._lowVig.w !== W || R._lowVig.h !== H) {
        const cv = document.createElement('canvas'); cv.width = Math.max(64, W >> 2); cv.height = Math.max(64, H >> 2); const x = cv.getContext('2d');
        const g = x.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.38, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.62);
        g.addColorStop(0, 'rgba(255,0,30,0)'); g.addColorStop(1, 'rgba(220,0,30,0.85)'); x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height);
        R._lowVig = { w: W, h: H, cv };
      }
      c.globalAlpha = (0.25 + 0.5 * k) * pulse; c.drawImage(R._lowVig.cv, 0, 0, W, H); c.globalAlpha = 1;
    }
    // --- direction d'où viennent les dégâts (chevron rouge autour du joueur) ---
    if (M.dmgDir && p && p.alive) {
      M.dmgDir.t += 1 / 60;
      if (M.dmgDir.t > 0.7) M.dmgDir = null;
      else {
        const cam = R.lastCam, sx = W / 2 + (p.x - cam.cx) * cam.sc, sy = H / 2 + (p.y - 8 - cam.cy) * cam.sc, rr = 62 * cam.sc, a = M.dmgDir.ang;
        c.save(); c.globalAlpha = 1 - M.dmgDir.t / 0.7; c.translate(sx, sy); c.rotate(a);
        c.beginPath(); c.arc(0, 0, rr, -0.42, 0.42); c.arc(0, 0, rr + 9 * cam.sc, 0.3, -0.3, true); c.closePath();
        c.fillStyle = '#ff2a3a'; c.fill(); c.strokeStyle = 'rgba(40,0,0,0.6)'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.moveTo(rr + 14 * cam.sc, 0); c.lineTo(rr + 4 * cam.sc, -7 * cam.sc); c.lineTo(rr + 4 * cam.sc, 7 * cam.sc); c.closePath(); c.fill();
        c.restore();
      }
    }
    // --- bandeau supérieur ---
    const top = 2 * u;
    const mm = Math.max(0, Math.floor(M.left / 60)), ss = Math.max(0, Math.ceil(M.left % 60));
    const tstr = mm + ':' + (ss < 10 ? '0' : '') + (ss === 60 ? '00' : ss);
    if (M.mode === 'showdown') {
      rrect(c, W / 2 - 14 * u, top, 28 * u, 7 * u, 3.5 * u); c.fillStyle = 'rgba(10,10,30,0.7)'; c.fill();
      text('☠ ' + M.alive + ' / 10', W / 2 - 5 * u, top + 3.5 * u, 4.2 * u, '#fff');
      text(tstr, W / 2 + 8.5 * u, top + 3.5 * u, 3.6 * u, '#ffd21f');
    } else {
      // scores
      const bw = 13 * u, bh = 7 * u;
      rrect(c, W / 2 - bw * 1.5 - 1 * u, top, bw, bh, 2 * u); c.fillStyle = 'rgba(40,110,255,0.9)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
      rrect(c, W / 2 + bw * 0.5 + 1 * u, top, bw, bh, 2 * u); c.fillStyle = 'rgba(255,60,70,0.9)'; c.fill(); c.stroke();
      rrect(c, W / 2 - bw / 2, top, bw, bh, 2 * u); c.fillStyle = 'rgba(10,10,30,0.85)'; c.fill(); c.stroke();
      text(tstr, W / 2, top + bh / 2, 4 * u, M.left < 15 ? '#ff6a6a' : '#fff');
      let s0, s1;
      if (M.mode === 'gemgrab') { s0 = Sim_gems(M, 0); s1 = Sim_gems(M, 1); }
      else if (M.mode === 'heist') { s0 = Math.round((M.safes[0].hp / M.safes[0].maxhp) * 100) + '%'; s1 = Math.round((M.safes[1].hp / M.safes[1].maxhp) * 100) + '%'; }
      else if (M.mode === 'boss') { s0 = M.ents.filter((e) => e.team === 0 && e.alive).length + ' / ' + M.ents.filter((e) => e.team === 0).length; const bs = M.ents.find((e) => e.isBoss); s1 = bs ? Math.round(bs.hp / bs.maxhp * 100) + '%' : '0%'; }
      else if (M.mode === 'hotzone') { s0 = Math.floor(M.score[0]); s1 = Math.floor(M.score[1]); }
      else { s0 = M.score[0]; s1 = M.score[1]; }
      const ic = M.mode === 'gemgrab' ? '◆ ' : M.mode === 'bounty' ? '★ ' : M.mode === 'brawlball' ? '⚽ ' : M.mode === 'hotzone' ? '◎ ' : M.mode === 'boss' ? '☻ ' : '🔒 ';
      text(ic + s0, W / 2 - bw * 1.0 - 1 * u, top + bh / 2, 3.8 * u);
      text(ic + s1, W / 2 + bw * 1.0 + 1 * u, top + bh / 2, 3.8 * u);
      if (M.mode === 'gemgrab') {
        for (let t = 0; t < 2; t++) if (M.gg.active[t]) {
          const x = t === 0 ? W / 2 - bw * 1.0 - 1 * u : W / 2 + bw * 1.0 + 1 * u;
          text(Math.ceil(M.gg.t[t]) + 's', x, top + bh + 3 * u, 3.6 * u, t === 0 ? '#9dffb4' : '#ff9a9a');
        }
      }
    }
    // fil des éliminations
    if (M.feed && M.feed.length) {
      let fy = 37 * u;
      for (const f of M.feed) {
        const kk = M.ents[f.k], vv = M.ents[f.v]; if (!kk || !vv) continue;
        const a = f.t < 0.2 ? f.t / 0.2 : f.t > 4 ? (4.5 - f.t) / 0.5 : 1;
        const col = (e) => (e === M.player ? '#9dffb4' : M.mode !== 'showdown' && e.team === M.player.team ? '#a6d2ff' : '#ff9aa2');
        c.globalAlpha = Math.max(0, a); c.font = (2.6 * u) + 'px "Lilita One", sans-serif'; c.textAlign = 'center';
        const vn = vv.name, kn = kk.name, wv = c.measureText(vn).width, wk = c.measureText(kn).width, x1 = W - 2 * u;
        rrect(c, x1 - wv - wk - 9 * u, fy - 2.2 * u, wv + wk + 10 * u, 4.4 * u, 1.4 * u); c.fillStyle = 'rgba(10,10,30,0.6)'; c.fill();
        text(vn, x1 - wv / 2 - 0.4 * u, fy, 2.6 * u, col(vv)); text('☠', x1 - wv - 3.6 * u, fy, 2.8 * u, '#fff'); text(kn, x1 - wv - 7 * u - wk / 2, fy, 2.6 * u, col(kk));
        fy += 5.2 * u;
      }
      c.globalAlpha = 1; c.textAlign = 'center';
    }
    // infos jeu (nom de l'arène)
    // --- minimap ---
    drawMinimap(c, M, W - 24 * u, 12 * u, 22 * u, u);
    // --- indicateurs hors écran ---
    if (R.lastCam) drawOffscreen(c, M, W, H, u);
    // --- barre du joueur ---
    // supers / attaque / joystick
    drawControls(c, M, W, H, input, u, time, text);
    // décompte & bannière
    if (M.state === 'countdown') {
      const n = Math.ceil(M.cd);
      if (n > 0 && n <= 3) { const k = 1 - (M.cd % 1); text(String(n), W / 2, H * 0.4, (14 + (1 - k) * 4) * u, '#ffd21f'); }
      if (M.state === 'countdown' && M.t < 1.6 && M.cdLast === 4) { /* intro gérée ailleurs */ }
    }
    if (M.banner) {
      const b = M.banner, k = b.t / b.dur, a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      c.globalAlpha = Math.max(0, a); const sc = k < 0.15 ? G.easeOutBack(k / 0.15) : 1;
      c.save(); c.translate(W / 2, H * 0.3); c.scale(sc, sc);
      rrect(c, -28 * u, -7 * u, 56 * u, b.sub ? 15 * u : 12 * u, 3 * u); c.fillStyle = 'rgba(10,10,30,0.55)'; c.fill();
      text(b.txt, 0, 0, 8 * u, b.color); if (b.sub) text(b.sub, 0, 6.5 * u, 3.6 * u, '#fff');
      c.restore(); c.globalAlpha = 1;
    }
    if (!p.alive && M.state === 'play') {
      if (M.mode !== 'showdown') text('Réapparition dans ' + Math.max(0, Math.ceil(p.respawn)) + 's', W / 2, H * 0.78, 4 * u, '#fff');
    }
    // vignette dégâts
    if (p.alive && p.hp < p.maxhp * 0.3 && M.state === 'play') {
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.9); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(255,0,0,' + (0.25 + Math.sin(time * 6) * 0.08) + ')');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    c.restore();
  };
  function Sim_gems(M, t) { return G.Sim.teamGems(M, t); }

  function drawMinimap(c, M, x, y, size, u) {
    const sc = size / Math.max(M.w, M.h) , mw = M.w * sc, mh = M.h * sc;
    const ox = x - mw / 2 + size / 2 - 0, oy = y;
    c.save(); c.translate(ox, oy);
    rrect(c, -2, -2, mw + 4, mh + 4, 4); c.fillStyle = 'rgba(10,10,30,0.7)'; c.fill();
    if (!M._mm || M.map.dirty) {
      const cv = M._mm || document.createElement('canvas'); cv.width = M.w * 3; cv.height = M.h * 3; const cc = cv.getContext('2d');
      const th = G.THEMES[M.map.theme];
      for (let ty = 0; ty < M.h; ty++) for (let tx = 0; tx < M.w; tx++) {
        const t = M.map.tiles[ty * M.w + tx];
        cc.fillStyle = t === 1 ? G.shade(th.wall, -0.2) : t === 2 ? th.crate : t === 3 ? th.bush : t === 4 ? th.water : t === 5 ? '#9aa' : t === 6 ? '#6dff8a' : th.g1;
        cc.fillRect(tx * 3, ty * 3, 3, 3);
      }
      M._mm = cv; M.map.dirty = false;
    }
    c.globalAlpha = 0.9; c.drawImage(M._mm, 0, 0, mw, mh); c.globalAlpha = 1;
    if (M.zone && M.mode === 'showdown') { c.strokeStyle = '#b6ff5a'; c.lineWidth = 1.5; c.strokeRect(M.zone.x0 / T * sc, M.zone.y0 / T * sc, (M.zone.x1 - M.zone.x0) / T * sc, (M.zone.y1 - M.zone.y0) / T * sc); }
    for (const b of M.ents) {
      if (!b.alive) continue;
      const vis = b.team === M.player.team || !b.hidden;
      if (!vis) continue;
      const ally = b.team === M.player.team;
      circ(c, (b.x / T) * sc, (b.y / T) * sc, b === M.player ? 3 : 2.2); c.fillStyle = b === M.player ? '#43e86a' : ally ? '#3c9bff' : '#ff4a55'; c.fill();
      if (b === M.player) { c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke(); }
    }
    if (M.ball) { circ(c, (M.ball.x / T) * sc, (M.ball.y / T) * sc, 2.5); c.fillStyle = '#fff'; c.fill(); }
    for (const s of M.safes) { c.fillStyle = s.team === 0 ? '#3c9bff' : '#ff4a55'; c.fillRect((s.x / T) * sc - 3, (s.y / T) * sc - 3, 6, 6); }
    if (M.map.mine) { circ(c, (M.map.mine.x / T) * sc, (M.map.mine.y / T) * sc, 2.5); c.fillStyle = '#e07bff'; c.fill(); }
    c.restore();
  }

  function drawOffscreen(c, M, W, H, u) {
    const cam = R.lastCam, sc = cam.sc;
    const toS = (x, y) => [W / 2 + (x - cam.cx) * sc, H / 2 + (y - cam.cy) * sc];
    const mark = (x, y, color, label) => {
      const [sx, sy] = toS(x, y);
      if (sx > 0 && sx < W && sy > 0 && sy < H) return;
      const a = Math.atan2(sy - H / 2, sx - W / 2), pad = 5 * u;
      let ex = W / 2 + Math.cos(a) * 1e4, ey = H / 2 + Math.sin(a) * 1e4;
      const kx = (W / 2 - pad) / Math.abs(Math.cos(a) || 1e-6), ky = (H / 2 - pad) / Math.abs(Math.sin(a) || 1e-6), k = Math.min(kx, ky);
      ex = W / 2 + Math.cos(a) * k; ey = H / 2 + Math.sin(a) * k;
      c.save(); c.translate(ex, ey); c.rotate(a);
      poly(c, [3 * u, 0, -2 * u, -2.2 * u, -2 * u, 2.2 * u]); c.fillStyle = color; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke(); c.restore();
      c.font = (2.6 * u) + 'px "Lilita One", sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 4;
      const lx = ex - Math.cos(a) * 4.2 * u, ly = ey - Math.sin(a) * 4.2 * u; c.strokeText(label, lx, ly); c.fillText(label, lx, ly);
    };
    const p = M.player;
    if (M.ball && !(M.ball.owner === p)) mark(M.ball.x, M.ball.y, '#fff', '⚽');
    for (const s of M.safes) mark(s.x, s.y, s.team === 0 ? '#3c9bff' : '#ff4a55', '🔒');
    if (M.map.mine) mark(M.map.mine.x, M.map.mine.y, '#e07bff', '◆');
    if (M.mode === 'showdown') { /* rien */ }
    if (M.mode === 'brawlball') for (const g of M.map.goals) mark((g.x0 + g.x1) / 2, (g.y0 + g.y1) / 2, g.team === 0 ? '#3c9bff' : '#ff4a55', 'BUT');
  }

  /* contrôles tactiles */
  R.layout = function (W, H) {
    const u = Math.min(Math.min(W, H) / 100, 5.4) * G.clamp(G.Save.data.settings.ctrlScale || 1, 0.8, 1.2); // taille plafonnée sur tablette
    const lefty = G.Save.data.settings.lefty;
    const L = {
      u,
      joyX: (lefty ? W - 21 * u : 21 * u), joyY: H - 23 * u, joyR: 14.5 * u,
      atkX: (lefty ? 19 * u : W - 19 * u), atkY: H - 24 * u, atkR: 12 * u,
      supX: (lefty ? 43 * u : W - 43 * u), supY: H - 12 * u, supR: 7.5 * u,
      dgX: (lefty ? 8 * u : W - 8 * u), dgY: H - 46 * u, dgR: 6 * u,
      gdX: (lefty ? 41 * u : W - 41 * u), gdY: H - 34 * u, gdR: 5.5 * u,
      emX: (lefty ? 27 * u : W - 27 * u), emY: H - 48 * u, emR: 4.5 * u,
    };
    return L;
  };
  R.emoteSlots = function (W, H) {
    const u = Math.min(W, H) / 100, n = G.EMOTES.length;
    return G.EMOTES.map((e, i) => { const a = -Math.PI / 2 + (i * TAU) / n; return { x: W / 2 + Math.cos(a) * 19 * u, y: H / 2 + Math.sin(a) * 19 * u, r: 6.5 * u }; });
  };
  function drawControls(c, M, W, H, input, u, time, text) {
    const L = R.layout(W, H), p = M.player;
    const now = performance.now();
    // ---- joystick de déplacement : apparaît sous le doigt, discret au repos ----
    const j = input.joy;
    if (j.active) {
      const ap = Math.min(1, (now - (j.t0 || 0)) / 110), sc = 0.82 + 0.18 * (1 - (1 - ap) * (1 - ap)), R0 = L.joyR * sc;
      const dx = j.x - j.bx, dy = j.y - j.by, l = Math.hypot(dx, dy), k = l > L.joyR ? L.joyR / l : 1;
      const kx = j.bx + dx * k, ky = j.by + dy * k, moving = Math.hypot(j.mx, j.my) > 0.01;
      c.save(); c.globalAlpha = 0.35 + 0.65 * ap;
      circ(c, j.bx, j.by, R0); c.fillStyle = 'rgba(8,12,40,0.30)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3; c.stroke();
      circ(c, j.bx, j.by, R0 * 0.56); c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 2; c.stroke();
      if (moving) {
        const a = Math.atan2(j.my, j.mx);
        c.beginPath(); c.arc(j.bx, j.by, R0, a - 0.62, a + 0.62); c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.stroke();
        c.save(); c.translate(j.bx + Math.cos(a) * (R0 + 9), j.by + Math.sin(a) * (R0 + 9)); c.rotate(a);
        c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, -7); c.lineTo(-4, 7); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.restore();
      }
      circ(c, kx + 2, ky + 4, L.joyR * 0.42); c.fillStyle = 'rgba(0,0,0,0.22)'; c.fill();
      circ(c, kx, ky, L.joyR * 0.42); const kg = c.createRadialGradient(kx - L.joyR * 0.12, ky - L.joyR * 0.16, 2, kx, ky, L.joyR * 0.42);
      kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#c9d3ff'); c.fillStyle = kg; c.fill(); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
      c.restore();
    } else {
      c.save(); c.globalAlpha = 0.32;
      circ(c, L.joyX, L.joyY, L.joyR); c.fillStyle = 'rgba(8,12,40,0.35)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3; c.stroke();
      circ(c, L.joyX, L.joyY, L.joyR * 0.42); c.fillStyle = 'rgba(255,255,255,0.75)'; c.fill();
      c.restore();
    }
    // ---- attaque : bouton au repos, manette de visée quand on glisse ----
    const a = input.atk, canAtk = p.ammo >= 1;
    actionStick(c, L, a, L.atkX, L.atkY, L.atkR, canAtk ? ['#ffd86a', '#f08a12'] : ['#9a8a6a', '#5a4a3a'], iconCross, now);
    if (!(a.active && a.drag)) { // munitions autour du bouton
      c.save(); c.translate(L.atkX, L.atkY);
      for (let i = 0; i < 3; i++) {
        const f = G.clamp(p.ammo - i, 0, 1), a0 = -Math.PI * 0.95 + i * Math.PI * 0.65, a1 = a0 + Math.PI * 0.55;
        c.beginPath(); c.arc(0, 0, L.atkR * 1.2, a0, a1); c.strokeStyle = OUT; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
        if (f > 0) { c.beginPath(); c.arc(0, 0, L.atkR * 1.2, a0, a0 + (a1 - a0) * f); c.strokeStyle = f >= 1 ? '#ffb21a' : '#c98a1a'; c.lineWidth = 5; c.stroke(); }
      }
      c.restore();
    }
    // esquive
    { const cd = p.roll ? 1 : (p.rollCd || 0) / G.Sim.DODGE.cd, ok = cd <= 0 && p.alive;
      c.save(); c.translate(L.dgX, L.dgY);
      circ(c, 0, 0, L.dgR * (input.dodgeFx > 0 ? 0.88 : 1)); const gd = c.createRadialGradient(0, -L.dgR * 0.3, 2, 0, 0, L.dgR); gd.addColorStop(0, ok ? '#9ff6ff' : '#6a7090'); gd.addColorStop(1, ok ? '#2a9ad6' : '#3a3f5a'); c.fillStyle = gd; c.fill(); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
      if (!ok) { c.beginPath(); c.arc(0, 0, L.dgR * 1.18, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - Math.min(1, cd))); c.strokeStyle = '#7df9ff'; c.lineWidth = 4; c.stroke(); }
      c.strokeStyle = '#fff'; c.lineWidth = L.dgR * 0.16; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, L.dgR * 0.45, -2.6, 1.2); c.stroke();
      c.beginPath(); c.moveTo(L.dgR * 0.62, L.dgR * 0.02); c.lineTo(L.dgR * 0.2, L.dgR * 0.48); c.lineTo(L.dgR * 0.05, L.dgR * 0.02); c.stroke();
      c.restore(); if (input.dodgeFx > 0) input.dodgeFx -= 0.016; }
    // gadget (3 par partie)
    { const gd = p.def && G.GADGETS[p.def.gadget];
      if (gd) {
        const n = p.gadgets === undefined ? 3 : p.gadgets, cd = (p.gadgetCd || 0) / G.Sim.GADGET_CD, ok = n > 0 && cd <= 0 && p.alive;
        c.save(); c.translate(L.gdX, L.gdY); c.globalAlpha = n > 0 ? 1 : 0.45;
        circ(c, 0, 0, L.gdR * (input.gadgetFx > 0 ? 0.88 : 1)); const gg = c.createRadialGradient(0, -L.gdR * 0.3, 2, 0, 0, L.gdR); gg.addColorStop(0, ok ? '#b8ffcf' : '#6a7090'); gg.addColorStop(1, ok ? '#1fae5a' : '#3a3f5a'); c.fillStyle = gg; c.fill(); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
        if (cd > 0 && n > 0) { c.beginPath(); c.arc(0, 0, L.gdR * 1.18, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - Math.min(1, cd))); c.strokeStyle = '#6dff8a'; c.lineWidth = 4; c.stroke(); }
        c.font = Math.round(L.gdR * 0.95) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(gd.icon, 0, 1);
        for (let i = 0; i < 3; i++) { circ(c, (i - 1) * L.gdR * 0.42, L.gdR * 1.42, L.gdR * 0.15); c.fillStyle = i < n ? '#6dff8a' : 'rgba(0,0,0,0.45)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
        c.restore(); if (input.gadgetFx > 0) input.gadgetFx -= 0.016;
      }
    }
    // émotes
    { c.save(); c.translate(L.emX, L.emY); circ(c, 0, 0, L.emR); c.fillStyle = input.emoteOpen ? 'rgba(255,210,31,0.95)' : 'rgba(20,24,48,0.55)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3; c.stroke();
      c.font = Math.round(L.emR * 1.1) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('😀', 0, 1); c.restore();
      if (input.emoteOpen) {
        c.save(); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W, H); c.textAlign = 'center'; c.textBaseline = 'middle';
        R.emoteSlots(W, H).forEach((s, i) => { circ(c, s.x, s.y, s.r); c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke(); c.font = Math.round(s.r * 1.15) + 'px sans-serif'; c.fillStyle = '#000'; c.fillText(G.EMOTES[i], s.x, s.y + 2); });
        c.restore();
      }
    }
    // super : même manette, jaune, avec jauge de charge
    const s = input.sup, ready = p.superCharge >= 1;
    if (!(s.active && s.drag)) {
      c.save(); c.translate(L.supX, L.supY);
      if (!ready) { c.beginPath(); c.arc(0, 0, L.supR * 1.22, 0, TAU); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 6; c.stroke();
        c.beginPath(); c.arc(0, 0, L.supR * 1.22, -Math.PI / 2, -Math.PI / 2 + TAU * p.superCharge); c.strokeStyle = '#ffd21f'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke(); }
      else { const pl = (time * 1.6) % 1; c.globalAlpha = 0.7 * (1 - pl); circ(c, 0, 0, L.supR * (1.1 + pl * 0.6)); c.strokeStyle = '#fff3a0'; c.lineWidth = 4; c.stroke(); c.globalAlpha = 1; }
      c.restore();
    }
    actionStick(c, L, s, L.supX, L.supY, L.supR * (ready && !s.active ? 1 + Math.sin(time * 8) * 0.05 : 1), ready ? ['#fff27a', '#ff9f1a'] : ['#7a7a98', '#3a3a58'], iconBolt, now);
  }
  function iconCross(c, r) {
    c.strokeStyle = '#fff'; c.lineWidth = Math.max(3, r * 0.09); c.lineCap = 'round';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.beginPath(); c.moveTo(dx * r * 0.26, dy * r * 0.26); c.lineTo(dx * r * 0.56, dy * r * 0.56); c.stroke(); }
    circ(c, 0, 0, r * 0.28); c.stroke();
  }
  function iconBolt(c, r) {
    c.beginPath(); c.moveTo(r * 0.12, -r * 0.62); c.lineTo(-r * 0.36, r * 0.08); c.lineTo(-r * 0.02, r * 0.08); c.lineTo(-r * 0.14, r * 0.62); c.lineTo(r * 0.36, -r * 0.1); c.lineTo(r * 0.02, -r * 0.1); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = Math.max(2, r * 0.08); c.lineJoin = 'round'; c.stroke();
  }
  // bouton d'action -> manette de visée (zone + bouton qui suit le doigt, annulation au centre)
  function actionStick(c, L, b, cx, cy, R0, cols, icon, now) {
    c.save();
    if (b.active && b.drag) {
      const A = L.atkR * 1.5, ux = b.len ? b.dx / b.len : 0, uy = b.len ? b.dy / b.len : 0, k = Math.min(1, b.len / A);
      circ(c, cx, cy, A); c.fillStyle = b.cancel ? 'rgba(255,50,60,0.24)' : 'rgba(8,12,40,0.30)'; c.fill();
      c.strokeStyle = b.cancel ? 'rgba(255,130,130,0.9)' : 'rgba(255,255,255,0.5)'; c.lineWidth = 3; c.stroke();
      circ(c, cx, cy, L.atkR * 0.28); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.setLineDash([5, 5]); c.lineWidth = 2; c.stroke(); c.setLineDash([]);
      const kx = cx + ux * k * A, ky = cy + uy * k * A, r = R0 * 0.66;
      circ(c, kx + 2, ky + 4, r); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
      circ(c, kx, ky, r); const g = c.createRadialGradient(kx, ky - r * 0.3, 2, kx, ky, r);
      g.addColorStop(0, b.cancel ? '#d0d0d8' : cols[0]); g.addColorStop(1, b.cancel ? '#70707c' : cols[1]); c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
      c.translate(kx, ky);
      if (b.cancel) { c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * 0.32, -r * 0.32); c.lineTo(r * 0.32, r * 0.32); c.moveTo(r * 0.32, -r * 0.32); c.lineTo(-r * 0.32, r * 0.32); c.stroke(); }
      else icon(c, r);
    } else {
      const pr = b.active ? Math.min(1, (now - (b.t0 || 0)) / 80) : 0, sc = 1 - 0.08 * pr;
      c.translate(cx, cy); c.scale(sc, sc);
      circ(c, 2, 5, R0); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
      circ(c, 0, 0, R0); const g = c.createRadialGradient(0, -R0 * 0.35, 2, 0, 0, R0); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
      c.fillStyle = g; c.fill(); c.strokeStyle = OUT; c.lineWidth = 5; c.stroke();
      c.beginPath(); c.arc(0, 0, R0 * 0.8, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
      icon(c, R0);
    }
    c.restore();
  }

  /* ---------- écran d'accueil animé en fond ---------- */
  R.drawMenuBg = function (c, W, H, time) {
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2b49d6'); g.addColorStop(1, '#6a2bd6'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.09; c.fillStyle = '#fff';
    const s = Math.max(W, H) / 9, off = (time * 12) % (s * 2);
    c.translate(-off, -off * 0.5);
    for (let y = -2; y < H / s + 4; y++) for (let x = -2; x < W / s + 4; x++) if ((x + y) % 2 === 0) { c.save(); c.translate(x * s + s / 2, y * s + s / 2); c.rotate(Math.PI / 4); c.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7); c.restore(); }
    c.restore();
    // rayons de lumière rotatifs + bokeh flottant
    c.save(); c.translate(W * 0.45, H * 0.55); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { c.rotate((Math.PI * 2) / 9); const a = c.createLinearGradient(0, 0, 0, -H * 1.1); a.addColorStop(0, 'rgba(255,255,255,0.10)'); a.addColorStop(1, 'rgba(255,255,255,0)'); c.save(); c.rotate(time * 0.05 + i * 0.1); c.fillStyle = a; c.beginPath(); c.moveTo(-W * 0.02, 0); c.lineTo(-W * 0.07, -H * 1.1); c.lineTo(W * 0.07, -H * 1.1); c.lineTo(W * 0.02, 0); c.fill(); c.restore(); }
    c.restore();
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const x = ((i * 137.5 + time * (6 + (i % 4) * 3)) % (W + 40)) - 20, y = H - ((i * 71.3 + time * (8 + (i % 5) * 4)) % (H + 40)) + 20, r = (3 + (i % 5) * 2) * (W / 600); c.fillStyle = 'rgba(255,255,255,' + (0.05 + (i % 3) * 0.04) + ')'; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); }
    c.restore();
    const v = c.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H / 2, H * 0.9); v.addColorStop(0, 'rgba(255,255,255,0.12)'); v.addColorStop(1, 'rgba(0,0,20,0.45)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  };
})();
