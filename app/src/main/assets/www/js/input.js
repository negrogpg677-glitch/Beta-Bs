/* Brawl Rush - contrôles tactiles (joystick flottant + visée par glissement) et clavier/souris */
(function () {
  const G = window.G;
  const T = G.T;
  const In = (G.Input = {
    joy: { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0, mx: 0, my: 0 },
    atk: { active: false, id: -1, dx: 0, dy: 0, len: 0, drag: false },
    sup: { active: false, id: -1, dx: 0, dy: 0, len: 0, drag: false },
    keys: {}, mouse: { x: 0, y: 0, down: false, sdown: false }, W: 1, H: 1, enabled: false, pending: [],
  });

  In.attach = function (canvas) {
    canvas.style.touchAction = 'none';
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!In.enabled) return;
      G.Audio.unlock();
      const [x, y] = pos(e);
      if (e.pointerType === 'mouse') {
        if (e.button === 2 || e.button === 1) { In.mouse.sdown = true; In.mouse.x = x; In.mouse.y = y; return; }
        In.mouse.down = true; In.mouse.x = x; In.mouse.y = y; return;
      }
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      const L = G.Render.layout(In.W, In.H);
      const da = Math.hypot(x - L.atkX, y - L.atkY), ds = Math.hypot(x - L.supX, y - L.supY);
      if (Math.hypot(x - L.dgX, y - L.dgY) < L.dgR * 1.45) { In.pending.push({ kind: 'dodge' }); In.dodgeFx = 0.15; return; }
      if (!In.sup.active && ds < L.supR * 1.5) { Object.assign(In.sup, { active: true, id: e.pointerId, dx: 0, dy: 0, len: 0, drag: false, sx: L.supX, sy: L.supY }); return; }
      if (!In.atk.active && da < L.atkR * 1.5) { Object.assign(In.atk, { active: true, id: e.pointerId, dx: 0, dy: 0, len: 0, drag: false, sx: L.atkX, sy: L.atkY }); return; }
      const lefty = G.Save.data.settings.lefty;
      const onMoveSide = lefty ? x > In.W * 0.5 : x < In.W * 0.5;
      if (!In.joy.active && onMoveSide) {
        Object.assign(In.joy, { active: true, id: e.pointerId, bx: x, by: y, x, y, mx: 0, my: 0 });
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!In.enabled) return;
      const [x, y] = pos(e);
      if (e.pointerType === 'mouse') { In.mouse.x = x; In.mouse.y = y; return; }
      const L = G.Render.layout(In.W, In.H);
      if (In.joy.active && e.pointerId === In.joy.id) {
        let dx = x - In.joy.bx, dy = y - In.joy.by; const l = Math.hypot(dx, dy), max = L.joyR;
        if (l > max) { // le joystick suit le doigt
          In.joy.bx += (dx / l) * (l - max); In.joy.by += (dy / l) * (l - max); dx = x - In.joy.bx; dy = y - In.joy.by;
        }
        In.joy.x = In.joy.bx + dx; In.joy.y = In.joy.by + dy;
        const ll = Math.hypot(dx, dy) / max;
        In.joy.mx = ll > 0.12 ? (dx / max) / Math.max(1, ll) : 0; In.joy.my = ll > 0.12 ? (dy / max) / Math.max(1, ll) : 0;
        if (ll > 0.12) { const k = Math.min(1, (ll - 0.12) / 0.5); In.joy.mx *= k > 0 ? 1 : 0; }
      }
      for (const b of [In.atk, In.sup]) {
        if (b.active && e.pointerId === b.id) {
          b.dx = x - b.sx; b.dy = y - b.sy; b.len = Math.hypot(b.dx, b.dy);
          if (b.len > L.atkR * 0.5) b.drag = true;
        }
      }
    });
    const up = (e) => {
      const [x, y] = pos(e);
      if (e.pointerType === 'mouse') {
        if (e.button === 2 || e.button === 1) { if (In.mouse.sdown) { In.mouse.sdown = false; In.pending.push({ kind: 'sup', mouse: true }); } return; }
        if (In.mouse.down) { In.mouse.down = false; In.pending.push({ kind: 'atk', mouse: true }); } return;
      }
      if (In.joy.active && e.pointerId === In.joy.id) { In.joy.active = false; In.joy.mx = In.joy.my = 0; }
      for (const [name, b] of [['atk', In.atk], ['sup', In.sup]]) {
        if (b.active && e.pointerId === b.id) {
          b.active = false;
          In.pending.push({ kind: name, drag: b.drag, dx: b.dx, dy: b.dy, len: b.len });
        }
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', (e) => {
      if (In.joy.active && e.pointerId === In.joy.id) { In.joy.active = false; In.joy.mx = In.joy.my = 0; }
      for (const b of [In.atk, In.sup]) if (b.active && e.pointerId === b.id) b.active = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      In.keys[e.code] = true;
      if (!In.enabled) return;
      if (e.code === 'Space') In.pending.push({ kind: 'atk', key: true });
      if (e.code === 'ShiftLeft' || e.code === 'KeyE' || e.code === 'KeyQ') In.pending.push({ kind: 'sup', key: true });
      if (e.code === 'KeyF' || e.code === 'ControlLeft') In.pending.push({ kind: 'dodge' });
      if (e.code === 'Escape' || e.code === 'KeyP') G.App.togglePause();
    });
    window.addEventListener('keyup', (e) => { In.keys[e.code] = false; });
  };

  In.reset = function () {
    In.joy.active = In.atk.active = In.sup.active = false; In.joy.mx = In.joy.my = 0; In.pending.length = 0; In.mouse.down = In.mouse.sdown = false;
  };

  // visée courante du joueur pour le bouton b (écran -> monde)
  function aimFor(M, p, b, isSuper, mouse) {
    const spec = isSuper ? p.def.sup : p.def.atk;
    const range = (spec.range || (spec.dist) || 7) * T;
    let ang, dist, hasDrag = false;
    if (mouse) {
      const cam = G.Render.lastCam;
      const wx = cam.cx + (In.mouse.x - In.W / 2) / cam.sc, wy = cam.cy + (In.mouse.y - In.H / 2) / cam.sc;
      ang = Math.atan2(wy - p.y, wx - p.x); dist = Math.hypot(wx - p.x, wy - p.y); hasDrag = true;
    } else if (b && b.drag) {
      ang = Math.atan2(b.dy, b.dx); const L = G.Render.layout(In.W, In.H);
      dist = G.clamp(b.len / (L.atkR * 2.4), 0.12, 1) * range; hasDrag = true;
      if (G.Save.data.settings.aimAssist && !(spec.type === 'lobArea' || spec.type === 'barrage' || spec.lob)) {
        let best = null, bd = 0.14;
        for (const e of M.ents) {
          if (!e.alive || e.team === p.team || !G.Sim.canSee(M, p, e)) continue;
          const d = G.dist(p.x, p.y, e.x, e.y); if (d > range * 1.05) continue;
          const da = Math.abs(G.angDiff(ang, Math.atan2(e.y - p.y, e.x - p.x))) * (1 + d / 900);
          if (da < bd) { bd = da; best = e; }
        }
        if (best) { ang = Math.atan2(best.y - p.y, best.x - p.x); dist = Math.min(range, G.dist(p.x, p.y, best.x, best.y)); }
      }
    }
    if (!hasDrag) {
      const t = G.Sim.autoTarget(M, p, range * 1.05);
      if (t) {
        const d = G.dist(p.x, p.y, t.x, t.y);
        const tl = Math.min(0.5, d / ((spec.speed || 18) * T)) * 0.8;
        ang = Math.atan2(t.y + (t.vy || 0) * tl - p.y, t.x + (t.vx || 0) * tl - p.x); dist = d;
      } else { ang = p.face; dist = range * 0.8; }
    }
    return { ang, dist: Math.min(dist, range) };
  }
  In.aimFor = aimFor;

  In.update = function (M, dt) {
    const p = M.player;
    if (!p) return;
    let mx = In.joy.mx, my = In.joy.my;
    const k = In.keys;
    const kx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft || k.KeyQ && false ? 1 : 0), ky = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp || k.KeyZ ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); mx = kx / l; my = ky / l; }
    p.input.mx = mx; p.input.my = my;
    if (p.alive) {
      // direction du visage = visée si on tient un bouton, sinon mouvement
      if (In.atk.active || In.sup.active) {
        const b = In.atk.active ? In.atk : In.sup;
        if (b.drag) p.face = Math.atan2(b.dy, b.dx);
      } else if (In.mouse.down || In.mouse.sdown) { p.face = aimFor(M, p, null, false, true).ang; }
      else if (mx || my) p.face = Math.atan2(my, mx);
    }
    for (const ev of In.pending.splice(0)) {
      if (!p.alive || M.state !== 'play') continue;
      if (ev.kind === 'dodge') {
        const ang = (mx || my) ? Math.atan2(my, mx) : p.face;
        if (M.net) G.NetMatch.dodge(M, ang); else if (!G.Sim.tryDodge(M, p, ang)) G.Audio.sfx('error');
        continue;
      }
      const isSuper = ev.kind === 'sup';
      const a = ev.mouse ? aimFor(M, p, null, isSuper, true) : aimFor(M, p, ev, isSuper, false);
      if (M.net) { if (!G.NetMatch.attack(M, a.ang, a.dist, isSuper) && !isSuper && p.ammo < 1) G.Audio.sfx('error'); }
      else if (isSuper) G.Sim.trySuper(M, p, a.ang, a.dist); else if (!G.Sim.tryAttack(M, p, a.ang, a.dist) && p.ammo < 1) G.Audio.sfx('error');
    }
  };

  // renvoie les infos de visée à dessiner (ou null)
  In.aimPreview = function (M) {
    const p = M.player;
    if (!p || !p.alive) return null;
    if (In.sup.active) return Object.assign({ sup: true }, aimFor(M, p, In.sup, true, false));
    if (In.atk.active && In.atk.drag) return Object.assign({ sup: false }, aimFor(M, p, In.atk, false, false));
    if (In.mouse.down) return Object.assign({ sup: false }, aimFor(M, p, null, false, true));
    if (In.mouse.sdown) return Object.assign({ sup: true }, aimFor(M, p, null, true, true));
    return null;
  };
})();
