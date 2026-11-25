/* Brawl Rush - intelligence artificielle des bots : pathfinding A*, tactiques par mode */
(function () {
  const G = window.G;
  const T = G.T;
  const Sim = G.Sim;
  const AI = (G.AI = {});

  /* ---------- A* sur la grille ---------- */
  AI.findPath = function (M, sx, sy, tx, ty) {
    const w = M.w, h = M.h, tiles = M.map.tiles;
    const s = { x: G.clamp(Math.floor(sx / T), 0, w - 1), y: G.clamp(Math.floor(sy / T), 0, h - 1) };
    let e = { x: G.clamp(Math.floor(tx / T), 0, w - 1), y: G.clamp(Math.floor(ty / T), 0, h - 1) };
    const pass = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !G.isSolidTile(tiles[y * w + x]);
    if (!pass(e.x, e.y)) { // cherche la case libre la plus proche de la destination
      let best = null, bd = 1e9;
      for (let r = 1; r < 6 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (pass(e.x + dx, e.y + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { x: e.x + dx, y: e.y + dy }; } }
      }
      if (!best) return null; e = best;
    }
    const N = w * h, g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; // [f, idx]
    const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { let l = 2 * c + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const si = s.y * w + s.x, ei = e.y * w + e.x;
    g[si] = 0; push(0, si);
    const hf = (x, y) => { const dx = Math.abs(x - e.x), dy = Math.abs(y - e.y); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    let found = false, iter = 0;
    while (heap.length && iter++ < 4000) {
      const [, ci] = pop();
      if (closed[ci]) continue; closed[ci] = 1;
      if (ci === ei) { found = true; break; }
      const cx = ci % w, cy = (ci / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!pass(nx, ny)) continue;
        if (dx && dy && (!pass(cx + dx, cy) || !pass(cx, cy + dy))) continue;
        const ni = ny * w + nx; if (closed[ni]) continue;
        // pénalité près des murs
        let pen = 0;
        if (!pass(nx + 1, ny) || !pass(nx - 1, ny) || !pass(nx, ny + 1) || !pass(nx, ny - 1)) pen = 0.35;
        if (tiles[ni] === 3) pen += 0.1;
        const ng = g[ci] + (dx && dy ? 1.414 : 1) + pen;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = ci; push(ng + hf(nx, ny), ni); }
      }
    }
    if (!found) return null;
    const path = [];
    let c = ei;
    while (c !== si && c >= 0) { path.push({ x: ((c % w) + 0.5) * T, y: (((c / w) | 0) + 0.5) * T }); c = came[c]; }
    path.reverse();
    return path;
  };

  function fatClear(M, x0, y0, x1, y1, r) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    if (d < 1) return true;
    const nx = -dy / d * r, ny = dx / d * r;
    return Sim.lineClear(M, x0, y0, x1, y1, false) && Sim.lineClear(M, x0 + nx, y0 + ny, x1 + nx, y1 + ny, false) && Sim.lineClear(M, x0 - nx, y0 - ny, x1 - nx, y1 - ny, false);
  }

  // avance vers (gx,gy) en suivant un chemin si nécessaire ; écrit b.input
  function steer(M, b, gx, gy, dt) {
    const ai = b.ai;
    const d = G.dist(b.x, b.y, gx, gy);
    if (d < 14) { return false; }
    if (d < 7 * T && fatClear(M, b.x, b.y, gx, gy, 17)) { setMove(b, gx - b.x, gy - b.y); ai.path = null; return true; }
    ai.pathT -= dt;
    const moved = !ai.pathGoal || G.dist(ai.pathGoal.x, ai.pathGoal.y, gx, gy) > T * 1.4;
    if (!ai.path || moved || ai.pathT <= 0) {
      ai.path = AI.findPath(M, b.x, b.y, gx, gy); ai.pathGoal = { x: gx, y: gy }; ai.pathT = 0.7; ai.pi = 0;
    }
    if (!ai.path || !ai.path.length) { setMove(b, gx - b.x, gy - b.y); return true; }
    // saute les points visibles les plus lointains
    let best = 0;
    for (let i = Math.min(ai.path.length - 1, 5); i >= 0; i--) { if (fatClear(M, b.x, b.y, ai.path[i].x, ai.path[i].y, 17)) { best = i; break; } }
    if (best > 0) ai.path.splice(0, best);
    const wp = ai.path[0];
    if (G.dist(b.x, b.y, wp.x, wp.y) < 22) ai.path.shift();
    const t = ai.path[0] || wp;
    setMove(b, t.x - b.x, t.y - b.y);
    return true;
  }
  function setMove(b, dx, dy) { const l = Math.hypot(dx, dy) || 1; b.input.mx = dx / l; b.input.my = dy / l; }
  function addMove(b, dx, dy, k) { const l = Math.hypot(dx, dy) || 1; b.input.mx += (dx / l) * k; b.input.my += (dy / l) * k; }

  /* ---------- perception ---------- */
  function enemiesOf(M, b) { const out = []; for (const e of M.ents) if (e.alive && e.team !== b.team) out.push(e); return out; }
  function alliesOf(M, b) { const out = []; for (const e of M.ents) if (e.alive && e.team === b.team && e !== b) out.push(e); return out; }

  function pickTarget(M, b) {
    const ai = b.ai, def = b.def;
    let best = null, bs = 1e9;
    const sight = (M.mode === 'showdown' ? 8.5 : 12) * T;
    for (const e of M.ents) {
      if (!e.alive || e.team === b.team || e.jump) continue;
      const d = G.dist(b.x, b.y, e.x, e.y);
      if (d > sight || !Sim.canSee(M, b, e)) continue;
      let sc = d;
      if (e.hp < e.maxhp * 0.45) sc -= 90;
      if (e.hasBall || e.gems >= 3) sc -= 120;
      if (ai.target === e) sc -= 60; // stabilité
      if (M.mode === 'showdown' && e.cubes > 1) sc -= 20;
      if (!Sim.lineClear(M, b.x, b.y, e.x, e.y, true)) sc += 160;
      if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }

  /* ---------- objectif selon le mode ---------- */
  function objective(M, b) {
    const ai = b.ai, my = b.team, enemy = 1 - my;
    const allies = alliesOf(M, b);
    const ownSide = my === 0 ? 1 : -1; // direction vers l'ennemi en x
    const mw = M.w * T, mh = M.h * T;
    switch (M.mode) {
      case 'gemgrab': {
        const mine = M.map.mine, mg = Sim.teamGems(M, my), eg = Sim.teamGems(M, enemy);
        if (mg >= 10) { // protéger : se replier si porteur, sinon escorter
          if (b.gems > 0) { const bx = mine.x - ownSide * 6.5 * T; return { x: bx, y: mine.y + (b.spawnIdx - 1) * 2 * T, kind: 'retreat' }; }
          const carrier = allies.find((a) => a.gems > 0);
          if (carrier) return { x: carrier.x + ownSide * 1.2 * T, y: carrier.y, kind: 'guard' };
        }
        if (eg >= 10) { // chasser le porteur ennemi
          let tgt = null; for (const e of M.ents) if (e.alive && e.team === enemy && (!tgt || e.gems > tgt.gems)) tgt = e;
          if (tgt) return { x: tgt.x, y: tgt.y, kind: 'hunt' };
        }
        // cristaux proches
        let best = null, bd = 12 * T;
        for (const it of M.items) if (it.type === 'gem') { const d = G.dist(b.x, b.y, it.x, it.y); if (d < bd && (b.spawnIdx !== 2 || d < 6 * T)) { bd = d; best = it; } }
        if (best) return { x: best.x, y: best.y, kind: 'gem' };
        if (b.spawnIdx === 0) return { x: mine.x + ownSide * -1.5 * T, y: mine.y, kind: 'mine' };
        return { x: mine.x - ownSide * 2.2 * T, y: mine.y + (b.spawnIdx === 1 ? -3 : 3) * T, kind: 'hold' };
      }
      case 'brawlball': {
        const B = M.ball, gx = my === 0 ? mw - 2.2 * T : 2.2 * T, ownGx = my === 0 ? 2.2 * T : mw - 2.2 * T, gy = mh / 2;
        if (b.hasBall) return { x: gx, y: gy, kind: 'score' };
        const mate = allies.find((a) => a.hasBall);
        if (mate) return { x: Math.max(1.5 * T, Math.min(mw - 1.5 * T, mate.x + ownSide * 3 * T)), y: mate.y + (b.spawnIdx === 1 ? -2 : 2) * T, kind: 'escort' };
        if (B.owner && B.owner.team !== my) {
          if (b.spawnIdx === 2) return { x: ownGx + ownSide * 3 * T, y: gy + G.clamp(B.owner.y - gy, -2.5 * T, 2.5 * T), kind: 'keeper' };
          return { x: B.owner.x, y: B.owner.y, kind: 'chase' };
        }
        // balle libre : les deux plus proches y vont
        const mine = [b].concat(allies).filter((a) => !a.hasBall).sort((a, c) => G.dist(a.x, a.y, B.x, B.y) - G.dist(c.x, c.y, B.x, B.y));
        const rank = mine.indexOf(b);
        if (rank === 0 || (rank === 1 && b.spawnIdx !== 2)) return { x: B.x, y: B.y, kind: 'ball' };
        return { x: G.lerp(ownGx, B.x, 0.35), y: G.lerp(gy, B.y, 0.5), kind: 'defend' };
      }
      case 'heist': {
        const es = M.safes[enemy], os = M.safes[my];
        // menace sur notre coffre ?
        let threat = null;
        for (const e of M.ents) if (e.alive && e.team === enemy && G.dist(e.x, e.y, os.x, os.y) < 7.5 * T) { if (!threat || G.dist(e.x, e.y, os.x, os.y) < G.dist(threat.x, threat.y, os.x, os.y)) threat = e; }
        if (threat && (b.spawnIdx === 2 || G.dist(b.x, b.y, os.x, os.y) < 9 * T)) return { x: threat.x, y: threat.y, kind: 'defend' };
        if (b.spawnIdx === 2 && !(M.safes[my].hp < M.safes[enemy].hp * 0.5)) return { x: os.x + ownSide * 5 * T, y: os.y + G.rr(-1, 1) * 0, kind: 'guard' };
        const want = Math.min(b.def.aiRange, 6) * T * 0.9;
        const off = (b.spawnIdx - 1) * 1.6 * T;
        return { x: es.x - ownSide * (want + 80), y: es.y + off, kind: 'attack' };
      }
      case 'hotzone': {
        // aller vers la zone non contrôlée la plus proche (ou aider à défendre)
        let best = null, bs = 1e9;
        for (const c of M.caps) { const d = G.dist(b.x, b.y, c.x, c.y) + (c.state === my ? 5 * T : 0) - (c.state === 2 ? 3 * T : 0); if (d < bs) { bs = d; best = c; } }
        if (b.hp < b.maxhp * 0.3) return { x: M.map.spawns[my][1].x + ownSide * 3 * T, y: M.map.spawns[my][1].y, kind: 'retreat' };
        return best ? { x: best.x + (b.spawnIdx - 1) * 20, y: best.y + (b.spawnIdx - 1) * 25, kind: 'zone2' } : { x: mw / 2, y: mh / 2, kind: 'center' };
      }
      case 'boss': {
        let near = null, nd = 1e9;
        for (const e of M.ents) if (e.alive && e.team === enemy) { const d = G.dist(b.x, b.y, e.x, e.y); if (d < nd) { nd = d; near = e; } }
        if (b.isBoss) return near ? { x: near.x, y: near.y, kind: 'hunt' } : { x: mw / 2, y: mh / 2, kind: 'center' };
        if (near) return { x: near.x, y: near.y, kind: 'hunt' };
        return { x: mw / 2, y: mh / 2, kind: 'center' };
      }
      case 'knockout':
      case 'bounty': {
        let near = null, nd = 1e9;
        for (const e of M.ents) if (e.alive && e.team === enemy) { const d = G.dist(b.x, b.y, e.x, e.y); if (d < nd) { nd = d; near = e; } }
        if (b.hp < b.maxhp * 0.4) return { x: M.map.spawns[my][1].x + ownSide * 3 * T, y: M.map.spawns[my][1].y, kind: 'retreat' };
        if (near && nd < 11 * T) return { x: near.x, y: near.y, kind: 'hunt' };
        return { x: mw / 2 + (b.spawnIdx - 1) * 2 * T * 0 - ownSide * 1 * T, y: mh / 2 + (b.spawnIdx - 1) * 4 * T, kind: 'center' };
      }
      case 'showdown': {
        const z = M.zone, m = 2.2 * T;
        if (b.x < z.x0 + m || b.x > z.x1 - m || b.y < z.y0 + m || b.y > z.y1 - m) return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2, kind: 'zone' };
        if (b.hp < b.maxhp * 0.33) return { x: (z.x0 + z.x1) / 2 + G.rr(-1, 1) * 2 * T, y: (z.y0 + z.y1) / 2, kind: 'flee' };
        let best = null, bd = 13 * T;
        for (const it of M.items) { if (it.type !== 'cube') continue; const d = G.dist(b.x, b.y, it.x, it.y); if (d < bd) { bd = d; best = it; } }
        if (best) return { x: best.x, y: best.y, kind: 'cube' };
        // boîte proche
        if (!ai.boxT || M.t > ai.boxT) {
          ai.boxT = M.t + 2; ai.box = null; let bb = 15 * T;
          const tx0 = Math.floor(b.x / T), ty0 = Math.floor(b.y / T);
          for (let ty = Math.max(0, ty0 - 15); ty <= Math.min(M.h - 1, ty0 + 15); ty++) for (let tx = Math.max(0, tx0 - 15); tx <= Math.min(M.w - 1, tx0 + 15); tx++) {
            if (M.map.tiles[ty * M.w + tx] === 6) { const d = G.dist(b.x, b.y, (tx + 0.5) * T, (ty + 0.5) * T); if (d < bb) { bb = d; ai.box = { x: (tx + 0.5) * T, y: (ty + 0.5) * T, tx, ty }; } }
          }
        }
        if (ai.box && M.map.tiles[ai.box.ty * M.w + ai.box.tx] === 6) return { x: ai.box.x, y: ai.box.y, kind: 'box', box: ai.box };
        if (!ai.roam || G.dist(b.x, b.y, ai.roam.x, ai.roam.y) < 2 * T || M.t > ai.roamT) {
          ai.roam = { x: G.clamp((z.x0 + z.x1) / 2 + G.rr(-6, 6) * T, z.x0 + 2 * T, z.x1 - 2 * T), y: G.clamp((z.y0 + z.y1) / 2 + G.rr(-6, 6) * T, z.y0 + 2 * T, z.y1 - 2 * T) };
          ai.roamT = M.t + 8;
        }
        return { x: ai.roam.x, y: ai.roam.y, kind: 'roam' };
      }
    }
    return { x: M.w * T / 2, y: M.h * T / 2, kind: 'center' };
  }

  /* ---------- boucle principale d'un bot ---------- */
  AI.update = function (M, b, dt) {
    const ai = b.ai, def = b.def, skill = M.skill, atk = def.atk;
    ai.t -= dt; ai.pathT = ai.pathT === undefined ? 0 : ai.pathT;
    ai.fireT = (ai.fireT || 0) - dt; ai.strafeT = (ai.strafeT || 0) - dt; ai.dodgeT = (ai.dodgeT || 0) - dt;
    ai.stuckT = (ai.stuckT || 0);
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? 1 : -1; ai.strafeT = G.rr(0.7, 2.0); }
    // réflexion périodique
    if (ai.t <= 0) {
      ai.t = G.rr(0.1, 0.22) * (1.7 - skill);
      ai.target = pickTarget(M, b);
      ai.obj = objective(M, b);
    }
    const obj = ai.obj || objective(M, b);
    const tgt = ai.target && ai.target.alive && Sim.canSee(M, b, ai.target) ? ai.target : null;
    b.input.mx = 0; b.input.my = 0;

    let engaged = false, tdist = 0, tx = 0, ty = 0, los = false;
    if (tgt) {
      tdist = G.dist(b.x, b.y, tgt.x, tgt.y);
      // visée prédictive
      const spd = atk.speed * T;
      const tl = Math.min(0.6, tdist / spd) * (0.5 + 0.5 * skill);
      tx = tgt.x + (tgt.vx || 0) * tl; ty = tgt.y + (tgt.vy || 0) * tl;
      los = atk.lob || Sim.lineClear(M, b.x, b.y, tx, ty, true);
    }
    const range = def.aiRange * T;
    const lowHp = b.hp < b.maxhp * 0.3;
    const mustObjective = obj.kind === 'zone' || (M.mode === 'brawlball' && obj.kind === 'score') || (obj.kind === 'retreat' && M.mode === 'gemgrab');

    // ---- mouvement ----
    if (tgt && tdist < (M.mode === 'showdown' ? (obj.kind === 'cube' || obj.kind === 'box' ? 5 : 7.5) : 9.5) * T && !mustObjective && !(obj.kind === 'gem' && tdist > range * 1.3)) {
      engaged = true;
      if (lowHp && tdist < range * 1.4 && M.mode !== 'bounty') { // fuite
        const a = Math.atan2(b.y - tgt.y, b.x - tgt.x);
        if (!steer(M, b, b.x + Math.cos(a) * 3 * T, b.y + Math.sin(a) * 3 * T, dt)) setMove(b, Math.cos(a), Math.sin(a));
        addMove(b, -Math.sin(a), Math.cos(a), 0.5 * ai.strafe);
      } else if (tdist > range * 1.08 || !los) {
        if (!steer(M, b, tgt.x, tgt.y, dt)) setMove(b, tgt.x - b.x, tgt.y - b.y);
      } else if (tdist < range * 0.55 && def.id !== 'taurus') {
        const a = Math.atan2(b.y - tgt.y, b.x - tgt.x);
        setMove(b, Math.cos(a), Math.sin(a)); addMove(b, -Math.sin(a), Math.cos(a), 0.6 * ai.strafe);
        // éviter de reculer dans un mur
        if (Sim.circleHitsSolid(M, b.x + b.input.mx * 30, b.y + b.input.my * 30, b.r)) { setMove(b, -Math.sin(a) * ai.strafe, Math.cos(a) * ai.strafe); }
      } else {
        const a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        setMove(b, -Math.sin(a) * ai.strafe, Math.cos(a) * ai.strafe);
        if (Sim.circleHitsSolid(M, b.x + b.input.mx * 28, b.y + b.input.my * 28, b.r)) ai.strafe *= -1;
        // un peu d'avance vers l'objectif
        if (obj.kind !== 'roam' && G.dist(b.x, b.y, obj.x, obj.y) > 3 * T && tdist > range * 0.8) addMove(b, obj.x - b.x, obj.y - b.y, 0.35);
      }
      b.face = Math.atan2(tgt.y - b.y, tgt.x - b.x);
    } else {
      const moving = steer(M, b, obj.x, obj.y, dt);
      if (!moving && obj.kind !== 'attack') { // sur place : petite oscillation
        addMove(b, -Math.sin(b.face), Math.cos(b.face), 0.25 * ai.strafe);
      }
    }

    // ---- tir sur objets (coffre, boîtes) ----
    let shootTarget = null;
    if (!tgt || !los) {
      if (M.mode === 'heist') {
        const es = M.safes[1 - b.team];
        const d = G.dist(b.x, b.y, es.x, es.y);
        if (d < atk.range * T * 0.95 + 40 && !(tgt && los)) shootTarget = { x: es.x, y: es.y, safe: true };
      }
      if (M.mode === 'showdown' && obj.kind === 'box' && obj.box) {
        const d = G.dist(b.x, b.y, obj.x, obj.y);
        if (d < atk.range * T * 0.9 && Sim.lineClear(M, b.x, b.y, obj.x, obj.y, true)) shootTarget = { x: obj.x, y: obj.y };
        else if (d < atk.range * T && atk.lob) shootTarget = { x: obj.x, y: obj.y };
      }
    }

    if (!engaged && Math.hypot(b.input.mx, b.input.my) > 0.2) b.face = Math.atan2(b.input.my, b.input.mx);

    // ---- esquive ----
    if (ai.dodgeT <= 0 && Math.random() < dt * (3 + skill * 7) * skill) {
      for (const p of M.projs) {
        if (p.team === b.team || p.lob) continue;
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (d > 5.5 * T) continue;
        const dot = (dx * p.vx + dy * p.vy) / (p.speed * d || 1);
        if (dot < 0.9) continue;
        const cross = dx * p.vy - dy * p.vx;
        ai.dodgeDir = cross > 0 ? 1 : -1; ai.dodgeAng = Math.atan2(p.vy, p.vx); ai.dodgeT = 0.28; break;
      }
    }
    if (ai.dodgeT > 0 && ai.dodgeDir && b.rollCd <= 0 && !ai.rolled && Math.random() < skill * 0.55) { ai.rolled = true; Sim.tryDodge(M, b, ai.dodgeAng + (Math.PI / 2) * ai.dodgeDir); }
    if (ai.dodgeT <= 0) ai.rolled = false;
    if (lowHp && tgt && tdist < 3 * T && b.rollCd <= 0 && Math.random() < dt * 2 * skill) Sim.tryDodge(M, b, Math.atan2(b.y - tgt.y, b.x - tgt.x)); // fuite en roulade
    if (ai.dodgeT > 0 && ai.dodgeDir) {
      const a = ai.dodgeAng + Math.PI / 2 * ai.dodgeDir;
      b.input.mx = Math.cos(a); b.input.my = Math.sin(a);
      if (Sim.circleHitsSolid(M, b.x + b.input.mx * 30, b.y + b.input.my * 30, b.r)) { b.input.mx *= -1; b.input.my *= -1; }
    }

    // ---- blocage ----
    const mvl = Math.hypot(b.input.mx, b.input.my);
    if (mvl > 0.3 && G.dist(b.x, b.y, ai.lx === undefined ? b.x : ai.lx, ai.ly === undefined ? b.y : ai.ly) < 40 * dt * 3) { ai.stuckT += dt; } else if (mvl <= 0.3) ai.stuckT = 0;
    ai.lc = (ai.lc || 0) + dt;
    if (ai.lc > 0.4) { ai.lc = 0; const moved = G.dist(b.x, b.y, ai.lx === undefined ? -999 : ai.lx, ai.ly === undefined ? -999 : ai.ly); if (moved < 14 && mvl > 0.3) ai.stuckT += 0.4; else ai.stuckT = 0; ai.lx = b.x; ai.ly = b.y; }
    if (ai.stuckT > 0.8) { ai.stuckT = 0; ai.path = null; ai.unstick = 0.5; ai.ua = Math.random() * 6.28; }
    if (ai.unstick > 0) { ai.unstick -= dt; b.input.mx = Math.cos(ai.ua); b.input.my = Math.sin(ai.ua); }

    // ---- tir ----
    const react = (1.35 - skill) * 0.3;
    const aimTo = (px, py, extra) => {
      const err = (1.15 - skill) * 0.2 * (Math.random() - 0.5) * 2 + (extra || 0);
      return Math.atan2(py - b.y, px - b.x) + err;
    };
    if (b.hasBall) {
      // kick vers le but quand l'angle est bon ou sous pression
      const gx = b.team === 0 ? M.w * T - 2.2 * T : 2.2 * T, gy = M.h * T / 2;
      const dgx = Math.abs(gx - b.x);
      const pressured = enemiesOf(M, b).some((e) => G.dist(e.x, e.y, b.x, b.y) < 2.4 * T);
      if (ai.fireT <= 0 && b.ammo >= 1 && ((dgx < 9 * T && Sim.lineClear(M, b.x, b.y, gx, gy, true)) || (pressured && dgx < 13 * T && Sim.lineClear(M, b.x, b.y, gx, gy, true)))) {
        Sim.tryAttack(M, b, aimTo(gx, gy + G.rr(-1, 1) * T * 0.8), 0);
        ai.fireT = 0.5;
      }
    } else if (ai.fireT <= 0) {
      let fx = null, fy = null, fd = 0;
      if (tgt && los && tdist <= atk.range * T * 0.97) { fx = tx; fy = ty; fd = tdist; }
      else if (shootTarget) { fx = shootTarget.x; fy = shootTarget.y; fd = G.dist(b.x, b.y, fx, fy); }
      if (fx !== null && b.ammo >= 1) {
        if (Sim.tryAttack(M, b, aimTo(fx, fy), fd)) ai.fireT = react + G.rr(0.05, 0.25);
      }
    }
    // ---- gadget : utilisé au bon moment ----
    if (b.gadgets > 0 && b.gadgetCd <= 0 && b.def.gadget && Math.random() < dt * 3) {
      const g = b.def.gadget, hpF = b.hp / b.maxhp, near = tgt && tdist < 5 * T;
      if ((g === 'heal' && hpF < 0.4) || (g === 'shield' && hpF < 0.45 && near) || (g === 'sprint' && hpF < 0.3 && near) ||
          (g === 'pulse' && tgt && tdist < 2.2 * T) || (g === 'reload' && b.ammo < 1 && tgt && los && tdist < atk.range * T)) Sim.tryGadget(M, b);
    }
    // ---- super ----
    if (b.superCharge >= 1 && !b.hasBall) {
      ai.superWait = (ai.superWait === undefined ? react + 0.2 : ai.superWait) - dt;
      if (ai.superWait <= 0) { if (useSuper(M, b, tgt, tdist, tx, ty, los, aimTo)) ai.superWait = undefined; }
    }
    // pas de tir quand on utilise une charge
    if (b.dash || b.jump) { b.input.mx = 0; b.input.my = 0; }
  };

  function useSuper(M, b, tgt, tdist, tx, ty, los, aimTo) {
    const s = b.def.sup;
    switch (s.type) {
      case 'proj': {
        if (tgt && los && tdist < s.range * T * 0.95) return Sim.trySuper(M, b, aimTo(tx, ty), tdist);
        if (M.mode === 'heist') { const es = M.safes[1 - b.team]; const d = G.dist(b.x, b.y, es.x, es.y); if (d < s.range * T * 0.85 && Sim.lineClear(M, b.x, b.y, es.x, es.y, true)) return Sim.trySuper(M, b, aimTo(es.x, es.y), d); }
        return false;
      }
      case 'dash': {
        if (tgt && tdist < s.dist * T * 0.9 && tdist > 2 * T && los) return Sim.trySuper(M, b, aimTo(tx, ty), tdist);
        return false;
      }
      case 'jump': {
        if (tgt && tdist < s.dist * T + 1.2 * T && tdist > 2.2 * T) return Sim.trySuper(M, b, aimTo(tx, ty), Math.min(tdist, s.dist * T));
        if (b.hp < b.maxhp * 0.3) { // saut défensif
          const e = enemiesOf(M, b).sort((p, q) => G.dist(p.x, p.y, b.x, b.y) - G.dist(q.x, q.y, b.x, b.y))[0];
          if (e && G.dist(e.x, e.y, b.x, b.y) < 4 * T) return Sim.trySuper(M, b, Math.atan2(b.y - e.y, b.x - e.x), s.dist * T);
        }
        return false;
      }
      case 'lobArea': case 'barrage': {
        if (tgt && tdist < s.range * T) return Sim.trySuper(M, b, aimTo(tx, ty), tdist);
        return false;
      }
      case 'aura': {
        const R = s.radius * T;
        if (s.rage) return tgt && tdist < 7 * T ? Sim.trySuper(M, b, 0, 0) : false;
        if (s.heal) {
          let miss = 0; const mates = [b].concat(alliesOf(M, b));
          for (const a of mates) if (G.dist(a.x, a.y, b.x, b.y) < R) miss += a.maxhp - a.hp;
          if (miss > s.heal * 0.7) return Sim.trySuper(M, b, 0, 0);
          return false;
        }
        const n = enemiesOf(M, b).filter((e) => G.dist(e.x, e.y, b.x, b.y) < R * 0.95).length;
        if (n >= 1) return Sim.trySuper(M, b, 0, 0);
        if (M.mode === 'heist') { const es = M.safes[1 - b.team]; if (G.dist(es.x, es.y, b.x, b.y) < R + 70) return Sim.trySuper(M, b, 0, 0); }
        return false;
      }
    }
    return false;
  }
})();
