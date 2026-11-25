/* Brawl Rush - personnages en vraie 3D (three.js) : modèles « chibi » toon générés à partir de l'apparence de chaque brawler,
   animations procédurales (attente, course, tir, roulade, victoire, défaite, élimination, réaction au toucher).
   Utilisés dans les menus (salon, profil, résultats) et en combat. Repli automatique sur le rendu 2D si WebGL est indisponible. */
(function () {
  const G = window.G, THREE = window.THREE;
  const C3 = (G.Char3D = { ok: false, models: {}, pokeT: -9, pokeId: null });
  if (!THREE) return;
  const OUTC = 0x1a1530;
  let R = null, CV = null, S = 640;
  function renderer() {
    if (R || C3.failed) return R;
    try {
      CV = document.createElement('canvas'); CV.width = S; CV.height = S;
      R = new THREE.WebGLRenderer({ canvas: CV, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
      R.setPixelRatio(1); R.setSize(S, S, false); R.setClearColor(0x000000, 0); R.outputEncoding = THREE.sRGBEncoding; R.setScissorTest(true);
      C3.ok = true;
    } catch (e) { C3.failed = true; C3.ok = false; R = null; }
    return R;
  }
  C3.enabled = (inMatch) => { const s = G.Save.data.settings; if (s.chars3d === false) return false; if (inMatch && (!s.chars3dMatch || G.Render.q < 1)) return false; return !!renderer(); };

  /* ---------- matériaux toon ---------- */
  const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const mats = {};
  function mat(col, extra) {
    const k = col + (extra ? JSON.stringify(extra) : '');
    if (!mats[k]) { const m = new THREE.MeshToonMaterial(Object.assign({ color: new THREE.Color(col).convertSRGBToLinear(), gradientMap: grad }, extra || {})); m.userData.em = m.emissive.clone(); mats[k] = m; }
    return mats[k];
  }
  const outMat = new THREE.MeshBasicMaterial({ color: OUTC, side: THREE.BackSide });
  const geo = {
    sph: new THREE.SphereGeometry(1, 20, 14), sphL: new THREE.SphereGeometry(1, 12, 8), cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 14),
    box: new THREE.BoxGeometry(1, 1, 1), arc: new THREE.TorusGeometry(1, 0.28, 8, 16, Math.PI), tor: new THREE.TorusGeometry(1, 0.22, 8, 20), taper: new THREE.CylinderGeometry(0.82, 1, 1, 18), half: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  // pièce = maillage + contour (coque inversée)
  function part(parent, g, col, s, p, r, outline, extra) {
    const m = new THREE.Mesh(g, typeof col === 'object' ? col : mat(col, extra));
    if (s) m.scale.set(s[0], s[1], s[2]); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]);
    parent.add(m);
    if (outline !== false) { const o = new THREE.Mesh(g, outMat); o.scale.set(1.07, 1.07, 1.07); m.add(o); }
    return m;
  }
  const grp = (parent, p) => { const g = new THREE.Group(); if (p) g.position.set(p[0], p[1], p[2]); parent.add(g); return g; };

  /* ---------- construction d'un brawler ---------- */
  function build(id, skin) {
    const def = G.BRAWLER[id] || G.BRAWLERS[0], L = G.getLook(id, skin) || def.look, sk = G.SKIN[skin] || {};
    const bulk = G.clamp((def.hp || 6000) / 7600, 0.86, 1.28), big = id === 'robot' ? 1.25 : 1;
    const extra = sk.fx === 'ghost' ? { transparent: true, opacity: 0.62 } : null;
    const root = new THREE.Group(), body = grp(root, [0, 0, 0]);
    const hips = grp(body, [0, 0.44, 0]);
    const shoe = G.mix(L.body2, '#000', 0.5);
    const legs = [-1, 1].map((sd) => { const l = grp(hips, [sd * 0.15 * bulk, 0, 0]); part(l, geo.cyl, L.body2, [0.11, 0.3, 0.11], [0, -0.14, 0], null, true, extra); part(l, geo.sph, shoe, [0.14, 0.1, 0.2], [0, -0.34, 0.05], null, true, extra); return l; });
    const torso = grp(hips, [0, 0.02, 0]);
    part(torso, geo.taper, L.body, [0.3 * bulk, 0.52, 0.25 * bulk], [0, 0.27, 0], null, true, extra);
    part(torso, geo.sph, L.body, [0.31 * bulk, 0.17, 0.26 * bulk], [0, 0.5, 0], null, false, extra);
    part(torso, geo.cyl, L.body2, [0.31 * bulk, 0.07, 0.26 * bulk], [0, 0.05, 0], null, false, extra);
    part(torso, geo.box, L.accent, [0.11, 0.09, 0.04], [0, 0.05, 0.26 * bulk], null, false);
    part(torso, geo.box, L.accent, [0.05, 0.3, 0.03], [0.12 * bulk, 0.3, 0.255 * bulk], [0, 0, 0.35], false);
    const arms = [-1, 1].map((sd) => { const a = grp(torso, [sd * 0.36 * bulk, 0.46, 0]); part(a, geo.sph, L.body, [0.12, 0.12, 0.12], [0, 0, 0], null, true, extra); part(a, geo.cyl, L.body, [0.085, 0.28, 0.085], [0, -0.14, 0], null, true, extra); const hand = part(a, geo.sph, L.skin, [0.105, 0.105, 0.105], [0, -0.32, 0], null, true, extra); a.userData.hand = hand; return a; });
    const head = grp(torso, [0, 1.1, 0]); head.scale.setScalar(1.24);
    part(head, geo.sph, L.skin, [0.52, 0.48, 0.48], [0, 0, 0], null, true, extra);
    part(head, geo.sph, L.skin, [0.1, 0.13, 0.08], [-0.5, -0.02, 0], null, false, extra); part(head, geo.sph, L.skin, [0.1, 0.13, 0.08], [0.5, -0.02, 0], null, false, extra);
    const eyes = [-1, 1].map((sd) => { const e = grp(head, [sd * 0.19, 0.02, 0.41]); part(e, geo.sph, '#ffffff', [0.12, 0.155, 0.06], null, null, false); part(e, geo.sph, G.mix(L.hair, '#1b1b2b', 0.55), [0.078, 0.1, 0.045], [sd * -0.008, -0.012, 0.035], null, false); part(e, geo.sph, '#0d0d16', [0.04, 0.05, 0.03], [sd * -0.008, -0.015, 0.06], null, false); part(e, geo.sph, '#ffffff', [0.024, 0.024, 0.02], [0.028, 0.035, 0.08], null, false, { emissive: new THREE.Color(0xffffff) }); return e; });
    const brows = [-1, 1].map((sd) => part(head, geo.box, G.mix(L.hair, '#000', 0.35), [0.15, 0.04, 0.04], [sd * 0.19, 0.22, 0.44], [0, 0, sd * 0.15], false));
    const mouth = part(head, geo.arc, '#5a1a2a', [0.08, 0.06, 0.05], [0, -0.17, 0.44], [0, 0, Math.PI], false);
    part(head, geo.sph, G.mix(L.skin, '#ff6a7a', 0.45), [0.07, 0.04, 0.02], [-0.3, -0.09, 0.37], null, false); part(head, geo.sph, G.mix(L.skin, '#ff6a7a', 0.45), [0.07, 0.04, 0.02], [0.3, -0.09, 0.37], null, false);
    hat(head, L, def.look.hat, extra);
    const wpn = weapon(arms[1], L, def.look.weapon, extra);
    root.scale.setScalar(big);
    return { root, body, hips, torso, head, legs, arms, eyes, brows, mouth, wpn, def, fx: sk.fx || null, mats: [] };
  }
  function hat(h, L, type, ex) {
    const hc = L.hair, ac = L.accent, b2 = L.body2;
    const cap = () => { part(h, geo.half, hc, [0.55, 0.42, 0.52], [0, 0.1, -0.03], null, true, ex); part(h, geo.sph, hc, [0.5, 0.42, 0.34], [0, 0.0, -0.2], null, true, ex);
      [[-0.26, 0.3, 0.33, 0.4], [-0.08, 0.36, 0.38, 0.1], [0.12, 0.35, 0.37, -0.2], [0.29, 0.28, 0.3, -0.5]].forEach(([x, y, z, rz]) => part(h, geo.sph, hc, [0.15, 0.13, 0.12], [x, y, z], [0, 0, rz], false, ex)); };
    switch (type) {
      case 'cowboy': part(h, geo.cyl, ac, [0.78, 0.04, 0.72], [0, 0.32, 0]); part(h, geo.cyl, ac, [0.38, 0.3, 0.36], [0, 0.48, 0]); part(h, geo.cyl, b2, [0.39, 0.06, 0.37], [0, 0.38, 0], null, false); break;
      case 'wizard': part(h, geo.cyl, ac, [0.7, 0.04, 0.7], [0, 0.32, 0]); part(h, geo.cone, ac, [0.38, 0.8, 0.38], [0, 0.72, -0.05], [-0.15, 0, 0.1]); break;
      case 'jester': cap(); [-1, 1].forEach((s) => { part(h, geo.cone, s < 0 ? ac : hc, [0.14, 0.5, 0.14], [s * 0.3, 0.55, 0], [0, 0, -s * 0.7]); part(h, geo.sph, '#ffd21f', [0.08, 0.08, 0.08], [s * 0.55, 0.72, 0]); }); break;
      case 'horns': cap(); [-1, 1].forEach((s) => part(h, geo.cone, '#fff3d6', [0.09, 0.32, 0.09], [s * 0.36, 0.42, 0], [0, 0, -s * 0.5])); break;
      case 'yeti': part(h, geo.half, '#f4fbff', [0.6, 0.5, 0.56], [0, 0.02, -0.02]); [-1, 1].forEach((s) => part(h, geo.cone, '#cfe6f5', [0.08, 0.28, 0.08], [s * 0.4, 0.4, 0], [0, 0, -s * 0.6])); break;
      case 'robot': part(h, geo.box, '#9fb0c8', [0.9, 0.8, 0.86], [0, 0.02, 0]); part(h, geo.cyl, '#59657e', [0.03, 0.3, 0.03], [0, 0.55, 0]); part(h, geo.sph, '#ff4a55', [0.08, 0.08, 0.08], [0, 0.72, 0], null, false, { emissive: new THREE.Color(0xff2030) }); break;
      case 'headphones': cap(); part(h, geo.arc, '#2a2a3a', [0.56, 0.56, 0.4], [0, 0.04, 0]); [-1, 1].forEach((s) => part(h, geo.cyl, ac, [0.16, 0.12, 0.16], [s * 0.52, 0, 0], [0, 0, Math.PI / 2])); break;
      case 'aviator': cap(); [-1, 1].forEach((s) => part(h, geo.tor, ac, [0.1, 0.1, 0.1], [s * 0.16, 0.3, 0.38], [0.4, 0, 0])); break;
      case 'mohawk': for (let i = 0; i < 5; i++) part(h, geo.cone, hc, [0.08, 0.28, 0.12], [0, 0.48 - Math.abs(i - 2) * 0.04, 0.3 - i * 0.16], [-0.3 + i * 0.15, 0, 0]); break;
      case 'spiky': for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(h, geo.cone, hc, [0.12, 0.34, 0.12], [Math.cos(a) * 0.28, 0.38, Math.sin(a) * 0.22 - 0.04], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]); } break;
      case 'ponytail': cap(); part(h, geo.sph, hc, [0.16, 0.3, 0.16], [0, 0.1, -0.55], [0.5, 0, 0]); part(h, geo.sph, ac, [0.07, 0.07, 0.07], [0, 0.24, -0.47]); break;
      case 'hood': case 'reaper': { const hc2 = type === 'reaper' ? '#2a2236' : b2; part(h, geo.sph, hc2, [0.64, 0.62, 0.42], [0, 0.08, -0.2], null, true, ex); part(h, geo.half, hc2, [0.6, 0.5, 0.56], [0, 0.12, -0.04], null, true, ex); part(h, geo.cone, hc2, [0.2, 0.35, 0.2], [0, 0.55, -0.3], [-0.9, 0, 0], true, ex); break; }
      case 'monk': part(h, geo.sph, hc, [0.12, 0.12, 0.12], [0, 0.48, 0]); break;
      case 'cloud': [[-0.25, 0.38, 0], [0.2, 0.42, 0], [0, 0.5, -0.1], [0.35, 0.3, -0.1]].forEach((p) => part(h, geo.sphL, '#f2f6ff', [0.24, 0.2, 0.24], p)); break;
      case 'cactus': part(h, geo.half, '#3fae4a', [0.54, 0.46, 0.5], [0, 0.06, 0]); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; part(h, geo.cone, '#fff3d6', [0.025, 0.1, 0.025], [Math.cos(a) * 0.3, 0.36, Math.sin(a) * 0.28], [Math.sin(a), 0, -Math.cos(a)], false); } break;
      case 'clock': part(h, geo.cyl, '#2a2a3a', [0.34, 0.4, 0.34], [0, 0.5, 0]); part(h, geo.cyl, '#2a2a3a', [0.56, 0.04, 0.56], [0, 0.32, 0]); part(h, geo.cyl, '#fff3d6', [0.12, 0.02, 0.12], [0, 0.55, 0.34], [Math.PI / 2, 0, 0], false); break;
      case 'tide': cap(); part(h, geo.tor, '#4ad0ff', [0.32, 0.32, 0.5], [0, 0.42, -0.05], [0, Math.PI / 2, 0]); break;
      case 'scarab': part(h, geo.half, '#3b2a6b', [0.56, 0.42, 0.52], [0, 0.06, -0.02]); [-1, 1].forEach((s) => part(h, geo.cyl, '#3b2a6b', [0.02, 0.32, 0.02], [s * 0.16, 0.56, 0.1], [0.4, 0, -s * 0.4])); break;
      case 'bumper': part(h, geo.half, ac, [0.58, 0.46, 0.54], [0, 0.04, 0]); part(h, geo.tor, '#2a2a3a', [0.55, 0.55, 0.8], [0, 0.08, 0], [Math.PI / 2, 0, 0]); break;
      default: cap();
    }
  }
  function weapon(arm, L, type, ex) {
    const w = grp(arm.userData.hand, [0, -0.02, 0.06]); w.rotation.x = -Math.PI / 2;
    const dk = '#3a3f5a', ac = L.accent;
    switch (type) {
      case 'bomb': part(w, geo.sph, '#2a2a3a', [0.2, 0.2, 0.2], [0, 0.15, 0]); part(w, geo.cyl, '#c98a1a', [0.02, 0.1, 0.02], [0, 0.38, 0]); part(w, geo.sph, '#ffb21a', [0.05, 0.05, 0.05], [0, 0.45, 0], null, false, { emissive: new THREE.Color(0xff8a00) }); break;
      case 'staff': part(w, geo.cyl, '#8a5a2a', [0.03, 1.0, 0.03], [0, 0.2, 0]); part(w, geo.sph, ac, [0.12, 0.12, 0.12], [0, 0.72, 0], null, true, { emissive: new THREE.Color(ac).multiplyScalar(0.5) }); break;
      case 'scythe': part(w, geo.cyl, '#4a3a2a', [0.03, 1.1, 0.03], [0, 0.25, 0]); part(w, geo.tor, '#d0d6e0', [0.26, 0.26, 0.4], [0.18, 0.78, 0], [0, 0, 0.4]); break;
      case 'daggers': part(w, geo.cone, '#d0d6e0', [0.05, 0.4, 0.05], [0, 0.26, 0]); break;
      case 'mic': part(w, geo.cyl, dk, [0.04, 0.3, 0.04], [0, 0.12, 0]); part(w, geo.sph, '#c8c8d8', [0.09, 0.09, 0.09], [0, 0.3, 0]); break;
      case 'tesla': part(w, geo.cyl, dk, [0.08, 0.45, 0.08], [0, 0.2, 0]); for (let i = 0; i < 3; i++) part(w, geo.tor, ac, [0.1, 0.1, 0.1], [0, 0.1 + i * 0.12, 0], [Math.PI / 2, 0, 0], false); part(w, geo.sph, '#9ff6ff', [0.08, 0.08, 0.08], [0, 0.48, 0], null, false, { emissive: new THREE.Color(0x40d0ff) }); break;
      case 'rocketlauncher': part(w, geo.cyl, ac, [0.14, 0.8, 0.14], [0, 0.2, 0]); part(w, geo.cyl, dk, [0.16, 0.08, 0.16], [0, 0.6, 0]); break;
      default: { // armes à feu : longueur selon le type
        const len = type === 'sniper' ? 0.95 : type === 'bigshotgun' ? 0.7 : type === 'shotgun' ? 0.6 : type === 'cactusgun' ? 0.55 : 0.42, th = type === 'bigshotgun' ? 0.11 : 0.075;
        part(w, geo.box, dk, [th * 1.5, len, th * 1.6], [0, len / 2, 0]); part(w, geo.box, ac, [th * 1.6, len * 0.3, th * 1.8], [0, len * 0.22, 0]); part(w, geo.cyl, '#20202c', [th * 0.55, 0.05, th * 0.55], [0, len, 0], null, false);
      }
    }
    return w;
  }
  function model(id, skin) { const k = id + '|' + skin; if (!C3.models[k]) C3.models[k] = build(id, skin); return C3.models[k]; }

  /* ---------- animation ---------- */
  const lerp = (a, b, k) => a + (b - a) * k;
  function pose(m, st) {
    const t = st.t || 0, sd = (st.seed || 0) * 1.3, run = !!st.moving, w = st.walk || t * 6;
    const { body, hips, torso, head, legs, arms, eyes, brows, mouth } = m;
    body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1); torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
    let la = 0, ra = 0, ll = 0, rl = 0, bob = 0, armZ = 0.12;
    if (run) { const s = Math.sin(w * 1.15); ll = s * 0.85; rl = -s * 0.85; la = -s * 0.7; ra = s * 0.35; bob = Math.abs(Math.cos(w * 1.15)) * 0.09; torso.rotation.x = 0.16; }
    else { const br = Math.sin(t * 2.2 + sd); bob = br * 0.015; torso.scale.set(1, 1 + br * 0.02, 1); la = Math.sin(t * 1.7 + sd) * 0.08; ra = 0.25 + Math.sin(t * 1.7 + 1 + sd) * 0.06; head.rotation.y = Math.sin(t * 0.55 + sd) * 0.35 * (st.look === false ? 0 : 1); head.rotation.z = Math.sin(t * 0.9 + sd) * 0.04; }
    // tir : bras armé levé + recul
    const rec = st.recoil || 0;
    if (st.aiming || st.attackPose) ra = 1.45; ra += rec * 0.5; torso.rotation.x -= rec * 0.12; body.position.z -= rec * 0.08;
    // pose de victoire / défaite / interaction
    if (st.pose === 'win') { const j = Math.abs(Math.sin(t * 3.4)); bob = j * 0.45; la = -2.6 + Math.sin(t * 6) * 0.3; ra = -2.4; body.rotation.y = Math.sin(t * 1.7) * 0.5; head.rotation.x = -0.15; }
    else if (st.pose === 'lose') { torso.rotation.x = 0.35; head.rotation.x = 0.45; la = ra = 0.05; armZ = 0.02; bob = -0.05; body.rotation.z = Math.sin(t * 0.8) * 0.04; }
    const pk = st.poke >= 0 && st.poke < 1.2 ? st.poke : -1;
    if (pk >= 0) { const k = Math.sin(Math.min(1, pk / 1.2) * Math.PI); bob += Math.abs(Math.sin(pk * 7)) * 0.35 * k; la = -2.8 + Math.sin(pk * 18) * 0.45; body.rotation.y = pk * Math.PI * 2 * (pk < 0.6 ? 1 : 0); body.scale.set(1 + k * 0.08, 1 - k * 0.06, 1 + k * 0.08); }
    hips.position.y = 0.44 + bob;
    legs[0].rotation.x = ll; legs[1].rotation.x = rl;
    arms[0].rotation.set(la, 0, armZ); arms[1].rotation.set(-ra, 0, -armZ);
    // visage : clignement, colère, joie, douleur
    const blink = ((t * 0.6 + sd) % 3.4) < 0.11, hurt = (st.flash || 0) > 0;
    eyes.forEach((e) => e.scale.set(1, blink || hurt ? 0.15 : 1, 1));
    const ang = st.angry || rec > 0.15 ? 1 : 0, happy = st.pose === 'win' || pk >= 0 || st.happy;
    brows[0].rotation.z = -0.15 - ang * 0.45 + (st.pose === 'lose' ? 0.5 : 0); brows[1].rotation.z = 0.15 + ang * 0.45 - (st.pose === 'lose' ? 0.5 : 0);
    mouth.rotation.z = happy ? Math.PI : st.pose === 'lose' || hurt ? 0 : Math.PI; mouth.scale.set(happy ? 0.11 : 0.07, happy ? 0.09 : 0.05, 0.05);
    // roulade, élimination
    if (st.roll !== undefined && st.roll >= 0 && st.roll < 1) { body.rotation.x = st.roll * Math.PI * 2; body.position.y = 0.45 * Math.sin(st.roll * Math.PI); }
    if (st.deathT !== undefined) { const k = Math.min(1, st.deathT / 0.45); body.rotation.x = -k * 1.5; body.position.y = -k * 0.25; }
    // effets d'apparence
    const fl = hurt ? Math.min(1, st.flash * 8) : 0, fx = m.fx;
    m.root.traverse((o) => { if (o.material && o.material !== outMat && o.material.emissive) { const base = o.material.userData.em; if (fl > 0) o.material.emissive.setRGB(fl * 0.8, fl * 0.8, fl * 0.8); else if (fx === 'inferno') o.material.emissive.setRGB(0.35 + Math.sin(t * 12) * 0.1, 0.1, 0); else if (fx === 'crystal') o.material.emissive.setRGB(0.05, 0.25, 0.3); else if (fx === 'rainbow') o.material.emissive.setHSL((t * 0.25) % 1, 0.8, 0.18); else if (st.frozen) o.material.emissive.setRGB(0.1, 0.3, 0.5); else o.material.emissive.copy(base); } });
  }

  /* ---------- scènes et caméras ---------- */
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a62a8, 0.6));
  const key = new THREE.DirectionalLight(0xfff4e0, 1.2); key.position.set(-2, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xa8d8ff, 0.8); rim.position.set(3, 2, -4); scene.add(rim);
  const camP = new THREE.PerspectiveCamera(26, 1, 0.1, 50), camM = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 50);
  let cur = null;
  function show(m) { if (cur === m.root) return; if (cur) scene.remove(cur); scene.add(m.root); cur = m.root; }
  function draw(w, h, cam) { const r = renderer(); r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.clear(); r.render(scene, cam); }

  // portrait animé (salon, profil, résultats) dans un canevas 2D
  C3.portrait = function (cv, id, skin, t, opts) {
    opts = opts || {};
    const W = cv.width, H = cv.height, w = Math.min(S, W), h = Math.min(S, Math.round(w * H / W));
    const m = model(id, skin); show(m);
    pose(m, { t, seed: 0, pose: opts.pose, happy: opts.happy, poke: C3.pokeId === cv ? (performance.now() - C3._pokeAt) / 1000 : -1, attackPose: opts.attackPose });
    m.root.rotation.y = (opts.yaw !== undefined ? opts.yaw : -0.35) + (opts.spin ? t * 0.6 : 0);
    const z = opts.zoom || 1, ht = 3.2 / z;
    camP.aspect = w / h; camP.fov = 26; camP.updateProjectionMatrix();
    const dist = ht / (2 * Math.tan((camP.fov * Math.PI) / 360));
    const cy = 1.25 + (0.76 - (opts.y || 0.76)) * ht;
    camP.position.set(0, cy + dist * 0.12, dist); camP.lookAt(0, cy, 0);
    draw(w, h, camP);
    const c = cv.getContext('2d'); c.clearRect(0, 0, W, H);
    // ombre au sol
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#000'; c.beginPath(); c.ellipse(W / 2, H * (opts.y || 0.76) + H * 0.12, W * 0.2, W * 0.05, 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.drawImage(CV, 0, S - h, w, h, 0, 0, W, H);
  };
  C3.poke = function (cv) { C3.pokeId = cv; C3.pokeT = performance.now() / 1000 - 0; C3._pokeAt = performance.now(); };

  // personnage en combat : rendu dans une tuile puis copié dans le canevas 2D (les murs passent ensuite par-dessus)
  const TILE = 200;
  C3.drawMatch = function (c, id, skin, o) {
    const m = model(id, skin); show(m);
    pose(m, { t: o.t, seed: o.seed, moving: o.moving, walk: o.walk, recoil: o.recoil, flash: o.flash, frozen: o.frozen, angry: o.angry, roll: o.roll, deathT: o.deathT, pose: o.pose, look: false });
    const a = o.deathT !== undefined ? o.deathAng : o.aim;
    m.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
    camM.position.set(0, 1.1 + 6 * Math.sin(0.82), 6 * Math.cos(0.82)); camM.lookAt(0, 1.1, 0);
    draw(TILE, TILE, camM);
    const sz = 132 * (o.sc || 1), al = o.deathT !== undefined ? Math.max(0, 1 - o.deathT / 0.8) : (o.alpha === undefined ? 1 : o.alpha);
    c.save(); c.globalAlpha = 0.3 * al; c.fillStyle = '#000'; c.beginPath(); c.ellipse(o.x, o.y + 12, 22 * (o.sc || 1), 9 * (o.sc || 1), 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = al; c.drawImage(CV, 0, S - TILE, TILE, TILE, o.x - sz / 2, o.y - (o.z || 0) - sz * 0.74, sz, sz); c.restore();
  };

  // branchement : portraits animés des menus en 3D
  const base = G.Render.portrait;
  G.Render.portrait = function (cv, id, skin, t, opts) {
    if (!C3.enabled(false) || cv.width < 200) return base.apply(this, arguments);
    try { C3.portrait(cv, id, skin, t, opts); } catch (e) { C3.failed = true; base.apply(this, arguments); }
  };
})();
