/* Brawl Rush - combat en ligne côté client : reconstruit l'état depuis les instantanés du serveur,
   interpole les autres joueurs, prédit/réconcilie le joueur local et rejoue les évènements visuels. */
(function () {
  const G = window.G;
  const T = G.T;
  const Sim = G.Sim;
  const NM = (G.NetMatch = { M: null, buf: [], hist: [], seq: 0, sendT: 0, endMsg: null, lock: 0, P: null, latest: null });
  const STATES = ['countdown', 'play', 'goal', 'end'];
  const lerp = (a, b, k) => a + (b - a) * k;

  NM.begin = function (init) {
    const mode = G.MODES[init.mode], mdef = G.MAPS[init.mapKey];
    const map = G.genMap(mdef, init.seed);
    if (init.tiles) { const bin = atob(init.tiles); for (let i = 0; i < map.tiles.length && i < bin.length; i++) map.tiles[i] = bin.charCodeAt(i); }
    map.dirty = true;
    const M = Sim.makeM(mode, init.mapKey, map, 0);
    M.net = true; M.online = false; M.id = init.id; M.ready = false;
    init.roster.forEach((r) => {
      const b = Sim.mkBrawler(M, G.BRAWLER[r.brawler], r.team, r.name, r.level, r.skin, r.idx === init.you, { x: -999, y: -999 }, r.idx);
      b.isBot = r.bot; b.human = !r.bot; M.ents[r.idx] = b;
      if (r.brawler === 'robot') { b.r = 28; b.big = 1.8; b.isBoss = true; }
    });
    M.player = M.ents[init.you];
    if (mode.id === 'heist') map.safes.forEach((sf) => { sf.maxhp = 24000; sf.hp = 24000; sf.flash = 0; M.safes.push(sf); });
    if (mode.id === 'brawlball') M.ball = { x: map.ball.x, y: map.ball.y, vx: 0, vy: 0, owner: null, cd: {}, z: 0, spin: 0 };
    if (mode.id === 'showdown') { M.zone = { x0: T, y0: T, x1: (M.w - 1) * T, y1: (M.h - 1) * T }; M.alive = 10; }
    M.stats = M.player.st;
    NM.M = M; NM.buf = []; NM.hist = []; NM.seq = 0; NM.P = null; NM.latest = null; NM.endMsg = null; NM.lock = 0; NM.sendT = 0; NM.projs = {};
    return M;
  };

  /* ----- réception d'un instantané ----- */
  NM.onSnap = function (s) {
    const M = NM.M; if (!M) return;
    NM.buf.push({ at: performance.now(), s }); if (NM.buf.length > 10) NM.buf.shift();
    NM.latest = s;
    const me = M.player, first = !M.ready;
    M.ready = true;
    const st = STATES[s.s];
    if (st !== M.state) { M.state = st; if (st === 'end') M.endT = 0; }
    M.cd = s.cd; M.left = s.left; M.score = s.sc; M.t = s.tm;
    if (s.gg) { M.gg.active = [!!s.gg[0], !!s.gg[2]]; M.gg.t = [s.gg[1], s.gg[3]]; }
    if (s.z && M.zone) { M.zone.x0 = s.z[0]; M.zone.y0 = s.z[1]; M.zone.x1 = s.z[2]; M.zone.y1 = s.z[3]; }
    if (s.sf) s.sf.forEach((hp, i) => { const sf = M.safes[i]; if (sf) { if (hp < sf.hp) sf.flash = 0.12; sf.hp = hp; } });
    if (s.al !== undefined) M.alive = s.al;
    if (s.cp) s.cp.forEach((st, i) => { if (M.caps[i]) M.caps[i].state = st; });
    M.items = s.it.map((it, i) => ({ type: it[0] ? 'cube' : 'gem', x: it[1], y: it[2], bob: i * 1.7, age: 0, z: 0 }));
    if (s.b && M.ball) { M.ball.x = s.b[0]; M.ball.y = s.b[1]; M.ball.owner = s.b[2] >= 0 ? M.ents[s.b[2]] : null; M.ball.spin += 0.05; }
    s.e.forEach((a, i) => {
      const b = M.ents[i]; if (!b) return;
      const f = a[6], wasAlive = b.alive, wasHp = b.hp;
      b.hp = a[4]; b.maxhp = a[5];
      b.alive = !!(f & 1);
      if (b.alive && wasAlive && b.hp < wasHp - 1) b.flash = 0.12;
      if (wasAlive && !b.alive) { b.deathT = 0; b.deathAng = a[3]; }
      if (!wasAlive && b.alive) { b.deathT = -1; b.spawnT = 0; }
      b.hidden = !!(f & 2); b.stun = f & 4 ? 1 : 0; b.freeze = f & 8 ? 1 : 0; b.poison = f & 16 ? 1 : 0; b.slowT = f & 32 ? 1 : 0; b.slowF = f & 32 ? 0.5 : 1;
      b.boostT = f & 64 ? 1 : 0; b.invuln = f & 128 ? 1 : 0; b.hasBall = !!(f & 256); b.dash = f & 512 ? { ax: Math.cos(a[15]), ay: Math.sin(a[15]) } : null;
      b.moving = !!(f & 1024); b.revealT = f & 2048 ? 1 : 0;
      b.ammo = a[7] / 10; b.superCharge = a[8] / 100; b.gems = a[9]; b.cubes = a[10]; b.bounty = a[11]; b.z = a[12]; b.respawn = a[13]; b.kills = a[14];
      if (first || (b.alive && !wasAlive)) { b.x = a[0]; b.y = a[1]; b.px = b.x; b.py = b.y; if (b === me) NM.P = { x: a[0], y: a[1], r: 21 }; }
    });
    // réconciliation du joueur local : serveur + commandes non encore acquittées
    if (me && me.alive) {
      const a = s.e[M.ents.indexOf(me)], ack = s.ak ? s.ak[M.ents.indexOf(me)] : 0, f = a[6];
      const forced = (f & (4 | 8 | 512)) || a[12] > 0 || M.state !== 'play';
      const P = { x: a[0], y: a[1], r: me.r };
      if (!forced) {
        const spd = me.def.speed * T * (f & 32 ? 0.5 : 1) * (f & 64 ? 1.35 : 1) * (f & 256 ? 0.93 : 1);
        for (const h of NM.hist) {
          if (h.seq < ack) continue;
          const dur = h.seq === ack ? h.dur * 0.5 : h.dur;
          Sim.tryMove(M, P, h.mx * spd * dur, h.my * spd * dur);
        }
      }
      NM.hist = NM.hist.filter((h) => h.seq >= ack);
      NM.P = { x: P.x, y: P.y, forced, r: me.r };
    }
    s.ev.forEach((e) => NM.event(M, e));
    if (s.res && !M.result) {
      const r = s.res, meIdx = M.ents.indexOf(me), place = r.places ? r.places[meIdx] : 0;
      const show = M.mode === 'showdown';
      const win = show ? place === 1 : !r.draw && r.winnerTeam === me.team;
      M.result = { win, draw: !!r.draw, winnerTeam: r.winnerTeam, place: place || 10, time: M.t };
      M.stats = Object.assign({ damage: 0, kills: 0, supers: 0, heal: 0, gems: 0, goals: 0 }, r.stats ? r.stats[meIdx] : {});
      Sim.sfx(M, win ? 'win' : 'lose');
      Sim.banner(M, r.draw ? 'ÉGALITÉ' : show ? (win ? 'DERNIER SURVIVANT !' : 'ÉLIMINÉ') : win ? 'VICTOIRE !' : 'DÉFAITE', show ? '#' + place + ' sur 10' : '', win ? '#ffd21f' : '#ff5252', 3);
    }
  };

  /* ----- évènements visuels / sonores ----- */
  NM.event = function (M, e) {
    const me = M.player;
    switch (e[0]) {
      case 'b': Sim.burst(M, e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8] || undefined); break;
      case 'r': Sim.ring(M, e[1], e[2], e[3], e[4], e[5], e[6], !!e[7]); break;
      case 't': Sim.text(M, e[1], e[2], e[3], e[4], e[5]); break;
      case 'n': {
        let [, txt, sub, col, dur, team] = e;
        if (team >= 0 && me) {
          const mine = team === me.team;
          if (txt === 'BUT !!!') { sub = mine ? 'Quelle frappe !' : 'Dommage...'; col = mine ? '#6dff8a' : '#ff5252'; }
          else { txt = (mine ? 'VOTRE ÉQUIPE : ' : 'ÉQUIPE ENNEMIE : ') + txt; col = mine ? '#9dffb4' : '#ff9a9a'; }
        }
        Sim.banner(M, txt, sub, col, dur); break;
      }
      case 'd': {
        const tgt = M.ents[e[4]]; if (!tgt) break;
        if (tgt.popObj && tgt.popT > 0 && tgt.popObj.t < 0.5) { tgt.popObj.amt += e[3]; tgt.popObj.txt = String(Math.round(tgt.popObj.amt)); tgt.popObj.t = 0.1; }
        else { const o = { x: e[1] + G.rr(-8, 8), y: e[2], txt: String(e[3]), color: me && tgt.team === me.team ? '#ff5252' : '#fff', t: 0, dur: 0.9, size: 22, vy: -70, amt: e[3] }; M.texts.push(o); tgt.popObj = o; tgt.popT = 0.25; }
        if (tgt === me) { G.vibrate(25); Sim.shake(M, 5); }
        break;
      }
      case 's': if (e[2] < 0 || !me || G.dist(me.x, me.y, e[2], e[3]) < 1100) G.Audio.sfx(e[1]); break;
      case 'sr': if (me && M.ents[e[1]] === me) G.Audio.sfx('superReady'); break;
      case 'p': {
        const owner = M.ents[e[13]], def = G.BRAWLER[e[2]], spec = e[3] ? def.sup : def.atk;
        const p = { id: e[1], x: e[4], y: e[5], vx: e[6], vy: e[7], ang: e[8], speed: Math.hypot(e[6], e[7]), range: (spec.range || 8) * T + 40, travelled: 0, r: spec.r || 6, shape: spec.shape || 'pellet', color: spec.color || '#fff',
          lob: e[9] ? { sx: e[9][0], sy: e[9][1], tx: e[9][2], ty: e[9][3], dur: e[9][4], t: 0 } : null, z: 0, big: !!e[10], splash: e[12], age: 0, team: e[11], spec };
        M.projs.push(p); NM.projs[p.id] = p;
        if (owner) { owner.recoil = 1; if (owner !== me) owner.face = e[8]; }
        if (me && (!owner || G.dist(me.x, me.y, e[4], e[5]) < 1100) && spec.sfx && !e[3]) G.Audio.sfx(spec.sfx);
        break;
      }
      case 'px': { const p = NM.projs[e[1]]; if (p) { p.dead = true; delete NM.projs[e[1]]; } break; }
      case 'T': { const k = e[2] * M.w + e[1]; M.map.tiles[k] = 0; M.map.dirty = true; break; }
      case 'k': M.strikes.push({ x: e[1], y: e[2], t: -e[3], delay: 0.55, spec: (G.BRAWLER[e[4]] || {}).sup || { splash: 1.3 }, owner: null }); break;
      case 'z': M.zones.push({ x: e[1], y: e[2], r: e[3], t: e[4], max: e[4], color: e[5], acc: 0 }); break;
    }
  };

  const angLerp = (a, b, k) => a + G.angDiff(a, b) * k;

  /* ----- mise à jour par image ----- */
  NM.update = function (M, dt) {
    if (!M.ready) return;
    Sim.updateFx(M, dt);
    const me = M.player, now = performance.now() - 100; // 100 ms de retard d'interpolation
    if (M.state === 'end') M.endT += dt;
    // interpolation des autres entités
    let a = null, b = null;
    for (let i = NM.buf.length - 1; i >= 0; i--) { if (NM.buf[i].at <= now) { a = NM.buf[i]; b = NM.buf[i + 1] || null; break; } }
    if (!a) a = NM.buf[0];
    const k = a && b ? G.clamp((now - a.at) / Math.max(1, b.at - a.at), 0, 1) : 0;
    M.ents.forEach((e, i) => {
      if (!e) return;
      e.popT -= dt; e.flash = Math.max(0, e.flash - dt); e.recoil = Math.max(0, e.recoil - dt * 6);
      if (e.deathT >= 0) e.deathT += dt;
      if (e.moving && e.alive && Math.random() < dt * 7) Sim.burst(M, e.x, e.y + 14, '#d8d0b8', 1, 30, 5, 0.45, 'smoke');
      if (e.spawnT !== undefined) e.spawnT += dt;
      if (e === me) return;
      if (!a) return;
      const A = a.s.e[i], B = b ? b.s.e[i] : A;
      if (!A) return;
      const nx = lerp(A[0], B[0], k), ny = lerp(A[1], B[1], k);
      if (Math.hypot(nx - e.x, ny - e.y) > 300 || !e.alive) { e.x = nx; e.y = ny; } else { e.x = nx; e.y = ny; }
      e.ang = angLerp(A[2], B[2], k); e.face = angLerp(A[3], B[3], k);
      if (e.moving) e.walkT += dt * 12 * (e.def.speed * T / 240);
      e.vx = (B[0] - A[0]) * 10; e.vy = (B[1] - A[1]) * 10;
    });
    // joueur local : position prédite
    if (me && NM.P) {
      const inp = me.input;
      const f = NM.latest ? NM.latest.e[M.ents.indexOf(me)][6] : 0;
      if (me.alive) {
        if (NM.P.forced) { me.x = lerp(me.x, NM.P.x, Math.min(1, dt * 20)); me.y = lerp(me.y, NM.P.y, Math.min(1, dt * 20)); }
        else {
          const spd = me.def.speed * T * (f & 32 ? 0.5 : 1) * (f & 64 ? 1.35 : 1) * (f & 256 ? 0.93 : 1);
          const mx = inp.mx, my = inp.my;
          const P = NM.P; Sim.tryMove(M, P, mx * spd * dt, my * spd * dt); NM.P = { x: P.x, y: P.y, forced: false, r: me.r };
          const h = NM.hist[NM.hist.length - 1];
          if (h && h.seq === NM.seq) h.dur += dt; else NM.hist.push({ seq: NM.seq, mx, my, dur: dt });
          if (Math.hypot(NM.P.x - me.x, NM.P.y - me.y) > 160) { me.x = NM.P.x; me.y = NM.P.y; }
          else { me.x = lerp(me.x, NM.P.x, Math.min(1, dt * 24)); me.y = lerp(me.y, NM.P.y, Math.min(1, dt * 24)); }
        }
        me.moving = Math.hypot(inp.mx, inp.my) > 0.1 && !(f & 12);
        if (me.moving) me.walkT += dt * 12 * (me.def.speed * T / 240);
        me.ang += G.angDiff(me.ang, me.face) * Math.min(1, dt * 16);
      }
    }
    // projectiles : extrapolation locale
    for (let i = M.projs.length - 1; i >= 0; i--) {
      const p = M.projs[i]; p.age += dt;
      if (p.dead) { M.projs.splice(i, 1); continue; }
      if (p.lob) {
        p.lob.t += dt; const kk = Math.min(1, p.lob.t / p.lob.dur);
        p.x = p.lob.sx + (p.lob.tx - p.lob.sx) * kk; p.y = p.lob.sy + (p.lob.ty - p.lob.sy) * kk; p.z = Math.sin(kk * Math.PI) * 110;
        if (p.lob.t > p.lob.dur + 0.4) { p.dead = true; delete NM.projs[p.id]; }
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; p.travelled += p.speed * dt;
        if (p.travelled > p.range || G.isBulletTile(Sim.tileAt(M, p.x, p.y))) { p.dead = true; delete NM.projs[p.id]; }
      }
    }
    for (let i = M.strikes.length - 1; i >= 0; i--) { const s = M.strikes[i]; s.t += dt; if (s.t >= s.delay) M.strikes.splice(i, 1); }
    for (let i = M.zones.length - 1; i >= 0; i--) { M.zones[i].t -= dt; if (M.zones[i].t <= 0) M.zones.splice(i, 1); }
    for (const s of M.safes) if (s.flash > 0) s.flash -= dt;
    // camouflage : un buisson qui bouge
    // envoi des commandes (30 Hz)
    NM.sendT -= dt; NM.lock -= dt;
    if (me && me.alive) {
      const ch = !NM.lastIn || Math.abs(NM.lastIn.mx - me.input.mx) > 0.02 || Math.abs(NM.lastIn.my - me.input.my) > 0.02 || Math.abs(NM.lastIn.face - me.face) > 0.05;
      if ((NM.sendT <= 0 && ch) || NM.sendT <= -0.25) { NM.sendInput(M); NM.sendT = 0.033; }
    }
  };
  NM.sendInput = function (M, extra) {
    const me = M.player; NM.seq++;
    const o = Object.assign({ t: 'input', seq: NM.seq, mx: +me.input.mx.toFixed(3), my: +me.input.my.toFixed(3), face: +me.face.toFixed(2) }, extra || {});
    G.Net.send(o); NM.lastIn = { mx: me.input.mx, my: me.input.my, face: me.face };
  };
  NM.attack = function (M, ang, dist, isSuper) {
    const me = M.player;
    if (!me.alive || M.state !== 'play') return false;
    if (!isSuper && (me.ammo < 1 || NM.lock > 0)) return false;
    if (isSuper && me.superCharge < 1) return false;
    me.face = ang; me.ang = ang;
    NM.sendInput(M, isSuper ? { s: [+ang.toFixed(3), Math.round(dist)] } : { a: [+ang.toFixed(3), Math.round(dist)] });
    if (!isSuper) { me.ammo = Math.max(0, me.ammo - 1); NM.lock = 0.3; }
    me.recoil = 1;
    return true;
  };

  /* ----- fin de match : récompenses calculées par le serveur ----- */
  G.Net.on('end', (m) => { NM.endMsg = m; });
})();
