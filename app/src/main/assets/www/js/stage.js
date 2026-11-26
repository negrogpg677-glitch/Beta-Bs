/* Brawl Rush - PRISM : scène de présentation des personnages (salon, fiche brawler, résultats)
   Chaque personnage est présenté dans un décor 3D à son image (forge volcanique, grille holographique, île de cristal,
   hangar mécanique ; socle prismatique teinté pour les autres), avec éclairage d'ambiance, particules, caméra de mise en
   scène (lent travelling, rapprochement au toucher, arrivée en « survol » quand on change de personnage) et transition
   (onde, éclair, apparition). S'active pour les portraits demandés avec opts.stage. Purement visuel. */
(function () {
  const G = window.G, C3 = G.Char3D, THREE = window.THREE, PR = G.PRISM;
  if (!THREE || !C3 || !C3._h || !PR) return;
  const H = C3._h, TAU = Math.PI * 2, scene = H.scene;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k;
  const out3 = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3), pulse = (x, a, b) => (x < a || x > b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI));
  const { std, energy, sprite, GE, P, J, col } = PR, T = PR.tex;

  /* ---------- textures du décor ---------- */
  const tHex = (c0) => T.make('hex' + c0, (c, n) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, n, n); c.strokeStyle = c0; c.lineWidth = 2; c.shadowColor = c0; c.shadowBlur = 6;
    const r = n / 8, h = r * Math.sqrt(3);
    for (let y = -1; y < 6; y++) for (let x = -1; x < 6; x++) { const cx = x * r * 1.5, cy = y * h + (x % 2 ? h / 2 : 0); c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); } c.closePath(); c.globalAlpha = 0.35 + ((x * 7 + y * 3) % 5) * 0.12; c.stroke(); }
    c.globalAlpha = 1;
  });
  const tFade = T.make('vfade', (c, n) => { const g = c.createLinearGradient(0, 0, 0, n); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 0, n, n); }, false, 64);
  const tShadow = T.make('cshadow', (c, n) => { const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.5, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, n, n); }, false, 128);
  const tAurora = T.make('aurora', (c, n) => {
    for (let i = 0; i < 5; i++) { const g = c.createLinearGradient(0, 0, 0, n); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35 + i * 0.05, ['rgba(120,255,220,0.5)', 'rgba(190,120,255,0.5)', 'rgba(255,120,230,0.45)', 'rgba(120,200,255,0.5)', 'rgba(255,230,140,0.35)'][i]); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect((i / 5) * n, 0, n / 4, n); }
  });
  const tGrid = T.make('holo', (c, n) => { c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, n, n); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1; for (let i = 0; i <= n; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, n); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(n, i); c.stroke(); } c.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 14; k++) c.fillRect(8 + (k * 37) % (n - 40), 10 + (k * 53) % (n - 20), 20 + (k * 13) % 40, 4); c.strokeRect(2, 2, n - 4, n - 4); });
  const tRock = (c0) => T.make('rock' + c0, (c, n, r) => { c.fillStyle = c0; c.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { c.fillStyle = r() > 0.5 ? 'rgba(255,255,255,' + (r() * 0.08) + ')' : 'rgba(0,0,0,' + (r() * 0.25) + ')'; const s = 2 + r() * 10; c.fillRect(r() * n, r() * n, s, s * 0.6); } });

  /* ---------- décors ---------- */
  const glowMat = (c, op, map) => { const m = energy(c, op, true); if (map) m.map = map; m.side = THREE.DoubleSide; return m; };
  function common(g, c, o) {
    o = o || {};
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tShadow, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = (o.top || 0.02) + 0.005; sh.scale.set(1.6, 1.6, 1); g.add(sh);
    const halo = sprite(g, c, 4.2, [0, 1.3, -1.6], 0.22);
    const parts = []; const n = o.parts || 22; for (let i = 0; i < n; i++) parts.push(sprite(g, i % 3 ? c : '#ffffff', 0.08, [0, 0, 0], 0.9));
    const ring = P(g, GE.torT, glowMat(c, 0.9), [1, 1, 1], [0, (o.top || 0.02) + 0.01, 0], [Math.PI / 2, 0, 0]); ring.visible = false; // onde de transition
    const flash = sprite(g, '#ffffff', 0.1, [0, 1.1, 0], 0);
    return { sh, halo, parts, ring, flash, top: o.top || 0.02, pr: o.pr || 1.1, rise: o.rise || 2.4 };
  }
  const THEMES = {
    prism(c) { // socle prismatique (tous les autres personnages, teinté à leurs couleurs)
      const g = new THREE.Group();
      P(g, new THREE.CylinderGeometry(1.0, 1.08, 0.2, 6), std({ c: '#1a1730', m: 0.9, r: 0.28 }), null, [0, -0.1, 0], null, 1.02);
      P(g, new THREE.CylinderGeometry(0.9, 0.9, 0.02, 6), glowMat(c, 0.55, tHex(c)), null, [0, 0.005, 0]);
      P(g, new THREE.TorusGeometry(1.0, 0.025, 6, 6), energy(c), null, [0, 0.0, 0], [Math.PI / 2, 0, Math.PI / 6]);
      P(g, new THREE.CylinderGeometry(0.95, 0.95, 2.8, 6, 1, true), glowMat(c, 0.12, tFade), null, [0, 1.4, 0]);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; const sh = P(g, GE.oct, std({ c, m: 0.1, r: 0.05, e: c, ei: 0.6, flat: true, op: 0.9 }), [0.07, 0.16, 0.07], [Math.cos(a) * 1.35, 1.2, Math.sin(a) * 0.9 - 0.4]); sh.userData.float = i; }
      return { g, c: common(g, c, { top: 0.02 }), key: 0xfff1e6, rim: new THREE.Color(c).getHex(), under: c, ui: 0.6 };
    },
    ignis(c) { // forge volcanique
      const g = new THREE.Group(), rock = std({ c: '#2a2224', r: 0.95, map: tRock('#2a2224'), emap: T.lava(), e: '#ff6a1a', ei: 1.2, flat: true });
      P(g, new THREE.CylinderGeometry(1.0, 1.15, 0.3, 9), rock, null, [0, -0.15, 0], null, 1.02);
      P(g, new THREE.TorusGeometry(1.08, 0.06, 6, 24), energy('#ff7a1a'), null, [0, -0.02, 0], [Math.PI / 2, 0, 0]);
      const iron = std({ c: '#3a3436', m: 0.85, r: 0.4, map: T.metal('#3a3436') });
      const anv = J(g, [-1.3, 0, -0.9], [0, 0.6, 0]); P(anv, GE.box, iron, [0.3, 0.3, 0.22], [0, 0.15, 0], null, true); P(anv, GE.box, iron, [0.55, 0.14, 0.26], [0, 0.37, 0], null, true); P(anv, GE.cone, iron, [0.1, 0.25, 0.1], [0.38, 0.37, 0], [0, 0, -Math.PI / 2], true);
      const bra = J(g, [1.35, 0, -1.0]); P(bra, GE.cyl, iron, [0.06, 0.5, 0.06], [0, 0.25, 0], null, true); P(bra, new THREE.CylinderGeometry(0.22, 0.12, 0.16, 12), iron, null, [0, 0.55, 0], null, 1.04);
      const fl = []; for (let i = 0; i < 3; i++) { const f = P(bra, GE.cone, energy(i ? '#ff7a1a' : '#ffe48a', 0.9, true), [0.1 - i * 0.02, 0.35, 0.1 - i * 0.02], [(i - 1) * 0.07, 0.8, 0]); fl.push(f); }
      sprite(bra, '#ff8a2a', 0.9, [0, 0.8, 0], 0.6);
      return { g, c: common(g, '#ff7a1a', { top: 0.0 }), key: 0xffd2a8, rim: 0xff6a2a, under: '#ff5a10', fl, ui: 1 };
    },
    nyx(c) { // grille holographique
      const g = new THREE.Group();
      P(g, new THREE.CylinderGeometry(1.0, 1.05, 0.14, 6), std({ c: '#0b1220', m: 0.4, r: 0.08, phys: true, cc: 1 }), null, [0, -0.07, 0], null, 1.02);
      const grid = P(g, new THREE.CylinderGeometry(0.95, 0.95, 0.01, 6), glowMat('#36f0ff', 0.6, tHex('#36f0ff')), null, [0, 0.005, 0]);
      const scan = P(g, new THREE.TorusGeometry(0.75, 0.012, 6, 48), energy('#9ffcff', 0.8, true), null, [0, 0.2, 0], [Math.PI / 2, 0, 0]);
      const pan = [-1, 1].map((s) => { const m = glowMat('#36f0ff', 0.22, tGrid); m.map = tGrid; const p = P(g, new THREE.PlaneGeometry(0.9, 1.2), m, null, [s * 1.45, 1.35, -0.8], [0, -s * 0.6, 0]); return p; });
      return { g, c: common(g, '#36f0ff', { top: 0.0 }), key: 0xe0f4ff, rim: 0x36f0ff, under: '#1ad0ff', scan, pan, grid, ui: 0.7 };
    },
    lumen(c) { // île de cristal flottante + aurore
      const g = new THREE.Group(), isle = J(g, [0, 0, 0]), rock = std({ c: '#3a2a5a', r: 0.9, map: tRock('#3a2a5a'), flat: true });
      P(isle, new THREE.CylinderGeometry(1.0, 0.95, 0.14, 10), std({ c: '#5a4a8a', r: 0.7, map: tRock('#5a4a8a'), flat: true }), null, [0, -0.07, 0], null, 1.02);
      P(isle, new THREE.ConeGeometry(0.95, 1.0, 10), rock, null, [0, -0.64, 0], [Math.PI, 0, 0], 1.02);
      const cols = ['#ff7af0', '#bffff4', '#ffd76a', '#9a7cff'];
      for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.8, cl = J(isle, [Math.cos(a) * 0.82, 0, Math.sin(a) * 0.62]); for (let i = 0; i < 3; i++) P(cl, GE.oct, std({ c: cols[(k + i) % 4], m: 0.1, r: 0.04, e: cols[(k + i) % 4], ei: 0.5, flat: true, phys: true, cc: 1, op: 0.9 }), [0.05 + i * 0.01, 0.13 + i * 0.05, 0.05], [(i - 1) * 0.08, 0.1 + i * 0.03, 0], [0, 0, (i - 1) * 0.35]); }
      const aur = P(g, new THREE.CylinderGeometry(3.2, 3.2, 2.4, 32, 1, true, -0.9 + Math.PI, 1.8), glowMat('#ffffff', 0.4, tAurora), null, [0, 1.6, 1.2]);
      return { g, c: common(g, '#d8a8ff', { top: 0.0 }), key: 0xf4e8ff, rim: 0xff7af0, under: '#c070ff', isle, aur, ui: 0.8 };
    },
    krank(c) { // aire de hangar
      const g = new THREE.Group(), metal = std({ c: '#4a4f5a', m: 0.85, r: 0.35, map: T.metal('#4a4f5a') });
      P(g, new THREE.CylinderGeometry(1.02, 1.08, 0.16, 8), metal, null, [0, -0.08, 0], null, 1.02);
      P(g, new THREE.CylinderGeometry(1.03, 1.03, 0.1, 8, 1, true), std({ c: '#ffffff', r: 0.5, map: T.hazard('#f0a81c'), side: THREE.DoubleSide }), null, [0, -0.04, 0]);
      const bea = [-1, 1].map((s) => { const b = J(g, [s * 1.3, 0, -0.85]); P(b, GE.cyl, metal, [0.04, 0.9, 0.04], [0, 0.45, 0], null, true); P(b, GE.half, std({ c: '#ff8a1a', e: '#ff6a00', ei: 1, r: 0.3 }), [0.09, 0.08, 0.09], [0, 0.9, 0], null, true); return { b, s: sprite(b, '#ff9a2a', 0.5, [0, 0.95, 0], 0.7) }; });
      const crate = std({ c: '#ffffff', r: 0.7, map: T.leather('#7a5a3a') });
      P(g, GE.box, crate, [0.42, 0.42, 0.42], [1.15, 0.21, -1.3], [0, 0.3, 0], true); P(g, GE.box, crate, [0.32, 0.32, 0.32], [1.05, 0.58, -1.25], [0, -0.2, 0], true); P(g, GE.box, metal, [0.5, 0.3, 0.36], [-1.2, 0.15, -1.3], [0, -0.3, 0], true);
      const steam = []; for (let i = 0; i < 4; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.smoke, color: 0xcfd6e0, transparent: true, depthWrite: false, opacity: 0.4 })); sp.userData.i = i; g.add(sp); steam.push(sp); }
      return { g, c: common(g, '#ffb21a', { top: 0.0 }), key: 0xfff0d8, rim: 0x3affb0, under: '#ffa21a', bea, steam, ui: 0.9 };
    },
  };
  const themeOf = (id) => (THEMES[id] ? id : 'prism');
  const cache = {};
  function stageFor(id) {
    const th = themeOf(id), b = G.BRAWLER[id] || {}, L = b.look || {}, c = th === 'prism' ? (L.accent || '#7a8cff') : null;
    const k = th === 'prism' ? 'prism' + c : th;
    if (!cache[k]) { cache[k] = THEMES[th](c); cache[k].th = th; }
    return cache[k];
  }
  // couleur d'ambiance du personnage (utilisée aussi par l'interface)
  G.heroColor = function (id) {
    const b = G.BRAWLER[id] || {}, L = b.look || {};
    return { ignis: ['#ff6a1a', '#ffb21a'], nyx: ['#36f0ff', '#8a5cff'], lumen: ['#c070ff', '#ff7af0'], krank: ['#ffb21a', '#3affb0'] }[id] || [L.accent || '#7a8cff', L.body || '#8a5cff'];
  };

  /* ---------- lumière d'appoint (toujours présente, éteinte hors scène : pas de recompilation des shaders) ---------- */
  const under = new THREE.PointLight(0xffffff, 0, 4.5, 2); under.position.set(0, 0.35, 0.9); scene.add(under);
  const save = { key: H.key.color.clone(), rim: H.rim.color.clone(), ki: H.key.intensity, ri: H.rim.intensity };

  /* ---------- état par canevas : changement de personnage, toucher ---------- */
  const ST = new WeakMap();
  let active = null;
  function animate(S, st, t) {
    const c = st.c, sw = S.sw;
    // particules qui s'élèvent (positions déduites du temps : aucun état), jaillissement au changement
    c.parts.forEach((p, i) => { const sp = 0.25 + (i % 5) * 0.05, life = (t * sp + i * 0.618) % 1, a = i * 2.399, r = c.pr * (0.35 + ((i * 7) % 10) / 14); const burst = sw < 1 ? out3(sw) : 1;
      p.position.set(Math.cos(a + t * 0.2) * r * (sw < 1 ? burst : 1), c.top + life * c.rise * (sw < 1 ? 0.3 + burst * 0.7 : 1), Math.sin(a + t * 0.2) * r * 0.8); p.scale.setScalar(0.07 * (1 - life) + 0.02); p.material.opacity = Math.sin(life * Math.PI) * 0.9 * (G.Render.q < 1 && i % 2 ? 0 : 1); });
    c.halo.material.opacity = 0.18 + Math.sin(t * 0.9) * 0.04 + pulse(sw, 0, 0.6) * 0.3;
    // onde et éclair de transition
    c.ring.visible = sw < 0.8; if (c.ring.visible) { const k = out3(sw / 0.8); c.ring.scale.setScalar(0.2 + k * 1.8); c.ring.material.opacity = (1 - k) * 0.9; }
    c.flash.material.opacity = pulse(sw, 0, 0.35) * 0.9; c.flash.scale.setScalar(0.5 + out3(sw / 0.35) * 3.5);
    // vie du décor
    if (st.fl) st.fl.forEach((f, i) => f.scale.y = 0.35 * (1 + Math.sin(t * 15 + i * 2) * 0.2));
    if (st.scan) { const k = (t * 0.45) % 1; st.scan.position.y = 0.05 + k * 2.3; st.scan.material.opacity = Math.sin(k * Math.PI) * 0.8; st.scan.scale.setScalar(1 - k * 0.15); st.pan.forEach((p, i) => { p.material.opacity = 0.16 + Math.sin(t * 2 + i) * 0.05 + (Math.sin(t * 23 + i) > 0.97 ? 0.2 : 0); if (p.material.map) p.material.map.offset.y = (t * 0.05) % 1; }); }
    if (st.isle) { st.isle.position.y = Math.sin(t * 1.1) * 0.03; st.aur.material.opacity = 0.3 + Math.sin(t * 0.7) * 0.1; st.aur.rotation.y = Math.sin(t * 0.2) * 0.15; }
    if (st.bea) st.bea.forEach((b, i) => { const k = (Math.sin(t * 6 + i * Math.PI) + 1) / 2; b.s.material.opacity = 0.2 + k * 0.8; b.s.scale.setScalar(0.3 + k * 0.4); });
    if (st.steam) st.steam.forEach((sp) => { const i = sp.userData.i, life = (t * 0.35 + i * 0.25) % 1; sp.position.set((i % 2 ? 0.95 : -0.95) + Math.sin(life * 4 + i) * 0.1, 0.05 + life * 1.3, -0.5 - (i >> 1) * 0.3); sp.scale.setScalar(0.25 + life * 0.7); sp.material.opacity = Math.sin(life * Math.PI) * 0.35; });
    st.g.traverse((o) => { if (o.userData.float !== undefined) { o.position.y = 1.2 + Math.sin(t * 1.3 + o.userData.float * 2) * 0.12; o.rotation.y = t * 0.8 + o.userData.float; } });
  }
  // caméra de mise en scène : léger travelling, rapprochement au toucher, survol à l'arrivée d'un personnage
  const baseHook = C3.camHook;
  C3.camHook = function (cam, cv, opts, t, cy, dist) {
    if (baseHook) baseHook.apply(this, arguments);
    if (!active || active.cv !== cv) return;
    const S = active.S, sw = S.sw, k = out3(sw / 1.0);
    const poke = C3.pokeId === cv ? (performance.now() - C3._pokeAt) / 1000 : -1, pk = poke >= 0 ? pulse(poke, 0, 1.2) : 0;
    const yaw = Math.sin(t * 0.13) * 0.22 + (1 - k) * 0.9, d = dist * (1 + (1 - k) * 0.55 - pk * 0.12) * (opts.camDist || 1), h = cy + dist * 0.12 + (1 - k) * 1.4 + Math.sin(t * 0.21) * 0.06;
    cam.position.set(Math.sin(yaw) * d, h, Math.cos(yaw) * d); cam.lookAt(0, cy + pk * 0.25 - (1 - k) * 0.2, 0);
    // apparition « pop » des personnages qui n'ont pas leur propre animation d'entrée
    const hero = scene.children.find((o) => o !== S.st.g && o.isObject3D && !o.isLight && o.parent === scene);
    if (hero && !hero.userData.prism && sw < 0.9) { const p = sw / 0.9, s = p < 0.6 ? out3(p / 0.6) * 1.08 : 1.08 - Math.sin(((p - 0.6) / 0.4) * Math.PI / 2) * 0.08; active.pop = { o: hero, s0: hero.scale.x }; hero.scale.setScalar(hero.scale.x * Math.max(0.01, s)); }
  };
  const basePortrait = C3.portrait;
  C3.portrait = function (cv, id, skin, t, opts) {
    if (!opts || !opts.stage) return basePortrait.apply(this, arguments);
    let S = ST.get(cv); const now = performance.now();
    if (!S) { S = { id: null, swAt: now, last: 0 }; ST.set(cv, S); }
    // 30 images/s pour la scène du salon (fluide, et deux fois moins de batterie) ; changement de personnage : tout de suite
    if (S.id === id && now - S.last < 32 && now >= S.last) return; S.last = now;
    if (S.id !== id) { S.id = id; S.swAt = now; if (S.st) scene.remove(S.st.g); S.st = stageFor(id); }
    S.sw = (now - S.swAt) / 1000;
    const st = S.st; animate(S, st, t);
    scene.add(st.g); active = { cv, S };
    H.key.color.setHex(st.key); H.rim.color.setHex(st.rim); H.rim.intensity = 1.25; H.key.intensity = 1.15;
    under.color.set(st.under); under.intensity = 1.4 + Math.sin(t * 2.3) * 0.15 + pulse(S.sw, 0, 0.6) * 2;
    try { basePortrait.call(this, cv, id, skin, t, opts); }
    finally {
      if (active && active.pop) active.pop.o.scale.setScalar(active.pop.s0);
      scene.remove(st.g); active = null; under.intensity = 0;
      H.key.color.copy(save.key); H.rim.color.copy(save.rim); H.key.intensity = save.ki; H.rim.intensity = save.ri;
    }
  };
  C3.stageSwitch = (cv) => { const S = ST.get(cv); if (S) S.swAt = performance.now(); };
})();
