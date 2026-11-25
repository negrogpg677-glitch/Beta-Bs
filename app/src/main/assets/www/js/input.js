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
      { const L = G.Render.layout(In.W, In.H); // roue d'émotes, bouton d'émote, gadget
        if (In.emoteOpen) { In.emoteOpen = false; const s = G.Render.emoteSlots(In.W, In.H).findIndex((q) => Math.hypot(x - q.x, y - q.y) < q.r * 1.25); if (s >= 0) In.pending.push({ kind: 'emote', i: s }); return; }
        if (Math.hypot(x - L.emX, y - L.emY) < L.emR * 1.3) { In.emoteOpen = true; return; }
        if (Math.hypot(x - L.gdX, y - L.gdY) < L.gdR * 1.35) { In.pending.push({ kind: 'gadget' }); In.gadgetFx = 0.15; return; }
      }
      if (e.pointerType === 'mouse') {
        if (e.button === 2 || e.button === 1) { In.mouse.sdown = true; In.mouse.x = x; In.mouse.y = y; return; }
        In.mouse.down = true; In.mouse.x = x; In.mouse.y = y; return;
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* pointeur déjà relâché */ }
      const L = G.Render.layout(In.W, In.H);
      const da = Math.hypot(x - L.atkX, y - L.atkY), ds = Math.hypot(x - L.supX, y - L.supY);
      if (Math.hypot(x - L.dgX, y - L.dgY) < L.dgR * 1.45) { In.pending.push({ kind: 'dodge' }); In.dodgeFx = 0.15; return; }
      // le bouton le plus proche gagne quand les zones de toucher se chevauchent
      const hitS = !In.sup.active && ds < L.supR * 1.6, hitA = !In.atk.active && da < L.atkR * 1.55;
      if (hitS && (!hitA || ds / L.supR < da / L.atkR)) { stickStart(In.sup, e.pointerId, L.supX, L.supY); return; }
      if (hitA) { stickStart(In.atk, e.pointerId, L.atkX, L.atkY); return; }
      const lefty = G.Save.data.settings.lefty;
      const onMoveSide = lefty ? x > In.W * 0.45 : x < In.W * 0.55;
      if (!In.joy.active && onMoveSide) { // joystick flottant : il apparaît sous le doigt (gardé entièrement à l'écran)
        const m = L.joyR + 8, bx = G.clamp(x, m, In.W - m), by = G.clamp(y, m, In.H - m);
        Object.assign(In.joy, { active: true, id: e.pointerId, bx, by, x, y, mx: 0, my: 0, t0: performance.now() });
        joyMove(In.joy, x, y, L.joyR);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!In.enabled) return;
      const [x, y] = pos(e);
      if (e.pointerType === 'mouse') { In.mouse.x = x; In.mouse.y = y; return; }
      const L = G.Render.layout(In.W, In.H);
      if (In.joy.active && e.pointerId === In.joy.id) joyMove(In.joy, x, y, L.joyR);
      for (const b of [In.atk, In.sup]) {
        if (b.active && e.pointerId === b.id) {
          b.dx = x - b.sx; b.dy = y - b.sy; b.len = Math.hypot(b.dx, b.dy);
          if (!b.drag && b.len > L.atkR * 0.35) { b.drag = true; G.vibrate(8); }
          const was = b.cancel; b.cancel = b.drag && b.len < L.atkR * 0.27; // retour au centre = annuler
          if (b.cancel && !was) G.vibrate(15);
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
          if (b.cancel) { b.cancel = false; G.Audio.sfx('back'); continue; } // tir annulé
          In.pending.push({ kind: name, drag: b.drag, dx: b.dx, dy: b.dy, len: b.len });
        }
      }
    };
    canvas.addEventListener('pointerup', up);
    // doigt perdu (bord de l'écran, notification, appel…) : on relâche sans tirer, plus de joystick bloqué
    const drop = (e) => {
      if (In.joy.active && e.pointerId === In.joy.id) { In.joy.active = false; In.joy.mx = In.joy.my = 0; }
      for (const b of [In.atk, In.sup]) if (b.active && e.pointerId === b.id) { b.active = false; b.cancel = false; }
    };
    canvas.addEventListener('pointercancel', drop);
    canvas.addEventListener('lostpointercapture', (e) => { if (e.pointerType !== 'mouse') drop(e); });
    window.addEventListener('blur', () => In.release());
    document.addEventListener('visibilitychange', () => { if (document.hidden) In.release(); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      In.keys[e.code] = true;
      if (!In.enabled) return;
      if (e.code === 'Space') In.pending.push({ kind: 'atk', key: true });
      if (e.code === 'ShiftLeft' || e.code === 'KeyE' || e.code === 'KeyQ') In.pending.push({ kind: 'sup', key: true });
      if (e.code === 'KeyF' || e.code === 'ControlLeft') In.pending.push({ kind: 'dodge' });
      if (e.code === 'KeyG') In.pending.push({ kind: 'gadget' });
      if (e.code === 'KeyT') In.emoteOpen = !In.emoteOpen;
      if (In.emoteOpen && /^Digit[1-8]$/.test(e.code)) { In.pending.push({ kind: 'emote', i: +e.code.slice(5) - 1 }); In.emoteOpen = false; }
      if (e.code === 'Escape' || e.code === 'KeyP') G.App.togglePause();
    });
    window.addEventListener('keyup', (e) => { In.keys[e.code] = false; });
  };

  // joystick « façon arcade » : zone morte minuscule, pleine vitesse très vite, la base suit le doigt s'il va trop loin
  const DZ = 0.1, FULL = 0.32;
  function joyMove(j, x, y, R) {
    let dx = x - j.bx, dy = y - j.by, l = Math.hypot(dx, dy);
    if (l > R) { const k = (l - R) / l; j.bx += dx * k; j.by += dy * k; dx = x - j.bx; dy = y - j.by; l = R; }
    j.x = x; j.y = y;
    const f = l / R;
    if (f < DZ) { j.mx = j.my = 0; return; }
    const m = Math.min(1, (f - DZ) / (FULL - DZ)), sp = m * (2 - m);
    j.mx = (dx / l) * sp; j.my = (dy / l) * sp;
  }
  function stickStart(b, id, sx, sy) { Object.assign(b, { active: true, id, dx: 0, dy: 0, len: 0, drag: false, cancel: false, sx, sy, t0: performance.now() }); }
  In.release = function () { In.joy.active = In.atk.active = In.sup.active = false; In.atk.cancel = In.sup.cancel = false; In.joy.mx = In.joy.my = 0; In.mouse.down = In.mouse.sdown = false; In.keys = {}; };
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
      dist = G.clamp(b.len / (L.atkR * 1.5), 0.1, 1) * range; hasDrag = true;
      if (G.Save.data.settings.aimAssist && !(spec.type === 'lobArea' || spec.type === 'barrage' || spec.lob)) {
        let best = null, bd = 0.11;
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
      if (ev.kind === 'gadget') { if (M.net) G.NetMatch.gadget(M); else if (!G.Sim.tryGadget(M, p)) G.Audio.sfx('error'); continue; }
      if (ev.kind === 'emote') { if (M.net) G.NetMatch.emote(M, ev.i); else G.Sim.emote(M, p, ev.i); continue; }
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
    if ((In.atk.cancel && In.atk.active) || (In.sup.cancel && In.sup.active)) return null;
    if (In.sup.active && In.sup.drag) return Object.assign({ sup: true }, aimFor(M, p, In.sup, true, false));
    if (In.atk.active && In.atk.drag) return Object.assign({ sup: false }, aimFor(M, p, In.atk, false, false));
    if (In.mouse.down) return Object.assign({ sup: false }, aimFor(M, p, null, false, true));
    if (In.mouse.sdown) return Object.assign({ sup: true }, aimFor(M, p, null, true, true));
    return null;
  };
})();
