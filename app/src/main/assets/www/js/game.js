/* Brawl Rush - simulation du combat (physique, armes, supers, modes de jeu) */
(function () {
  const G = window.G;
  const T = G.T;
  const Sim = (G.Sim = {});
  const BOT_NAMES = ['Zébulon', 'Ninja42', 'Tornade', 'LeBoss', 'Pixel', 'Mistral', 'Gaufre', 'Turbo', 'Chaton', 'Ombre', 'Rafale', 'Biscotte', 'Éclair', 'Panda', 'Dragon', 'Cactus', 'Fusée', 'Comète', 'Loup', 'Nuage'];

  /* ---------- évènements réseau / audio ---------- */
  Sim.sfx = function (M, name, x, y, pitch) {
    if (M.online) { if (M.evq.length < 500) M.evq.push(['s', name, x === undefined ? -1 : Math.round(x), y === undefined ? -1 : Math.round(y), pitch || 1]); return; }
    if (x !== undefined && M.player && Math.hypot(x - M.player.x, y - M.player.y) > 1100) return;
    G.Audio.sfx(name, pitch);
  };

  /* ---------- création ---------- */
  Sim.create = function (opts) {
    const mode = G.MODES[opts.mode];
    const mdef = G.MAPS[opts.mapKey];
    const seed = mode.id === 'showdown' ? Math.floor(Math.random() * 100000) : mdef.seed;
    const map = G.genMap(mdef, seed);
    const M = makeM(mode, opts.mapKey, map, opts.trophies || 0);
    // joueurs
    const names = G.shuffle(BOT_NAMES.slice());
    const all = G.BRAWLERS.slice();
    const lv = opts.level || 1;
    const botLevel = () => G.clamp(Math.round(lv + G.rr(-1.5, 1.5)), 1, G.MAX_LEVEL);
    if (mode.id === 'showdown') {
      const sp = G.shuffle(map.spawns.slice());
      const pool = G.shuffle(all.slice());
      for (let i = 0; i < 10; i++) {
        const isP = i === 0;
        const def = isP ? G.BRAWLER[opts.brawlerId] : pool[i % pool.length];
        const b = mkBrawler(M, def, i, isP ? opts.name : names[i], isP ? lv : botLevel(), isP ? opts.skin : G.pick(G.SKINS).id, isP, sp[i], i);
        M.ents.push(b);
        if (isP) M.player = b;
      }
      M.alive = 10;
      M.ents.forEach((e) => { e.invuln = 6.5; });
      // zone toxique
      const fx = (M.w / 2 + G.rr(-5, 5)) * T, fy = (M.h / 2 + G.rr(-5, 5)) * T, half = 3.2 * T;
      M.zone = { x0: T, y0: T, x1: (M.w - 1) * T, y1: (M.h - 1) * T, fx0: fx - half, fy0: fy - half, fx1: fx + half, fy1: fy + half, sx0: T, sy0: T, sx1: (M.w - 1) * T, sy1: (M.h - 1) * T, start: 22, dur: 150, dmgT: 0 };
      // dégâts des boîtes
    } else {
      const pool = G.shuffle(all.slice());
      let pi = 0;
      for (let team = 0; team < 2; team++) {
        for (let k = 0; k < 3; k++) {
          if (mode.id === 'boss' && team === 1 && k > 0) continue;
          const isP = team === 0 && k === 0;
          const def = isP ? G.BRAWLER[opts.brawlerId] : (mode.id === 'boss' && team === 1 ? G.BRAWLER.robot : pool[pi++ % pool.length]);
          const b = mkBrawler(M, def, team, isP ? opts.name : names[pi + k + team * 3], isP ? lv : botLevel(), isP ? opts.skin : G.pick(G.SKINS).id, isP, map.spawns[team][k], team * 3 + k);
          b.spawnIdx = k;
          M.ents.push(b);
          if (isP) M.player = b;
        }
      }
    }
    if (mode.id === 'boss') setupBoss(M);
    if (mode.id === 'heist') {
      map.safes.forEach((s) => { s.maxhp = 24000; s.hp = s.maxhp; s.flash = 0; M.safes.push(s); });
    }
    if (mode.id === 'brawlball') M.ball = { x: map.ball.x, y: map.ball.y, vx: 0, vy: 0, owner: null, cd: {}, z: 0, spin: 0 };
    M.stats = M.player.st;
    applyEvent(M, opts.event === undefined ? G.todayEvent().id : opts.event);
    M.cam.x = M.player.x; M.cam.y = M.player.y;
    return M;
  };

  function makeM(mode, mapKey, map, trophies) {
    return {
      mode: mode.id, modeDef: mode, mapKey: mapKey, map, w: map.w, h: map.h, t: 0, state: 'countdown', cd: 3.2, cdLast: 4, endT: 0,
      left: mode.time, ents: [], projs: [], items: [], zones: [], parts: [], texts: [], strikes: [], events: [], rings: [],
      score: [0, 0], cam: { x: 0, y: 0, shake: 0, zoom: 1 }, player: null, result: null, banner: null, shakeT: 0,
      stats: null, caps: (map.caps || []).map((c) => ({ x: c.x, y: c.y, r: c.r, state: -1 })), trophiesAvg: trophies || 0, practice: false, online: false, evq: [], pid: 0,
      overtime: false, ball: null, safes: [], gg: { count: [0, 0], active: [false, false], t: [15, 15] }, gemT: 3, zone: null, alive: 0, place: 0, tick: 0,
      skill: G.clamp(0.15 + (trophies || 0) / 800, 0.15, 0.95), hitstop: 0,
    };
  }

  function setupBoss(M) {
    const boss = M.ents.find((e) => e.id === 'robot'); if (!boss) return;
    boss.r = 28; boss.big = 1.8; boss.isBoss = true; boss.name = 'Mégabot';
    const n = M.ents.filter((e) => e.team === 0).length;
    boss.maxhp = boss.hp = G.BOSS.hp * (0.8 + 0.3 * n) * (boss.dmgMul || 1);
    boss.ammo = 3;
  }
  function mkBrawler(M, def, team, name, level, skin, isP, pos, idx) {
    const mul = G.levelMul(level);
    return {
      id: def.id, def, team, name, level, skin, isPlayer: isP, idx, x: pos.x, y: pos.y, r: 21, vx: 0, vy: 0, kx: 0, ky: 0,
      maxhp: def.hp * mul, hp: def.hp * mul, dmgMul: mul, ammo: 3, reload: 0, superCharge: 0, ang: team === 1 ? Math.PI : 0, face: team === 1 ? Math.PI : 0,
      deathT: -1, alive: true, respawn: 0, stun: 0, freeze: 0, slowF: 1, slowT: 0, poison: 0, poisonDps: 0, poisonBy: null, poisonAcc: 0, boostF: 1, boostT: 0, invuln: 0,
      revealT: 0, hidden: false, atkCd: 0, queue: [], dash: null, jump: null, gems: 0, hasBall: false, cubes: 0, kills: 0, deaths: 0, dmgDealt: 0,
      bounty: 0, flash: 0, recoil: 0, walkT: Math.random() * 6, moving: false, supers: 0, input: { mx: 0, my: 0 }, ai: { t: Math.random() * 0.3 }, popObj: null, popT: 0,
      st: { damage: 0, kills: 0, supers: 0, heal: 0, gems: 0, goals: 0 }, pid: null, human: false, px: pos.x, py: pos.y, spawn: pos, lastHitBy: null, z: 0, superReadyFx: false, place: 0, emote: 0, emoteT: 0, shield: 0,
    };
  }

  /* ---------- utilitaires carte ---------- */
  Sim.tile = function (M, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= M.w || ty >= M.h) return 1;
    return M.map.tiles[ty * M.w + tx];
  };
  Sim.tileAt = (M, x, y) => Sim.tile(M, Math.floor(x / T), Math.floor(y / T));
  function circleHitsSolid(M, x, y, r) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!G.isSolidTile(Sim.tile(M, tx, ty))) continue;
      const cx = G.clamp(x, tx * T, tx * T + T), cy = G.clamp(y, ty * T, ty * T + T);
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }
  Sim.circleHitsSolid = circleHitsSolid;
  // déplace en glissant le long des murs ; renvoie true si bloqué
  function tryMove(M, e, dx, dy) {
    let blocked = false;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 10));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx) { if (!circleHitsSolid(M, e.x + sx, e.y, e.r)) e.x += sx; else { blocked = true; nudge(M, e, sx, 0); } }
      if (sy) { if (!circleHitsSolid(M, e.x, e.y + sy, e.r)) e.y += sy; else { blocked = true; nudge(M, e, 0, sy); } }
    }
    return blocked;
  }
  // aide à contourner les coins : si on est presque aligné avec une ouverture
  function nudge(M, e, sx, sy) {
    const k = 1.2;
    if (sx) {
      for (const d of [k, -k, 2 * k, -2 * k, 3 * k, -3 * k]) if (!circleHitsSolid(M, e.x + sx, e.y + d, e.r)) { e.y += d * 0.6; return; }
    } else {
      for (const d of [k, -k, 2 * k, -2 * k, 3 * k, -3 * k]) if (!circleHitsSolid(M, e.x + d, e.y + sy, e.r)) { e.x += d * 0.6; return; }
    }
  }
  Sim.lineClear = function (M, x0, y0, x1, y1, bulletOnly) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 14);
    for (let i = 1; i < n; i++) {
      const t = i / n, tx = Math.floor((x0 + (x1 - x0) * t) / T), ty = Math.floor((y0 + (y1 - y0) * t) / T);
      const tt = Sim.tile(M, tx, ty);
      if (bulletOnly ? G.isBulletTile(tt) : G.isSolidTile(tt)) return false;
    }
    return true;
  };
  Sim.canSee = (M, viewer, e) => e.alive && (e.team === viewer.team || !e.hidden || G.dist(viewer.x, viewer.y, e.x, e.y) < 2.7 * T);

  /* ---------- effets visuels ---------- */
  function part(M, o) { if (M.parts.length < 500) M.parts.push(o); }
  Sim.burst = function (M, x, y, color, n, spd, size, dur, type) {
    if (M.online) { if (M.evq.length < 400) M.evq.push(['b', Math.round(x), Math.round(y), color, n, spd, size, dur, type || 0]); return; }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = spd * (0.3 + Math.random() * 0.9);
      part(M, { type: type || 'circle', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, dur: dur * (0.6 + Math.random() * 0.6), r0: size * (0.7 + Math.random() * 0.6), r1: 0, color, drag: 3 });
    }
  };
  Sim.ring = function (M, x, y, r0, r1, dur, color, fill) {
    if (M.online) { M.evq.push(['r', Math.round(x), Math.round(y), r0, r1, dur, color, fill ? 1 : 0]); return; } M.rings.push({ x, y, r0, r1, t: 0, dur, color, fill }); };
  Sim.text = function (M, x, y, txt, color, size) {
    if (M.online) { M.evq.push(['t', Math.round(x), Math.round(y), txt, color || '#fff', size || 22]); return; } M.texts.push({ x, y, txt, color: color || '#fff', t: 0, dur: 0.9, size: size || 22, vy: -70 }); };
  Sim.shake = function (M, a) {
    if (M.online) return; M.cam.shake = Math.max(M.cam.shake, a); };
  Sim.banner = function (M, txt, sub, color, dur, team) {
    if (M.online) { M.evq.push(['n', txt, sub || '', color || '#ffd21f', dur || 2, team === undefined ? -1 : team]); return; } M.banner = { txt, sub, color: color || '#ffd21f', t: 0, dur: dur || 2 }; };

  /* ---------- dégâts ---------- */
  Sim.damage = function (M, tgt, amt, src, fx) {
    if (!tgt.alive || tgt.invuln > 0 || tgt.jump || amt <= 0) return 0;
    if (M.state === 'end') return 0;
    if (G.Dev && !M.online && !M.net) { amt = G.Dev.onDamage(M, tgt, amt, src); if (amt <= 0) return 0; }
    tgt.hp -= amt; tgt.flash = 0.12; tgt.revealT = 0.9; tgt.lastHitBy = src || tgt.lastHitBy;
    if (tgt.hasBall) dropBall(M, tgt);
    if (M.online) { M.evq.push(['d', Math.round(tgt.x), Math.round(tgt.y - 40), Math.round(amt), tgt.idx, tgt.team]); }
    else if (tgt.popObj && tgt.popT > 0 && tgt.popObj.t < 0.5) { tgt.popObj.amt += amt; tgt.popObj.txt = String(Math.round(tgt.popObj.amt)); tgt.popObj.t = 0.1; }
    else {
      const o = { x: tgt.x + G.rr(-8, 8), y: tgt.y - 40, txt: String(Math.round(amt)), color: tgt.team === M.player.team ? '#ff5252' : '#fff', t: 0, dur: 0.9, size: 22, vy: -70, amt };
      M.texts.push(o); tgt.popObj = o; tgt.popT = 0.25;
    }
    if (src && src !== tgt) {
      src.dmgDealt += amt; src.superCharge = Math.min(1, src.superCharge + (amt / src.def.superCost) * (M.event === 'supercharge' ? 1.8 : 1));
      if (M.event === 'vampire' && src.alive) src.hp = Math.min(src.maxhp, src.hp + amt * 0.15);
      src.st.damage += amt;
      if (src.superCharge >= 1 && !src.superReadyFx) { src.superReadyFx = true; if (M.online) M.evq.push(['sr', src.idx]); else if (src === M.player) Sim.sfx(M, 'superReady'); }
    }
    if (tgt === M.player) { G.vibrate(25); Sim.shake(M, 5); }
    if (fx) applyFx(M, tgt, fx, src);
    if (tgt.hp <= 0) die(M, tgt, src);
    return amt;
  };
  Sim.heal = function (M, tgt, amt, src) {
    if (!tgt.alive || amt <= 0) return;
    const a = Math.min(amt, tgt.maxhp - tgt.hp);
    if (a <= 0) return;
    tgt.hp += a;
    if (src) src.st.heal += a;
    Sim.text(M, tgt.x, tgt.y - 44, '+' + Math.round(a), '#6dff8a', 22);
    Sim.burst(M, tgt.x, tgt.y - 10, '#6dff8a', 4, 60, 4, 0.5);
  };
  function applyFx(M, e, fx, src) {
    if (fx.slow) { e.slowF = Math.min(e.slowF, fx.slow.f); e.slowT = Math.max(e.slowT, fx.slow.t); }
    if (fx.poison) { e.poison = Math.max(e.poison, fx.poison.t); e.poisonDps = fx.poison.dps; e.poisonBy = src; }
    if (fx.stun) e.stun = Math.max(e.stun, fx.stun);
    if (fx.freeze) { e.freeze = Math.max(e.freeze, fx.freeze); Sim.burst(M, e.x, e.y, '#bff0ff', 8, 120, 5, 0.6); }
    if (fx.knock && fx.ang !== undefined) { const v = fx.knock * 7; e.kx += Math.cos(fx.ang) * v; e.ky += Math.sin(fx.ang) * v; }
  }
  Sim.damageTile = function (M, tx, ty, amt, force) {
    const k = ty * M.w + tx, t = M.map.tiles[k];
    if (t !== 2 && t !== 6) return;
    M.map.hp[k] = force ? 0 : Math.max(0, M.map.hp[k] - amt);
    M.map.dirty = true;
    Sim.burst(M, (tx + 0.5) * T, (ty + 0.5) * T, '#c98b4a', 3, 90, 5, 0.5, 'chunk');
    if (M.map.hp[k] <= 0) {
      M.map.tiles[k] = 0; M.map.dirty = true;
      if (M.online) M.evq.push(['T', tx, ty, t]);
      Sim.burst(M, (tx + 0.5) * T, (ty + 0.5) * T, t === 6 ? '#ffe14a' : '#d9a25e', 12, 200, 7, 0.8, 'chunk');
      Sim.ring(M, (tx + 0.5) * T, (ty + 0.5) * T, 10, 55, 0.35, 'rgba(255,255,255,0.8)');
      if (t === 6) {
        const n = Math.random() < 0.35 ? 2 : 1;
        for (let i = 0; i < n; i++) spawnItem(M, 'cube', (tx + 0.5) * T, (ty + 0.5) * T, G.rr(80, 160));
      }
      Sim.sfx(M, 'hit');
    }
  };
  function damageSafe(M, s, amt, src) {
    if (M.state !== 'play' || s.hp <= 0) return;
    s.hp = Math.max(0, s.hp - amt); s.flash = 0.12;
    if (src) { src.dmgDealt += amt; src.superCharge = Math.min(1, src.superCharge + amt / src.def.superCost * 0.6); src.st.damage += amt; }
    if (M.online) M.evq.push(['t', Math.round(s.x + G.rr(-30, 30)), Math.round(s.y - 70), String(Math.round(amt)), '#fff', 22]); else M.texts.push({ x: s.x + G.rr(-30, 30), y: s.y - 70, txt: String(Math.round(amt)), color: '#fff', t: 0, dur: 0.8, size: 22, vy: -60 });
    Sim.burst(M, s.x + G.rr(-40, 40), s.y + G.rr(-40, 40), '#ffd21f', 2, 90, 4, 0.4);
    if (s.hp <= 0) {
      Sim.burst(M, s.x, s.y, '#ffd21f', 40, 400, 9, 1.2); Sim.shake(M, 16); Sim.sfx(M, 'explode');
      finish(M, 1 - s.team);
    }
  }
  function safeAt(M, x, y) {
    for (const s of M.safes) if (Math.abs(x - s.x) < 92 && Math.abs(y - s.y) < 92) return s;
    return null;
  }

  function dropBall(M, b) {
    if (!M.ball || M.ball.owner !== b) return;
    M.ball.owner = null; b.hasBall = false;
    const a = Math.random() * 6.28;
    M.ball.vx = Math.cos(a) * 160; M.ball.vy = Math.sin(a) * 160; M.ball.cd[b.idx] = 0.7;
  }

  function die(M, b, killer) {
    b.deathT = 0; b.deathAng = b.face;
    b.alive = false; b.hp = 0; b.deaths++; b.stun = b.freeze = 0; b.dash = null; b.jump = null; b.queue.length = 0; b.poison = 0;
    if (b.hasBall) dropBall(M, b);
    if (killer && killer !== b) {
      killer.kills++; killer.st.kills = killer.kills;
    }
    Sim.burst(M, b.x, b.y, G.getLook(b.id, b.skin).body, 18, 240, 8, 0.9);
    Sim.burst(M, b.x, b.y, '#fff', 8, 160, 5, 0.6);
    Sim.ring(M, b.x, b.y, 10, 70, 0.4, 'rgba(255,255,255,0.7)');
    Sim.sfx(M, 'die', b.x, b.y);
    // objets lâchés
    if (b.gems > 0) {
      for (let i = 0; i < b.gems; i++) spawnItem(M, 'gem', b.x, b.y, G.rr(90, 220));
      b.gems = 0;
    }
    if (M.mode === 'showdown') {
      const n = Math.max(1, b.cubes);
      for (let i = 0; i < n; i++) spawnItem(M, 'cube', b.x, b.y, G.rr(90, 200));
      b.cubes = 0;
      M.alive = M.ents.filter((e) => e.alive).length;
      b.place = M.alive + 1;
      if (M.online) { if (M.alive <= 1) endShowdownOnline(M); }
      else if (b === M.player) { M.place = b.place; finishShowdown(M, b.place); }
      else if (M.alive <= 1) { const w = M.ents.find((e) => e.alive); if (w) w.place = 1; finishShowdown(M, M.player.alive ? 1 : M.player.place); }
    } else {
      b.respawn = M.mode === 'bounty' ? 3.2 : 3.4;
      if (M.mode === 'knockout') { b.respawn = 1e9; checkKnockout(M); }
      if (M.mode === 'boss') {
        if (b.isBoss) { Sim.burst(M, b.x, b.y, '#ff6a6a', 60, 500, 12, 1.4); Sim.shake(M, 18); finish(M, 0); }
        else { b.respawn = 1e9; if (!M.ents.some((e) => e.team === 0 && e.alive)) finish(M, 1); }
      }
      if (M.mode === 'bounty' && killer && killer.team !== b.team) {
        M.score[killer.team] += 1 + b.bounty;
        killer.bounty = Math.min(7, killer.bounty + 1);
        Sim.text(M, b.x, b.y - 60, '★ +' + (1 + b.bounty), '#ffd21f', 28);
      }
      b.bounty = 0;
    }
    b.superCharge = Math.max(0, b.superCharge * 0.0);
    b.superReadyFx = false;
  }

  function spawnItem(M, type, x, y, spd) {
    const a = Math.random() * 6.283;
    M.items.push({ type, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, age: 0, z: 0, bob: Math.random() * 6, lock: 0.5 });
  }

  /* ---------- fin de partie ---------- */
  function finish(M, winnerTeam) {
    if (M.state === 'end') return;
    M.state = 'end'; M.endT = 0;
    const p = M.player, draw = winnerTeam === -1;
    const win = p ? !draw && winnerTeam === p.team : false;
    M.result = { win, draw, winnerTeam, place: p ? p.place || 1 : 0, time: M.t };
    if (M.online) { M.result.places = M.ents.map((e) => e.place || 0); return; }
    Sim.sfx(M, win ? 'win' : 'lose');
    Sim.banner(M, draw ? 'ÉGALITÉ' : win ? 'VICTOIRE !' : 'DÉFAITE', '', win ? '#ffd21f' : '#ff5252', 3);
  }
  function finishShowdown(M, place) {
    if (M.state === 'end') return;
    M.state = 'end'; M.endT = 0;
    const win = place === 1;
    M.result = { win, draw: false, winnerTeam: win ? 0 : -1, place, time: M.t };
    Sim.sfx(M, win ? 'win' : 'lose');
    Sim.banner(M, win ? 'DERNIER SURVIVANT !' : 'ÉLIMINÉ', '#' + place + ' sur 10', win ? '#ffd21f' : '#ff5252', 3);
  }
  // fin de la Survie en ligne : classement de tous les joueurs
  function endShowdownOnline(M) {
    const al = M.ents.filter((e) => e.alive).sort((a, b) => b.hp - a.hp);
    al.forEach((e, i) => { e.place = i + 1; });
    finish(M, al.length ? al[0].team : -1);
  }

  /* ---------- attaques ---------- */
  Sim.tryAttack = function (M, b, ang, dist) {
    if (!b.alive || M.state !== 'play' || b.stun > 0 || b.freeze > 0 || b.dash || b.jump) return false;
    if (b.ammo < 1 || b.atkCd > 0) return false;
    b.ammo -= 1; b.atkCd = 0.3; b.face = ang; b.ang = ang;
    if (b.hasBall) { kickBall(M, b, ang); return true; }
    launch(M, b, b.def.atk, ang, dist, false);
    return true;
  };
  Sim.trySuper = function (M, b, ang, dist) {
    if (!b.alive || M.state !== 'play' || b.stun > 0 || b.freeze > 0 || b.dash || b.jump) return false;
    if (b.superCharge < 1) return false;
    b.superCharge = 0; b.superReadyFx = false; b.supers++; b.face = ang; b.ang = ang;
    b.st.supers++;
    launch(M, b, b.def.sup, ang, dist, true);
    return true;
  };
  function kickBall(M, b, ang) {
    const B = M.ball;
    B.owner = null; b.hasBall = false;
    B.last = b; B.vx = Math.cos(ang) * 1150; B.vy = Math.sin(ang) * 1150; B.cd[b.idx] = 0.35;
    B.x = b.x + Math.cos(ang) * (b.r + 14); B.y = b.y + Math.sin(ang) * (b.r + 14);
    b.recoil = 1; Sim.sfx(M, 'kick'); b.revealT = 0.6;
    Sim.burst(M, B.x, B.y, '#fff', 8, 160, 5, 0.4);
  }

  function launch(M, b, spec, ang, dist, isSuper) {
    b.recoil = 1; b.revealT = Math.max(b.revealT, 0.9);
    const dmgMul = b.dmgMul * (1 + 0.1 * b.cubes) * (b.rageT > 0 ? (b.rageK || 1.6) : 1);
    if (spec.sfx) Sim.sfx(M, isSuper && spec.sfx === 'shoot' ? 'super' : spec.sfx, b.x, b.y, b.def.voice);
    if (isSuper) { Sim.sfx(M, 'super'); if (b === M.player) { G.vibrate(40); Sim.shake(M, 6); } }
    const type = isSuper ? spec.type : 'proj';
    if (type === 'proj') {
      const burst = spec.burst || 1;
      volley(M, b, spec, ang, dist, dmgMul, isSuper);
      for (let i = 1; i < burst; i++) b.queue.push({ t: i * spec.burstDelay, spec, ang, dist, dmgMul, isSuper });
    } else if (type === 'dash') {
      b.dash = { ax: Math.cos(ang), ay: Math.sin(ang), left: spec.dist * T, speed: spec.speed * T, hit: new Set(), spec, dmgMul };
      b.invuln = 0;
      Sim.sfx(M, 'dash');
    } else if (type === 'jump') {
      let d = Math.min(spec.dist * T, Math.max(2 * T, dist || spec.dist * T));
      if (dist === undefined || dist === null) d = spec.dist * T;
      let tx = b.x + Math.cos(ang) * d, ty = b.y + Math.sin(ang) * d;
      // trouve un point libre en reculant
      for (let k = 0; k < 40; k++) {
        if (!circleHitsSolid(M, tx, ty, b.r)) break;
        d -= 12; tx = b.x + Math.cos(ang) * d; ty = b.y + Math.sin(ang) * d;
      }
      b.jump = { sx: b.x, sy: b.y, tx, ty, t: 0, dur: 0.55, spec, dmgMul };
      Sim.sfx(M, 'dash');
    } else if (type === 'aura') {
      doAura(M, b, spec, dmgMul);
    } else if (type === 'lobArea') {
      const d = G.clamp(dist == null ? spec.range * T : dist, 1.5 * T, spec.range * T);
      const p = newProj(M, b, spec, ang, dmgMul);
      p.lob = { sx: b.x, sy: b.y, tx: b.x + Math.cos(ang) * d, ty: b.y + Math.sin(ang) * d, t: 0, dur: Math.max(0.3, d / (spec.speed * T)) };
      p.splash = spec.splash * T; p.big = !!spec.big;
      addProj(M, p, isSuper);
    } else if (type === 'barrage') {
      const d = G.clamp(dist == null ? spec.range * T : dist, 1.5 * T, spec.range * T);
      const cx = b.x + Math.cos(ang) * d, cy = b.y + Math.sin(ang) * d;
      for (let i = 0; i < spec.count; i++) {
        const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * spec.area * T;
        const sk = { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, t: -(i * spec.duration / spec.count), delay: 0.55, spec, owner: b, dmgMul };
        M.strikes.push(sk);
        if (M.online) M.evq.push(['k', Math.round(sk.x), Math.round(sk.y), +(-sk.t).toFixed(2), b.id]);
      }
      Sim.ring(M, cx, cy, spec.area * T, spec.area * T, 1.8, 'rgba(255,80,40,0.45)', true);
    }
  }

  function volley(M, b, spec, ang, dist, dmgMul, isSuper) {
    const n = spec.n || 1;
    for (let j = 0; j < n; j++) {
      let a = ang;
      if (n > 1) a += ((j / (n - 1) - 0.5) * spec.spread * Math.PI) / 180 + G.rr(-0.02, 0.02);
      const p = newProj(M, b, spec, a, dmgMul);
      if (spec.lob) {
        const d = G.clamp(dist == null ? spec.range * T : dist, 1.5 * T, spec.range * T);
        p.lob = { sx: b.x, sy: b.y, tx: b.x + Math.cos(a) * d, ty: b.y + Math.sin(a) * d, t: 0, dur: Math.max(0.3, d / (spec.speed * T)) };
      }
      addProj(M, p, isSuper);
    }
    const mx = b.x + Math.cos(ang) * 34, my = b.y + Math.sin(ang) * 34;
    Sim.burst(M, mx, my, spec.color || '#ffe066', 4, 120, 4, 0.2);
  }

  let _pid = 1;
  function addProj(M, p, isSuper) {
    p.id = _pid++; p.isSuper = !!isSuper;
    M.projs.push(p);
    if (M.online && M.evq.length < 500) {
      const l = p.lob;
      M.evq.push(['p', p.id, p.owner.id, isSuper ? 1 : 0, Math.round(p.x), Math.round(p.y), Math.round(p.vx), Math.round(p.vy), +p.ang.toFixed(3),
        l ? [Math.round(l.sx), Math.round(l.sy), Math.round(l.tx), Math.round(l.ty), +l.dur.toFixed(2)] : 0, p.big ? 1 : 0, p.owner.team, Math.round(p.splash), p.owner.idx]);
    }
  }
  function newProj(M, b, spec, a, dmgMul) {
    const sp = spec.speed * T * (spec.n > 3 ? G.rr(0.93, 1.07) : 1);
    return {
      x: b.x + Math.cos(a) * (b.r + 4), y: b.y + Math.sin(a) * (b.r + 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, speed: sp,
      range: spec.range * T, travelled: 0, r: spec.r || 6, dmg: spec.dmg * dmgMul, owner: b, team: b.team, spec, shape: spec.shape || 'pellet',
      color: spec.color || '#fff', pierce: !!spec.pierce, hit: new Set(), splash: (spec.splash || 0) * T, lob: null, dead: false,
      heal: spec.heal ? spec.heal * dmgMul : 0, breakCrates: !!spec.breakCrates, age: 0, trail: [],
    };
  }

  function doAura(M, b, spec, dmgMul) {
    const R = spec.radius * T;
    Sim.ring(M, b.x, b.y, 20, R, 0.5, spec.color, true);
    Sim.ring(M, b.x, b.y, 10, R * 0.8, 0.7, '#fff');
    Sim.burst(M, b.x, b.y, spec.color, 26, R * 1.4, 6, 0.8);
    if (spec.sfx) Sim.sfx(M, spec.sfx);
    for (const e of M.ents) {
      if (!e.alive) continue;
      const d = G.dist(b.x, b.y, e.x, e.y);
      if (d > R + e.r) continue;
      if (e.team === b.team) {
        if (spec.heal) Sim.heal(M, e, spec.heal * dmgMul, b);
        if (spec.boost) { e.boostF = spec.boost; e.boostT = spec.boostT; }
        if (spec.shield) { e.invuln = Math.max(e.invuln, spec.shield); Sim.burst(M, e.x, e.y, spec.color, 6, 120, 5, 0.6); }
        if (spec.rage && e === b) { b.rageT = spec.rage.t; b.rageK = spec.rage.dmg; b.boostF = spec.rage.speed; b.boostT = spec.rage.t; }
      } else if (spec.dmg) {
        Sim.damage(M, e, spec.dmg * dmgMul, b, { stun: spec.stun, freeze: spec.freeze });
        Sim.burst(M, e.x, e.y, spec.color, 8, 160, 5, 0.5);
      } else if (spec.stun || spec.freeze) {
        applyFx(M, e, { stun: spec.stun, freeze: spec.freeze }, b); Sim.burst(M, e.x, e.y, spec.color, 8, 160, 5, 0.5);
      }
    }
    if (spec.shield || spec.rage) Sim.ring(M, b.x, b.y, 10, 60, 0.5, spec.color, true);
    if (spec.dmg) {
      for (const s of M.safes) if (s.team !== b.team && G.dist(b.x, b.y, s.x, s.y) < R + 70) damageSafe(M, s, spec.dmg * dmgMul * 0.6, b);
      Sim.shake(M, 8);
    }
  }

  function explode(M, p, x, y, rad, spec) {
    const o = p.owner;
    Sim.shake(M, p.big ? 14 : 5);
    Sim.ring(M, x, y, rad * 0.3, rad, 0.35, p.color, true);
    Sim.burst(M, x, y, p.color, p.big ? 30 : 14, rad * 2.2, p.big ? 10 : 6, 0.7);
    Sim.burst(M, x, y, '#ffd86a', p.big ? 10 : 5, rad * 0.8, rad * 0.55, 0.55, 'fire');
    Sim.burst(M, x, y, '#fff3b0', 10, rad * 2.4, 5, 0.4, 'spark');
    Sim.ring(M, x, y, rad * 0.1, rad * 1.5, 0.22, 'rgba(255,255,255,0.9)', true);
    Sim.burst(M, x, y, '#444', 8, rad * 1.2, 9, 0.9, 'smoke');
    Sim.sfx(M, 'explode');
    for (const e of M.ents) {
      if (!e.alive || e.team === p.team) continue;
      const d = G.dist(x, y, e.x, e.y);
      if (d < rad + e.r * 0.6) {
        const a = Math.atan2(e.y - y, e.x - x);
        Sim.damage(M, e, p.dmg, o, { slow: spec.slow, poison: spec.poison, stun: spec.stun, freeze: spec.freeze, knock: spec.knock, ang: a });
      }
    }
    for (const s of M.safes) {
      if (s.team === p.team) continue;
      const dx = Math.max(0, Math.abs(x - s.x) - 90), dy = Math.max(0, Math.abs(y - s.y) - 90);
      if (Math.hypot(dx, dy) < rad) damageSafe(M, s, p.dmg, o);
    }
    // caisses
    const tx0 = Math.floor((x - rad) / T), tx1 = Math.floor((x + rad) / T), ty0 = Math.floor((y - rad) / T), ty1 = Math.floor((y + rad) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = Sim.tile(M, tx, ty);
      if (t === 2 || t === 6) {
        const cx = G.clamp(x, tx * T, tx * T + T), cy = G.clamp(y, ty * T, ty * T + T);
        if (G.dist(x, y, cx, cy) < rad) Sim.damageTile(M, tx, ty, p.dmg, p.breakCrates);
      }
    }
    if (spec.zone) {
      if (M.online) M.evq.push(['z', Math.round(x), Math.round(y), Math.round(rad * 1.05), spec.zone.t, spec.zone.color]);
      M.zones.push({ x, y, r: rad * 1.05, t: spec.zone.t, max: spec.zone.t, slow: spec.zone.slow, dps: spec.zone.dps, team: p.team, owner: o, color: spec.zone.color, acc: 0 });
    }
  }

  /* ---------- mise à jour ---------- */
  Sim.update = function (M, dt) {
    dt = Math.min(dt, 0.05);
    if (M.hitstop > 0) { M.hitstop -= dt; return; }
    M.t += dt; M.tick++;
    if (G.Dev && !M.online) G.Dev.onUpdate(M, dt);
    // caméra, particules, textes
    updateFx(M, dt);
    if (M.state === 'countdown') {
      const prev = Math.ceil(M.cd);
      M.cd -= dt;
      const cur = Math.ceil(M.cd);
      if (cur !== prev && cur > 0) Sim.sfx(M, 'count');
      if (M.cd <= 0) { M.state = 'play'; Sim.sfx(M, 'go'); Sim.banner(M, 'GO !', '', '#ffd21f', 0.8); }
    }
    if (M.state === 'end') { M.endT += dt; }
    const active = M.state === 'play';
    if (M.state === 'play' || M.state === 'end' || M.state === 'goal') {
      if (active) {
        M.left -= dt;
        if (M.left <= 0) timeUp(M);
      }
      if (M.state === 'goal') {
        M.goalT -= dt;
        if (M.goalT <= 0) resetAfterGoal(M);
      }
    }
    // joueurs
    for (const b of M.ents) updateBrawler(M, b, dt, active || M.state === 'goal' || M.state === 'end');
    // projectiles, items, zones, frappes
    updateProjs(M, dt);
    updateStrikes(M, dt);
    updateItems(M, dt);
    updateZones(M, dt);
    if (M.state === 'play' || M.state === 'goal') {
      if (M.mode === 'gemgrab') updateGemGrab(M, dt);
      if (M.mode === 'brawlball') updateBall(M, dt);
      if (M.mode === 'showdown') updateShowdown(M, dt);
      if (M.mode === 'hotzone' && M.state === 'play') updateHotzone(M, dt);
      if (M.mode === 'bounty') { /* score géré à la mort */ }
    }
    if (M.safes.length) for (const s of M.safes) if (s.flash > 0) s.flash -= dt;
  };

  function timeUp(M) {
    if (M.mode === 'gemgrab') {
      const a = teamGems(M, 0), b = teamGems(M, 1);
      finish(M, a === b ? -1 : a > b ? 0 : 1);
    } else if (M.mode === 'brawlball') {
      if (M.score[0] === M.score[1]) {
        if (!M.overtime) { M.overtime = true; M.left = 60; Sim.banner(M, 'PROLONGATION !', 'But en or', '#ffd21f', 2); }
        else finish(M, -1);
      } else finish(M, M.score[0] > M.score[1] ? 0 : 1);
    } else if (M.mode === 'heist') {
      const a = M.safes[0].hp / M.safes[0].maxhp, b = M.safes[1].hp / M.safes[1].maxhp;
      // l'équipe dont le coffre est le plus sain gagne
      finish(M, Math.abs(a - b) < 0.001 ? -1 : a > b ? 0 : 1);
    } else if (M.mode === 'bounty' || M.mode === 'hotzone') {
      finish(M, Math.floor(M.score[0]) === Math.floor(M.score[1]) ? -1 : M.score[0] > M.score[1] ? 0 : 1);
    } else if (M.mode === 'knockout') {
      const hp = [0, 1].map((t) => M.ents.filter((e) => e.team === t && e.alive).reduce((a, e) => a + e.hp, 0));
      if (Math.abs(hp[0] - hp[1]) < 1) endRound(M, -1); else endRound(M, hp[0] > hp[1] ? 0 : 1);
    } else if (M.mode === 'boss') {
      finish(M, 1);
    } else if (M.mode === 'showdown') {
      const al = M.ents.filter((e) => e.alive);
      al.sort((a, b) => b.hp - a.hp);
      al.forEach((e, i) => { e.place = i + 1; });
      if (M.online) endShowdownOnline(M); else finishShowdown(M, M.player.alive ? M.player.place : M.player.place);
    }
  }

  function updateFx(M, dt) {
    const c = M.cam;
    c.shake = Math.max(0, c.shake - dt * 30);
    for (let i = M.parts.length - 1; i >= 0; i--) {
      const p = M.parts[i];
      p.t += dt;
      if (p.t >= p.dur) { M.parts.splice(i, 1); continue; }
      const drag = Math.exp(-(p.drag || 0) * dt);
      p.vx *= drag; p.vy *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'chunk') p.vy += 500 * dt;
    }
    for (let i = M.texts.length - 1; i >= 0; i--) {
      const t = M.texts[i]; t.t += dt; t.y += t.vy * dt; t.vy *= Math.exp(-3 * dt);
      if (t.t >= t.dur) M.texts.splice(i, 1);
    }
    for (let i = M.rings.length - 1; i >= 0; i--) { M.rings[i].t += dt; if (M.rings[i].t >= M.rings[i].dur) M.rings.splice(i, 1); }
    if (M.banner) { M.banner.t += dt; if (M.banner.t > M.banner.dur) M.banner = null; }
  }

  function updateBrawler(M, b, dt, active) {
    b.popT -= dt;
    b.flash = Math.max(0, b.flash - dt);
    b.recoil = Math.max(0, b.recoil - dt * 6);
    if (b.emoteT > 0) b.emoteT -= dt;
    if (!b.alive) {
      if (b.deathT >= 0) b.deathT += dt;
      if (M.mode !== 'showdown' && M.state !== 'end' && M.state !== 'countdown') {
        b.respawn -= dt;
        if (b.respawn <= 0) respawn(M, b);
      }
      return;
    }
    // temps des états
    b.slowT -= dt; if (b.slowT <= 0) b.slowF = 1;
    b.boostT -= dt; if (b.boostT <= 0) b.boostF = 1;
    b.rageT = Math.max(0, (b.rageT || 0) - dt);
    b.stun = Math.max(0, b.stun - dt); b.freeze = Math.max(0, b.freeze - dt); b.invuln = Math.max(0, b.invuln - dt);
    b.revealT = Math.max(0, b.revealT - dt); b.atkCd = Math.max(0, b.atkCd - dt);
    const tl = Sim.tileAt(M, b.x, b.y);
    b.hidden = tl === 3 && b.revealT <= 0 && !b.jump;
    if (b.poison > 0) {
      b.poison -= dt; b.poisonAcc += b.poisonDps * dt;
      if (b.poisonAcc >= 120 && M.state !== 'end') { const a = b.poisonAcc; b.poisonAcc = 0; Sim.damage(M, b, a, b.poisonBy); Sim.burst(M, b.x, b.y - 10, '#b04dff', 2, 50, 4, 0.5); if (!b.alive) return; }
    }
    // recharge munitions
    if (b.ammo < 3 && !b.dash) { b.ammo = Math.min(3, b.ammo + dt / b.def.atk.reload); }
    // file de rafales
    for (let i = b.queue.length - 1; i >= 0; i--) {
      const q = b.queue[i]; q.t -= dt;
      if (q.t <= 0) { b.queue.splice(i, 1); if (b.stun <= 0 && b.freeze <= 0) volley(M, b, q.spec, q.ang, q.dist, q.dmgMul, q.isSuper); }
    }
    // décisions / entrées
    if (!b.isPlayer && active && M.state === 'play' && !(G.Dev && G.Dev.passive(M, b))) G.AI.update(M, b, dt);
    if (M.state !== 'play') { b.input.mx = 0; b.input.my = 0; }
    // saut
    if (b.jump) {
      const j = b.jump; j.t += dt;
      const k = Math.min(1, j.t / j.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      b.x = j.sx + (j.tx - j.sx) * e; b.y = j.sy + (j.ty - j.sy) * e; b.z = Math.sin(k * Math.PI) * 90; b.invuln = 0.1;
      if (k >= 1) {
        b.jump = null; b.z = 0; b.invuln = 0.2;
        const p = { owner: b, team: b.team, dmg: j.spec.dmg * j.dmgMul, color: j.spec.color, big: false, breakCrates: false };
        explode(M, p, b.x, b.y, j.spec.splash * T, { poison: j.spec.poison, freeze: j.spec.freeze, knock: j.spec.knock });
        if (j.spec.heal) Sim.heal(M, b, j.spec.heal * j.dmgMul, b);
        b.revealT = 0.8;
      }
      b.px = b.x; b.py = b.y; return;
    }
    // charge
    if (b.dash) {
      const d = b.dash, step = Math.min(d.left, d.speed * dt);
      const blocked = tryMove(M, b, d.ax * step, d.ay * step);
      d.left -= step; b.face = Math.atan2(d.ay, d.ax); b.ang = b.face; b.walkT += dt * 20; b.revealT = 0.3;
      Sim.burst(M, b.x - d.ax * 20, b.y - d.ay * 20 + 10, '#e8d9b0', 1, 60, 8, 0.4, 'smoke');
      for (const e of M.ents) {
        if (!e.alive || e.team === b.team || d.hit.has(e)) continue;
        if (G.dist(b.x, b.y, e.x, e.y) < b.r + e.r + 6) {
          d.hit.add(e);
          Sim.damage(M, e, d.spec.dmg * d.dmgMul, b, { stun: d.spec.stun, knock: d.spec.knock || 100, ang: b.face });
          Sim.shake(M, 8); Sim.burst(M, e.x, e.y, '#fff', 10, 200, 5, 0.4);
        }
      }
      // caisses devant
      const fx = Math.floor((b.x + d.ax * (b.r + 6)) / T), fy = Math.floor((b.y + d.ay * (b.r + 6)) / T);
      const ft = Sim.tile(M, fx, fy);
      if (ft === 2 || ft === 6) Sim.damageTile(M, fx, fy, 99999, true);
      if (blocked || d.left <= 0.5) { b.dash = null; Sim.burst(M, b.x, b.y, '#e8d9b0', 8, 150, 8, 0.5, 'smoke'); }
      b.px = b.x; b.py = b.y;
      return;
    }
    // déplacement
    let mx = b.input.mx, my = b.input.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const blockedMove = b.stun > 0 || b.freeze > 0 || (M.state === 'countdown');
    let spd = b.def.speed * T * b.slowF * b.boostF * (b.hasBall ? 0.93 : 1) * (M.event === 'turbo' ? 1.2 : 1);
    if (G.Dev && !M.online) spd *= G.Dev.speedMul(M, b);
    if (M.mode === 'showdown') spd *= 1;
    if (blockedMove) { mx = my = 0; }
    b.moving = ml > 0.1 && !blockedMove;
    if (b.moving) { b.walkT += dt * 12 * (spd / 240); if (!M.online && Math.random() < dt * 7) Sim.burst(M, b.x, b.y + 14, '#d8d0b8', 1, 30, 5, 0.45, 'smoke'); }
    const vx = mx * spd + b.kx, vy = my * spd + b.ky;
    b.kx *= Math.exp(-8 * dt); b.ky *= Math.exp(-8 * dt);
    if (vx || vy) tryMove(M, b, vx * dt, vy * dt);
    b.ang += G.angDiff(b.ang, b.face) * Math.min(1, dt * 16);
    b.vx = (b.x - b.px) / Math.max(dt, 1e-4); b.vy = (b.y - b.py) / Math.max(dt, 1e-4);
    b.px = b.x; b.py = b.y;
    if (circleHitsSolid(M, b.x, b.y, b.r - 3)) unstick(M, b); // sécurité anti-blocage dans un mur
    // séparation entre brawlers
    for (const o of M.ents) {
      if (o === b || !o.alive || o.jump) continue;
      const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy), min = b.r + o.r - 4;
      if (d < min && d > 0.01) {
        const push = (min - d) * 0.35;
        const nx = dx / d, ny = dy / d;
        if (!circleHitsSolid(M, b.x + nx * push, b.y + ny * push, b.r)) { b.x += nx * push; b.y += ny * push; }
      }
    }
    // retour au centre
    if (b.moving && Math.random() < dt * 4 && b.hidden) { /* bruissement */ }
    if (b.superCharge >= 1) b.superReadyFx = true;
    // ballon
    if (M.mode === 'brawlball' && b.hasBall && M.ball.owner !== b) b.hasBall = false;
  }

  function unstick(M, b) {
    for (let r = 6; r <= 150; r += 6) for (let a = 0; a < 6.283; a += 0.5236) {
      const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
      if (!circleHitsSolid(M, x, y, b.r)) { b.x = x; b.y = y; b.px = x; b.py = y; return; }
    }
    const sp = M.map.spawns[b.team] && M.map.spawns[b.team][0]; if (sp) { b.x = sp.x; b.y = sp.y; }
  }
  function applyEvent(M, ev) {
    M.event = ev || 'none';
    if (M.event === 'giants') M.ents.forEach((e) => { if (e.isBoss) return; e.big = 1.3; e.r = 25; e.maxhp *= 1.25; e.hp = e.maxhp; });
  }
  Sim.applyEvent = applyEvent;
  function respawn(M, b) {
    const sp = M.map.spawns[b.team][b.spawnIdx || 0] || M.map.spawns[b.team][0];
    b.deathT = -1; b.alive = true; b.hp = b.maxhp; b.x = sp.x; b.y = sp.y; b.px = sp.x; b.py = sp.y; b.ammo = 3; b.invuln = 1.6;
    b.kx = b.ky = 0; b.slowF = 1; b.boostF = 1; b.face = b.team === 0 ? 0 : Math.PI; b.ang = b.face;
    b.input.mx = b.input.my = 0; b.hasBall = false; b.gems = 0; b.superCharge = Math.min(b.superCharge, 0.3);
    Sim.ring(M, b.x, b.y, 10, 90, 0.5, '#fff', true);
    Sim.burst(M, b.x, b.y, '#fff', 14, 220, 6, 0.6);
    if (b.ai) b.ai.path = null;
  }

  function updateProjs(M, dt) {
    for (let i = M.projs.length - 1; i >= 0; i--) {
      const p = M.projs[i];
      p.age += dt;
      if (p.lob) { updateLob(M, p, dt); if (p.dead) M.projs.splice(i, 1); continue; }
      const dist = p.speed * dt, steps = Math.max(1, Math.ceil(dist / 14)), sx = (p.vx * dt) / steps, sy = (p.vy * dt) / steps, sd = dist / steps;
      for (let s = 0; s < steps && !p.dead; s++) {
        p.x += sx; p.y += sy; p.travelled += sd;
        // murs
        const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), t = Sim.tile(M, tx, ty);
        if (G.isBulletTile(t)) {
          if (t === 5) {
            const sf = safeAt(M, p.x, p.y);
            if (sf && sf.team !== p.team && !p.hit.has(sf)) { p.hit.add(sf); damageSafe(M, sf, p.dmg * (p.spec.n > 1 ? 1 : 1), p.owner); }
            if (!p.pierce) { endProj(M, p); break; }
          } else if (t === 2 || t === 6) {
            if (!p.hit.has(tx + ',' + ty)) { p.hit.add(tx + ',' + ty); Sim.damageTile(M, tx, ty, p.dmg, p.breakCrates); }
            if (!p.breakCrates) { endProj(M, p); break; }
          } else { endProj(M, p); break; }
        }
        // brawlers
        for (const e of M.ents) {
          if (!e.alive || e.invuln > 0 || e.jump || p.hit.has(e)) continue;
          const dx = e.x - p.x, dy = e.y - p.y, rr = e.r + p.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          if (e.team === p.team) {
            if (p.heal && e !== p.owner) { p.hit.add(e); Sim.heal(M, e, p.heal, p.owner); }
            continue;
          }
          // buisson : les ennemis cachés ne sont touchés que s'ils sont révélés ou proches (réalisme)
          p.hit.add(e);
          if (p.splash) { endProj(M, p); break; } // les dégâts viennent de l'explosion
          Sim.damage(M, e, p.dmg, p.owner, { slow: p.spec.slow, poison: p.spec.poison, stun: p.spec.stun, freeze: p.spec.freeze, knock: p.spec.knock, ang: p.ang });
          Sim.burst(M, p.x, p.y, p.color, 6, 160, 4, 0.3);
          if (!p.pierce) { endProj(M, p); break; }
        }
        if (p.dead) break;
        if (p.travelled >= p.range) { endProj(M, p); break; }
      }
      if (p.dead) M.projs.splice(i, 1);
    }
  }
  function endProj(M, p) {
    p.dead = true;
    if (M.online) M.evq.push(['px', p.id, Math.round(p.x), Math.round(p.y)]);
    if (p.splash) explode(M, p, p.x, p.y, p.splash, p.spec);
    else Sim.burst(M, p.x, p.y, p.color, 3, 90, 3, 0.25);
  }
  function updateLob(M, p, dt) {
    const l = p.lob; l.t += dt;
    const k = Math.min(1, l.t / l.dur);
    p.x = l.sx + (l.tx - l.sx) * k; p.y = l.sy + (l.ty - l.sy) * k; p.z = Math.sin(k * Math.PI) * 110; p.travelled = 0;
    if (k >= 1) { p.dead = true; p.z = 0; if (M.online) M.evq.push(['px', p.id, Math.round(l.tx), Math.round(l.ty)]); explode(M, p, l.tx, l.ty, p.splash || 1.4 * T, p.spec); }
  }
  function updateStrikes(M, dt) {
    for (let i = M.strikes.length - 1; i >= 0; i--) {
      const s = M.strikes[i]; s.t += dt;
      if (s.t >= s.delay) {
        M.strikes.splice(i, 1);
        const p = { owner: s.owner, team: s.owner.team, dmg: s.spec.dmg * s.dmgMul, color: s.spec.color, big: false, breakCrates: false };
        explode(M, p, s.x, s.y, s.spec.splash * T, s.spec);
      }
    }
  }
  function updateZones(M, dt) {
    for (let i = M.zones.length - 1; i >= 0; i--) {
      const z = M.zones[i]; z.t -= dt;
      if (z.t <= 0) { M.zones.splice(i, 1); continue; }
      z.acc += dt;
      for (const e of M.ents) {
        if (!e.alive || e.team === z.team) continue;
        if (G.dist(z.x, z.y, e.x, e.y) < z.r) {
          e.slowF = Math.min(e.slowF, z.slow); e.slowT = Math.max(e.slowT, 0.25);
          if (z.acc >= 0.5) Sim.damage(M, e, z.dps * 0.5, z.owner);
        }
      }
      if (z.acc >= 0.5) z.acc = 0;
    }
  }
  function updateItems(M, dt) {
    for (let i = M.items.length - 1; i >= 0; i--) {
      const it = M.items[i];
      it.age += dt; it.lock -= dt;
      it.vx *= Math.exp(-3.5 * dt); it.vy *= Math.exp(-3.5 * dt);
      const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
      if (!G.isSolidTile(Sim.tileAt(M, nx, it.y))) it.x = nx; else it.vx *= -0.5;
      if (!G.isSolidTile(Sim.tileAt(M, it.x, ny))) it.y = ny; else it.vy *= -0.5;
      if (it.lock > 0) continue;
      for (const b of M.ents) {
        if (!b.alive || b.jump) continue;
        if (G.dist(b.x, b.y, it.x, it.y) < b.r + 18) {
          if (it.type === 'gem') {
            if (M.mode !== 'gemgrab') { M.items.splice(i, 1); break; }
            b.gems++; b.st.gems++;
            Sim.sfx(M, 'pickup', b.x, b.y);
            Sim.text(M, b.x, b.y - 50, '+1', '#e07bff', 22);
          } else {
            b.cubes++; const add = b.def.hp * b.dmgMul * 0.1; b.maxhp += add; b.hp += add;
            Sim.sfx(M, 'pickup', b.x, b.y); Sim.text(M, b.x, b.y - 50, 'CUBE +10%', '#6dff8a', 22);
          }
          Sim.burst(M, it.x, it.y, it.type === 'gem' ? '#e07bff' : '#6dff8a', 8, 120, 4, 0.4);
          M.items.splice(i, 1);
          break;
        }
      }
    }
  }

  /* ---------- Razzia de cristaux ---------- */
  function teamGems(M, team) { let n = 0; for (const b of M.ents) if (b.team === team) n += b.gems; return n; }
  Sim.teamGems = teamGems;
  function updateGemGrab(M, dt) {
    M.gemT -= dt;
    let onField = 0; for (const it of M.items) if (it.type === 'gem') onField++;
    if (M.gemT <= 0 && M.state === 'play') {
      M.gemT = 4.8;
      if (onField < 28) {
        spawnItem(M, 'gem', M.map.mine.x, M.map.mine.y, G.rr(120, 260));
        Sim.ring(M, M.map.mine.x, M.map.mine.y, 10, 70, 0.4, '#e07bff');
      }
    }
    for (let t = 0; t < 2; t++) {
      const g = teamGems(M, t);
      if (g >= 10) {
        if (!M.gg.active[t]) { M.gg.active[t] = true; M.gg.t[t] = 15; if (M.online) Sim.banner(M, '10 CRISTAUX !', 'Tenez 15 secondes / reprenez-les', '#e07bff', 2, t); else if (t === 0) Sim.banner(M, 'VOUS AVEZ 10 CRISTAUX !', 'Tenez 15 secondes', '#e07bff', 2); else Sim.banner(M, 'L\'ENNEMI A 10 CRISTAUX !', 'Reprenez-les !', '#ff5252', 2); }
        M.gg.t[t] -= dt;
        if (M.gg.t[t] <= 0) finish(M, t);
      } else { M.gg.active[t] = false; M.gg.t[t] = 15; }
    }
  }

  /* ---------- Duel d'élite : manches sans réapparition ---------- */
  function checkKnockout(M) {
    if (M.state !== 'play') return;
    const alive = [0, 1].map((t) => M.ents.filter((e) => e.team === t && e.alive).length);
    if (alive[0] && alive[1]) return;
    const w = alive[0] ? 0 : alive[1] ? 1 : -1;
    endRound(M, w);
  }
  function endRound(M, w) {
    if (w >= 0) M.score[w]++;
    M.state = 'goal'; M.goalT = 2.8; M.finalGoal = M.score[0] >= 2 || M.score[1] >= 2;
    Sim.banner(M, w < 0 ? 'MANCHE NULLE' : M.finalGoal ? 'DUEL REMPORTÉ !' : 'MANCHE GAGNÉE !', w < 0 ? '' : 'Score ' + M.score[0] + ' - ' + M.score[1], '#ffd21f', 2.6, w);
    Sim.sfx(M, 'goal');
  }

  /* ---------- Zone stratégique ---------- */
  function updateHotzone(M, dt) {
    for (const c of M.caps) {
      const cnt = [0, 0];
      for (const b of M.ents) if (b.alive && !b.jump && G.dist(b.x, b.y, c.x, c.y) < c.r + 4) cnt[b.team]++;
      c.state = cnt[0] && cnt[1] ? 2 : cnt[0] ? 0 : cnt[1] ? 1 : -1;
      if (c.state === 0 || c.state === 1) M.score[c.state] = Math.min(100, M.score[c.state] + dt * (1.7 + 0.35 * cnt[c.state]));
    }
    if (M.score[0] >= 100 || M.score[1] >= 100) finish(M, M.score[0] >= 100 && M.score[0] >= M.score[1] ? 0 : 1);
  }

  /* ---------- Foot brawl ---------- */
  function updateBall(M, dt) {
    const B = M.ball;
    for (const k in B.cd) B.cd[k] -= dt;
    if (M.state !== 'play') return;
    if (B.owner) {
      const o = B.owner;
      if (!o.alive) { B.owner = null; o.hasBall = false; }
      else { B.x = o.x + Math.cos(o.face) * 26; B.y = o.y + Math.sin(o.face) * 26 + 4; B.vx = B.vy = 0; }
    } else {
      const sp = Math.hypot(B.vx, B.vy);
      const nx = B.x + B.vx * dt, ny = B.y + B.vy * dt;
      const R = 14;
      if (G.isSolidTile(Sim.tileAt(M, nx + Math.sign(B.vx) * R, B.y)) && Sim.tileAt(M, nx + Math.sign(B.vx) * R, B.y) !== 4) { B.vx *= -0.75; Sim.burst(M, B.x, B.y, '#fff', 3, 80, 3, 0.2); } else B.x = nx;
      if (G.isSolidTile(Sim.tileAt(M, B.x, ny + Math.sign(B.vy) * R)) && Sim.tileAt(M, B.x, ny + Math.sign(B.vy) * R) !== 4) { B.vy *= -0.75; } else B.y = ny;
      B.vx *= Math.exp(-1.9 * dt); B.vy *= Math.exp(-1.9 * dt);
      if (sp < 8) { B.vx = B.vy = 0; }
      B.spin += sp * dt * 0.02;
      // ramassage
      for (const b of M.ents) {
        if (!b.alive || b.jump || b.stun > 0 && false) continue;
        if ((B.cd[b.idx] || 0) > 0) continue;
        if (G.dist(b.x, b.y, B.x, B.y) < b.r + R + 4) {
          B.owner = b; B.last = b; b.hasBall = true; b.revealT = 0.4;
          Sim.sfx(M, 'pickup'); Sim.text(M, b.x, b.y - 55, 'BALLON !', '#fff', 20);
          break;
        }
      }
      // buts
      for (const g of M.map.goals) {
        if (B.x > g.x0 && B.x < g.x1 && B.y > g.y0 && B.y < g.y1) { scoreGoal(M, 1 - g.team, g); break; }
      }
    }
  }
  function scoreGoal(M, team, g) {
    M.score[team]++;
    M.state = 'goal'; M.goalT = 2.8;
    if (M.ball.last && M.ball.last.team === team) M.ball.last.st.goals++;
    if (M.player) Sim.banner(M, 'BUT !!!', team === M.player.team ? 'Quelle frappe !' : 'Dommage...', team === M.player.team ? '#6dff8a' : '#ff5252', 2.6); else Sim.banner(M, 'BUT !!!', '', '#ffd21f', 2.6, team);
    Sim.sfx(M, 'goal'); Sim.shake(M, 14);
    Sim.burst(M, M.ball.x, M.ball.y, '#ffd21f', 40, 420, 8, 1.2);
    Sim.burst(M, M.ball.x, M.ball.y, '#fff', 30, 300, 6, 1.0);
    if (M.ball.owner) { M.ball.owner.hasBall = false; M.ball.owner = null; }
    M.ball.vx = M.ball.vy = 0;
    M.lastScorer = team;
    for (const b of M.ents) { b.input.mx = b.input.my = 0; }
    if (M.overtime || M.score[team] >= 2) { M.hitstop = 0; M.finalGoal = true; }
  }
  function resetAfterGoal(M) {
    if (M.finalGoal) { finish(M, M.score[0] === M.score[1] ? -1 : M.score[0] > M.score[1] ? 0 : 1); return; }
    for (const b of M.ents) {
      const sp = M.map.spawns[b.team][b.spawnIdx];
      b.x = sp.x; b.y = sp.y; b.px = b.x; b.py = b.y; b.alive = true; b.hp = b.maxhp; b.ammo = 3; b.respawn = 0; b.kx = b.ky = 0;
      b.stun = b.freeze = 0; b.hasBall = false; b.dash = null; b.jump = null; b.queue.length = 0; b.poison = 0; b.invuln = 1;
      b.face = b.team === 0 ? 0 : Math.PI; if (b.ai) b.ai.path = null;
    }
    if (M.ball) { M.ball.x = M.map.ball.x; M.ball.y = M.map.ball.y; M.ball.vx = M.ball.vy = 0; M.ball.owner = null; M.ball.cd = {}; }
    M.state = 'countdown'; M.cd = 2.2; M.cdLast = 3;
  }

  /* ---------- Survie ---------- */
  function updateShowdown(M, dt) {
    const z = M.zone;
    if (M.t > z.start) {
      const k = G.clamp((M.t - z.start) / z.dur, 0, 1);
      z.x0 = G.lerp(z.sx0, z.fx0, k); z.y0 = G.lerp(z.sy0, z.fy0, k); z.x1 = G.lerp(z.sx1, z.fx1, k); z.y1 = G.lerp(z.sy1, z.fy1, k);
    }
    z.dmgT -= dt;
    if (z.dmgT <= 0) {
      z.dmgT = 0.5;
      const lvl = 1 + Math.max(0, M.t - z.start) / 50;
      for (const b of M.ents) {
        if (!b.alive || b.jump) continue;
        if (b.x < z.x0 || b.x > z.x1 || b.y < z.y0 || b.y > z.y1) {
          Sim.damage(M, b, 360 * lvl, null);
          b.invuln = 0;
          Sim.burst(M, b.x, b.y - 10, '#8cff3a', 3, 70, 5, 0.6);
          if (b === M.player) Sim.sfx(M, 'poison');
        }
      }
    }
    M.alive = M.ents.filter((e) => e.alive).length;
    if (M.state === 'play' && M.alive <= 1 && !M.result) {
      const w = M.ents.find((e) => e.alive);
      if (w) w.place = 1;
      if (M.online) endShowdownOnline(M); else finishShowdown(M, M.player.alive ? 1 : M.player.place);
    }
  }

  /* ---------- Chasse aux primes / Braquage : rien de spécial par frame ---------- */

  /* meilleure cible automatique pour le joueur */
  Sim.autoTarget = function (M, b, range) {
    let best = null, bd = range;
    for (const e of M.ents) {
      if (!e.alive || e.team === b.team || !Sim.canSee(M, b, e)) continue;
      const d = G.dist(b.x, b.y, e.x, e.y) - (e.hp < e.maxhp * 0.4 ? 40 : 0);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) for (const s of M.safes) if (s.team !== b.team) { const d = G.dist(b.x, b.y, s.x, s.y) - 60; if (d < bd) { bd = d; best = { x: s.x, y: s.y, vx: 0, vy: 0, safe: true }; } }
    return best;
  };

  /* ---------- multijoueur : création côté serveur ---------- */
  const BOT_TAGS = ['Robo', 'Bot', 'Auto'];
  /* opts : {mode, mapKey, seed, players:[{pid, name, brawler, skin, level, team, trophies}]}  — les places vides sont remplies par des bots étiquetés */
  Sim.createOnline = function (opts) {
    const mode = G.MODES[opts.mode], mdef = G.MAPS[opts.mapKey];
    const map = G.genMap(mdef, opts.seed);
    const avg = opts.players.length ? opts.players.reduce((a, p) => a + (p.trophies || 0), 0) / opts.players.length : 0;
    const M = makeM(mode, opts.mapKey, map, avg);
    M.online = true; M.player = null; M.seed = opts.seed;
    const pool = G.shuffle(G.BRAWLERS.slice());
    let bi = 0;
    const botName = () => BOT_TAGS[bi % 3] + '-' + G.pick(['Zèbre', 'Lynx', 'Pixel', 'Tonnerre', 'Moka', 'Fusée', 'Nova', 'Panda', 'Comète', 'Ninja']);
    const addBot = (team, slot) => {
      const def = pool[bi++ % pool.length];
      return { pid: null, bot: true, name: botName(), brawler: def.id, skin: 'classic', level: G.clamp(Math.round((opts.players[0] ? opts.players[0].level : 3) + G.rr(-1, 1)), 1, G.MAX_LEVEL), team, trophies: avg };
    };
    let list = [];
    if (mode.id === 'showdown') {
      list = opts.players.slice(0, 10).map((p, i) => Object.assign({}, p, { team: i }));
      while (list.length < 10) list.push(addBot(list.length));
      const sp = G.shuffle(map.spawns.slice());
      list.forEach((p, i) => {
        const b = mkBrawler(M, G.BRAWLER[p.brawler], i, p.name, p.level, p.skin, !p.bot, sp[i], i);
        b.pid = p.pid; b.human = !p.bot; b.isBot = !!p.bot; M.ents.push(b);
      });
      M.alive = 10;
      M.ents.forEach((e) => { e.invuln = 6.5; });
      const fx = (M.w / 2 + G.rr(-5, 5)) * T, fy = (M.h / 2 + G.rr(-5, 5)) * T, half = 3.2 * T;
      M.zone = { x0: T, y0: T, x1: (M.w - 1) * T, y1: (M.h - 1) * T, fx0: fx - half, fy0: fy - half, fx1: fx + half, fy1: fy + half, sx0: T, sy0: T, sx1: (M.w - 1) * T, sy1: (M.h - 1) * T, start: 22, dur: 150, dmgT: 0 };
    } else {
      for (let team = 0; team < 2; team++) {
        let mine = opts.players.filter((p) => (mode.id === 'boss' ? 0 : p.team) === team).slice(0, 3);
        if (mode.id === 'boss' && team === 1) mine = [{ pid: null, bot: true, name: 'Mégabot', brawler: 'robot', skin: 'classic', level: opts.players[0] ? opts.players[0].level : 3, team: 1, trophies: avg }];
        while (mine.length < 3 && !(mode.id === 'boss' && team === 1)) mine.push(addBot(team));
        mine.forEach((p, k) => {
          const b = mkBrawler(M, G.BRAWLER[p.brawler], team, p.name, p.level, p.skin, !p.bot, map.spawns[team][k], team * 3 + k);
          b.spawnIdx = k; b.pid = p.pid; b.human = !p.bot; b.isBot = !!p.bot; M.ents.push(b);
        });
      }
    }
    if (mode.id === 'boss') setupBoss(M);
    applyEvent(M, opts.event === undefined ? 'none' : opts.event);
    if (mode.id === 'heist') map.safes.forEach((sf) => { sf.maxhp = 24000; sf.hp = sf.maxhp; sf.flash = 0; M.safes.push(sf); });
    if (mode.id === 'brawlball') M.ball = { x: map.ball.x, y: map.ball.y, vx: 0, vy: 0, owner: null, cd: {}, z: 0, spin: 0, last: null };
    return M;
  };

  /* instantané compact envoyé aux clients (20 Hz) ; les évènements (tirs, explosions…) sont envoyés à part */
  const STATE_CODE = { countdown: 0, play: 1, goal: 2, end: 3 };
  Sim.snapshot = function (M) {
    const e = M.ents.map((b) => {
      const f = (b.alive ? 1 : 0) | (b.hidden ? 2 : 0) | (b.stun > 0 ? 4 : 0) | (b.freeze > 0 ? 8 : 0) | (b.poison > 0 ? 16 : 0) | (b.slowT > 0 && b.slowF < 1 ? 32 : 0) | (b.boostT > 0 ? 64 : 0) | (b.invuln > 0 ? 128 : 0) | (b.hasBall ? 256 : 0) | (b.dash ? 512 : 0) | (b.moving ? 1024 : 0) | (b.revealT > 0 ? 2048 : 0);
      return [Math.round(b.x), Math.round(b.y), +b.ang.toFixed(2), +b.face.toFixed(2), Math.round(b.hp), Math.round(b.maxhp), f, Math.round(b.ammo * 10), Math.round(b.superCharge * 100), b.gems, b.cubes, b.bounty, Math.round(b.z || 0), +Math.max(0, b.respawn).toFixed(1), b.kills, b.dash ? +Math.atan2(b.dash.ay, b.dash.ax).toFixed(2) : 0];
    });
    const snap = {
      tm: +M.t.toFixed(2), s: STATE_CODE[M.state], cd: +M.cd.toFixed(1), left: +M.left.toFixed(1), sc: M.score, e,
      it: M.items.map((i) => [i.type === 'gem' ? 0 : 1, Math.round(i.x), Math.round(i.y)]),
    };
    if (M.mode === 'gemgrab') snap.gg = [M.gg.active[0] ? 1 : 0, +M.gg.t[0].toFixed(1), M.gg.active[1] ? 1 : 0, +M.gg.t[1].toFixed(1)];
    if (M.zone) snap.z = [Math.round(M.zone.x0), Math.round(M.zone.y0), Math.round(M.zone.x1), Math.round(M.zone.y1)];
    if (M.ball) snap.b = [Math.round(M.ball.x), Math.round(M.ball.y), M.ball.owner ? M.ball.owner.idx : -1];
    if (M.caps.length) snap.cp = M.caps.map((c) => c.state);
    if (M.safes.length) snap.sf = M.safes.map((x) => Math.round(x.hp));
    if (M.alive !== undefined) snap.al = M.alive;
    snap.ak = M.ents.map((b) => b.ack || 0);
    if (M.result) snap.res = Object.assign({}, M.result, { stats: M.ents.map((b) => Object.assign({}, b.st, { kills: b.kills })) });
    return snap;
  };
  Sim.flushEvents = function (M) { const q = M.evq; M.evq = []; return q; };
  Sim.updateFx = updateFx; Sim.finish = finish; Sim.heal2 = Sim.heal;
  Sim.makeM = makeM; Sim.mkBrawler = mkBrawler; Sim.tryMove = tryMove; Sim.explodeFx = null;
})();
