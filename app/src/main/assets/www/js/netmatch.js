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
    Sim.applyEvent(M, init.event || 'none');
    NM.M = M; NM.hist = []; NM.seq = 0; NM.P = null; NM.P0 = false; NM.latest = null; NM.endMsg = null; NM.lock = 0; NM.sendT = 0; NM.projs = {};
    NM.off = null; NM.dev = 0.02; NM.delay = 0.11; NM.queue = []; NM.A = null; NM.prev = null; NM.tr = 0;
    return M;
  };

  /* ----- réception d'un instantané : horloge serveur, file, réconciliation du joueur local ----- */
  NM.off = null; NM.dev = 0.02; NM.delay = 0.11; NM.queue = []; NM.A = null; NM.B = null; NM.tr = 0; NM.lastRecv = 0;
  NM.onSnap = function (s) {
    const M = NM.M; if (!M) return;
    const now = performance.now(), sample = now - s.tm * 1000;
    // recalage d'horloge : on suit le minimum (chemin le plus rapide) et on mesure la gigue
    if (NM.off === null || sample < NM.off) NM.off = sample; else NM.off += (sample - NM.off) * 0.004;
    NM.dev += (Math.min(0.3, (sample - NM.off) / 1000) - NM.dev) * 0.05;
    NM.delay = G.clamp(0.085 + NM.dev * 1.6, 0.1, 0.26);
    NM.queue.push(s); NM.latest = s; NM.lastRecv = now;
    if (NM.queue.length > 60) NM.queue.splice(0, NM.queue.length - 60);
    // joueur local : serveur + commandes non acquittées (immédiat, sans délai d'interpolation)
    const me = M.player; if (!me) return;
    const idx = M.ents.indexOf(me), a = s.e[idx]; if (!a) return;
    const ack = s.ak ? s.ak[idx] : 0, f = a[6];
    me._srvAlive = !!(f & 1);
    if (!me._srvAlive) return;
    const forced = (f & (4 | 8 | 512 | 4096)) || a[12] > 0 || s.s !== 1;
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
    if (!NM.P0) { NM.P0 = true; me.x = P.x; me.y = P.y; }
  };

  /* application d'un instantané (état discret + évènements) au moment où il devient visible */
  NM.apply = function (M, s) {
    const me = M.player, first = !M.ready;
    M.ready = true;
    const st = STATES[s.s];
    if (st !== M.state) { M.state = st; if (st === 'end') M.endT = 0; }
    M.cd = s.cd; M.left = s.left; M.score = s.sc; M.t = s.tm;
    if (s.gg) { M.gg.active = [!!s.gg[0], !!s.gg[2]]; M.gg.t = [s.gg[1], s.gg[3]]; }
    if (s.z && M.zone) { M.zone.x0 = s.z[0]; M.zone.y0 = s.z[1]; M.zone.x1 = s.z[2]; M.zone.y1 = s.z[3]; }
    if (s.sf) s.sf.forEach((hp, i) => { const sf = M.safes[i]; if (sf) { if (hp < sf.hp) sf.flash = 0.12; sf.hp = hp; } });
    if (s.al !== undefined) M.alive = s.al;
    if (s.cp) s.cp.forEach((st2, i) => { if (M.caps[i]) M.caps[i].state = st2; });
    M.items = s.it.map((it, i) => ({ type: it[0] ? 'cube' : 'gem', x: it[1], y: it[2], bob: i * 1.7, age: 0, z: 0 }));
    if (s.b && M.ball) { M.ball.x = s.b[0]; M.ball.y = s.b[1]; M.ball.owner = s.b[2] >= 0 ? M.ents[s.b[2]] : null; M.ball.spin += 0.05; }
    s.e.forEach((a, i) => {
      const b = M.ents[i]; if (!b) return;
      const f = a[6], wasAlive = b.alive, wasHp = b.hp;
      b.hp = a[4]; b.maxhp = a[5]; b.alive = !!(f & 1);
      if (b.alive && wasAlive && b.hp < wasHp - 1) b.flash = 0.12;
      if (wasAlive && !b.alive) { b.deathT = 0; b.deathAng = a[3]; }
      if (!wasAlive && b.alive) { b.deathT = -1; b.spawnT = 0; }
      b.hidden = !!(f & 2); b.stun = f & 4 ? 1 : 0; b.freeze = f & 8 ? 1 : 0; b.poison = f & 16 ? 1 : 0; b.slowT = f & 32 ? 1 : 0; b.slowF = f & 32 ? 0.5 : 1;
      b.boostT = f & 64 ? 1 : 0; b.invuln = f & 128 ? 1 : 0; b.hasBall = !!(f & 256); b.dash = f & 512 ? { ax: Math.cos(a[15]), ay: Math.sin(a[15]) } : null;
      b.moving = !!(f & 1024); b.revealT = f & 2048 ? 1 : 0; b.rollCd = (a[16] || 0) / 10; b.gadgets = a[17] === undefined ? 3 : a[17]; b.gadgetCd = (a[18] || 0) / 10;
      b.ammo = a[7] / 10; b.superCharge = a[8] / 100; b.gems = a[9]; b.cubes = a[10]; b.bounty = a[11]; b.z = a[12]; b.respawn = a[13]; b.kills = a[14];
      if (first || (b.alive && !wasAlive)) { b.x = a[0]; b.y = a[1]; if (b === me) { NM.P = { x: a[0], y: a[1], r: 21, forced: true }; } }
    });
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
        if (me && e[6] === M.ents.indexOf(me) && tgt !== me) { M.hitmarks.push({ x: tgt.x, y: tgt.y - 12, t: 0, big: e[3] >= 1200 }); G.Audio.sfx('hitm'); }
        break;
      }
      case 's': if (e[2] < 0 || !me || G.dist(me.x, me.y, e[2], e[3]) < 1100) G.Audio.sfx(e[1], e[4]); break;
      case 'sr': if (me && M.ents[e[1]] === me) G.Audio.sfx('superReady'); break;
      case 'kf': { M.feed.push({ k: e[1], v: e[2], t: 0 }); if (M.feed.length > 5) M.feed.shift(); const v = M.ents[e[2]]; if (me && M.ents[e[1]] === me && v) { Sim.text(M, v.x, v.y - 78, 'K.O. !', '#ff4a55', 40); Sim.ring(M, v.x, v.y, 10, 120, 0.45, 'rgba(255,90,90,0.9)'); Sim.burst(M, v.x, v.y - 10, '#ffd21f', 16, 320, 6, 0.7, 'spark'); M.cam.kick = 1; G.Audio.sfx('ko'); G.vibrate(60); } break; }
      case 'em': { const b = M.ents[e[1]]; if (b && G.EMOTES[e[2]]) { b.emote = G.EMOTES[e[2]]; b.emoteT = 2; } break; }
      case 'rl': { const r = M.ents[e[1]]; if (r && r !== me) r.rollT = 0; break; }
      case 'p': {
        const owner = M.ents[e[13]], def = G.BRAWLER[e[2]], spec = e[3] ? def.sup : def.atk;
        const p = { id: e[1], x: e[4], y: e[5], vx: e[6], vy: e[7], ang: e[8], speed: Math.hypot(e[6], e[7]), range: (spec.range || 8) * T + 40, travelled: 0, r: spec.r || 6, shape: spec.shape || 'pellet', color: spec.color || '#fff',
          lob: e[9] ? { sx: e[9][0], sy: e[9][1], tx: e[9][2], ty: e[9][3], dur: e[9][4], t: 0 } : null, z: 0, big: !!e[10], splash: e[12], age: 0, team: e[11], spec };
        M.projs.push(p); NM.projs[p.id] = p;
        if (owner) { owner.recoil = 1; if (owner !== me) owner.face = e[8]; }
        if (owner === me) { for (const g of M.projs) if (g.ghost) g.dead = true; }
        else if (me && (!owner || G.dist(me.x, me.y, e[4], e[5]) < 1100) && spec.sfx && !e[3]) G.Audio.sfx(spec.sfx);
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
    if (NM.off === null) return;
    Sim.updateFx(M, dt);
    const me = M.player;
    // horloge de rendu = horloge serveur estimée - délai d'interpolation adaptatif
    if (NM.off !== null) NM.tr = (performance.now() - NM.off) / 1000 - NM.delay;
    // faire avancer A/B : on applique chaque instantané quand il devient « passé »
    const q = NM.queue;
    while (q.length && q[0].tm <= NM.tr) { const s = q.shift(); NM.prev = NM.A; NM.A = s; NM.apply(M, s); }
    const A = NM.A, B = q[0] || null;
    let k = 0;
    if (A && B) k = B.tm - A.tm < 0.004 ? 1 : G.clamp((NM.tr - A.tm) / (B.tm - A.tm), 0, 1);
    const ex = A && !B ? G.clamp(NM.tr - A.tm, 0, 0.12) : 0; // sous-alimentation : extrapolation brève
    M.ents.forEach((e, i) => {
      if (!e) return;
      e.popT -= dt; e.flash = Math.max(0, e.flash - dt); e.recoil = Math.max(0, e.recoil - dt * 6);
      if (e.deathT >= 0) e.deathT += dt;
      if (e.rollT >= 0) { e.rollT += dt; if (e.rollT > 0.4) e.rollT = -1; }
      if (e.emoteT > 0) e.emoteT -= dt; if (e.emoteCd > 0) e.emoteCd -= dt;
      if (e.moving && e.alive && Math.random() < dt * 7) Sim.burst(M, e.x, e.y + 14, '#d8d0b8', 1, 30, 5, 0.45, 'smoke');
      if (e.spawnT !== undefined) e.spawnT += dt;
      if (e === me || !A) return;
      const a = A.e[i], b = (B || A).e[i]; if (!a) return;
      let nx, ny;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      if (Math.hypot(dx, dy) > 260 || (a[6] & 1) !== (b[6] & 1)) { nx = a[0]; ny = a[1]; } // téléportation (réapparition) : pas d'interpolation
      else if (B) { nx = a[0] + dx * k; ny = a[1] + dy * k; }
      else { // extrapolation brève et bornée (jamais plus vite qu'un brawler qui court)
        const pv = NM.prev && NM.prev.e[i], dtp = NM.prev ? A.tm - NM.prev.tm : 0;
        let vx = 0, vy = 0;
        if (pv && dtp > 0.015) { vx = (a[0] - pv[0]) / dtp; vy = (a[1] - pv[1]) / dtp; const sp = Math.hypot(vx, vy); if (sp > 600) { vx *= 600 / sp; vy *= 600 / sp; } }
        nx = a[0] + vx * ex; ny = a[1] + vy * ex;
      }
      e.vx = (nx - e.x) / Math.max(dt, 0.001); e.vy = (ny - e.y) / Math.max(dt, 0.001);
      e.x = nx; e.y = ny; e.z = a[12] + (b[12] - a[12]) * k;
      e.ang = angLerp(a[2], b[2], k); e.face = angLerp(a[3], b[3], k);
      if (e.moving) e.walkT += dt * 12 * (e.def.speed * T / 240);
    });
    // joueur local : position prédite
    if (me && NM.P) {
      const inp = me.input;
      const f = NM.latest ? NM.latest.e[M.ents.indexOf(me)][6] : 0;
      if (me.alive && !(me.freeze > 0 && 0)) {
        if (NM.P.forced) { me.x = lerp(me.x, NM.P.x, Math.min(1, dt * 20)); me.y = lerp(me.y, NM.P.y, Math.min(1, dt * 20)); }
        else {
          const spd = me.def.speed * T * (f & 32 ? 0.5 : 1) * (f & 64 ? 1.35 : 1) * (f & 256 ? 0.93 : 1);
          const mx = inp.mx, my = inp.my;
          const P = NM.P; Sim.tryMove(M, P, mx * spd * dt, my * spd * dt); NM.P = { x: P.x, y: P.y, forced: false, r: me.r };
          const h = NM.hist[NM.hist.length - 1];
          if (h && h.seq === NM.seq) h.dur += dt; else NM.hist.push({ seq: NM.seq, mx, my, dur: dt });
          const ex2 = NM.P.x - me.x, ey2 = NM.P.y - me.y, ed = Math.hypot(ex2, ey2);
          if (ed > 140) { me.x = NM.P.x; me.y = NM.P.y; }
          else if (ed > 0.01) { const step = Math.min(ed, Math.max(2.5, ed * Math.min(1, dt * 16))); me.x += ex2 / ed * step; me.y += ey2 / ed * step; }
        }
        me.moving = Math.hypot(inp.mx, inp.my) > 0.1 && !(f & 12);
        if (me.moving) me.walkT += dt * 12 * (me.def.speed * T / 240);
        me.ang += G.angDiff(me.ang, me.face) * Math.min(1, dt * 16);
      }
    }
    // projectiles : extrapolation locale
    for (let i = M.projs.length - 1; i >= 0; i--) {
      const p = M.projs[i]; p.age += dt;
      if (p.ghost && p.age > 0.9) p.dead = true;
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
  NM.dodge = function (M, ang) {
    const me = M.player;
    if (!me.alive || M.state !== 'play' || (me.rollCd || 0) > 0 || me.rollT >= 0) { G.Audio.sfx('error'); return false; }
    me.rollT = 0; me.rollCd = G.Sim.DODGE.cd; me.face = ang; G.Audio.sfx('dash', 1.5);
    NM.sendInput(M, { d: +ang.toFixed(3) });
    return true;
  };
  NM.gadget = function (M) {
    const me = M.player;
    if (!me.alive || M.state !== 'play' || !(me.gadgets > 0) || (me.gadgetCd || 0) > 0) { G.Audio.sfx('error'); return false; }
    me.gadgetCd = G.Sim.GADGET_CD; NM.sendInput(M, { gd: 1 }); return true;
  };
  NM.emote = function (M, i) {
    const me = M.player; if ((me.emoteCd || 0) > 0) return false;
    me.emoteCd = 2.5; NM.sendInput(M, { em: i | 0 }); return true;
  };
  NM.attack = function (M, ang, dist, isSuper) {
    const me = M.player;
    if (!me.alive || M.state !== 'play') return false;
    if (!isSuper && (me.ammo < 1 || NM.lock > 0)) return false;
    if (isSuper && me.superCharge < 1) return false;
    me.face = ang; me.ang = ang;
    const spec = isSuper ? me.def.sup : me.def.atk;
    if (!isSuper || spec.type === 'proj' || spec.type === 'lobArea') { // tir fantôme immédiat (remplacé par le tir réel du serveur à son arrivée)
      const n = spec.n || 1;
      for (let j = 0; j < n; j++) {
        const a = ang + (n > 1 ? ((j / (n - 1) - 0.5) * (spec.spread || 0) * Math.PI) / 180 : 0), sp = (spec.speed || 18) * T;
        const g = { id: -1, ghost: true, x: me.x + Math.cos(a) * (me.r + 4), y: me.y + Math.sin(a) * (me.r + 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ang: a, speed: sp, range: (spec.range || 8) * T + 40, travelled: 0, r: spec.r || 6, shape: spec.shape || 'pellet', color: spec.color || '#fff', lob: null, z: 0, big: !!spec.big, splash: 0, age: 0, team: me.team, spec };
        if (spec.lob || spec.type === 'lobArea') { const d = G.clamp(dist, 1.5 * T, spec.range * T); g.lob = { sx: me.x, sy: me.y, tx: me.x + Math.cos(a) * d, ty: me.y + Math.sin(a) * d, dur: Math.max(0.3, d / sp), t: 0 }; }
        M.projs.push(g);
      }
    }
    if (spec.sfx || isSuper) G.Audio.sfx(isSuper ? 'super' : spec.sfx);
    NM.sendInput(M, isSuper ? { s: [+ang.toFixed(3), Math.round(dist)], rtt: G.Net.ping } : { a: [+ang.toFixed(3), Math.round(dist)], rtt: G.Net.ping });
    if (!isSuper) { me.ammo = Math.max(0, me.ammo - 1); NM.lock = 0.3; }
    M.cam.kick = Math.max(M.cam.kick || 0, 0.25);
    me.recoil = 1;
    return true;
  };

  /* ----- fin de match : récompenses calculées par le serveur ----- */
  G.Net.on('end', (m) => { NM.endMsg = m; });
})();
