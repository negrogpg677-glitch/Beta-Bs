/* Brawl Rush - PRISM : effets de combat (v4.4) — purement graphiques, côté client (aucun effet sur la simulation ni le réseau)
   • traînées lumineuses des projectiles, fumée des roquettes et des bombes ;
   • projectiles des héros PRISM (braise, lame d'énergie, éclat de prisme, rivet) et impacts propres à chacun ;
   • explosions détaillées : boule de feu, fumée qui s'élève, étincelles, braises, trace de brûlure au sol ;
   • réaction aux coups (gerbe d'étincelles), éclats de prisme à l'élimination ;
   • destruction du décor : planches et éclats qui volent, nuage de poussière ;
   • supers : magma d'Ignis, phase fantôme de Nyx-7, supernova de Lumen, mortiers de Krank ;
   • feu d'artifice prismatique à la victoire.
   Qualité haute : tout ; moyenne : quantités réduites ; économie : rien. Lisibilité : effets brefs et contenus. */
(function () {
  const G = window.G, R = G.Render, Sim = G.Sim; if (!R || !Sim) return;
  const TAU = Math.PI * 2, T = G.T || 64, q = () => R.q || 0, rr = (a, b) => a + Math.random() * (b - a);
  const SPEC = ['#36f0ff', '#8a5cff', '#ff4fd8', '#ffb21a', '#7dff9a'];
  const TEAM = ['#5ab8ff', '#ff6070', '#ffd84a'];
  function st(M) { return M._pz || (M._pz = { parts: [], decals: [], trails: new WeakMap(), live: new Set(), alive: [], flash: [], sup: [], jump: [], dash: [], tiles: null, won: false, fw: 0, lastB: null }); }
  function add(M, o) { const S = st(M), max = q() >= 2 ? 300 : 140; if (S.parts.length >= max) return; S.parts.push(Object.assign({ t: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, rot: 0, vr: 0, drag: 0 }, o)); }
  const N = (n) => Math.max(1, Math.round(n * (q() >= 2 ? 1 : 0.5)));

  /* ---------- briques d'effets ---------- */
  function sparks(M, x, y, col, n, spd, dur) { for (let i = 0; i < N(n); i++) { const a = rr(0, TAU), s = spd * rr(0.4, 1.2); add(M, { type: 'streak', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, dur: dur * rr(0.6, 1.2), col, drag: 5, w: rr(1.6, 3) }); } }
  function embers(M, x, y, col, n) { for (let i = 0; i < N(n); i++) add(M, { type: 'ember', x: x + rr(-14, 14), y, z: rr(0, 10), vx: rr(-40, 40), vy: rr(-20, 20), vz: rr(60, 160), g: -40, dur: rr(0.6, 1.2), col, r: rr(1.5, 3.2), drag: 1.5 }); }
  function puffs(M, x, y, n, rad, col, dur) { for (let i = 0; i < N(n); i++) { const a = rr(0, TAU), d = rr(0, rad * 0.6); add(M, { type: 'puff', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * rr(10, 50), vy: Math.sin(a) * rr(10, 50) - 18, dur: dur * rr(0.7, 1.3), r: rad * rr(0.25, 0.45), col: col || '60,56,70', drag: 2 }); } }
  function shards(M, x, y, cols, n, spd) { for (let i = 0; i < N(n); i++) { const a = rr(0, TAU), s = spd * rr(0.4, 1); add(M, { type: 'shard', x, y, z: rr(10, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rr(80, 260), g: 620, dur: rr(0.8, 1.4), col: cols[i % cols.length], r: rr(4, 9), rot: rr(0, TAU), vr: rr(-14, 14), drag: 1.2 }); } }
  function fireball(M, x, y, rad, col) { add(M, { type: 'fireball', x, y, dur: 0.42, r: rad, col: col || '#ffb04a' }); }
  function ringP(M, x, y, r0, r1, dur, col, w) { add(M, { type: 'ringP', x, y, dur, r0, r1, col, w: w || 4 }); }
  function decal(M, o) { const S = st(M); if (S.decals.length > 40) S.decals.shift(); S.decals.push(Object.assign({ t: 0 }, o)); }

  /* ---------- explosions (toutes les explosions du jeu passent par une gerbe « fire ») ---------- */
  const baseBurst = Sim.burst;
  Sim.burst = function (M, x, y, color, n, spd, size, dur, type) {
    baseBurst.apply(this, arguments);
    if (M.online || q() < 1) return;
    const S = st(M);
    if (type === 'fire' && n >= 5) {
      const rad = Math.max(40, spd / 0.8), tint = S.lastB && Math.abs(S.lastB.x - x) < 2 && Math.abs(S.lastB.y - y) < 2 ? S.lastB.c : '#ffb04a';
      fireball(M, x, y, rad * 0.95, tint); puffs(M, x, y, n >= 10 ? 9 : 5, rad, '52,46,58', 1.4); sparks(M, x, y, '#fff1b0', n >= 10 ? 12 : 7, rad * 4, 0.35); embers(M, x, y, '#ffb04a', n >= 10 ? 10 : 5);
      decal(M, { type: 'scorch', x, y, r: rad * 0.9, dur: 5 });
    } else if (!type && typeof color === 'string') S.lastB = { x, y, c: color };
  };

  /* ---------- détection des évènements (hors ligne et en ligne) ---------- */
  function scan(M, dt) {
    const S = st(M);
    // projectiles : traînées + impacts
    const now = new Set();
    for (const p of M.projs) {
      now.add(p);
      let tr = S.trails.get(p); if (!tr) { tr = []; S.trails.set(p, tr); }
      tr.push(p.x, p.y - (p.z || 0)); const max = q() >= 2 ? 18 : 10; if (tr.length > max) tr.splice(0, tr.length - max);
      if ((p.shape === 'rocket' || p.lob) && Math.random() < dt * 30) add(M, { type: 'puff', x: p.x + rr(-3, 3), y: p.y - (p.z || 0) + rr(-3, 3), vx: rr(-8, 8), vy: rr(-14, -4), dur: 0.5, r: p.shape === 'rocket' ? 6 : 4, col: p.shape === 'rocket' ? '190,186,200' : '120,116,130', drag: 1 });
      if (p.shape === 'ember' && Math.random() < dt * 25) add(M, { type: 'ember', x: p.x, y: p.y, z: 6, vx: rr(-20, 20), vy: rr(-20, 20), vz: rr(20, 60), g: -20, dur: 0.4, col: '#ffb04a', r: 2 });
      p._pzx = p.x; p._pzy = p.y - (p.z || 0);
    }
    for (const p of S.live) if (!now.has(p) && !p.lob) impact(M, p);
    S.live = now;
    for (const b of M.ents) {
      if (!b) continue; const i = b.idx === undefined ? M.ents.indexOf(b) : b.idx, col = TEAM[b.team === 0 ? 0 : b.team === 1 ? 1 : 2];
      // coup reçu : gerbe d'étincelles
      const fl = b.flash || 0; if (fl > 0 && !(S.flash[i] > 0) && b.alive) { sparks(M, b.x, b.y - 22, '#ffffff', 4, 260, 0.22); if (q() >= 2) ringP(M, b.x, b.y - 18, 6, 30, 0.2, 'rgba(255,255,255,0.9)', 3); }
      S.flash[i] = fl;
      // élimination : éclats de prisme
      if (S.alive[i] && !b.alive && !b.isBoss) { shards(M, b.x, b.y - 20, [col, '#ffffff', SPEC[i % 4]], 12, 300); ringP(M, b.x, b.y, 10, 140, 0.5, col, 6); }
      S.alive[i] = !!b.alive;
      // supers des héros PRISM
      const sc = b.superCharge || 0;
      if ((S.sup[i] || 0) >= 1 && sc < 0.5 && b.alive) superFx(M, b);
      S.sup[i] = sc;
      // Ignis : traînée de feu pendant le saut, éruption de magma à l'atterrissage
      const jumping = !!b.jump; if (jumping && b.id === 'ignis' && Math.random() < dt * 40) embers(M, b.x, b.y, '#ff8a2a', 2);
      if (S.jump[i] && !jumping && b.alive && b.id === 'ignis') magma(M, b.x, b.y, (b.def.sup.splash || 2) * T);
      S.jump[i] = jumping;
      // Nyx-7 : sillage spectral pendant la phase, entaille en croix à la sortie
      const dashing = !!b.dash; if (dashing && b.id === 'nyx') { add(M, { type: 'streak', x: b.x + rr(-10, 10), y: b.y - 20 + rr(-12, 12), vx: -Math.cos(b.face) * 220, vy: -Math.sin(b.face) * 220, dur: 0.25, col: '#36f0ff', drag: 6, w: 3 }); if (Math.random() < dt * 30) add(M, { type: 'ghost', x: b.x, y: b.y, dur: 0.3, col: '#36f0ff', r: 26 }); }
      if (S.dash[i] && !dashing && b.id === 'nyx') { add(M, { type: 'slash', x: b.x, y: b.y - 20, dur: 0.4, col: '#9ffcff', r: 60, rot: b.face }); sparks(M, b.x, b.y - 20, '#36f0ff', 8, 300, 0.3); }
      S.dash[i] = dashing;
    }
    // décor détruit : caisses et blocs volent en éclats
    const tl = M.map && M.map.tiles;
    if (tl) {
      if (!S.tiles || S.tiles.length !== tl.length) S.tiles = Uint8Array.from(tl);
      else for (let k = 0; k < tl.length; k++) if (tl[k] !== S.tiles[k]) { if (tl[k] === 0 && (S.tiles[k] === 2 || S.tiles[k] === 6)) debris(M, ((k % M.w) + 0.5) * T, ((k / M.w | 0) + 0.5) * T, S.tiles[k]); S.tiles[k] = tl[k]; }
    }
    // victoire : feu d'artifice prismatique
    if (M.state === 'end' && M.result && M.player && !S.won) {
      const w = M.result.win !== undefined ? M.result.win : M.result.winnerTeam === M.player.team;
      if (w) { S.won = true; S.fw = 2.6; }
    }
    if (S.fw > 0) { S.fw -= dt; S.fwT = (S.fwT || 0) - dt; if (S.fwT <= 0) { S.fwT = 0.32; const p = M.player, x = p.x + rr(-260, 260), y = p.y + rr(-240, 60); shards(M, x, y, SPEC, 14, 380); ringP(M, x, y, 8, 120, 0.55, SPEC[(Math.random() * 4) | 0], 5); sparks(M, x, y, '#ffffff', 8, 360, 0.4); } }
  }
  function impact(M, p) {
    const x = p._pzx, y = p._pzy; if (x === undefined) return;
    // touché (près d'un brawler ou d'un mur) ou simple fin de portée ?
    let hit = false;
    for (const e of M.ents) if (e && e.alive && e.team !== p.team && Math.abs(e.x - x) < 46 && Math.abs(e.y - 20 - y) < 56) { hit = true; break; }
    if (!hit && G.isBulletTile) { const a = p.ang || 0; hit = G.isBulletTile(Sim.tileAt(M, x + Math.cos(a) * 26, y + Math.sin(a) * 26)); }
    const col = p.color || '#fff';
    if (!hit) { add(M, { type: 'flare', x, y, dur: 0.18, r: (p.r || 6) * 2.2, col }); return; }
    switch (p.shape) {
      case 'ember': fireball(M, x, y, 26, '#ff7a1a'); embers(M, x, y, '#ffb04a', 5); sparks(M, x, y, '#ffd27a', 3, 200, 0.25); break;
      case 'blade': add(M, { type: 'slash', x, y, dur: 0.28, col: '#9ffcff', r: 30, rot: p.ang || 0 }); sparks(M, x, y, '#36f0ff', 4, 260, 0.22); break;
      case 'prism': shards(M, x, y, SPEC, 4, 160); add(M, { type: 'flare', x, y, dur: 0.22, r: 22, col: '#ffffff' }); break;
      case 'rivet': sparks(M, x, y, '#fff1b0', 5, 320, 0.2); puffs(M, x, y, 1, 18, '150,146,160', 0.4); break;
      default: add(M, { type: 'flare', x, y, dur: 0.2, r: (p.r || 6) * 3, col }); if (q() >= 2) sparks(M, x, y, col, 3, 220, 0.2);
    }
  }
  function superFx(M, b) {
    if (b.id === 'lumen') { // supernova : anneaux du spectre, éclats, colonne de lumière
      SPEC.slice(0, 4).forEach((c, k) => ringP(M, b.x, b.y - 10, 10, (b.def.sup.radius || 4) * T * (0.7 + k * 0.12), 0.55 + k * 0.08, c, 6 - k));
      shards(M, b.x, b.y - 30, SPEC, 16, 420); add(M, { type: 'column', x: b.x, y: b.y, dur: 0.8, r: 46, col: '#f0d8ff' });
    } else if (b.id === 'krank') { puffs(M, b.x + 20, b.y - 30, 6, 40, '200,196,210', 0.9); sparks(M, b.x, b.y - 30, '#3affb0', 8, 260, 0.3); }
    else if (b.id === 'ignis') { embers(M, b.x, b.y, '#ff8a2a', 14); fireball(M, b.x, b.y - 10, 50, '#ff6a1a'); }
    else if (b.id === 'nyx') { ringP(M, b.x, b.y - 18, 8, 70, 0.3, '#36f0ff', 5); }
  }
  function magma(M, x, y, rad) {
    decal(M, { type: 'lava', x, y, r: rad, dur: 2.6 }); fireball(M, x, y, rad * 0.8, '#ff5a1a');
    for (let i = 0; i < N(6); i++) { const a = (i / 6) * TAU + rr(-0.3, 0.3), d = rad * rr(0.3, 0.75); add(M, { type: 'column', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, dur: rr(0.5, 0.9), r: rr(14, 24), col: '#ff8a2a' }); }
    embers(M, x, y, '#ffb04a', 18); shards(M, x, y, ['#2a2224', '#3a3034', '#ff6a1a'], 10, 320);
  }
  function debris(M, x, y, t) {
    const wood = t === 6 ? ['#ffe14a', '#d9a25e', '#b07a3a'] : ['#d9a25e', '#b07a3a', '#8a5a2a'];
    for (let i = 0; i < N(9); i++) { const a = rr(0, TAU), s = rr(80, 260); add(M, { type: 'plank', x: x + rr(-12, 12), y: y + rr(-12, 12), z: rr(10, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rr(140, 320), g: 760, dur: rr(0.9, 1.5), col: wood[i % 3], r: rr(5, 11), rot: rr(0, TAU), vr: rr(-12, 12), drag: 1.4 }); }
    puffs(M, x, y, 6, 70, '214,190,150', 1.0); sparks(M, x, y, '#fff3d0', 5, 240, 0.25);
    decal(M, { type: 'scorch', x, y, r: 26, dur: 3, a: 0.25 });
  }

  /* ---------- mise à jour et rendu ---------- */
  function step(M, dt) {
    const S = st(M);
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i]; p.t += dt; if (p.t >= p.dur) { S.parts.splice(i, 1); continue; }
      const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.g) { p.vz -= p.g * dt; p.z += p.vz * dt; if (p.z < 0 && p.g > 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; p.vr *= 0.5; } }
    }
    for (let i = S.decals.length - 1; i >= 0; i--) { const d = S.decals[i]; d.t += dt; if (d.t >= d.dur) S.decals.splice(i, 1); }
  }
  function drawDecals(c, M) {
    const S = M._pz; if (!S || !S.decals.length) return;
    for (const d of S.decals) {
      const k = d.t / d.dur, fade = k > 0.7 ? (1 - k) / 0.3 : 1;
      if (d.type === 'scorch') { const g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, 'rgba(20,14,12,' + (0.5 * fade * (d.a ? d.a * 2 : 1)) + ')'); g.addColorStop(1, 'rgba(20,14,12,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * 0.8, 0, 0, TAU); c.fill(); }
      else if (d.type === 'lava') { // flaque de magma : croûte sombre, cœur incandescent, bulles
        const rx = d.r, ry = d.r * 0.8, g = c.createRadialGradient(d.x, d.y, 0, d.x, d.y, rx);
        g.addColorStop(0, 'rgba(255,214,110,' + 0.95 * fade + ')'); g.addColorStop(0.35, 'rgba(255,120,30,' + 0.9 * fade + ')'); g.addColorStop(0.8, 'rgba(170,40,14,' + 0.75 * fade + ')'); g.addColorStop(1, 'rgba(60,16,10,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(d.x, d.y, rx, ry, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(40,16,12,' + 0.55 * fade + ')'; for (let i = 0; i < 7; i++) { const a = i * 0.9 + d.x * 0.01, rr2 = rx * (0.45 + (i % 3) * 0.15); c.beginPath(); c.ellipse(d.x + Math.cos(a) * rr2, d.y + Math.sin(a) * rr2 * 0.8, rx * 0.16, ry * 0.1, a, 0, TAU); c.fill(); }
        c.save(); c.globalCompositeOperation = 'lighter'; const b = (performance.now() / 1000) % 1; c.fillStyle = 'rgba(255,230,140,' + 0.5 * fade * (1 - b) + ')'; c.beginPath(); c.arc(d.x + rx * 0.2, d.y - ry * 0.1, 4 + b * 8, 0, TAU); c.fill(); c.restore();
      }
    }
  }
  function glow(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function drawLit(c, M) { // fumées, débris, éclats (éclairés par la carte de lumière)
    const S = M._pz; if (!S) return;
    for (const p of S.parts) {
      const k = p.t / p.dur;
      if (p.type === 'puff') { c.globalAlpha = (1 - k) * 0.5; c.fillStyle = 'rgb(' + p.col + ')'; c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k * 1.6), 0, TAU); c.fill(); }
      else if (p.type === 'plank' || p.type === 'shard') {
        c.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1; c.save(); c.translate(p.x, p.y - p.z); c.rotate(p.rot);
        if (p.type === 'plank') { c.fillStyle = p.col; c.fillRect(-p.r, -p.r * 0.32, p.r * 2, p.r * 0.64); c.strokeStyle = 'rgba(40,20,10,0.8)'; c.lineWidth = 1.2; c.strokeRect(-p.r, -p.r * 0.32, p.r * 2, p.r * 0.64); }
        else { c.beginPath(); c.moveTo(0, -p.r); c.lineTo(p.r * 0.8, p.r * 0.6); c.lineTo(-p.r * 0.8, p.r * 0.6); c.closePath(); c.fillStyle = p.col; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1; c.stroke(); }
        c.restore();
        if (p.z > 2) { c.globalAlpha = 0.25 * (1 - k); c.fillStyle = '#000'; c.beginPath(); c.ellipse(p.x, p.y + 2, p.r * 0.8, p.r * 0.3, 0, 0, TAU); c.fill(); }
      }
    }
    c.globalAlpha = 1;
  }
  function drawGlow(c, M) { // lumière pure, par-dessus l'éclairage (additif)
    const S = M._pz; if (!S) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    // traînées des projectiles
    for (const p of M.projs) {
      const tr = S.trails.get(p); if (!tr || tr.length < 4 || p.lob) continue;
      const n = tr.length / 2, w0 = Math.max(3, (p.r || 6) * (p.shape === 'blade' ? 2.2 : 1.3)), col = p.shape === 'prism' ? null : (p.color || '#fff');
      for (let i = 1; i < n; i++) {
        const f = i / n; c.globalAlpha = f * (q() >= 2 ? 0.55 : 0.4); c.strokeStyle = col || SPEC[i % 4]; c.lineWidth = w0 * f;
        c.beginPath(); c.moveTo(tr[(i - 1) * 2], tr[(i - 1) * 2 + 1]); c.lineTo(tr[i * 2], tr[i * 2 + 1]); c.stroke();
      }
    }
    for (const p of S.parts) {
      const k = p.t / p.dur;
      switch (p.type) {
        case 'streak': c.globalAlpha = 1 - k; c.strokeStyle = p.col; c.lineWidth = p.w || 2.4; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke(); break;
        case 'ember': glow(c, p.x, p.y - p.z, p.r * 3, p.col, (1 - k) * 0.9); c.globalAlpha = 1 - k; c.fillStyle = '#fff3c0'; c.fillRect(p.x - p.r / 2, p.y - p.z - p.r / 2, p.r, p.r); break;
        case 'fireball': { const e = 1 - Math.pow(1 - k, 3), r = p.r * (0.35 + e * 0.75); glow(c, p.x, p.y - r * 0.2, r, '#fff6d0', (1 - k) * 0.9); glow(c, p.x, p.y - r * 0.25, r * 1.35, p.col, (1 - k) * 0.7); break; }
        case 'flare': glow(c, p.x, p.y, p.r * (1 + k), p.col, (1 - k) * 0.85); break;
        case 'ringP': c.globalAlpha = (1 - k) * 0.9; c.strokeStyle = p.col; c.lineWidth = p.w * (1 - k * 0.5); c.beginPath(); c.ellipse(p.x, p.y, Math.max(1, p.r0 + (p.r1 - p.r0) * (1 - (1 - k) * (1 - k))), Math.max(1, (p.r0 + (p.r1 - p.r0) * (1 - (1 - k) * (1 - k))) * 0.8), 0, 0, TAU); c.stroke(); break;
        case 'slash': { c.globalAlpha = 1 - k; c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0); const L = p.r * (0.6 + k * 0.6); c.strokeStyle = p.col; c.lineWidth = 6 * (1 - k); c.beginPath(); c.moveTo(-L, -L * 0.5); c.lineTo(L, L * 0.5); c.moveTo(-L, L * 0.5); c.lineTo(L, -L * 0.5); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 2 * (1 - k); c.stroke(); c.restore(); break; }
        case 'column': { const h = 160 * Math.sin(Math.min(1, k * 2) * Math.PI / 2), w = p.r * (1 - k * 0.5), g = c.createLinearGradient(0, p.y - h, 0, p.y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, p.col); c.globalAlpha = (1 - k) * 0.8; c.fillStyle = g; c.fillRect(p.x - w / 2, p.y - h, w, h); break; }
        case 'ghost': glow(c, p.x, p.y - 24, p.r, p.col, (1 - k) * 0.45); break;
        case 'shard': if (k < 0.3) glow(c, p.x, p.y - p.z, p.r * 2.4, p.col, (0.3 - k) * 1.5); break;
      }
    }
    c.restore(); c.globalAlpha = 1;
  }

  /* ---------- formes des projectiles des héros PRISM ---------- */
  R.projShape = R.projShape || {};
  R.projShape.ember = (c, p) => { // braise de forge : roche incandescente
    c.rotate(p.age * 9); const fl = 1 + Math.sin(p.age * 40) * 0.12;
    c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 20 * fl, '#ff7a1a', 0.75); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.beginPath(); for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, r = 8 + ((i * 37) % 5); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fillStyle = '#3a1a10'; c.fill(); c.strokeStyle = '#1a0a06'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#ffb04a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, -2); c.lineTo(0, 1); c.lineTo(4, -3); c.moveTo(0, 1); c.lineTo(1, 6); c.stroke();
  };
  R.projShape.blade = (c, p, a) => { // lame d'énergie en croissant
    c.rotate(a); c.globalCompositeOperation = 'lighter';
    c.beginPath(); c.arc(-10, 0, 20, -1.2, 1.2); c.strokeStyle = 'rgba(54,240,255,0.55)'; c.lineWidth = 12; c.lineCap = 'round'; c.stroke();
    c.beginPath(); c.arc(-10, 0, 20, -1.05, 1.05); c.strokeStyle = '#eaffff'; c.lineWidth = 4; c.stroke(); c.globalCompositeOperation = 'source-over';
  };
  R.projShape.prism = (c, p, a) => { // éclat de prisme : triangle au dégradé du spectre
    c.rotate(a + p.age * 8); c.globalCompositeOperation = 'lighter'; glow(c, 0, 0, 18, '#c8a8ff', 0.6); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const g = c.createLinearGradient(-9, 0, 9, 0); SPEC.slice(0, 4).forEach((k, i) => g.addColorStop(i / 3, k));
    c.beginPath(); c.moveTo(0, -11); c.lineTo(9.5, 6); c.lineTo(-9.5, 6); c.closePath(); c.fillStyle = g; c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
  };
  R.projShape.rivet = (c, p, a) => { // rivet de métal chauffé
    c.rotate(a); c.strokeStyle = 'rgba(255,210,106,0.45)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-6, 0); c.stroke();
    const g = c.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#f4f6fa'); g.addColorStop(0.5, '#8a909c'); g.addColorStop(1, '#4a4f5a');
    c.fillStyle = g; c.fillRect(-7, -3, 12, 6); c.beginPath(); c.arc(5, 0, 5, -Math.PI / 2, Math.PI / 2); c.fill(); c.strokeStyle = '#1a1530'; c.lineWidth = 1.6; c.strokeRect(-7, -3, 12, 6);
    c.globalCompositeOperation = 'lighter'; glow(c, 8, 0, 8, '#ffb04a', 0.8); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  };

  /* ---------- branchements ---------- */
  let lastT = 0;
  const baseDraw = R.drawMatch;
  R.drawMatch = function (c, M) {
    const now = performance.now(), dt = Math.min(0.1, (now - (lastT || now)) / 1000); lastT = now;
    if (q() >= 1 && M && M.ents && !M.replay) { try { scan(M, dt); step(M, dt); } catch (e) { /* effet ignoré */ } }
    return baseDraw.apply(this, arguments);
  };
  if (R.World && R.World.drawGround) { const bg = R.World.drawGround; R.World.drawGround = function (c, M) { const r = bg.apply(this, arguments); if (q() >= 1) { try { drawDecals(c, M); } catch (e) { /* rien */ } } return r; }; }
  const baseHook = R.vfxHook;
  R.vfxHook = function (c, M) {
    if (q() >= 1) { try { drawLit(c, M); } catch (e) { /* rien */ } }
    if (baseHook) baseHook.apply(this, arguments);
    if (q() >= 1) { try { drawGlow(c, M); } catch (e) { /* rien */ } }
  };
  G.PrismFX = { scan, add, magma, debris, superFx };
})();
