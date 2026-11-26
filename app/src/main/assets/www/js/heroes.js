/* Brawl Rush - PRISM : personnages originaux en 3D (Ignis, Nyx-7, Lumen, Krank)
   Direction artistique « PRISM » : silhouettes lisibles à contour encré, vrais matériaux (métal réfléchissant, céramique,
   tissu, cristal) éclairés par une carte d'environnement générée, lignes d'énergie émissives et halos lumineux.
   Textures entièrement procédurales (dessinées au lancement : aucun fichier à télécharger).
   Animations procédurales MÉLANGÉES (attente, respiration, course avec poids, pas chassés, changements de direction,
   attaque, rechargement, réaction aux dégâts, victoire, défaite, apparition, élimination, gestes d'attente) avec
   une personnalité par personnage. Purement graphique : aucune incidence sur la simulation ni le réseau. */
(function () {
  const G = window.G, C3 = G.Char3D, THREE = window.THREE;
  if (!THREE || !C3 || !C3._h) return;
  const H = C3._h, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k), out3 = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
  const appr = (v, to, k) => v + (to - v) * Math.min(1, k);
  const col = (c) => new THREE.Color(c).convertSRGBToLinear();
  const pulse = (x, a, b) => (x < a || x > b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI)); // cloche entre a et b

  /* ======================= textures procédurales ======================= */
  const TX = {};
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function tex(key, fn, lin, size) {
    if (TX[key]) return TX[key];
    const n = size || 256, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const c = cv.getContext('2d'); fn(c, n, rng(key.length * 7919 + key.charCodeAt(0)));
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = lin ? THREE.LinearEncoding : THREE.sRGBEncoding; t.anisotropy = 2;
    return (TX[key] = t);
  }
  function grain(c, n, r, a) { for (let i = 0; i < n * n / 5; i++) { const v = r(); c.fillStyle = v > 0.5 ? 'rgba(255,255,255,' + (a * r()).toFixed(3) + ')' : 'rgba(0,0,0,' + (a * r()).toFixed(3) + ')'; c.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); } }
  function rivet(c, x, y, s) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(x + 1, y + 1, s, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - 0.6, y - 0.6, s * 0.7, 0, TAU); c.fill(); }
  // métal forgé : grain, brossage, rayures, joints de plaques, rivets, ombrage des bords
  const tMetal = (base) => tex('metal' + base, (c, n, r) => {
    c.fillStyle = base; c.fillRect(0, 0, n, n); grain(c, n, r, 0.16);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 70; i++) { const y = r() * n; c.lineWidth = 0.6 + r(); c.beginPath(); c.moveTo(0, y); c.lineTo(n, y + (r() - 0.5) * 6); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.22)'; for (let i = 0; i < 26; i++) { const x = r() * n, y = r() * n, a = r() * TAU, l = 6 + r() * 22; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    [0.25, 0.75].forEach((u) => { c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(u * n, 0); c.lineTo(u * n, n); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(u * n + 2, 0); c.lineTo(u * n + 2, n); c.stroke(); });
    for (let y = 12; y < n; y += 32) [0.25, 0.75].forEach((u) => { rivet(c, u * n - 7, y, 2.6); rivet(c, u * n + 9, y + 16, 2.6); });
    const g = c.createLinearGradient(0, 0, 0, n); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = g; c.fillRect(0, 0, n, n);
  });
  // fissures de lave (carte émissive)
  const tLava = () => tex('lava', (c, n, r) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, n, n);
    for (let pass = 0; pass < 2; pass++) {
      const rr = rng(99);
      for (let k = 0; k < 16; k++) {
        let x = rr() * n, y = rr() * n, a = rr() * TAU; c.beginPath(); c.moveTo(x, y);
        for (let i = 0; i < 9; i++) { a += (rr() - 0.5) * 1.3; const l = 8 + rr() * 16; x += Math.cos(a) * l; y += Math.sin(a) * l; c.lineTo(x, y); }
        if (pass === 0) { c.strokeStyle = '#ff5a0a'; c.lineWidth = 2 + rr() * 3; c.shadowColor = '#ff8a20'; c.shadowBlur = 10; } else { c.strokeStyle = '#ffe08a'; c.lineWidth = 0.9; c.shadowBlur = 0; }
        c.stroke();
      }
    }
    c.shadowBlur = 0; for (let i = 0; i < 10; i++) { const x = r() * n, y = r() * n, g = c.createRadialGradient(x, y, 0, x, y, 10); g.addColorStop(0, 'rgba(255,160,40,0.9)'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.fillRect(x - 10, y - 10, 20, 20); }
  });
  // céramique blanche : joints de panneaux, aérations, marquages
  const tCeramic = (base) => tex('cer' + base, (c, n, r) => {
    c.fillStyle = base; c.fillRect(0, 0, n, n);
    const g = c.createLinearGradient(0, 0, 0, n); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(60,70,100,0.18)'); c.fillStyle = g; c.fillRect(0, 0, n, n); grain(c, n, r, 0.05);
    c.strokeStyle = 'rgba(50,60,85,0.55)'; c.lineWidth = 2;
    [0.33, 0.66].forEach((v, j) => { c.beginPath(); c.moveTo(0, v * n); c.lineTo(n, v * n); c.stroke(); [0.2, 0.5, 0.8].forEach((u) => { const x = (u + j * 0.12) * n; c.beginPath(); c.moveTo(x, v * n); c.lineTo(x, v * n + n * 0.33); c.stroke(); }); });
    c.fillStyle = 'rgba(40,50,70,0.6)'; for (let k = 0; k < 3; k++) { const x = 20 + r() * (n - 60), y = 20 + r() * (n - 40); for (let i = 0; i < 4; i++) c.fillRect(x + i * 6, y, 3, 14); }
    c.font = 'bold 14px sans-serif'; c.fillStyle = 'rgba(40,50,70,0.5)'; c.fillText('N-7', n * 0.58, n * 0.27); c.fillText('◇ 07', n * 0.1, n * 0.92);
  });
  const tSeams = () => tex('seams', (c, n) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, n, n); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.shadowColor = '#fff'; c.shadowBlur = 6;
    [0.33, 0.66].forEach((v, j) => { c.beginPath(); c.moveTo(n * 0.1, v * n + 3); c.lineTo(n * 0.45, v * n + 3); c.stroke(); c.beginPath(); c.moveTo((0.5 + j * 0.12) * n + 3, v * n); c.lineTo((0.5 + j * 0.12) * n + 3, v * n + n * 0.3); c.stroke(); });
  });
  // peinture industrielle : bandes de danger, éclats de peinture, rayures, rivets, pochoir
  const tHazard = (base) => tex('haz' + base, (c, n, r) => {
    c.fillStyle = base; c.fillRect(0, 0, n, n); grain(c, n, r, 0.12);
    c.save(); c.beginPath(); c.rect(0, n * 0.8, n, n * 0.14); c.clip(); c.fillStyle = '#1b1b22'; for (let x = -n; x < n * 2; x += 28) { c.beginPath(); c.moveTo(x, n * 0.8); c.lineTo(x + 14, n * 0.8); c.lineTo(x + 14 - n * 0.14, n * 0.94); c.lineTo(x - n * 0.14, n * 0.94); c.fill(); } c.restore();
    c.fillStyle = '#8a8f98'; for (let i = 0; i < 34; i++) { const x = r() * n, y = r() * n, s = 1.5 + r() * 5; c.beginPath(); c.moveTo(x, y); for (let k = 1; k < 6; k++) { const a = (k / 6) * TAU; c.lineTo(x + Math.cos(a) * s * (0.6 + r() * 0.6), y + Math.sin(a) * s * (0.6 + r() * 0.6)); } c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 20; i++) { const x = r() * n, y = r() * n; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 10); c.stroke(); }
    for (let x = 10; x < n; x += 24) { rivet(c, x, n * 0.06, 2.5); rivet(c, x, n * 0.76, 2.5); }
    c.font = 'bold 30px Impact, sans-serif'; c.fillStyle = 'rgba(20,20,28,0.65)'; c.fillText('KR-4', n * 0.32, n * 0.5);
    const g = c.createLinearGradient(0, n * 0.6, 0, n); g.addColorStop(0, 'rgba(70,45,20,0)'); g.addColorStop(1, 'rgba(70,45,20,0.35)'); c.fillStyle = g; c.fillRect(0, 0, n, n);
  });
  // tissu tissé brodé
  const tFabric = (base, trim) => tex('fab' + base + trim, (c, n, r) => {
    c.fillStyle = base; c.fillRect(0, 0, n, n);
    for (let i = 0; i < n; i += 3) { c.fillStyle = i % 6 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; c.fillRect(0, i, n, 1); c.fillRect(i, 0, 1, n); }
    grain(c, n, r, 0.05); c.fillStyle = trim; c.strokeStyle = trim;
    for (let i = 0; i < 18; i++) { const x = r() * n, y = r() * n * 0.75, s = 3 + r() * 3; c.globalAlpha = 0.55; c.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, rr = k % 2 ? s * 0.4 : s; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.fill(); }
    c.globalAlpha = 1; c.fillRect(0, n * 0.84, n, n * 0.1); c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 0; x < n; x += 16) { c.beginPath(); c.moveTo(x, n * 0.86); c.lineTo(x + 8, n * 0.92); c.lineTo(x + 16, n * 0.86); c.fill(); }
  });
  // cuir piqué
  const tLeather = (base) => tex('lea' + base, (c, n, r) => {
    c.fillStyle = base; c.fillRect(0, 0, n, n); grain(c, n, r, 0.14);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 14; i++) { const x = r() * n, y = r() * n; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 10, y + (r() - 0.5) * 12, x + 22, y + (r() - 0.5) * 6); c.stroke(); }
    c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,230,200,0.45)'; c.lineWidth = 1.4; [8, n - 8].forEach((y) => { c.beginPath(); c.moveTo(0, y); c.lineTo(n, y); c.stroke(); }); c.setLineDash([]);
  });
  // halo lumineux (sprites additifs)
  const glowTex = tex('glow', (c, n) => { const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, n, n); }, false, 128);
  const smokeTex = tex('smoke', (c, n, r) => { for (let i = 0; i < 9; i++) { const x = n / 2 + (r() - 0.5) * n * 0.4, y = n / 2 + (r() - 0.5) * n * 0.4, g = c.createRadialGradient(x, y, 0, x, y, n * 0.3); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, n, n); } }, false, 128);
  C3.glowTex = glowTex;

  /* ======================= carte d'environnement (reflets des métaux) ======================= */
  let ENV = null, envTried = false;
  function env() {
    if (ENV || envTried) return ENV; envTried = true;
    try {
      const r = H.renderer(); if (!r || !THREE.PMREMGenerator) return null;
      const es = new THREE.Scene();
      const sky = tex('envsky', (c, n) => { const g = c.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#fff6ea'); g.addColorStop(0.42, '#a99cf0'); g.addColorStop(0.5, '#4a3a86'); g.addColorStop(0.62, '#241a44'); g.addColorStop(1, '#0c0818'); c.fillStyle = g; c.fillRect(0, 0, n, n); });
      es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));
      const panel = (c, p, s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) })); m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); es.add(m); };
      panel([6, 5.6, 5], [-4, 6, 5], [4, 3, 0.1]); panel([1.2, 3.2, 4], [7, 2, -3], [1.5, 5, 0.1]); panel([4, 1.6, 0.8], [-7, 1, -4], [1.5, 4, 0.1]); panel([2, 2, 2.4], [0, -2, 7], [6, 0.6, 0.1]);
      const pm = new THREE.PMREMGenerator(r); ENV = pm.fromScene(es, 0.03).texture; pm.dispose();
    } catch (e) { ENV = null; }
    return ENV;
  }

  /* ======================= matériaux ======================= */
  function std(o) {
    const P = o.phys && THREE.MeshPhysicalMaterial ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new P({ color: col(o.map ? '#ffffff' : o.c || '#ffffff'), metalness: o.m || 0, roughness: o.r === undefined ? 0.6 : o.r, flatShading: !!o.flat });
    const e = env(); if (e) { m.envMap = e; m.envMapIntensity = o.env === undefined ? 1 : o.env; }
    if (o.map) m.map = o.map;
    if (o.emap) { m.emissiveMap = o.emap; m.emissive = col(o.e || '#ffffff'); m.emissiveIntensity = o.ei === undefined ? 1 : o.ei; }
    else if (o.e) { m.emissive = col(o.e); m.emissiveIntensity = o.ei === undefined ? 1 : o.ei; }
    if (o.op !== undefined) { m.transparent = true; m.opacity = o.op; m.depthWrite = o.op > 0.6; }
    if (o.side) m.side = o.side;
    if (o.cc && 'clearcoat' in m) { m.clearcoat = o.cc; m.clearcoatRoughness = 0.12; }
    m.userData.e0 = m.emissive.clone(); m.userData.ei0 = m.emissiveIntensity; m.userData.op0 = m.opacity; m.userData.pbr = true;
    return m;
  }
  const energy = (c, op, add) => { const m = new THREE.MeshBasicMaterial({ color: col(c), transparent: op !== undefined || !!add, opacity: op === undefined ? 1 : op, toneMapped: false }); if (add) { m.blending = THREE.AdditiveBlending; m.depthWrite = false; } m.userData.energy = true; m.userData.c0 = m.color.clone(); m.userData.op0 = m.opacity; return m; };
  function sprite(parent, c, s, p, op) {
    const m = new THREE.SpriteMaterial({ map: glowTex, color: col(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op === undefined ? 0.9 : op, toneMapped: false });
    const sp = new THREE.Sprite(m); sp.scale.set(s, s, s); if (p) sp.position.set(p[0], p[1], p[2]); parent.add(sp); sp.userData.s0 = s; sp.userData.op0 = m.opacity; return sp;
  }

  /* ======================= géométries ======================= */
  const GHI = {
    sph: new THREE.SphereGeometry(1, 28, 18), half: new THREE.SphereGeometry(1, 28, 12, 0, TAU, 0, Math.PI / 2), cyl: new THREE.CylinderGeometry(1, 1, 1, 22), cylO: new THREE.CylinderGeometry(1, 1, 1, 22, 1, true),
    taper: new THREE.CylinderGeometry(0.78, 1, 1, 22), cone: new THREE.ConeGeometry(1, 1, 18), box: new THREE.BoxGeometry(1, 1, 1), oct: new THREE.OctahedronGeometry(1, 0),
    tor: new THREE.TorusGeometry(1, 0.12, 10, 36), torT: new THREE.TorusGeometry(1, 0.05, 6, 40), tri: new THREE.CylinderGeometry(1, 1, 1, 3), ico: new THREE.IcosahedronGeometry(1, 0),
    cap: THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(1, 1, 6, 16) : new THREE.CylinderGeometry(1, 1, 2, 16),
  };
  // version allégée (combat : personnage affiché en petit) — 4 à 6 fois moins de triangles
  const GLO = {
    sph: new THREE.SphereGeometry(1, 12, 8), half: new THREE.SphereGeometry(1, 12, 5, 0, TAU, 0, Math.PI / 2), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), cylO: new THREE.CylinderGeometry(1, 1, 1, 10, 1, true),
    taper: new THREE.CylinderGeometry(0.78, 1, 1, 10), cone: new THREE.ConeGeometry(1, 1, 8), box: GHI.box, oct: GHI.oct, tor: new THREE.TorusGeometry(1, 0.12, 5, 16), torT: new THREE.TorusGeometry(1, 0.05, 4, 16),
    tri: GHI.tri, ico: GHI.ico, cap: THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(1, 1, 3, 8) : new THREE.CylinderGeometry(1, 1, 2, 8),
  };
  let GE = GHI, LITE = false, SEG = 18;
  const lod = (lite) => { LITE = !!lite; GE = LITE ? GLO : GHI; SEG = LITE ? 9 : 18; };
  // pièce : maillage (+ contour encré facultatif)
  function P(parent, g, m, s, p, r, outline) {
    const o = new THREE.Mesh(g, m); if (s) o.scale.set(s[0], s[1], s[2]); if (p) o.position.set(p[0], p[1], p[2]); if (r) o.rotation.set(r[0], r[1], r[2]);
    parent.add(o);
    if (outline) { const ol = new THREE.Mesh(g, H.outMat); ol.scale.setScalar(outline === true ? 1.06 : outline); o.add(ol); }
    return o;
  }
  const J = (parent, p, r) => { const g = LITE ? new THREE.Bone() : new THREE.Group(); if (p) g.position.set(p[0], p[1], p[2]); if (r) g.rotation.set(r[0], r[1], r[2]); parent.add(g); return g; };

  /* ======================= moteur d'animation commun (mélange des états) ======================= */
  const MEM = new Map();
  function memOf(k) {
    let m = MEM.get(k);
    if (!m) { if (MEM.size > 160) MEM.clear(); m = { last: 0, vx: 0, vy: 0, run: 0, ph: 0, strafe: 0, fwd: 1, turn: 0, atkT: 9, hitT: 9, rlT: 9, spT: 0, win: 0, lose: 0, reload: 0, fidT: 4 + Math.random() * 4, fid: null, fidK: 0, id: null }; MEM.set(k, m); }
    return m;
  }
  C3.prismReset = (k) => MEM.delete(k);
  function drive(m, st) {
    const now = performance.now(), mem = memOf(st.key === undefined ? 'x' : st.key);
    let dt = (now - mem.last) / 1000; const gap = dt > 1.2; if (!(dt > 0) || dt > 0.1) dt = 0.016; mem.last = now;
    if (mem.id !== m.heroId) { mem.id = m.heroId; mem.spT = st.match || (st.opts && (st.opts.idleShow || st.opts.stage)) ? 0 : 99; mem.atkT = mem.hitT = 9; mem.fid = null; } // nouveau personnage → apparition
    else if (gap && !st.match) mem.spT = Math.max(mem.spT, 9);
    const t = st.t || now / 1000, mv = st.moving ? 1 : 0;
    // vitesse réelle (déduite des positions : fonctionne aussi pour les autres joueurs en ligne)
    if (st.x !== undefined) {
      if (mem.px !== undefined && !gap) { const vx = (st.x - mem.px) / dt, vy = (st.y - mem.py) / dt; if (Math.hypot(vx, vy) < 2000) { mem.vx = appr(mem.vx, vx, dt * 10); mem.vy = appr(mem.vy, vy, dt * 10); } }
      mem.px = st.x; mem.py = st.y;
    }
    let strafe = 0, fwd = 1;
    if (mv && Math.hypot(mem.vx, mem.vy) > 25 && st.aim !== undefined) { const rel = Math.atan2(mem.vy, mem.vx) - st.aim; strafe = -Math.sin(rel); fwd = Math.cos(rel); }
    mem.strafe = appr(mem.strafe, strafe, dt * 7); mem.fwd = appr(mem.fwd, mv ? fwd : 1, dt * 7);
    if (st.aim !== undefined) { if (mem.aim !== undefined && !gap) { let da = st.aim - mem.aim; da = Math.atan2(Math.sin(da), Math.cos(da)); mem.turn = appr(mem.turn, clamp(da / dt * 0.09, -1, 1), dt * 9); } mem.aim = st.aim; }
    mem.turn = appr(mem.turn, 0, dt * 3);
    mem.run = appr(mem.run, mv, dt * 7);
    mem.ph += dt * m.hero.step * (mv ? 1 : mem.run);
    // évènements : tir, coup reçu, rechargement
    const rec = st.recoil || 0; if (rec > (mem.rec || 0) + 0.15) { mem.atkT = 0; mem.atkN = (mem.atkN || 0) + 1; } mem.rec = rec;
    if (st.attackPose && mem.atkT > 1.2) mem.atkT = 0;
    mem.atkT += dt;
    const fl = st.flash || 0; if (fl > 0 && !(mem.fl > 0)) mem.hitT = 0; mem.fl = fl; mem.hitT += dt;
    const am = st.ammo; if (am !== undefined) { if (mem.am !== undefined && Math.floor(am + 0.001) > Math.floor(mem.am + 0.001)) mem.rlT = 0; mem.am = am; }
    mem.rlT += dt;
    mem.reload = appr(mem.reload, am !== undefined && am < 2.98 && mem.atkT > 0.55 ? 1 : 0, dt * 4);
    // mort / réapparition
    if (st.deathT !== undefined) mem.dead = true; else if (mem.dead) { mem.dead = false; mem.spT = 0; }
    mem.spT += dt;
    mem.win = appr(mem.win, st.pose === 'win' ? 1 : 0, dt * 5); mem.lose = appr(mem.lose, st.pose === 'lose' ? 1 : 0, dt * 4);
    // gestes d'attente (personnalité) quand rien ne se passe
    const calm = mem.run < 0.05 && mem.atkT > 1.5 && mem.hitT > 1 && mem.win < 0.1 && mem.lose < 0.1 && mem.spT > 2 && st.deathT === undefined;
    if (mem.fid) { mem.fid.t += dt; if (mem.fid.t > mem.fid.d || !calm) mem.fid = null; }
    else if (calm) { mem.fidT -= dt * (st.match ? 0.5 : 1); if (mem.fidT <= 0) { mem.fidT = 5 + Math.random() * 5; mem.fid = { t: 0, d: 2.2, k: Math.floor(Math.random() * 2) }; } }
    const poke = st.poke !== undefined && st.poke >= 0 && st.poke < 1.4 ? st.poke : -1;
    if (poke >= 0) mem.fid = null;
    const fid = mem.fid ? { k: mem.fid.k, p: mem.fid.t / mem.fid.d, w: pulse(mem.fid.t / mem.fid.d, 0, 1) } : null;
    const atkK = mem.atkT / m.hero.atkDur;
    return {
      t, dt, mem, run: mem.run, ph: mem.ph, strafe: mem.strafe, fwd: mem.fwd, turn: mem.turn,
      atk: atkK < 1 ? atkK : -1, atkW: atkK < 1 ? 1 : Math.max(0, 1 - (mem.atkT - m.hero.atkDur) * 5), atkN: mem.atkN || 0,
      hit: mem.hitT < 0.4 ? 1 - mem.hitT / 0.4 : 0, reload: mem.reload * (1 - mem.run * 0.5), rl: mem.rlT < 0.35 ? 1 - mem.rlT / 0.35 : 0,
      win: mem.win, lose: mem.lose, spawn: clamp(mem.spT / m.hero.spawnDur, 0, 1), death: st.deathT === undefined ? -1 : clamp(st.deathT / 0.75, 0, 1),
      poke, fid, sup: !!st.superReady, stun: !!st.stun, frozen: !!st.frozen, dash: !!st.dashing, jump: !!st.jumping, roll: st.roll !== undefined && st.roll >= 0 && st.roll < 1 ? st.roll : -1,
      flash: fl > 0 ? Math.min(1, fl * 8) : 0, lobby: !st.match,
    };
  }
  // jambes : cycle de marche avec poids (amplitude, levée du genou, pas chassés)
  function legCycle(A, side, amp) {
    const s = Math.sin(A.ph + (side < 0 ? 0 : Math.PI)), lift = Math.max(0, Math.cos(A.ph + (side < 0 ? 0 : Math.PI)));
    const k = A.run * amp;
    return { x: s * k * A.fwd, z: s * k * A.strafe * 0.6, knee: lift * k * 1.1 + 0.05, lift };
  }
  // effets de matériaux : flash blanc au coup reçu, pulsation de l'énergie, apparences spéciales
  function fxMats(m, A, glow) {
    const fx = m.fx, fl = A.flash;
    for (const mt of m.pbr) {
      if (fl > 0) { mt.emissive.setRGB(fl, fl, fl); mt.emissiveIntensity = 1; }
      else if (fx === 'inferno') { mt.emissive.setRGB(0.35 + Math.sin(A.t * 6) * 0.08, 0.08, 0); mt.emissiveIntensity = 1; }
      else if (fx === 'crystal') { mt.emissive.setRGB(0.04, 0.2, 0.26); mt.emissiveIntensity = 1; }
      else { mt.emissive.copy(mt.userData.e0); mt.emissiveIntensity = mt.userData.ei0 * (mt.emissiveMap ? glow : 1); }
    }
    for (const mt of m.en) { if (fx === 'rainbow') mt.color.setHSL((A.t * 0.25) % 1, 1, 0.6).convertSRGBToLinear(); else mt.color.copy(mt.userData.c0).multiplyScalar(Math.min(1.6, Math.max(0.15, glow))); }
    for (const sp of m.sprites) {
      if (sp.userData.dyn) { if (A.death >= 0) sp.material.opacity *= 1 - A.death; continue; }
      sp.material.opacity = sp.userData.op0 * clamp(glow, 0, 1.4) * (A.death >= 0 ? 1 - A.death : 1); if (fx === 'rainbow') sp.material.color.setHSL((A.t * 0.25 + 0.3) % 1, 1, 0.6);
    }
  }
  // collecte des matériaux d'un modèle (pour les effets)
  function collect(m) {
    if (LITE) dedupe(m);
    m.pbr = []; m.en = []; m.sprites = []; m.details = [];
    const seen = new Set(), v = new THREE.Vector3();
    m.root.updateMatrixWorld(true);
    m.root.traverse((o) => {
      if (o.isSprite) { m.sprites.push(o); return; }
      if (!o.isMesh) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(v); const rad = o.geometry.boundingSphere.radius * Math.max(v.x, v.y, v.z);
      if (o.material === H.outMat) { if (LITE && rad < 0.15) m.details.push(o); return; }
      if (LITE && rad < 0.045 && !o.material.userData.energy) m.details.push(o);
      const mt = o.material; if (seen.has(mt)) return; seen.add(mt);
      if (mt.userData.pbr) m.pbr.push(mt); else if (mt.userData.energy) m.en.push(mt);
    });
    if (m.fx === 'ghost') m.pbr.forEach((mt) => { mt.transparent = true; mt.opacity = 0.6; mt.depthWrite = true; });
    // version allégée : les détails invisibles à cette taille (et leurs contours) sont retirés, puis les pièces fixes fusionnées
    for (const o of m.details) if (o.parent) o.parent.remove(o);
    m.lite = LITE;
    if (LITE) { try { skinMerge(m); } catch (e) { /* on garde les pièces séparées */ } }
  }
  /* combat : « squelette rigide ». Les articulations sont des os (THREE.Bone) ; toutes les pièces d'un même matériau
     (contours compris) sont réunies en UN maillage skinné dont chaque sommet suit son os → ~4× moins d'appels de dessin,
     animations identiques (on anime toujours les mêmes articulations). */
  function matKey(mt) {
    const c = (x) => (x ? x.getHexString() : '-');
    return [mt.type, c(mt.color), c(mt.emissive), mt.emissiveIntensity, mt.metalness, mt.roughness, mt.map ? mt.map.uuid : '', mt.emissiveMap ? mt.emissiveMap.uuid : '', mt.opacity, mt.transparent, mt.side, mt.blending, mt.flatShading, mt.clearcoat].join('|');
  }
  function dedupe(m) {
    const canon = new Map();
    m.root.traverse((o) => { if (!o.isMesh || o.material === H.outMat) return; const k = matKey(o.material); const c = canon.get(k); if (c) o.material = c; else canon.set(k, o.material); });
  }
  function skinMerge(m) {
    const keep = new Set();
    for (const k in m) { const v = m[k]; (Array.isArray(v) ? v : [v]).forEach((o) => { if (o && o.isMesh) keep.add(o); }); }
    m.root.updateMatrixWorld(true);
    const bones = []; m.root.traverse((o) => { if (o.isBone) bones.push(o); }); if (!bones.length) return;
    const bi = new Map(bones.map((b, i) => [b, i])), byMat = new Map(), victims = [];
    m.root.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || keep.has(o)) return;
      let a = o.parent, ok = true; while (a && !a.isBone) { if (a.isMesh && keep.has(a)) ok = false; if (a === m.root) break; a = a.parent; }
      if (!ok || !a || !a.isBone) return;
      let l = byMat.get(o.material); if (!l) byMat.set(o.material, (l = [])); l.push({ geo: o.geometry, mx: o.matrixWorld.clone(), b: bi.get(a) }); victims.push(o);
    });
    const skel = new THREE.Skeleton(bones);
    for (const [mat, list] of byMat) {
      const parts = list.map(({ geo, mx, b }) => { const g2 = geo.index ? geo.toNonIndexed() : geo.clone(); g2.applyMatrix4(mx); return { g2, b }; });
      let n = 0; parts.forEach(({ g2 }) => (n += g2.attributes.position.count));
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); let o = 0;
      parts.forEach(({ g2, b }) => { const c = g2.attributes.position.count; pos.set(g2.attributes.position.array, o * 3); if (g2.attributes.normal) nor.set(g2.attributes.normal.array, o * 3); if (g2.attributes.uv) uv.set(g2.attributes.uv.array, o * 2); for (let i = 0; i < c; i++) { si[(o + i) * 4] = b; sw[(o + i) * 4] = 1; } o += c; g2.dispose(); });
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      mg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); mg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      const sm = new THREE.SkinnedMesh(mg, mat); sm.frustumCulled = false; m.root.add(sm); sm.bind(skel, new THREE.Matrix4());
    }
    victims.forEach((v) => { if (v.parent) v.parent.remove(v); });
    m.skinned = true;
  }
  const dyn = (sp) => { sp.userData.dyn = true; return sp; };
  // squelette commun : racine → corps → bassin ; poses de base appliquées à chaque image
  function base(id, hero) { const root = new THREE.Group(), body = J(root); return { root, body, heroId: id, hero, custom: null }; }
  function commonBody(m, A, o) {
    // apparition, élimination, roulade, saut, étourdissement : appliqués au corps entier
    const b = m.body; b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1);
    if (A.roll >= 0) { b.rotation.x = A.roll * TAU; b.position.y = 0.45 * Math.sin(A.roll * Math.PI); }
    if (A.death >= 0) { const k = out3(A.death / 0.7); b.rotation.x = -k * (o.fall || 1.45); b.position.y = -k * 0.2; b.rotation.z = k * (o.twist || 0.25); }
    if (A.stun) b.rotation.z += Math.sin(A.t * 9) * 0.06;
    if (A.frozen) b.scale.set(1.02, 0.98, 1.02);
    if (A.hit > 0) { b.position.z -= A.hit * 0.08; b.rotation.x -= A.hit * 0.12; }
  }

  /* ============================================================================
     🔥 IGNIS — forgeron volcanique. Armure de fer noir fissurée de lave, marteau géant, crête de flammes.
     Personnalité : lourd, sûr de lui. Pas pesants, souffle, pose le marteau au sol.
     ============================================================================ */
  const IGNIS = {
    step: 7.2, atkDur: 0.52, spawnDur: 1.0,
    build(skin, lite) {
      lod(lite); const L = G.getLook('ignis', skin), sk = G.SKIN[skin] || {}, m = base('ignis', IGNIS);
      const iron = std({ c: L.body, m: 0.85, r: 0.42, map: tMetal(L.body), emap: tLava(), e: L.hair, ei: 0.9, env: 1.1 });
      const ironD = std({ c: L.body2, m: 0.8, r: 0.5, map: tMetal(L.body2), env: 0.9 });
      const leather = std({ c: '#4a2e1e', r: 0.85, map: tLeather('#4a2e1e') });
      const skinM = std({ c: L.skin, r: 0.9, emap: tLava(), e: L.hair, ei: 0.35 });
      const gold = std({ c: L.accent, m: 1, r: 0.25, e: L.accent, ei: 0.35 });
      const fire = energy(L.hair, 0.95, true), fire2 = energy('#ffe48a', 0.95, true), slit = energy('#ffd86a');
      const hips = J(m.body, [0, 0.62, 0]); m.hips = hips;
      m.legs = [-1, 1].map((sd) => {
        const th = J(hips, [sd * 0.2, 0, 0]); P(th, GE.cap, leather, [0.14, 0.12, 0.14], [0, -0.14, 0], null, true);
        const kn = J(th, [0, -0.3, 0]); P(kn, GE.sph, ironD, [0.13, 0.11, 0.13], [0, 0, 0.06], null, true); P(kn, GE.cap, leather, [0.12, 0.08, 0.12], [0, -0.1, 0], null, true);
        const ft = J(kn, [0, -0.24, 0]); P(ft, GE.box, ironD, [0.27, 0.13, 0.38], [0, -0.02, 0.06], null, true); P(ft, GE.sph, iron, [0.14, 0.1, 0.12], [0, 0.02, 0.2], null, true);
        return { th, kn, ft };
      });
      const torso = J(hips, [0, 0.02, 0]); m.torso = torso;
      P(torso, GE.taper, leather, [0.36, 0.28, 0.32], [0, 0.1, 0], null, true);
      P(torso, GE.box, leather, [0.36, 0.42, 0.05], [0, -0.06, 0.31], [0.12, 0, 0], true); // tablier
      P(torso, GE.tor, ironD, [0.38, 0.38, 0.5], [0, 0.22, 0], [Math.PI / 2, 0, 0]);
      const buckle = P(torso, GE.box, gold, [0.16, 0.12, 0.05], [0, 0.22, 0.39], null, true);
      const chest = J(torso, [0, 0.26, 0]); m.chest = chest;
      P(chest, GE.sph, iron, [0.55, 0.46, 0.45], [0, 0.26, 0], null, true);
      const emb = P(chest, GE.oct, gold, [0.1, 0.13, 0.04], [0, 0.32, 0.44], null, true); // emblème d'enclume
      P(chest, GE.cyl, skinM, [0.2, 0.12, 0.2], [0, 0.7, 0], null, true);
      // tête : visage charbonneux, heaume, fente lumineuse en T, barbe de braises, crête de flammes
      const head = J(chest, [0, 0.95, 0.02]); m.head = head;
      P(head, GE.sph, skinM, [0.34, 0.33, 0.32], [0, 0, 0], null, true);
      P(head, GE.half, iron, [0.37, 0.32, 0.36], [0, 0.03, 0], null, true);
      P(head, GE.box, ironD, [0.46, 0.2, 0.1], [0, -0.02, 0.27], [0.08, 0, 0], true);
      m.eyes = [P(head, GE.box, slit, [0.36, 0.04, 0.03], [0, 0.02, 0.33]), P(head, GE.box, slit, [0.045, 0.13, 0.03], [0, -0.05, 0.33])];
      m.sprites0 = [sprite(head, L.accent, 0.5, [0, 0, 0.38], 0.7)];
      for (let i = 0; i < 3; i++) { const bd = P(head, GE.cone, skinM, [0.06, 0.2, 0.06], [(i - 1) * 0.1, -0.33, 0.2], [Math.PI, 0, (i - 1) * 0.25], true); P(bd, GE.sph, fire2, [0.5, 0.25, 0.5], [0, -0.45, 0]); }
      m.flames = [];
      for (let i = 0; i < 5; i++) { const f = J(head, [0, 0.33 - Math.abs(i - 2) * 0.02, 0.2 - i * 0.12], [-0.3 + i * 0.16, 0, 0]); P(f, GE.cone, fire, [0.1, 0.36 + (2 - Math.abs(i - 2)) * 0.08, 0.1], [0, 0.17, 0]); P(f, GE.cone, fire2, [0.05, 0.2, 0.05], [0, 0.1, 0.01]); m.flames.push(f); }
      // épaulières, bras, gantelets
      m.arms = [-1, 1].map((sd) => {
        const pa = J(chest, [sd * 0.58, 0.44, 0]); P(pa, GE.half, iron, [0.28, 0.24, 0.3], [0, 0.02, 0], [0, 0, -sd * 0.35], true); P(pa, GE.cone, ironD, [0.06, 0.16, 0.06], [sd * 0.12, 0.24, 0], [0, 0, -sd * 0.5], true);
        const sh = J(chest, [sd * 0.6, 0.36, 0]); P(sh, GE.cap, leather, [0.11, 0.12, 0.11], [0, -0.15, 0], null, true);
        const el = J(sh, [0, -0.32, 0]); P(el, GE.taper, iron, [0.15, 0.3, 0.15], [0, -0.13, 0], [Math.PI, 0, 0], true); const fist = J(el, [0, -0.32, 0]); P(fist, GE.sph, ironD, [0.14, 0.13, 0.14], [0, 0, 0], null, true);
        return { sh, el, fist };
      });
      // marteau : manche gainé, tête de fer à runes incandescentes
      const hm = J(m.arms[1].fist, [0, 0, 0]); m.hammer = hm;
      P(hm, GE.cyl, leather, [0.04, 0.78, 0.04], [0, -0.34, 0], null, true);
      const hh = J(hm, [0, -0.74, 0]); m.hhead = hh;
      P(hh, GE.box, iron, [0.48, 0.27, 0.28], [0, 0, 0], null, true);
      [-1, 1].forEach((s) => { P(hh, GE.cyl, ironD, [0.17, 0.08, 0.17], [s * 0.27, 0, 0], [0, 0, Math.PI / 2], true); P(hh, GE.cyl, energy(L.accent), [0.1, 0.02, 0.1], [s * 0.315, 0, 0], [0, 0, Math.PI / 2]); });
      P(hh, GE.box, fire2, [0.3, 0.03, 0.01], [0, 0.05, 0.145]); P(hh, GE.box, fire2, [0.3, 0.03, 0.01], [0, -0.05, 0.145]);
      m.hglow = dyn(sprite(hh, L.hair, 0.8, [0, 0, 0.1], 0.55));
      // braises qui s'élèvent
      m.embers = []; for (let i = 0; i < (LITE ? 3 : 7); i++) m.embers.push(dyn(sprite(m.root, i % 2 ? L.hair : '#ffd86a', 0.12, [0, 0, 0], 0.9)));
      m.fx = sk.fx || null; m.buckle = buckle; m.emb = emb; collect(m);
      m.custom = IGNIS; m.root.userData.prism = 'ignis';
      return m;
    },
    animate(m, st) {
      const A = drive(m, st), t = A.t;
      commonBody(m, A, { fall: 1.3, twist: 0.4 });
      const { hips, torso, chest, head, legs, arms } = m;
      let hy = 0.62, tx = 0, tz = 0, ty = 0, hx = 0, hyaw = 0;
      const br = Math.sin(t * 1.6);
      // attente : souffle lourd, épaules qui roulent
      chest.scale.set(1 + br * 0.015, 1 + br * 0.025, 1 + br * 0.015); hy += br * 0.008;
      let la = [0.12, 0, 0.18], ra = [0.25, 0, -0.12], le = [-0.25, 0], re = [-0.35, 0], hamX = -0.15, hamZ = 0;
      hyaw = Math.sin(t * 0.5) * 0.25 * (A.lobby ? 1 : 0.3);
      // course : foulée lourde, buste penché, marteau traîné en arrière
      const R = A.run, sw = Math.sin(A.ph);
      hy += -Math.abs(Math.cos(A.ph)) * 0.07 * R + 0.035 * R; tx += 0.24 * R * A.fwd - 0.12 * R * (1 - A.fwd); tz += -A.strafe * 0.14 * R; ty += sw * 0.12 * R - A.turn * 0.25;
      la = [lerp(la[0], -sw * 0.75, R), 0, lerp(la[2], 0.25, R)]; ra = [lerp(ra[0], 0.55 + sw * 0.25, R), 0, lerp(ra[2], -0.18, R)]; le = [lerp(le[0], -0.6 - sw * 0.2, R), 0]; hamX = lerp(hamX, 0.6, R);
      // rechargement : frappe le gantelet contre le marteau
      if (A.reload > 0.01) { const k = A.reload, tap = Math.abs(Math.sin(t * 7)); la = [lerp(la[0], -1.0, k), 0, lerp(la[2], -0.35, k)]; le = [lerp(le[0], -1.2 + tap * 0.3, k), 0]; ra = [lerp(ra[0], -0.6, k), 0, ra[2]]; re = [lerp(re[0], -1.1, k), 0]; hamX = lerp(hamX, -0.3, k); }
      // attaque : marteau levé derrière la tête puis abattu devant (anticipation → impact → retour)
      if (A.atk >= 0 || A.atkW > 0) {
        const k = Math.max(0, A.atk), w = A.atkW, up = ease(clamp(k / 0.38, 0, 1)), dn = out3(clamp((k - 0.38) / 0.16, 0, 1)), back = ease(clamp((k - 0.62) / 0.38, 0, 1));
        const armX = k < 0.38 ? lerp(0.25, -3.0, up) : k < 0.54 ? lerp(-3.0, -1.05, dn) : lerp(-1.05, 0.25, back);
        ra = [lerp(ra[0], armX, w), 0, lerp(ra[2], -0.05, w)]; re = [lerp(re[0], k < 0.38 ? -0.6 : -0.1, w), 0];
        la = [lerp(la[0], k < 0.54 ? -2.2 * up * (1 - dn * 0.5) : -1.1 * (1 - back), w), 0, la[2]];
        tx += w * (k < 0.38 ? -0.22 * up : 0.42 * dn * (1 - back) - 0.22 * up * (1 - dn)); hy -= w * 0.1 * dn * (1 - back); hamX = lerp(hamX, 0, w);
      }
      // coup reçu
      tx -= A.hit * 0.25; hx -= A.hit * 0.2;
      // gestes d'attente : pose le marteau sur l'épaule / fait craquer ses poings
      if (A.fid) { const k = A.fid.w; if (A.fid.k === 0) { ra = [lerp(ra[0], -2.6, k), 0, lerp(ra[2], 0.5, k)]; re = [lerp(re[0], -2.2, k), 0]; hyaw += k * 0.4; } else { la = [lerp(la[0], -1.3, k), 0, lerp(la[2], -0.6, k)]; ra = [lerp(ra[0], -1.3, k), 0, lerp(ra[2], 0.6, k)]; le = [lerp(le[0], -1.5, k), 0]; re = [lerp(re[0], -1.5, k), 0]; chest.scale.y += Math.sin(A.fid.p * 30) * 0.01 * k; } }
      // réaction au toucher : frappe le sol, les flammes jaillissent
      if (A.poke >= 0) { const k = pulse(A.poke, 0, 1.4), s = A.poke < 0.5 ? ease(A.poke / 0.5) : 1 - ease(clamp((A.poke - 0.5) / 0.4, 0, 1)); ra = [lerp(ra[0], -2.9 * s + (1 - s) * -0.8, k), 0, ra[2]]; hy += Math.sin(A.poke * 9) * 0.05 * k; hx -= 0.2 * k; }
      // victoire : marteau brandi, poing levé, sauts lourds ; défaite : à genoux appuyé sur le marteau
      if (A.win > 0.01) { const k = A.win, j = Math.abs(Math.sin(t * 3.2)); ra = [lerp(ra[0], -3.05, k), 0, lerp(ra[2], -0.25, k)]; re = [lerp(re[0], 0, k), 0]; la = [lerp(la[0], -0.3 + Math.sin(t * 6.4) * 0.5, k), 0, lerp(la[2], 1.2, k)]; hy += j * 0.22 * k; hx -= 0.2 * k; ty += Math.sin(t * 1.6) * 0.3 * k; }
      if (A.lose > 0.01) { const k = A.lose; hy -= 0.26 * k; tx += 0.35 * k; hx += 0.4 * k; ra = [lerp(ra[0], -0.9, k), 0, ra[2]]; re = [lerp(re[0], -0.6, k), 0]; la = [lerp(la[0], 0.3, k), 0, lerp(la[2], 0.1, k)]; }
      // apparition : surgit du sol dans un jaillissement de lave, atterrissage écrasé
      if (A.spawn < 1) { const k = A.spawn, rise = out3(clamp(k / 0.55, 0, 1)); m.body.position.y += (rise - 1) * 1.4; const land = pulse(k, 0.5, 0.85); m.body.scale.set(1 + land * 0.12, 1 - land * 0.14, 1 + land * 0.12); }
      hips.position.y = hy; torso.rotation.set(tx, ty, tz); head.rotation.set(hx - tx * 0.4, hyaw - ty * 0.6, -tz * 0.5);
      legs.forEach((l, i) => { const c = legCycle(A, i ? 1 : -1, 0.7); const kneel = A.lose * (i ? 1.4 : 0.2); l.th.rotation.set(-c.x - kneel * 0.9 + A.win * 0.05, 0, c.z + (i ? -1 : 1) * 0.04); l.kn.rotation.set(c.knee + kneel * 1.5, 0, 0); l.ft.rotation.set(c.x * 0.4 - c.knee * 0.4 + kneel * -0.5, 0, 0); });
      arms[0].sh.rotation.set(la[0], la[1], la[2]); arms[0].el.rotation.set(le[0], 0, 0);
      arms[1].sh.rotation.set(ra[0], ra[1], ra[2]); arms[1].el.rotation.set(re[0], 0, 0);
      m.hammer.rotation.set(hamX, 0, hamZ);
      // flammes, braises, lueur (plus vives quand la super est prête ou en victoire)
      const glow = (A.sup ? 1.25 + Math.sin(t * 8) * 0.2 : 1) * (1 + A.win * 0.4) * (1 - A.lose * 0.55) * (A.death >= 0 ? 1 - A.death : 1) * (A.lobby ? 1 : 1.6); // en combat : lave plus vive (lisibilité)
      m.flames.forEach((f, i) => { const fl = 1 + Math.sin(t * 17 + i * 1.9) * 0.16 + Math.sin(t * 7.3 + i) * 0.1; f.scale.set(1, fl * glow * (1 + A.win * 0.5), 1); });
      m.embers.forEach((e, i) => { const life = ((t * 0.55 + i * 0.137 * 7) % 1), a = i * 2.39 + t * 0.4; e.position.set(Math.cos(a) * (0.35 + life * 0.25), 0.5 + life * 1.9, Math.sin(a) * (0.3 + life * 0.2) - 0.05); e.scale.setScalar(0.11 * (1 - life) * (A.lobby ? 1 : 1.6)); e.material.opacity = (1 - life) * 0.9 * glow; });
      m.eyes.forEach((e) => e.scale.y = (((t * 0.5) % 4) < 0.1 || A.hit > 0.3 ? 0.012 : 0.04) * (e === m.eyes[1] ? 3.2 : 1));
      m.hglow.material.opacity = 0.35 + 0.4 * (A.atkW * pulse(Math.max(0, A.atk), 0.35, 0.8) + (A.sup ? 0.4 : 0));
      fxMats(m, A, glow);
    },
  };

  /* ============================================================================
     ⚡ NYX-7 — androïde spectrale. Céramique blanche, articulations graphite, coutures d'énergie, lames, drone.
     Personnalité : vive, précise, un peu robotique (mouvements de tête saccadés).
     ============================================================================ */
  const NYX = {
    step: 10.5, atkDur: 0.34, spawnDur: 0.9,
    build(skin, lite) {
      lod(lite); const L = G.getLook('nyx', skin), sk = G.SKIN[skin] || {}, m = base('nyx', NYX);
      const cer = std({ c: L.body, m: 0.05, r: 0.22, map: tCeramic(L.body), emap: tSeams(), e: L.accent, ei: 0.9, phys: true, cc: 0.8, env: 1.2 });
      const gra = std({ c: L.body2, m: 0.75, r: 0.35, map: tMetal(L.body2), env: 1 });
      const glass = std({ c: '#0b1220', m: 0.3, r: 0.05, phys: true, cc: 1, env: 1.6 });
      const en = energy(L.accent), enA = energy(L.accent, 0.5, true), core = energy('#eaffff');
      const hips = J(m.body, [0, 0.66, 0]); m.hips = hips;
      m.legs = [-1, 1].map((sd) => {
        const th = J(hips, [sd * 0.13, 0, 0]); P(th, GE.cap, gra, [0.075, 0.12, 0.075], [0, -0.15, 0], null, true);
        const kn = J(th, [0, -0.33, 0]); P(kn, GE.sph, cer, [0.085, 0.085, 0.085], [0, 0, 0.01], null, true); P(kn, GE.torT, en, [0.09, 0.09, 0.09], [0, 0, 0], [Math.PI / 2, 0, 0]);
        P(kn, GE.taper, cer, [0.085, 0.27, 0.085], [0, -0.14, 0], [Math.PI, 0, 0], true);
        const ft = J(kn, [0, -0.3, 0]); P(ft, GE.box, cer, [0.1, 0.06, 0.25], [0, -0.01, 0.05], null, true); P(ft, GE.box, en, [0.02, 0.02, 0.2], [0, 0.025, 0.05]);
        return { th, kn, ft };
      });
      const torso = J(hips, [0, 0.02, 0]); m.torso = torso;
      P(torso, GE.cyl, gra, [0.12, 0.2, 0.1], [0, 0.1, 0], null, true); P(torso, GE.torT, en, [0.13, 0.13, 0.13], [0, 0.12, 0], [Math.PI / 2, 0, 0]);
      P(torso, GE.sph, cer, [0.17, 0.09, 0.13], [0, 0.01, 0], null, true);
      const chest = J(torso, [0, 0.2, 0]); m.chest = chest;
      P(chest, GE.sph, cer, [0.3, 0.27, 0.22], [0, 0.2, 0], null, true);
      P(chest, GE.cyl, core, [0.05, 0.03, 0.05], [0, 0.22, 0.21], [Math.PI / 2, 0, 0]); m.coreS = sprite(chest, L.accent, 0.35, [0, 0.22, 0.25], 0.8);
      [-1, 1].forEach((s) => { const fin = P(chest, GE.box, cer, [0.035, 0.46, 0.13], [s * 0.13, 0.32, -0.22], [0.35, 0, s * 0.55], true); P(fin, GE.box, en, [1.4, 0.95, 0.15], [0, 0, -0.5]); });
      // ruban d'énergie (écharpe) — 3 segments enchaînés
      m.scarf = []; let par = J(chest, [0, 0.42, -0.12]);
      for (let i = 0; i < 3; i++) { const s = J(par, i ? [0, 0, -0.2] : [0, 0, 0]); P(s, GE.box, enA, [0.14 - i * 0.025, 0.015, 0.22], [0, 0, -0.1]); m.scarf.push(s); par = s; }
      // tête : casque céramique, visière de verre fumé, yeux pixels, ailettes-antennes, « cheveux » spectraux
      const head = J(chest, [0, 0.66, 0.01]); m.head = head;
      P(head, GE.sph, cer, [0.29, 0.31, 0.29], [0, 0, 0], null, true);
      P(head, GE.sph, glass, [0.25, 0.13, 0.17], [0, -0.01, 0.15], null, false);
      m.eyes = [-1, 1].map((s) => P(head, GE.box, en, [0.075, 0.035, 0.01], [s * 0.085, 0.0, 0.315]));
      P(head, GE.box, enA, [0.36, 0.012, 0.01], [0, -0.06, 0.3]);
      [-1, 1].forEach((s) => { P(head, GE.box, cer, [0.04, 0.16, 0.12], [s * 0.29, 0.06, -0.04], [0.5, 0, -s * 0.25], true); sprite(head, L.accent, 0.13, [s * 0.32, 0.15, -0.0], 0.7); });
      m.hair = []; for (let i = 0; i < 4; i++) { const h = J(head, [(i - 1.5) * 0.09, 0.18, -0.18], [-1.9 - Math.abs(i - 1.5) * 0.15, 0, (i - 1.5) * 0.18]); P(h, GE.cone, enA, [0.07, 0.5, 0.07], [0, 0.24, 0]); m.hair.push(h); }
      // bras : avant-bras céramique, lames d'énergie
      m.arms = [-1, 1].map((sd) => {
        const sh = J(chest, [sd * 0.33, 0.36, 0]); P(sh, GE.sph, cer, [0.13, 0.11, 0.13], [sd * 0.02, 0.03, 0], null, true); P(sh, GE.cap, gra, [0.055, 0.1, 0.055], [0, -0.14, 0], null, true);
        const el = J(sh, [0, -0.29, 0]); P(el, GE.taper, cer, [0.08, 0.24, 0.08], [0, -0.11, 0], null, true); P(el, GE.sph, gra, [0.06, 0.06, 0.06], [0, -0.26, 0], null, true);
        const bl = J(el, [sd * 0.07, -0.12, 0.02], [-0.25, 0, 0]);
        P(bl, GE.box, core, [0.025, 0.86, 0.06], [0, -0.45, 0]); P(bl, GE.box, enA, [0.07, 0.94, 0.15], [0, -0.45, 0]);
        const tip = sprite(bl, L.accent, 0.38, [0, -0.9, 0], 0.85);
        return { sh, el, bl, tip };
      });
      // drone compagnon
      const dr = J(m.root, [-0.6, 1.55, -0.1]); m.drone = dr;
      P(dr, GE.sph, cer, [0.1, 0.1, 0.1], null, null, true); P(dr, GE.torT, en, [0.15, 0.15, 0.15], null, [Math.PI / 2, 0, 0]); P(dr, GE.sph, core, [0.04, 0.04, 0.02], [0, 0, 0.09]); sprite(dr, L.accent, 0.3, [0, 0, 0.1], 0.6);
      m.root.scale.setScalar(1.1); m.fx = sk.fx || null; collect(m); m.custom = NYX; m.root.userData.prism = 'nyx';
      return m;
    },
    animate(m, st) {
      const A = drive(m, st), t = A.t, R = A.run;
      commonBody(m, A, { fall: 1.5, twist: -0.5 });
      const { hips, torso, chest, head, legs, arms } = m;
      let hy = 0.66, tx = 0.05, ty = 0, tz = 0, hx = 0, hyaw = 0, hroll = 0, blade = 0.55;
      // attente : rebond léger sur la pointe des pieds, transfert de poids, tête qui « scanne » par à-coups
      const bounce = Math.abs(Math.sin(t * 3.1)) * 0.015; hy += bounce; tz += Math.sin(t * 1.3) * 0.05;
      const snap = Math.floor(t * 0.9 + 0.3); hyaw = ((snap * 7919) % 5 - 2) * 0.13 * (A.lobby ? 1 : 0.4); hroll = ((snap * 104729) % 3 - 1) * 0.08;
      let la = [0.15, 0, 0.25], ra = [0.15, 0, -0.25], le = [-0.5, 0], re = [-0.5, 0];
      // course : penchée en avant, bras en arrière, lames qui traînent
      const sw = Math.sin(A.ph);
      tx += R * 0.45 * A.fwd - R * 0.2 * (1 - A.fwd); tz += -A.strafe * 0.25 * R; ty += -A.turn * 0.35; hy += -Math.abs(Math.cos(A.ph)) * 0.045 * R;
      la = [lerp(la[0], 1.15 + sw * 0.15, R), 0, lerp(la[2], 0.35, R)]; ra = [lerp(ra[0], 1.15 - sw * 0.15, R), 0, lerp(ra[2], -0.35, R)]; le = [lerp(le[0], -0.3, R), 0]; re = [lerp(re[0], -0.3, R), 0]; hx -= R * 0.3;
      // rechargement : les lames se rallument en vacillant, la visière balaie
      if (A.reload > 0.01) { blade = lerp(blade, 0.3 + Math.abs(Math.sin(t * 22)) * 0.3, A.reload); }
      if (A.rl > 0) blade += A.rl * 0.6;
      // attaque : double taille en croix (alterne le sens), buste qui pivote
      if (A.atk >= 0 || A.atkW > 0) {
        const k = Math.max(0, A.atk), w = A.atkW, dir = A.atkN % 2 ? 1 : -1, wind = ease(clamp(k / 0.25, 0, 1)), cut = out3(clamp((k - 0.25) / 0.25, 0, 1)), rec = ease(clamp((k - 0.55) / 0.45, 0, 1));
        const ax = k < 0.25 ? lerp(0.2, -2.3, wind) : k < 0.55 ? lerp(-2.3, -0.7, cut) : lerp(-0.7, 0.2, rec), az = k < 0.25 ? lerp(0.25, 0.9, wind) : k < 0.55 ? lerp(0.9, -0.6, cut) : lerp(-0.6, 0.25, rec);
        la = [lerp(la[0], ax, w), 0, lerp(la[2], az, w)]; ra = [lerp(ra[0], ax, w), 0, lerp(ra[2], -az, w)]; le = [lerp(le[0], -0.2, w), 0]; re = [lerp(re[0], -0.2, w), 0];
        ty += w * dir * (k < 0.25 ? -0.4 * wind : 0.5 * cut * (1 - rec)); tx += w * 0.25 * cut * (1 - rec); blade = lerp(blade, 1.25, w);
      }
      if (A.dash) { tx += 0.7; la = [1.5, 0, 0.3]; ra = [1.5, 0, -0.3]; blade = 1.3; }
      tx -= A.hit * 0.3; hroll += A.hit * 0.3;
      // gestes : moulinet de lame / ajustement de visière
      if (A.fid) { const k = A.fid.w; if (A.fid.k === 0) { ra = [lerp(ra[0], -1.4, k), A.fid.p * TAU * 2 * k, lerp(ra[2], -0.2, k)]; re = [lerp(re[0], -0.9, k), 0]; blade = lerp(blade, 1.1, k); } else { la = [lerp(la[0], -2.2, k), 0, lerp(la[2], -0.2, k)]; le = [lerp(le[0], -2.0, k), 0]; hroll += k * 0.2; } }
      if (A.poke >= 0) { const k = pulse(A.poke, 0, 1.4); m.body.rotation.y += ease(clamp(A.poke / 0.7, 0, 1)) * TAU; hy += Math.sin(clamp(A.poke / 0.7, 0, 1) * Math.PI) * 0.35; la = [lerp(la[0], -2.6, k), 0, lerp(la[2], 1.1, k)]; ra = [lerp(ra[0], -2.6, k), 0, lerp(ra[2], -1.1, k)]; blade = lerp(blade, 1.3, k); }
      // victoire : pirouette lames déployées puis pose ; défaite : bug d'affichage, à genoux
      if (A.win > 0.01) { const k = A.win, cyc = (t * 0.6) % 1; m.body.rotation.y += ease(clamp(cyc / 0.35, 0, 1)) * TAU * k; hy += Math.sin(clamp(cyc / 0.35, 0, 1) * Math.PI) * 0.3 * k; la = [lerp(la[0], -1.4, k), 0, lerp(la[2], 1.3, k)]; ra = [lerp(ra[0], -2.9, k), 0, lerp(ra[2], -0.2, k)]; blade = lerp(blade, 1.3, k); hx -= 0.15 * k; }
      if (A.lose > 0.01) { const k = A.lose, gl = Math.sin(t * 43) > 0.85 ? 1 : 0; hy -= 0.22 * k; tx += 0.4 * k; hx += 0.4 * k; la = [lerp(la[0], 0.1, k), 0, lerp(la[2], 0.1, k)]; ra = [lerp(ra[0], 0.1, k), 0, lerp(ra[2], -0.1, k)]; blade = lerp(blade, 0.15 * gl, k); m.body.position.x += gl * 0.04 * k; hroll += gl * 0.3 * k; }
      // apparition : matérialisation (ligne de lumière qui s'élargit)
      if (A.spawn < 1) { const k = A.spawn, w = out3(clamp((k - 0.1) / 0.6, 0, 1)); m.body.scale.set(Math.max(0.02, w), 1 + (1 - w) * 0.6, Math.max(0.02, w)); }
      hips.position.y = hy; torso.rotation.set(tx, ty, tz); head.rotation.set(hx - tx * 0.6, hyaw - ty * 0.7, hroll - tz * 0.4);
      legs.forEach((l, i) => { const c = legCycle(A, i ? 1 : -1, 0.95); const kneel = A.lose * (i ? 1.5 : 0.3); l.th.rotation.set(-c.x - 0.12 - kneel * 0.8, 0, c.z + (i ? -1 : 1) * (0.03 + Math.sin(t * 1.3) * 0.02)); l.kn.rotation.set(c.knee + 0.18 + kneel * 1.6, 0, 0); l.ft.rotation.set(c.x * 0.5 - c.knee * 0.5 - 0.06, 0, 0); });
      arms[0].sh.rotation.set(la[0], la[1], la[2]); arms[0].el.rotation.set(le[0], 0, 0); arms[1].sh.rotation.set(ra[0], ra[1], ra[2]); arms[1].el.rotation.set(re[0], 0, 0);
      arms.forEach((a) => { a.bl.scale.set(1, Math.max(0.05, blade), 1); });
      m.scarf.forEach((s, i) => s.rotation.set(0.2 + R * 0.5 + Math.sin(t * 5 - i * 0.9) * (0.15 + R * 0.2) - tx * 0.6, Math.sin(t * 2.7 - i) * 0.25, 0));
      m.hair.forEach((h, i) => h.rotation.z = (i - 1.5) * 0.18 + Math.sin(t * 3 + i) * 0.08);
      const da = t * 1.4; m.drone.position.set(Math.cos(da) * 0.62, 1.55 + Math.sin(t * 2.3) * 0.08 + A.win * 0.3, Math.sin(da) * 0.35 - 0.1); m.drone.rotation.y = da + Math.PI / 2;
      const blink = ((t * 0.45) % 3.7) < 0.08 || A.hit > 0.4; m.eyes.forEach((e) => { e.scale.y = blink ? 0.008 : A.win > 0.5 ? 0.02 : 0.035; e.rotation.z = A.win > 0.5 ? 0.4 * (e === m.eyes[0] ? 1 : -1) : 0; });
      const glow = (A.sup ? 1.3 + Math.sin(t * 9) * 0.25 : 1) * (1 - A.lose * 0.5) * (A.death >= 0 ? 1 - A.death : 1);
      m.coreS.scale.setScalar(0.35 * (1 + Math.sin(t * 6) * 0.15) * glow);
      fxMats(m, A, glow);
    },
  };

  /* ============================================================================
     💎 LUMEN — mage prismatique en lévitation. Robe brodée, col d'or, cape, couronne de cristaux, prisme flottant,
     cristaux en orbite. Personnalité : gracieuse, calme, théâtrale.
     ============================================================================ */
  const LUMEN = {
    step: 5.2, atkDur: 0.46, spawnDur: 1.1,
    build(skin, lite) {
      lod(lite); const L = G.getLook('lumen', skin), sk = G.SKIN[skin] || {}, m = base('lumen', LUMEN);
      const fab = std({ c: L.body, r: 0.78, map: tFabric(L.body, '#ffd76a'), side: THREE.DoubleSide });
      const fab2 = std({ c: L.body2, r: 0.8, map: tFabric(L.body2, L.accent), side: THREE.DoubleSide, e: L.accent, ei: 0.08 });
      const gold = std({ c: '#ffcf5a', m: 1, r: 0.22, env: 1.3, side: THREE.DoubleSide });
      const skinM = std({ c: L.skin, r: 0.45, e: L.hair, ei: 0.08, phys: true, cc: 0.3 });
      const hairM = std({ c: L.hair, r: 0.35, e: L.hair, ei: 0.22, phys: true, cc: 0.5 });
      const crys = (c) => std({ c, m: 0.1, r: 0.04, e: c, ei: 0.55, flat: true, phys: true, cc: 1, env: 1.8, op: 0.92 });
      const hips = J(m.body, [0, 0.8, 0]); m.hips = hips;
      // robe en cloche (tour), ourlet doré, lueur de lévitation
      const robe = J(hips, [0, 0.02, 0]); m.robe = robe;
      const prof = []; for (let i = 0; i <= 10; i++) { const k = i / 10; prof.push(new THREE.Vector2(0.17 + Math.pow(k, 1.6) * 0.3 + Math.sin(k * 9) * 0.006, -k * 0.66)); }
      P(robe, new THREE.LatheGeometry(prof, LITE ? 12 : 28), fab, null, null, null, 1.04);
      P(robe, GE.tor, gold, [0.47, 0.47, 0.25], [0, -0.66, 0], [Math.PI / 2, 0, 0]);
      m.under = dyn(sprite(hips, L.accent, 1.1, [0, -0.74, 0], 0.55));
      m.ring = P(m.root, GE.torT, energy(L.accent, 0.6, true), [0.42, 0.42, 0.42], [0, 0.04, 0], [Math.PI / 2, 0, 0]);
      const torso = J(hips, [0, 0.02, 0]); m.torso = torso;
      const chest = J(torso, [0, 0, 0]); m.chest = chest;
      P(chest, GE.sph, fab, [0.21, 0.25, 0.17], [0, 0.18, 0], null, true); P(chest, GE.tor, gold, [0.18, 0.18, 0.3], [0, 0.02, 0], [Math.PI / 2, 0, 0]);
      P(chest, GE.oct, crys(L.accent), [0.05, 0.08, 0.03], [0, 0.22, 0.17]);
      P(chest, new THREE.CylinderGeometry(0.15, 0.2, 0.2, SEG, 1, true, -2.3, 4.6), gold, null, [0, 0.42, -0.01], null, 1.04);
      // cape
      const cape = J(chest, [0, 0.38, -0.05]); m.cape = cape;
      P(cape, new THREE.CylinderGeometry(0.2, 0.46, 1.0, SEG, LITE ? 2 : 4, true, Math.PI * 0.62, Math.PI * 0.76), fab2, null, [0, -0.5, -0.02], null, 1.03);
      // tête
      const head = J(chest, [0, 0.66, 0.01]); m.head = head;
      P(head, GE.sph, skinM, [0.26, 0.27, 0.25], null, null, true);
      P(head, GE.sph, hairM, [0.28, 0.29, 0.25], [0, 0.03, -0.05], null, true);
      [[-0.12, 0.17, 0.15], [0.02, 0.2, 0.17], [0.14, 0.16, 0.14]].forEach((p, i) => P(head, GE.sph, hairM, [0.1, 0.07, 0.07], p, [0, 0, (i - 1) * 0.5], true));
      m.locks = [-1, 1].map((s) => { const l = J(head, [s * 0.22, -0.02, 0.02]); P(l, GE.cap, hairM, [0.055, 0.17, 0.055], [0, -0.17, 0], null, true); return l; });
      m.tail = []; let tp = J(head, [0, 0.05, -0.22]); for (let i = 0; i < 3; i++) { const s = J(tp, i ? [0, -0.2, 0] : [0, 0, 0]); P(s, GE.sph, hairM, [0.09 - i * 0.015, 0.14, 0.09 - i * 0.015], [0, -0.1, 0], null, true); m.tail.push(s); tp = s; }
      const iris = energy(L.accent);
      m.eyes = [-1, 1].map((s) => { const e = J(head, [s * 0.095, -0.01, 0.215]); P(e, GE.sph, std({ c: '#ffffff', r: 0.3 }), [0.06, 0.075, 0.03]); P(e, GE.sph, iris, [0.04, 0.052, 0.02], [0, -0.005, 0.02]); P(e, GE.sph, energy('#ffffff'), [0.012, 0.014, 0.01], [-0.012, 0.018, 0.035]); return e; });
      P(head, GE.box, std({ c: G.mix(L.hair, '#3a2a6a', 0.6), r: 0.6 }), [0.07, 0.012, 0.012], [-0.095, 0.08, 0.235], [0, 0, 0.12]); P(head, GE.box, std({ c: G.mix(L.hair, '#3a2a6a', 0.6), r: 0.6 }), [0.07, 0.012, 0.012], [0.095, 0.08, 0.235], [0, 0, -0.12]);
      m.mouth = P(head, GE.sph, std({ c: '#c0507a', r: 0.5 }), [0.03, 0.012, 0.01], [0, -0.12, 0.235]);
      // couronne de cristaux
      m.crown = J(head, [0, 0.24, 0.04]);
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.38, h = 0.18 - Math.abs(i - 2) * 0.035; const c = P(m.crown, GE.oct, crys(i % 2 ? L.hair : L.accent), [0.045, h, 0.045], [Math.sin(a) * 0.2, h * 0.6, Math.cos(a) * 0.12], [0, 0, -a * 0.6], true); if (i === 2) sprite(m.crown, L.accent, 0.22, [0, 0.2, 0.12], 0.7); }
      // bras à manches évasées
      m.arms = [-1, 1].map((sd) => {
        const sh = J(chest, [sd * 0.23, 0.33, 0]); P(sh, GE.sph, fab, [0.08, 0.08, 0.08], null, null, true); P(sh, GE.cap, fab, [0.05, 0.08, 0.05], [0, -0.11, 0], null, true);
        const el = J(sh, [0, -0.23, 0]); P(el, new THREE.CylinderGeometry(0.11, 0.05, 0.24, SEG, 1, true), fab2, null, [0, -0.1, 0], null, 1.05); P(el, GE.torT, gold, [0.11, 0.11, 0.11], [0, -0.22, 0], [Math.PI / 2, 0, 0]);
        const hand = J(el, [0, -0.25, 0]); P(hand, GE.sph, skinM, [0.05, 0.06, 0.05], null, null, true);
        return { sh, el, hand };
      });
      // prisme flottant au-dessus de la main droite
      const pr = J(m.arms[1].hand, [0, -0.12, 0.08]); m.prism = pr;
      P(pr, GE.tri, crys('#f4f0ff'), [0.08, 0.2, 0.08], null, null, true); m.prismS = dyn(sprite(pr, '#ffffff', 0.5, null, 0.6));
      // cristaux en orbite
      m.orbs = [L.accent, L.hair, '#ffd76a'].map((c, i) => { const g = J(m.root, [0, 1, 0]); P(g, GE.oct, crys(c), [0.065, 0.15, 0.065], null, null, true); sprite(g, c, 0.42, null, 0.7); return g; });
      m.fx = sk.fx || null; collect(m); m.custom = LUMEN; m.root.userData.prism = 'lumen';
      return m;
    },
    animate(m, st) {
      const A = drive(m, st), t = A.t, R = A.run;
      commonBody(m, A, { fall: 1.2, twist: 0.6 });
      const { hips, torso, head, arms } = m;
      let fy = 0.8 + Math.sin(t * 1.8) * 0.05, tx = 0, ty = 0, tz = Math.sin(t * 0.9) * 0.04, hx = 0, hyaw = Math.sin(t * 0.45) * 0.3 * (A.lobby ? 1 : 0.3), robeX = 0, robeZ = 0, orbR = 0.72, orbS = 1, orbY = 1.0, prs = 1;
      let la = [0.2, 0, 0.35 + Math.sin(t * 1.2) * 0.08], ra = [-0.5, 0, -0.35], le = [-0.4, 0], re = [-1.0 + Math.sin(t * 1.5) * 0.1, 0];
      // glisse : penchée, robe et cape qui traînent, cristaux en sillage
      tx += R * 0.3 * A.fwd - R * 0.15 * (1 - A.fwd); tz += -A.strafe * 0.3 * R; ty += -A.turn * 0.3; fy += R * 0.08; robeX = -R * 0.35 * A.fwd + R * 0.2 * (1 - A.fwd); robeZ = A.strafe * 0.3 * R;
      la = [lerp(la[0], 0.6, R), 0, lerp(la[2], 0.6, R)]; ra = [lerp(ra[0], 0.3, R), 0, lerp(ra[2], -0.6, R)];
      if (A.reload > 0.01) { const k = A.reload; re = [lerp(re[0], -1.6, k), 0]; ra = [lerp(ra[0], -0.9 + Math.sin(t * 4) * 0.2, k), 0, ra[2]]; orbR = lerp(orbR, 0.55, k); prs += Math.sin(t * 10) * 0.15 * k; }
      if (A.rl > 0) prs += A.rl * 0.5;
      // attaque : la main pousse le prisme vers l'avant, les cristaux s'alignent
      if (A.atk >= 0 || A.atkW > 0) { const k = Math.max(0, A.atk), w = A.atkW, push = out3(clamp(k / 0.3, 0, 1)) * (1 - ease(clamp((k - 0.45) / 0.55, 0, 1))); ra = [lerp(ra[0], -1.55, w * push), 0, lerp(ra[2], -0.05, w * push)]; re = [lerp(re[0], -0.1, w * push), 0]; tx -= 0.1 * push * w; prs += push * 0.8 * w; orbR = lerp(orbR, 0.45, push * w); }
      tx -= A.hit * 0.25; hx -= A.hit * 0.2;
      // gestes : jongle avec ses cristaux / remet une mèche
      if (A.fid) { const k = A.fid.w; if (A.fid.k === 0) { orbY = lerp(orbY, 2.05, k); orbR = lerp(orbR, 0.32, k); orbS = 1 + k * 2.5; la = [lerp(la[0], -2.6, k), 0, lerp(la[2], 0.3, k)]; ra = [lerp(ra[0], -2.6, k), 0, lerp(ra[2], -0.3, k)]; hx -= 0.3 * k; } else { la = [lerp(la[0], -2.2, k), 0, lerp(la[2], -0.3, k)]; le = [lerp(le[0], -1.9, k), 0]; hyaw -= 0.3 * k; } }
      if (A.poke >= 0) { const k = pulse(A.poke, 0, 1.4); fy += k * 0.35; orbS = 1 + k * 3; orbR = lerp(orbR, 1.0, k); la = [lerp(la[0], -2.4, k), 0, lerp(la[2], 1.0, k)]; ra = [lerp(ra[0], -2.4, k), 0, lerp(ra[2], -1.0, k)]; m.body.rotation.y += Math.sin(A.poke / 1.4 * Math.PI) * 0.5; }
      // victoire : s'élève, bras ouverts, spirale de cristaux ; défaite : redescend au sol, cristaux éteints au sol
      if (A.win > 0.01) { const k = A.win; fy += 0.35 * k; la = [lerp(la[0], -2.5, k), 0, lerp(la[2], 1.2, k)]; ra = [lerp(ra[0], -2.5, k), 0, lerp(ra[2], -1.2, k)]; orbS = lerp(orbS, 3.5, k); orbY = lerp(orbY, 1.3 + Math.sin(t * 3) * 0.4, k); hx -= 0.25 * k; m.body.rotation.y += Math.sin(t * 1.2) * 0.35 * k; }
      if (A.lose > 0.01) { const k = A.lose; fy = lerp(fy, 0.6, k); hx += 0.45 * k; tx += 0.25 * k; la = [lerp(la[0], -1.7, k), 0, lerp(la[2], -0.5, k)]; le = [lerp(le[0], -1.8, k), 0]; ra = [lerp(ra[0], -1.7, k), 0, lerp(ra[2], 0.5, k)]; re = [lerp(re[0], -1.8, k), 0]; orbY = lerp(orbY, 0.1, k); orbS = lerp(orbS, 0, k); }
      // apparition : descend du ciel, les cristaux convergent
      if (A.spawn < 1) { const k = A.spawn; fy += (1 - out3(clamp(k / 0.7, 0, 1))) * 2.2; orbR = lerp(2.2, orbR, out3(k)); }
      if (A.death >= 0) { orbR = lerp(orbR, 1.6, A.death); orbY = lerp(orbY, 0.1, A.death); }
      hips.position.y = fy; torso.rotation.set(tx, ty, tz); head.rotation.set(hx - tx * 0.5, hyaw - ty * 0.6, -tz * 0.6);
      m.robe.rotation.set(robeX + Math.sin(t * 2.1) * 0.03, 0, robeZ + Math.sin(t * 1.7) * 0.03);
      m.cape.rotation.set(0.15 + R * 0.5 + Math.sin(t * 2.4) * 0.06 - tx * 0.5, 0, Math.sin(t * 1.3) * 0.05);
      m.locks.forEach((l, i) => l.rotation.set(-R * 0.3 + Math.sin(t * 2 + i) * 0.05, 0, (i ? -1 : 1) * 0.08 + Math.sin(t * 1.6 + i) * 0.05));
      m.tail.forEach((s, i) => s.rotation.set(0.3 + R * 0.5 + Math.sin(t * 2.2 - i * 0.8) * 0.12, Math.sin(t * 1.5 - i) * 0.12, 0));
      arms[0].sh.rotation.set(la[0], la[1], la[2]); arms[0].el.rotation.set(le[0], 0, 0); arms[1].sh.rotation.set(ra[0], ra[1], ra[2]); arms[1].el.rotation.set(re[0], 0, 0);
      m.prism.rotation.set(0, t * 2.2, Math.sin(t * 1.3) * 0.3); m.prism.scale.setScalar(prs); m.prismS.material.opacity = 0.4 + 0.3 * (prs - 1);
      m.orbs.forEach((g, i) => { const a = t * 1.1 * orbS + i * (TAU / 3), y = orbY + Math.sin(t * 1.7 + i * 2) * 0.12 + (A.fid && A.fid.k === 0 ? i * 0.02 : 0); g.position.set(Math.cos(a) * orbR, y + (orbY > 1.5 ? 0 : 0), Math.sin(a) * orbR * 0.8); g.rotation.set(0, a * 2, Math.sin(a) * 0.4); });
      m.ring.scale.setScalar(0.42 + Math.sin(t * 3) * 0.03 + A.win * 0.2); m.ring.position.y = 0.04;
      m.under.material.opacity = 0.35 + Math.sin(t * 4) * 0.1 + A.win * 0.3;
      const blink = ((t * 0.5 + 0.7) % 3.9) < 0.1 || A.hit > 0.4; m.eyes.forEach((e) => e.scale.set(1, blink ? 0.12 : A.lose > 0.5 ? 0.5 : 1, 1));
      m.mouth.scale.set(A.win > 0.4 || A.poke >= 0 ? 0.05 : 0.03, A.win > 0.4 || A.poke >= 0 ? 0.025 : 0.012, 0.01);
      const glow = (A.sup ? 1.3 + Math.sin(t * 7) * 0.25 : 1) * (1 + A.win * 0.4) * (1 - A.lose * 0.6) * (A.death >= 0 ? 1 - A.death : 1);
      fxMats(m, A, glow);
    },
  };

  /* ============================================================================
     🦾 KRANK — petit pilote dans un marcheur blindé à deux pattes. Peinture industrielle écaillée, verrière,
     canon rotatif à rivets, pince, pots d'échappement fumants. Personnalité : bruyant, fanfaron, maladroit.
     ============================================================================ */
  const KRANK = {
    step: 6.4, atkDur: 0.3, spawnDur: 1.0,
    build(skin, lite) {
      lod(lite); const L = G.getLook('krank', skin), sk = G.SKIN[skin] || {}, m = base('krank', KRANK);
      const paint = std({ c: L.body, m: 0.35, r: 0.48, map: tHazard(L.body), env: 0.9, cc: 0.3, phys: true });
      const gra = std({ c: L.body2, m: 0.85, r: 0.38, map: tMetal(L.body2) });
      const chrome = std({ c: '#d8dde6', m: 1, r: 0.12, env: 1.5 });
      const glass = std({ c: '#9fe8ff', m: 0, r: 0.04, op: 0.32, phys: true, cc: 1, env: 1.8 });
      const skinM = std({ c: L.skin, r: 0.6 }), cap = std({ c: L.hair, r: 0.75, map: tLeather(L.hair) }), en = energy(L.accent), scarfM = std({ c: '#e8334a', r: 0.8 });
      const hips = J(m.body, [0, 0.8, 0]); m.hips = hips;
      P(hips, GE.box, gra, [0.5, 0.16, 0.34], null, null, true);
      m.legs = [-1, 1].map((sd) => {
        const th = J(hips, [sd * 0.3, -0.02, 0]); P(th, GE.sph, gra, [0.12, 0.12, 0.12], null, null, true); P(th, GE.box, paint, [0.15, 0.42, 0.19], [0, -0.21, 0], null, true);
        const kn = J(th, [0, -0.42, 0]); P(kn, GE.cyl, gra, [0.09, 0.2, 0.09], null, [0, 0, Math.PI / 2], true);
        P(kn, GE.box, gra, [0.11, 0.42, 0.13], [0, -0.21, 0], null, true); P(kn, GE.cyl, chrome, [0.025, 0.36, 0.025], [0, -0.2, -0.09], null, false);
        const ft = J(kn, [0, -0.42, 0]); P(ft, GE.sph, gra, [0.07, 0.07, 0.07], null, null, true); P(ft, GE.box, gra, [0.24, 0.07, 0.3], [0, -0.04, 0.06], null, true);
        [-1, 1].forEach((s) => P(ft, GE.cone, paint, [0.05, 0.12, 0.05], [s * 0.07, -0.04, 0.24], [Math.PI / 2, 0, 0], true));
        return { th, kn, ft };
      });
      const torso = J(hips, [0, 0.06, 0]); m.torso = torso;
      const chest = J(torso, [0, 0, 0]); m.chest = chest;
      P(chest, GE.sph, paint, [0.52, 0.38, 0.46], [0, 0.32, 0], null, true);
      P(chest, GE.box, paint, [0.62, 0.22, 0.08], [0, 0.2, 0.42], [-0.35, 0, 0], true);
      P(chest, GE.box, en, [0.14, 0.05, 0.02], [0, 0.24, 0.47], [-0.35, 0, 0]); m.lamp = sprite(chest, L.accent, 0.5, [0, 0.24, 0.52], 0.75);
      [-1, 1].forEach((s) => { for (let i = 0; i < 3; i++) P(chest, GE.box, gra, [0.02, 0.12, 0.06], [s * 0.45, 0.3, -0.06 + i * 0.07], null, false); });
      P(chest, GE.tor, gra, [0.29, 0.29, 0.6], [0, 0.6, 0.08], [Math.PI / 2, 0, 0]);
      // pilote dans la verrière
      const pil = J(chest, [0, 0.6, 0.1]); m.pilot = pil;
      const ph = J(pil, [0, 0.05, 0]); m.phead = ph;
      P(ph, GE.sph, skinM, [0.14, 0.14, 0.13], null, null, true); P(ph, GE.half, cap, [0.15, 0.13, 0.15], [0, 0.02, -0.01], null, true);
      [-1, 1].forEach((s) => { P(ph, GE.torT, gra, [0.045, 0.045, 0.045], [s * 0.05, 0.06, 0.12]); P(ph, GE.sph, en, [0.035, 0.035, 0.01], [s * 0.05, 0.06, 0.125]); });
      P(ph, GE.box, std({ c: '#3a2010', r: 0.6 }), [0.06, 0.012, 0.01], [0, -0.05, 0.13]);
      P(pil, GE.tor, scarfM, [0.1, 0.1, 0.25], [0, -0.09, 0], [Math.PI / 2, 0, 0]);
      const parm = J(pil, [-0.12, -0.08, 0.04]); P(parm, GE.cap, scarfM, [0.03, 0.06, 0.03], [0, 0.07, 0]); m.parm = parm;
      P(chest, GE.sph, glass, [0.31, 0.27, 0.29], [0, 0.6, 0.08], null, false);
      // échappements fumants, antenne
      m.smoke = [];
      [-1, 1].forEach((s) => { P(chest, GE.cyl, gra, [0.06, 0.32, 0.06], [s * 0.2, 0.62, -0.38], [-0.2, 0, 0], true); P(chest, GE.cyl, std({ c: '#111', r: 0.9 }), [0.045, 0.02, 0.045], [s * 0.2, 0.79, -0.42], [-0.2, 0, 0]);
        for (let i = 0; i < (LITE ? 1 : 3); i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x8a8a96, transparent: true, depthWrite: false, opacity: 0.5 })); sp.userData = { s0: 0.2, op0: 0.5, side: s, i, dyn: true }; chest.add(sp); m.smoke.push(sp); } });
      P(chest, GE.cyl, gra, [0.012, 0.36, 0.012], [-0.3, 0.78, -0.18]); m.ant = P(chest, GE.sph, energy('#ff3a4a'), [0.035, 0.035, 0.035], [-0.3, 0.97, -0.18]); m.antS = dyn(sprite(chest, '#ff3a4a', 0.25, [-0.3, 0.97, -0.18], 0.6));
      // canon rotatif à rivets (bras droit)
      const gun = J(chest, [0.58, 0.32, 0.02]); m.gun = gun;
      P(gun, GE.sph, gra, [0.14, 0.14, 0.14], null, null, true);
      P(gun, GE.cyl, paint, [0.14, 0.34, 0.14], [0, 0, 0.18], [Math.PI / 2, 0, 0], true);
      const bar = J(gun, [0, 0, 0.36]); m.barrels = bar;
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; P(bar, GE.cyl, gra, [0.032, 0.42, 0.032], [Math.cos(a) * 0.065, Math.sin(a) * 0.065, 0.18], [Math.PI / 2, 0, 0], true); }
      P(bar, GE.tor, chrome, [0.11, 0.11, 0.3], [0, 0, 0.36]);
      m.muzzle = dyn(sprite(gun, '#ffe28a', 0.9, [0, 0, 0.82], 0));
      P(gun, GE.box, gra, [0.16, 0.14, 0.18], [0, -0.17, 0.08], null, true);
      // pince (bras gauche)
      const cl = J(chest, [-0.56, 0.3, 0.02]); m.claw = cl;
      P(cl, GE.sph, gra, [0.13, 0.13, 0.13], null, null, true); P(cl, GE.box, paint, [0.12, 0.12, 0.34], [0, -0.04, 0.17], null, true);
      m.fingers = [-1, 1].map((s) => { const f = J(cl, [s * 0.05, -0.04, 0.34]); P(f, GE.cone, gra, [0.04, 0.18, 0.04], [0, 0, 0.08], [Math.PI / 2, 0, 0], true); return f; });
      m.fx = sk.fx || null; collect(m); m.custom = KRANK; m.root.userData.prism = 'krank';
      return m;
    },
    animate(m, st) {
      const A = drive(m, st), t = A.t, R = A.run;
      commonBody(m, A, { fall: 1.2, twist: 0.9 });
      const { hips, torso, legs } = m, mem = A.mem;
      // pas de marcheur : levée haute des pattes, choc à chaque appui, roulis, verrière en retard (ressort)
      const sw = Math.sin(A.ph), plant = Math.pow(Math.abs(Math.cos(A.ph)), 6);
      let hy = 0.8 + Math.sin(t * 1.4) * 0.012, tx = 0, ty = 0, tz = 0, gunX = 0, gunSpin = 0, clawO = 0.3, pyaw = Math.sin(t * 0.7) * 0.6 * (A.lobby ? 1 : 0.4), parm = 0.2;
      hy += R * (0.05 - plant * 0.07); tz += sw * 0.07 * R - A.strafe * 0.12 * R; tx += R * 0.12 * A.fwd; ty += -A.turn * 0.3;
      mem.spr = mem.spr || { v: 0, x: 0 }; const target = -(hy - 0.8) * 2 + tx * 0.5; mem.spr.v += (target - mem.spr.x) * 60 * A.dt - mem.spr.v * 7 * A.dt; mem.spr.x += mem.spr.v * A.dt;
      // tir : canon qui tourne, recul à chaque rivet, flash de bouche
      mem.spin = (mem.spin || 0) + A.dt * (A.atkW > 0 ? 28 : mem.spinV || 0); mem.spinV = A.atkW > 0 ? 28 : Math.max(0, (mem.spinV || 0) - A.dt * 30);
      gunSpin = mem.spin;
      if (A.atk >= 0) { const k = A.atk, kick = Math.exp(-k * 9); gunX -= kick * 0.25; tx -= kick * 0.05; m.muzzle.material.opacity = kick > 0.3 ? 0.9 * kick : 0; m.muzzle.scale.setScalar(0.6 + Math.random() * 0.5); } else m.muzzle.material.opacity = 0;
      if (A.reload > 0.01) { const k = A.reload; gunX = lerp(gunX, -0.9 + Math.abs(Math.sin(t * 5)) * 0.2, k); clawO = lerp(clawO, Math.abs(Math.sin(t * 6)) * 0.6, k); }
      if (A.rl > 0) gunX += A.rl * 0.3;
      tx -= A.hit * 0.2; tz += A.hit * 0.15;
      // gestes : le pilote salue / le marcheur tape du pied
      let stomp = 0;
      if (A.fid) { const k = A.fid.w; if (A.fid.k === 0) { parm = lerp(parm, 2.8 + Math.sin(A.fid.p * 40) * 0.4, k); pyaw = lerp(pyaw, 0, k); } else stomp = pulse(A.fid.p, 0.1, 0.9) * Math.abs(Math.sin(A.fid.p * 18)); }
      if (A.poke >= 0) { const k = pulse(A.poke, 0, 1.4); hy += Math.abs(Math.sin(A.poke * 6)) * 0.25 * k; parm = lerp(parm, 2.8 + Math.sin(A.poke * 30) * 0.4, k); clawO = lerp(clawO, Math.abs(Math.sin(A.poke * 12)) * 0.7, k); }
      // victoire : sauts, pilote bras en l'air, pince qui claque ; défaite : marcheur affaissé, vapeur, pilote dépité
      if (A.win > 0.01) { const k = A.win, j = Math.abs(Math.sin(t * 3.6)); hy += j * 0.3 * k; parm = lerp(parm, 2.9 + Math.sin(t * 12) * 0.3, k); clawO = lerp(clawO, Math.abs(Math.sin(t * 8)) * 0.8, k); gunX = lerp(gunX, -0.8, k); pyaw *= 1 - k; }
      if (A.lose > 0.01) { const k = A.lose; hy -= 0.28 * k; tx += 0.3 * k; gunX = lerp(gunX, 0.5, k); parm = lerp(parm, 2.2, k); pyaw = lerp(pyaw, 0, k); }
      if (A.spawn < 1) { const k = A.spawn, fall = out3(clamp(k / 0.45, 0, 1)); m.body.position.y += (1 - fall) * 2.6; const land = pulse(k, 0.4, 0.8); hy -= land * 0.2; m.body.scale.set(1 + land * 0.1, 1 - land * 0.1, 1 + land * 0.1); }
      hips.position.y = hy; torso.rotation.set(tx + mem.spr.x * 0.6, ty, tz);
      m.pilot.rotation.set(mem.spr.x * 1.2 - A.lose * 0.3, 0, -tz * 1.2); m.phead.rotation.set(-A.lose * 0.4 - A.win * 0.2, pyaw, 0); m.parm.rotation.set(-parm, 0, -0.3);
      legs.forEach((l, i) => {
        const side = i ? 1 : -1, c = legCycle(A, side, 0.62), kneel = A.lose * 0.5 + (stomp && i === 1 ? stomp * 0.6 : 0);
        const th = -0.6 - c.x - kneel * 0.4, sh = 1.1 + c.knee * 1.2 + kneel * 0.7;
        l.th.rotation.set(th, 0, c.z); l.kn.rotation.set(sh, 0, 0); l.ft.rotation.set(-(th + sh) + c.lift * 0.3 * R, 0, -c.z);
      });
      m.gun.rotation.set(gunX, 0, 0); m.barrels.rotation.z = gunSpin; m.claw.rotation.set(-0.2 + A.win * -0.8 + Math.sin(t * 1.1) * 0.05, 0, 0);
      m.fingers.forEach((f, i) => f.rotation.y = (i ? -1 : 1) * clawO);
      m.smoke.forEach((sp) => { const life = (t * (0.6 + R * 0.8 + A.lose) + sp.userData.i / 3) % 1; sp.position.set(sp.userData.side * 0.2 + Math.sin(life * 5 + sp.userData.i) * 0.05, 0.85 + life * (0.6 + A.lose * 0.4), -0.45 - life * (0.2 + R * 0.4)); sp.scale.setScalar(0.12 + life * 0.35); sp.material.opacity = (1 - life) * (A.lobby ? 0.45 : 0.3) * (A.death >= 0 ? 1 - A.death : 1); });
      const blinkOn = Math.sin(t * 4) > 0.2; m.ant.visible = blinkOn; m.antS.material.opacity = blinkOn ? 0.6 : 0;
      const glow = (A.sup ? 1.35 + Math.sin(t * 8) * 0.25 : 1) * (1 - A.lose * 0.5) * (A.death >= 0 ? 1 - A.death : 1);
      fxMats(m, A, glow);
    },
  };

  C3.CUSTOM.ignis = IGNIS; C3.CUSTOM.nyx = NYX; C3.CUSTOM.lumen = LUMEN; C3.CUSTOM.krank = KRANK;
  G.PRISM = { ids: ['ignis', 'nyx', 'lumen', 'krank'], tex: { glow: glowTex, smoke: smokeTex, metal: tMetal, lava: tLava, hazard: tHazard, leather: tLeather, fabric: tFabric, ceramic: tCeramic, make: tex }, sprite, energy, std, GE: GHI, P, J, env, col };
})();

