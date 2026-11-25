/* Brawl Rush - génération procédurale d'arènes symétriques
   Tuiles : 0 sol, 1 mur, 2 caisse, 3 buisson, 4 eau, 5 coffre-fort, 6 boîte à cubes */
(function () {
  const G = window.G;
  const T = G.T;
  G.TILE = { GROUND: 0, WALL: 1, CRATE: 2, BUSH: 3, WATER: 4, SAFE: 5, BOX: 6 };

  const WALL_SHAPES = [
    [[0, 0]], [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  ];
  const CRATE_SHAPES = [[[0, 0]], [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1]]];

  function blob(rng, n) {
    const cells = [[0, 0]], set = { '0,0': 1 };
    let tries = 0;
    while (cells.length < n && tries++ < 60) {
      const c = cells[Math.floor(rng() * cells.length)];
      const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rng() * 4)];
      const nx = c[0] + d[0], ny = c[1] + d[1], k = nx + ',' + ny;
      if (!set[k]) { set[k] = 1; cells.push([nx, ny]); }
    }
    return cells;
  }

  G.isSolidTile = (t) => t === 1 || t === 2 || t === 4 || t === 5 || t === 6; // bloque les déplacements
  G.isBulletTile = (t) => t === 1 || t === 2 || t === 5 || t === 6; // bloque les projectiles

  // VUE VERTICALE : la carte générée (équipes à gauche/droite) est tournée d'un quart de tour : l'équipe bleue (0) est en bas,
  // l'équipe rouge (1) en haut, on attaque vers le haut. Tout (tuiles, apparitions, buts, coffres, zones) tourne ensemble.
  G.VERTICAL = true;
  G.faceOf = (team) => (G.VERTICAL ? (team === 0 ? -Math.PI / 2 : Math.PI / 2) : (team === 0 ? 0 : Math.PI)); // regard vers l'ennemi
  function rotate(m) {
    const w = m.w, h = m.h, Wp = w * T, nt = new Uint8Array(w * h), nh = new Uint16Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = (w - 1 - x) * h + y, i = y * w + x; nt[j] = m.tiles[i]; nh[j] = m.hp[i]; }
    const P = (p) => { if (p && typeof p.x === 'number') { const x = p.x; p.x = p.y; p.y = Wp - x; } return p; };
    const each = (a) => { if (Array.isArray(a)) a.forEach((v) => (Array.isArray(v) ? each(v) : P(v))); };
    m.tiles = nt; m.hp = nh; m.w = h; m.h = w;
    each(m.spawns); each(m.safes); each(m.caps); P(m.mine); P(m.ball); P(m.center);
    (m.goals || []).forEach((g) => { const x0 = g.x0, x1 = g.x1; g.x0 = g.y0; g.x1 = g.y1; g.y0 = Wp - x1; g.y1 = Wp - x0; });
    m.vertical = true;
    return m;
  }
  G.genMap = function (def, seedOverride) { const m = genMapH(def, seedOverride); return m && G.VERTICAL ? rotate(m) : m; };
  function genMapH(def, seedOverride) {
    const baseSeed = seedOverride != null ? seedOverride : def.seed;
    for (let attempt = 0; attempt < 40; attempt++) {
      const rng = G.mulberry32(baseSeed * 977 + attempt * 7919 + 13);
      const m = build(def, rng);
      if (m) return m;
    }
    return build(Object.assign({}, def, { density: 0.1 }), G.mulberry32(5));
  };

  function build(def, rng) {
    const w = def.w, h = def.h, mode = def.mode;
    const tiles = new Uint8Array(w * h), res = new Uint8Array(w * h);
    const idx = (x, y) => y * w + x;
    const inb = (x, y) => x >= 1 && y >= 1 && x <= w - 2 && y <= h - 2;
    const cx = (w - 1) / 2, cy = Math.floor(h / 2);
    for (let x = 0; x < w; x++) { tiles[idx(x, 0)] = 1; tiles[idx(x, h - 1)] = 1; }
    for (let y = 0; y < h; y++) { tiles[idx(0, y)] = 1; tiles[idx(w - 1, y)] = 1; }

    const reserve = (x0, y0, x1, y1) => {
      for (let y = Math.max(1, y0); y <= Math.min(h - 2, y1); y++)
        for (let x = Math.max(1, x0); x <= Math.min(w - 2, x1); x++) res[idx(x, y)] = 1;
    };
    const set = (x, y, t) => { if (inb(x, y)) tiles[idx(x, y)] = t; };
    const mirrorSet = (x, y, t) => {
      set(x, y, t);
      if (def.mirror !== false) set(w - 1 - x, y, t);
      if (def.vmirror) { set(x, h - 1 - y, t); if (def.mirror !== false) set(w - 1 - x, h - 1 - y, t); }
    };

    const map = {
      w, h, tiles, hp: new Uint16Array(w * h), theme: def.theme, mode, name: def.name, spawns: [[], []],
      mine: null, goals: [], safes: [], ball: null, seed: def.seed, border: true,
    };
    const tc = (x, y) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T });
    const must = []; // points qui doivent être atteignables (tuiles)

    if (mode === 'showdown') {
      // 10 points d'apparition en anneau
      const R = Math.min(w, h) / 2 - 5;
      map.spawns = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 10;
        const x = Math.round(cx + Math.cos(a) * R), y = Math.round((h - 1) / 2 + Math.sin(a) * R);
        reserve(x - 1, y - 1, x + 1, y + 1);
        map.spawns.push(tc(x, y));
        must.push([x, y]);
      }
      reserve(Math.floor(cx) - 1, cy - 1, Math.floor(cx) + 1, cy + 1);
      def = Object.assign({}, def, { mirror: false });
    } else {
      const sx = mode === 'brawlball' ? 7 : mode === 'heist' ? 8 : 3;
      for (const dy of [-3, 0, 3]) {
        map.spawns[0].push(tc(sx, cy + dy));
        map.spawns[1].push(tc(w - 1 - sx, cy + dy));
        must.push([sx, cy + dy], [w - 1 - sx, cy + dy]);
      }
      reserve(1, cy - 5, sx + 2, cy + 5); reserve(w - 2 - sx - 2, cy - 5, w - 2, cy + 5);
      if (mode === 'gemgrab') {
        const mx = Math.floor(cx);
        reserve(mx - 2, cy - 2, mx + 2, cy + 2);
        map.mine = tc(mx, cy); must.push([mx, cy]);
      }
      if (mode === 'hotzone') {
        const mx = Math.floor(cx);
        map.caps = [];
        for (const dy of [-5, 5]) { reserve(mx - 3, cy + dy - 3, mx + 3, cy + dy + 3); const c = tc(mx, cy + dy); map.caps.push({ x: c.x, y: c.y, r: 2.3 * T }); must.push([mx, cy + dy]); }
      }
      if (mode === 'brawlball') {
        const mx = Math.floor(cx);
        reserve(mx - 2, cy - 2, mx + 2, cy + 2);
        map.ball = tc(mx, cy); must.push([mx, cy]);
        // buts : poche de 3 de profondeur, 5 de hauteur
        for (let y = 1; y < h - 1; y++) for (let x = 1; x <= 3; x++) {
          const inGoal = Math.abs(y - cy) <= 2;
          if (!inGoal) { tiles[idx(x, y)] = 1; tiles[idx(w - 1 - x, y)] = 1; }
          res[idx(x, y)] = 1; res[idx(w - 1 - x, y)] = 1;
        }
        reserve(4, cy - 4, 9, cy + 4); reserve(w - 10, cy - 4, w - 5, cy + 4);
        map.goals = [
          { team: 0, x0: 1 * T, y0: (cy - 2) * T, x1: 4 * T, y1: (cy + 3) * T },
          { team: 1, x0: (w - 4) * T, y0: (cy - 2) * T, x1: (w - 1) * T, y1: (cy + 3) * T },
        ];
        // poteaux décoratifs : murs au-dessus/en dessous déjà posés
      }
      if (mode === 'heist') {
        for (const team of [0, 1]) {
          const x0 = team === 0 ? 2 : w - 5;
          for (let y = cy - 1; y <= cy + 1; y++) for (let x = x0; x < x0 + 3; x++) { tiles[idx(x, y)] = 5; res[idx(x, y)] = 1; }
          map.safes.push({ team, x: (x0 + 1.5) * T, y: (cy + 0.5) * T, hp: 0, maxhp: 0 });
          reserve(x0 - 1, cy - 3, x0 + 6, cy + 3);
          // quelques murs de protection autour du coffre
          const wx = team === 0 ? x0 + 4 : x0 - 2;
          set(wx, cy - 3, 1); set(wx, cy + 3, 1); set(wx, cy - 4, 1); set(wx, cy + 4, 1);
        }
        for (const dy of [-3, 0, 3]) { map.spawns[0][(dy + 3) / 3] = tc(8, cy + dy); map.spawns[1][(dy + 3) / 3] = tc(w - 9, cy + dy); }
      }
    }

    // ----- placement des obstacles -----
    const half = def.mirror === false ? w - 1 : Math.floor(cx);
    const area = (w - 2) * (h - 2);
    const count = Math.floor(area * def.density * 0.045);
    const solidAt = (x, y) => { const t = tiles[idx(x, y)]; return t === 1 || t === 2 || t === 4 || t === 5 || t === 6; };
    const place = (cells, type, solidType) => {
      const ox = 1 + Math.floor(rng() * (half - 1)), oy = 1 + Math.floor(rng() * (h - 2));
      const own = {};
      for (const [dx, dy] of cells) {
        const x = ox + dx, y = oy + dy;
        if (!inb(x, y) || x > half || res[idx(x, y)] || tiles[idx(x, y)] !== 0) return false;
        own[x + ',' + y] = 1;
      }
      if (solidType) {
        for (const [dx, dy] of cells) for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) {
          const x = ox + dx + ax, y = oy + dy + ay;
          if (own[x + ',' + y]) continue;
          if (x >= 0 && y >= 0 && x < w && y < h && solidAt(x, y) && !(tiles[idx(x, y)] === 1 && (x === 0 || y === 0 || x === w - 1 || y === h - 1))) return false;
        }
      }
      for (const [dx, dy] of cells) mirrorSet(ox + dx, oy + dy, type);
      return true;
    };
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 25) {
      const r = rng();
      let ok;
      const bushW = mode === 'showdown' ? 0.38 : 0.28, waterW = 0.1, crateW = 0.2;
      if (r < bushW) ok = place(blob(rng, 4 + Math.floor(rng() * 6)), 3, false);
      else if (r < bushW + waterW) ok = place(blob(rng, 3 + Math.floor(rng() * 5)), 4, true);
      else if (r < bushW + waterW + crateW) ok = place(CRATE_SHAPES[Math.floor(rng() * CRATE_SHAPES.length)], 2, true);
      else ok = place(WALL_SHAPES[Math.floor(rng() * WALL_SHAPES.length)], 1, true);
      if (ok) placed++;
    }
    // boîtes à cubes (survie)
    if (mode === 'showdown') {
      let boxes = 0, g2 = 0;
      while (boxes < 22 && g2++ < 600) {
        const x = 3 + Math.floor(rng() * (w - 6)), y = 3 + Math.floor(rng() * (h - 6));
        if (res[idx(x, y)] || tiles[idx(x, y)] !== 0) continue;
        let near = false;
        for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) if (tiles[idx(x + ax, y + ay)] === 6) near = true;
        if (near) continue;
        tiles[idx(x, y)] = 6; boxes++;
      }
    }

    // ----- connectivité -----
    const pass = (t) => t === 0 || t === 3;
    const seen = new Uint8Array(w * h);
    const sp = must[0];
    const q = [idx(sp[0], sp[1])]; seen[q[0]] = 1;
    while (q.length) {
      const c = q.pop(), x = c % w, y = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = idx(nx, ny);
        if (seen[k] || !pass(tiles[k])) continue;
        seen[k] = 1; q.push(k);
      }
    }
    for (const [x, y] of must) if (!seen[idx(x, y)]) return null;
    for (const s of map.safes) { // le devant du coffre doit être accessible
      const tx = Math.floor(s.x / T) + (s.team === 0 ? 3 : -3);
      if (!seen[idx(tx, Math.floor(s.y / T))]) return null;
    }
    let pockets = 0;
    for (let i = 0; i < w * h; i++) if (pass(tiles[i]) && !seen[i]) pockets++;
    if (pockets > 14) return null;
    for (let i = 0; i < w * h; i++) if (pass(tiles[i]) && !seen[i]) tiles[i] = 1;

    // points de vie des caisses
    for (let i = 0; i < w * h; i++) {
      if (tiles[i] === 2) map.hp[i] = 2400;
      else if (tiles[i] === 6) map.hp[i] = 3600;
    }
    // cases d'apparition de gaz etc. : centre de la carte
    map.center = { x: (w / 2) * T, y: (h / 2) * T };
    return map;
  }
})();
