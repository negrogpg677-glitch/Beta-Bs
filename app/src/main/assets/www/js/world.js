/* Brawl Rush — moteur de rendu du décor en blocs mis en cache.
   Le sol, l'eau, les ombres, les marquages, les murs et les buissons sont dessinés UNE fois dans des blocs de 8×8 tuiles
   (à la résolution de l'écran), puis réutilisés : ~10 dessins par image au lieu de plusieurs centaines.
   Un bloc n'est redessiné que si une tuile change (caisse détruite). Ce coût unique permet un décor beaucoup plus riche. */
(function () {
  const G = window.G, R = G.Render, T = G.T;
  const W = (R.World = {});
  const CH = 8, MARGIN = 2; // tuiles par bloc, recouvrement anti-joints (unités monde)
  const MAXC = 40; // blocs gardés en mémoire par couche
  let cache = null, frame = 0;
  const TAU = Math.PI * 2;

  /* bruit déterministe */
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const solid = (t) => t === 1 || t === 2 || t === 5 || t === 6;

  W.reset = () => { cache = null; };
  W.stats = () => (cache ? { ground: cache.ground.size, bush: cache.bush.size, rs: cache.rs, built: cache.built } : null);

  function ensure(M, rs) {
    const key = (M.map.seed || 0) + ':' + M.mapKey + ':' + M.w + 'x' + M.h + ':' + M.map.theme + ':' + R.q;
    if (!cache || cache.key !== key || cache.rs !== rs || cache.map !== M.map) {
      cache = { key, rs, map: M.map, ground: new Map(), bush: new Map(), tiles: Uint8Array.from(M.map.tiles), built: 0 };
    }
    const t = M.map.tiles, old = cache.tiles;
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== old[i]) {
        old[i] = t[i];
        const tx = i % M.w, ty = (i / M.w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const k = Math.floor((tx + dx) / CH) + ',' + Math.floor((ty + dy) / CH);
          const g = cache.ground.get(k), b = cache.bush.get(k); if (g) g.dirty = true; if (b) b.dirty = true;
        }
      }
    }
  }

  function getChunk(M, layer, kx, ky) {
    const store = layer === 'g' ? cache.ground : cache.bush, k = kx + ',' + ky;
    let e = store.get(k);
    if (e && e.dirty && cache.budget > 0) { cache.budget--; e.cv = build(M, layer, kx, ky); e.dirty = false; cache.built++; } // reconstruction étalée (pas d'à-coup)
    if (!e) {
      e = { cv: build(M, layer, kx, ky), used: frame };
      store.set(k, e); cache.built++;
      if (store.size > MAXC) { // éviction du bloc le moins récemment utilisé
        let oldK = null, oldF = Infinity;
        for (const [kk, v] of store) if (v.used < oldF) { oldF = v.used; oldK = kk; }
        if (oldK) store.delete(oldK);
      }
    }
    e.used = frame;
    return e.cv;
  }

  function build(M, layer, kx, ky) {
    const rs = cache.rs, span = CH * T + MARGIN * 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = Math.ceil(span * rs);
    const c = cv.getContext('2d');
    c.scale(rs, rs);
    c.translate(-kx * CH * T + MARGIN, -ky * CH * T + MARGIN);
    c.beginPath(); c.rect(kx * CH * T - MARGIN, ky * CH * T - MARGIN, span, span); c.clip();
    const tx0 = Math.max(0, kx * CH - 1), tx1 = Math.min(M.w - 1, kx * CH + CH), ty0 = Math.max(0, ky * CH - 1), ty1 = Math.min(M.h - 1, ky * CH + CH + 1);
    if (layer === 'g') paintGround(c, M, tx0, ty0, tx1, ty1, kx, ky); else paintBush(c, M, tx0, ty0, tx1, ty1);
    return cv;
  }

  /* ---------- couche sol + murs ---------- */
  function paintGround(c, M, tx0, ty0, tx1, ty1, kx, ky) {
    const th = G.THEMES[M.map.theme], S = R.getSprites(M.map.theme), tiles = M.map.tiles, w = M.w, seed = (M.map.seed || 7) & 0xffff;
    const tile = (x, y) => (x < 0 || y < 0 || x >= M.w || y >= M.h ? 1 : tiles[y * w + x]);
    const border = (x, y) => x === 0 || y === 0 || x === M.w - 1 || y === M.h - 1;
    // 1. sol de base
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tiles[ty * w + tx];
      if (t === 1 && border(tx, ty)) {
        const g = c.createLinearGradient(0, ty * T, 0, ty * T + T); g.addColorStop(0, G.shade(th.border, -0.25)); g.addColorStop(1, G.shade(th.border, -0.42));
        c.fillStyle = g; c.fillRect(tx * T, ty * T, T, T);
        continue;
      }
      const v = ((tx * 7 + ty * 13) ^ (tx * ty)) & 3;
      c.drawImage(S.ground[v], tx * T, ty * T, T, T);
    }
    // 2. grandes taches de couleur (variation organique du terrain)
    const cell = 3;
    for (let gy = Math.floor(ty0 / cell) - 1; gy <= Math.ceil(ty1 / cell) + 1; gy++) for (let gx = Math.floor(tx0 / cell) - 1; gx <= Math.ceil(tx1 / cell) + 1; gx++) {
      const h = hash(gx, gy, seed), h2 = hash(gx, gy, seed + 1), h3 = hash(gx, gy, seed + 2);
      const x = (gx + h) * cell * T, y = (gy + h2) * cell * T, r = (1.4 + h3 * 2.2) * T;
      const dark = h3 > 0.5, a = 0.07 + h * 0.06;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, dark ? 'rgba(0,0,0,' + a + ')' : 'rgba(255,255,255,' + a * 0.8 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 3. décor détaillé par tuile
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tiles[ty * w + tx];
      if (t !== 0 && t !== 3) continue;
      decorate(c, th, tx, ty, seed);
    }
    // 4. eau : fond animé dessiné ailleurs ; ici profondeur + écume des berges
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tiles[ty * w + tx] !== 4) continue;
      const x = tx * T, y = ty * T;
      c.drawImage(S.water, x, y, T, T);
      const lava = th.deco === 'ember';
      const g = c.createLinearGradient(0, y, 0, y + T); g.addColorStop(0, lava ? 'rgba(255,240,150,0.35)' : 'rgba(255,255,255,0.12)'); g.addColorStop(1, lava ? 'rgba(160,30,0,0.25)' : 'rgba(0,30,80,0.22)');
      c.fillStyle = g; c.fillRect(x, y, T, T);
      c.strokeStyle = lava ? 'rgba(255,220,120,0.9)' : 'rgba(255,255,255,0.75)'; c.lineWidth = 3; c.lineCap = 'round';
      const edge = (nx, ny, x1, y1, x2, y2) => { if (tile(nx, ny) !== 4) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); } };
      edge(tx, ty - 1, x + 3, y + 2, x + T - 3, y + 2); edge(tx, ty + 1, x + 3, y + T - 2, x + T - 3, y + T - 2);
      edge(tx - 1, ty, x + 2, y + 3, x + 2, y + T - 3); edge(tx + 1, ty, x + T - 2, y + 3, x + T - 2, y + T - 3);
    }
    // 5. occlusion ambiante au pied des obstacles
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tiles[ty * w + tx]; if (solid(t) || t === 4) continue;
      const x = tx * T, y = ty * T, d = 16;
      const ao = (nx, ny, gx0, gy0, gx1, gy1, rx, ry, rw, rh) => { if (!solid(tile(nx, ny))) return; const g = c.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(rx, ry, rw, rh); };
      ao(tx - 1, ty, x, 0, x + d, 0, x, y, d, T); ao(tx + 1, ty, x + T, 0, x + T - d, 0, x + T - d, y, d, T);
      ao(tx, ty - 1, 0, y, 0, y + d, x, y, T, d); ao(tx, ty + 1, 0, y + T, 0, y + T - d, x, y + T - d, T, d);
    }
    // 6. ombres portées (soleil en haut à gauche)
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = tiles[ty * w + tx];
      if ((t === 1 && !border(tx, ty)) || t === 2 || t === 6) { c.beginPath(); c.moveTo(tx * T + 4, ty * T + T - 4); c.lineTo(tx * T + T + 18, ty * T + T - 4); c.lineTo(tx * T + T + 18, ty * T + T + 14); c.lineTo(tx * T - 6, ty * T + T + 14); c.fill(); }
      else if (t === 3) { c.beginPath(); c.ellipse(tx * T + T / 2 + 7, ty * T + T - 2, 31, 11, 0, 0, TAU); c.fill(); }
    }
    // 7. marquages statiques (terrain de foot, zones d'apparition, coffres)
    if (R._fieldMarks) R._fieldMarks(c, M, th);
    // 8. murs, caisses et boîtes, rangée par rangée (le haut d'un mur recouvre la face avant de celui du dessus)
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) W.wallTile(c, M, tx, ty, false);
  }

  function decorate(c, th, tx, ty, seed) {
    const x = tx * T, y = ty * T, n = 3 + Math.floor(hash(tx, ty, seed + 9) * 4);
    for (let i = 0; i < n; i++) {
      const h1 = hash(tx, ty, seed + 20 + i), h2 = hash(tx, ty, seed + 40 + i), h3 = hash(tx, ty, seed + 60 + i);
      const px = x + 4 + h1 * (T - 8), py = y + 4 + h2 * (T - 8);
      switch (th.deco) {
        case 'flower':
          if (h3 < 0.55) { c.strokeStyle = G.shade(th.g1, -0.28); c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 2, py - 6); c.moveTo(px + 2, py); c.lineTo(px + 3, py - 7); c.moveTo(px + 4, py); c.lineTo(px + 7, py - 5); c.stroke(); }
          else if (h3 < 0.75) { c.fillStyle = ['#ffffff', '#ffe27a', '#ffb3d9', '#b9d8ff'][Math.floor(h1 * 4)]; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(px + Math.cos(k * 1.57) * 2.2, py + Math.sin(k * 1.57) * 2.2, 1.8, 0, TAU); c.fill(); } c.fillStyle = '#ffcc00'; c.beginPath(); c.arc(px, py, 1.3, 0, TAU); c.fill(); }
          else if (h3 < 0.83) { c.fillStyle = 'rgba(110,110,120,0.55)'; c.beginPath(); c.ellipse(px, py, 3.5, 2.4, 0, 0, TAU); c.fill(); }
          break;
        case 'pebble':
          if (h3 < 0.4) { c.fillStyle = 'rgba(120,80,40,0.3)'; c.beginPath(); c.ellipse(px, py, 2.5 + h1 * 2, 1.7 + h2, 0, 0, TAU); c.fill(); }
          else if (h3 < 0.55) { c.strokeStyle = 'rgba(140,90,40,0.28)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px - 6, py); c.lineTo(px - 1, py + 2); c.lineTo(px + 3, py - 1); c.lineTo(px + 7, py + 1); c.stroke(); }
          else if (h3 < 0.7) { c.strokeStyle = 'rgba(255,240,200,0.35)'; c.lineWidth = 1.4; c.beginPath(); c.arc(px, py + 6, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
          break;
        case 'snow':
          if (h3 < 0.45) { c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(px, py, 1.4 + h1 * 1.5, 0, TAU); c.fill(); }
          else if (h3 < 0.6) { c.fillStyle = 'rgba(150,190,230,0.22)'; c.beginPath(); c.ellipse(px, py, 6, 3, h1, 0, TAU); c.fill(); }
          else if (h3 < 0.66) { c.strokeStyle = 'rgba(140,180,220,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 6, py + 3); c.lineTo(px + 9, py - 2); c.stroke(); }
          break;
        case 'ember':
          if (h3 < 0.3) { c.strokeStyle = 'rgba(255,110,30,0.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px - 5, py - 2); c.lineTo(px, py + 1); c.lineTo(px + 6, py - 1); c.stroke(); c.strokeStyle = 'rgba(255,200,90,0.35)'; c.lineWidth = 4; c.stroke(); }
          else if (h3 < 0.6) { c.fillStyle = 'rgba(20,10,12,0.35)'; c.beginPath(); c.ellipse(px, py, 3 + h1 * 2, 2, 0, 0, TAU); c.fill(); }
          break;
        case 'star':
          if (h3 < 0.35) { c.fillStyle = 'rgba(200,220,255,0.7)'; c.beginPath(); c.arc(px, py, 1.1, 0, TAU); c.fill(); }
          else if (h3 < 0.45) { c.fillStyle = 'rgba(120,255,230,0.25)'; c.beginPath(); c.arc(px, py, 5, 0, TAU); c.fill(); c.fillStyle = '#9ffff0'; c.beginPath(); c.arc(px, py, 1.8, 0, TAU); c.fill(); }
          else if (h3 < 0.6) { c.fillStyle = 'rgba(40,140,110,0.3)'; c.beginPath(); c.ellipse(px, py, 4, 2.5, 0, 0, TAU); c.fill(); }
          break;
      }
    }
  }

  /* dessin d'une tuile solide (utilisé par le cache ET pour l'occlusion devant les personnages) */
  W.wallTile = function (c, M, tx, ty, topOnly) {
    const t = M.map.tiles[ty * M.w + tx];
    if (t !== 1 && t !== 2 && t !== 6) return;
    const S = R.getSprites(M.map.theme), L = S.lift, th = G.THEMES[M.map.theme], seed = (M.map.seed || 7) & 0xffff;
    const border = tx === 0 || ty === 0 || tx === M.w - 1 || ty === M.h - 1;
    if (topOnly) { c.save(); c.beginPath(); c.rect(tx * T - 2, ty * T - L - 2, T + 4, T + 1); c.clip(); }
    const img = t === 1 ? (border ? S.border : S.wall) : t === 2 ? S.crate : S.box;
    c.drawImage(img, tx * T, ty * T - L, T, T + L);
    if (t === 1 && !border) { // variations propres à chaque bloc
      const h = hash(tx, ty, seed + 101), h2 = hash(tx, ty, seed + 102);
      c.fillStyle = h > 0.5 ? 'rgba(255,255,255,' + (h - 0.5) * 0.16 + ')' : 'rgba(0,0,0,' + (0.5 - h) * 0.16 + ')';
      c.fillRect(tx * T + 4, ty * T - L + 4, T - 8, T - 6);
      if (th.deco === 'snow' && h2 < 0.6) { c.fillStyle = 'rgba(255,255,255,0.92)'; c.beginPath(); c.ellipse(tx * T + T * (0.35 + h * 0.3), ty * T - L + 7, 12 + h2 * 8, 5, 0, 0, TAU); c.fill(); }
      if (th.deco === 'flower' && h2 < 0.35) { c.fillStyle = '#4c9a36'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(tx * T + 8 + i * 4 + h * 20, ty * T + T - 4, 3, 0, TAU); c.fill(); } }
      if (th.deco === 'pebble' && h2 < 0.4) { c.strokeStyle = 'rgba(80,40,10,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(tx * T + 14 + h * 20, ty * T - L + 10); c.lineTo(tx * T + 22 + h * 18, ty * T - L + 24); c.lineTo(tx * T + 18 + h * 18, ty * T - L + 34); c.stroke(); }
      if (th.deco === 'star' && h2 < 0.3) { c.fillStyle = 'rgba(200,180,255,0.8)'; c.beginPath(); c.arc(tx * T + 15 + h * 30, ty * T - L + 12 + h2 * 20, 1.6, 0, TAU); c.fill(); }
    }
    if (topOnly) c.restore();
  };

  /* ---------- couche buissons (dessinée par-dessus les brawlers cachés dedans) ---------- */
  function paintBush(c, M, tx0, ty0, tx1, ty1) {
    const S = R.getSprites(M.map.theme), th = G.THEMES[M.map.theme], tiles = M.map.tiles, seed = (M.map.seed || 7) & 0xffff;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tiles[ty * M.w + tx] !== 3) continue;
      const h = hash(tx, ty, seed + 300);
      c.drawImage(S.bush, tx * T - 4 + (h - 0.5) * 4, ty * T - 8, T + 8, T + 8);
      if (th.deco === 'flower' && h < 0.3) { c.fillStyle = ['#ffffff', '#ffb3d9', '#ffe27a'][Math.floor(h * 10) % 3]; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(tx * T + 14 + i * 13 + h * 10, ty * T + 8 + ((i * 7) % 12), 2.6, 0, TAU); c.fill(); } }
      if (th.deco === 'snow' && h < 0.5) { c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(tx * T + T / 2, ty * T - 2, 18, 6, 0, 0, TAU); c.fill(); }
    }
  }

  /* ---------- API ---------- */
  function range(M, view) {
    return { kx0: Math.max(0, Math.floor(view.x0 / CH)), kx1: Math.floor(view.x1 / CH), ky0: Math.max(0, Math.floor(view.y0 / CH)), ky1: Math.floor(view.y1 / CH) };
  }
  W.begin = function (M, scale, dpr) {
    frame++;
    const qf = R.q >= 2 ? 1 : R.q === 1 ? 0.78 : 0.6;
    const rs = Math.max(0.35, Math.round(scale * dpr * qf * 20) / 20);
    ensure(M, rs);
    cache.budget = 2;
  };
  W.drawGround = function (c, M, view) {
    const r = range(M, view), span = CH * T + MARGIN * 2;
    for (let ky = r.ky0; ky <= r.ky1; ky++) for (let kx = r.kx0; kx <= r.kx1; kx++) c.drawImage(getChunk(M, 'g', kx, ky), kx * CH * T - MARGIN, ky * CH * T - MARGIN, span, span);
  };
  W.drawBushes = function (c, M, view) {
    const r = range(M, view), span = CH * T + MARGIN * 2;
    for (let ky = r.ky0; ky <= r.ky1; ky++) for (let kx = r.kx0; kx <= r.kx1; kx++) c.drawImage(getChunk(M, 'b', kx, ky), kx * CH * T - MARGIN, ky * CH * T - MARGIN, span, span);
  };
  /* occlusion : le haut des murs situés juste au sud d'une entité passe devant elle */
  W.occlude = function (c, M, e, rad) {
    const ty = Math.floor(e.y / T) + 1; if (ty >= M.h) return;
    const xa = Math.floor((e.x - rad) / T), xb = Math.floor((e.x + rad) / T);
    for (let tx = Math.max(0, xa); tx <= Math.min(M.w - 1, xb); tx++) W.wallTile(c, M, tx, ty, true);
  };
})();