/* ---------- version 2D des héros PRISM (qualité « économie » ou appareil sans WebGL) ---------- */
(function () {
  const G = window.G, R = G.Render, H = R && R._h; if (!H) return;
  const { HATS, WEAPONS, fillStroke, circ, rrect, poly, OUT } = H;
  const glow = (c, col, b) => { c.shadowColor = col; c.shadowBlur = b; };
  Object.assign(HATS, {
    // Ignis : heaume de forge, fente en T incandescente, crête de flammes
    forge(c, L, o) {
      const t = (o && o.t) || 0;
      for (let i = 0; i < 3; i++) { const h = 14 + Math.sin(t * 14 + i * 2) * 3 + (i === 1 ? 6 : 0); c.beginPath(); c.moveTo(-6 + i * 6 - 4, -14); c.quadraticCurveTo(-6 + i * 6, -14 - h, -6 + i * 6 + 4, -14); c.closePath(); glow(c, L.hair, 10); c.fillStyle = i === 1 ? '#ffe48a' : L.hair; c.fill(); c.shadowBlur = 0; }
      c.beginPath(); c.arc(0, -2, 16, Math.PI, Math.PI * 2); c.lineTo(16, 4); c.lineTo(-16, 4); c.closePath(); fillStroke(c, L.body);
      c.strokeStyle = L.hair; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-10, -10); c.lineTo(-4, -4); c.lineTo(-7, 2); c.moveTo(8, -12); c.lineTo(4, -5); c.stroke();
      glow(c, L.accent, 8); c.fillStyle = '#ffd86a'; c.fillRect(-10, -2, 20, 3.4); c.fillRect(-1.7, -2, 3.4, 9); c.shadowBlur = 0;
    },
    // Nyx-7 : casque céramique, visière fumée, yeux pixels, ailettes
    visor(c, L) {
      c.beginPath(); c.arc(0, -2, 16, Math.PI * 0.95, Math.PI * 2.05); c.closePath(); fillStroke(c, L.body);
      for (const s of [-1, 1]) { poly(c, [s * 14, -8, s * 22, -18, s * 16, -4]); fillStroke(c, L.body, 2); circ(c, s * 22, -18, 2.2); glow(c, L.accent, 8); c.fillStyle = L.accent; c.fill(); c.shadowBlur = 0; }
      rrect(c, -13, -6, 26, 10, 5); fillStroke(c, '#0b1220', 2);
      glow(c, L.accent, 8); c.fillStyle = L.accent; c.fillRect(-8, -2.5, 5, 2.6); c.fillRect(3, -2.5, 5, 2.6); c.shadowBlur = 0;
    },
    // Lumen : chevelure claire et couronne de cristaux
    prism(c, L) {
      c.beginPath(); c.arc(0, -2, 15.6, Math.PI * 1.0, Math.PI * 2.0); c.quadraticCurveTo(8, -8, -2, -8); c.quadraticCurveTo(-10, -8, -15.6, -2); c.closePath(); fillStroke(c, L.hair);
      for (let i = -2; i <= 2; i++) { const h = 12 - Math.abs(i) * 3; poly(c, [i * 5, -16 - h, i * 5 + 3, -16, i * 5, -13, i * 5 - 3, -16]); glow(c, L.accent, 6); fillStroke(c, i % 2 ? L.hair : L.accent, 1.4); c.shadowBlur = 0; }
    },
    // Krank : casque d'aviateur et grosses lunettes
    pilot(c, L) {
      c.beginPath(); c.arc(0, -2, 15.8, Math.PI, Math.PI * 2); c.lineTo(15.8, 3); c.lineTo(-15.8, 3); c.closePath(); fillStroke(c, L.hair);
      for (const s of [-1, 1]) { circ(c, s * 6, -9, 5.2); fillStroke(c, '#3a3f4c', 2); circ(c, s * 6, -9, 3.2); glow(c, L.accent, 6); c.fillStyle = L.accent; c.fill(); c.shadowBlur = 0; }
    },
  });
  Object.assign(WEAPONS, {
    hammer(c, L) { rrect(c, -6, -2.5, 34, 5, 2); fillStroke(c, '#4a2e1e', 2); rrect(c, 24, -12, 16, 24, 4); fillStroke(c, L.body); glow(c, L.hair, 8); c.fillStyle = L.hair; c.fillRect(27, -6, 10, 2); c.fillRect(27, 3, 10, 2); c.shadowBlur = 0; },
    blades(c, L) { glow(c, L.accent, 12); poly(c, [-2, -3, 40, -1, 44, 0, 40, 1, -2, 3]); c.fillStyle = '#eaffff'; c.fill(); c.strokeStyle = L.accent; c.lineWidth = 2.4; c.stroke(); c.shadowBlur = 0; rrect(c, -6, -4, 8, 8, 3); fillStroke(c, L.body2, 1.6); },
    crystal(c, L) { circ(c, 2, 0, 4); fillStroke(c, L.skin, 1.6); glow(c, L.accent, 12); poly(c, [18, -10, 26, 0, 18, 10, 10, 0]); fillStroke(c, '#f4f0ff', 1.6); c.shadowBlur = 0; },
    rivetgun(c, L) { rrect(c, -4, -8, 22, 16, 5); fillStroke(c, L.body); for (const y of [-4.5, 0, 4.5]) { rrect(c, 16, y - 1.8, 22, 3.6, 1.5); fillStroke(c, L.body2, 1.4); } c.fillStyle = OUT; c.fillRect(4, -2, 6, 4); },
  });
})();
