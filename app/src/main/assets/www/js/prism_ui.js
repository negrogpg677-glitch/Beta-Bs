/* Brawl Rush - PRISM : interface joueur (v4.4)
   Direction artistique « PRISM » : verre sombre, arêtes prismatiques (cyan → violet → magenta → ambre), formes « taillées »,
   couleur d'ambiance qui suit le personnage choisi. S'applique au salon, aux brawlers, aux résultats, à la recherche de
   partie, aux réglages et aux fenêtres du joueur. Le menu développeur (Dev Hub) n'est PAS concerné.
   Toutes les actions existantes (data-act) sont conservées : on ne fait que réorganiser et habiller. */
(function () {
  const G = window.G, UI = G.UI; if (!UI) return;
  const { $, $$, esc, fmt, S, ic, skinOf } = UI.h, ACT = UI.ACT;
  document.body.classList.add('prism');
  const owned = () => G.BRAWLERS.filter((b) => S().unlocked.includes(b.id)).map((b) => b.id);

  /* ---------- couleur d'ambiance du personnage (transition douce via CSS) ---------- */
  let bgHue = null;
  function applyHero(id) {
    const c = G.heroColor ? G.heroColor(id) : ['#8a7cff', '#36f0ff'];
    document.body.style.setProperty('--hc', c[0]); document.body.style.setProperty('--hc2', c[1]);
    bgHue = c;
  }
  G.PrismUI = { applyHero };
  // fenêtres du joueur (UI.modal) : marquées pour le style PRISM ; le Dev Hub et l'ancien panneau développeur ne passent pas par là
  const baseModal = UI.modal; UI.modal = function () { const o = baseModal.apply(this, arguments); if (o && o.classList) o.classList.add('pz-m'); return o; };

  /* ---------- fond des menus : lumière prismatique teintée par le personnage ---------- */
  const R = G.Render, rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  let cur = [138, 124, 255], cur2 = [54, 240, 255], shards = null;
  let lastBg = -1;
  R.drawMenuBg = function (c, W, H, time) {
    if (time - lastBg < (R.q < 1 ? 0.1 : 0.033) && time >= lastBg) return; lastBg = time; // 30 images/s suffisent (10 en économie)
    const eco = R.q < 1, tgt = bgHue ? rgb(bgHue[0]) : [138, 124, 255], tgt2 = bgHue ? rgb(bgHue[1]) : [54, 240, 255];
    for (let i = 0; i < 3; i++) { cur[i] += (tgt[i] - cur[i]) * 0.05; cur2[i] += (tgt2[i] - cur2[i]) * 0.05; }
    const C = (a, k) => 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + k + ')';
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0920'); g.addColorStop(0.6, '#141033'); g.addColorStop(1, '#1d1240'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // halo du personnage (centre, légèrement à gauche comme la scène)
    const hx = W * 0.47, hy = H * 0.58, hg = c.createRadialGradient(hx, hy, 0, hx, hy, H * 0.75); hg.addColorStop(0, C(cur, 0.42)); hg.addColorStop(0.45, C(cur2, 0.12)); hg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = hg; c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter';
    // faisceaux réfractés (spectre)
    const hues = ['54,240,255', '138,92,255', '255,79,216', '255,178,26'];
    for (let i = 0; i < 4; i++) {
      const sw = eco ? 0 : Math.sin(time * 0.25 + i * 1.7) * W * 0.03, x0 = W * (0.12 + i * 0.06) + sw;
      c.beginPath(); c.moveTo(x0, -10); c.lineTo(x0 + W * 0.05, -10); c.lineTo(x0 + W * 0.42 + sw, H + 10); c.lineTo(x0 + W * 0.3 + sw, H + 10); c.closePath();
      const lg = c.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, 'rgba(' + hues[i] + ',0.10)'); lg.addColorStop(1, 'rgba(' + hues[i] + ',0)'); c.fillStyle = lg; c.fill();
    }
    // éclats prismatiques qui flottent (parallaxe)
    if (!shards || shards.W !== W) { shards = []; shards.W = W; for (let i = 0; i < 22; i++) shards.push({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 1.2, r: Math.random() * 6, v: 0.004 + Math.random() * 0.012, h: i % 4 }); }
    const n = eco ? 8 : shards.length;
    for (let i = 0; i < n; i++) {
      const p = shards[i], y = ((p.y - time * p.v) % 1 + 1) % 1, x = p.x * W + Math.sin(time * 0.3 + i) * 6, sz = p.s * H * 0.035;
      c.save(); c.translate(x, y * (H + 40) - 20); c.rotate(p.r + time * 0.2 * (i % 2 ? 1 : -1));
      c.beginPath(); c.moveTo(0, -sz); c.lineTo(sz * 0.7, sz * 0.6); c.lineTo(-sz * 0.7, sz * 0.6); c.closePath();
      c.fillStyle = 'rgba(' + hues[p.h] + ',' + (0.05 + 0.05 * p.s) + ')'; c.fill(); c.strokeStyle = 'rgba(' + hues[p.h] + ',0.35)'; c.lineWidth = 1; c.stroke(); c.restore();
    }
    // sol en perspective
    c.strokeStyle = C(cur, 0.16); c.lineWidth = 1; const hz = H * 0.72;
    for (let i = 1; i < 8; i++) { const k = i / 8, y = hz + (H - hz) * k * k; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(W / 2 + i * W * 0.02, hz); c.lineTo(W / 2 + i * W * 0.16, H); c.stroke(); }
    c.restore();
    const v = c.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.5, H * 1.0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,0.55)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  };

  /* ---------- salon : scène, plaque du personnage, changement rapide de brawler ---------- */
  const baseHome = UI.build.home;
  UI.build.home = function () {
    baseHome.apply(this, arguments);
    const home = $('#home'); if (!home) return;
    const sv = S(), id = sv.selected; home.classList.add('pz'); applyHero(id);
    const cv = home.querySelector('.hero'), a = UI.anim.find((x) => x.cv === cv);
    if (a) Object.assign(a.opts, { stage: true, zoom: 0.9, y: 0.74 });
    const st = home.querySelector('.stage2'), plate = home.querySelector('.hplate');
    if (st && plate && !st.querySelector('.pz-plate')) {
      const w = document.createElement('div'); w.className = 'pz-plate';
      const n = owned().length;
      w.innerHTML = `${n > 1 ? '<button class="pz-arr" data-act="pzPrev" aria-label="Brawler précédent">‹</button>' : ''}<div class="pz-pl"></div>${n > 1 ? '<button class="pz-arr" data-act="pzNext" aria-label="Brawler suivant">›</button>' : ''}`;
      st.appendChild(w); w.querySelector('.pz-pl').appendChild(plate);
      plate.insertAdjacentHTML('afterend', '<div class="pz-role"></div>');
      fillPlate(home, id);
    }
  };
  function fillPlate(home, id) {
    const sv = S(), b = G.BRAWLER[id], r = G.RARITY[b.rarity], plate = home.querySelector('.hplate'), role = home.querySelector('.pz-role');
    if (plate) plate.innerHTML = `<span class="lvl">${sv.levels[id] || 1}</span><b>${esc(b.name)}</b><span class="ht">${ic('trophy')} ${fmt(sv.trophies[id] || 0)}</span>`;
    if (role) role.innerHTML = `${esc(b.role)} <i style="--rc:${r.color}">${esc(r.name)}</i>${b.prism ? '<em>NOUVEAU</em>' : ''}`;
  }
  function cycle(d) {
    const list = owned(), sv = S(); if (list.length < 2) return;
    const i = list.indexOf(sv.selected), id = list[(i + d + list.length) % list.length];
    sv.selected = id; G.Save.commit(); G.Audio.sfx('ui'); G.vibrate && G.vibrate(10);
    if (G.Net && G.Net.status === 'online' && G.Net.sendProfile) G.Net.sendProfile();
    const home = $('#home'), cv = home && home.querySelector('.hero'), a = UI.anim.find((x) => x.cv === cv);
    if (a) { a.id = id; a.skin = skinOf(id); }
    applyHero(id); fillPlate(home, id);
    const pl = home.querySelector('.pz-plate'); if (pl) { pl.classList.remove('sw'); void pl.offsetWidth; pl.classList.add('sw'); }
  }
  ACT.pzNext = () => cycle(1); ACT.pzPrev = () => cycle(-1);
  // glisser horizontalement sur le personnage ≠ changer : le glissé fait tourner le modèle (comportement existant)

  /* ---------- écran Brawlers : vraie mise en scène dans la fiche ---------- */
  function dressBrawlers() {
    const root = $('#brawlers'); if (!root) return;
    root.classList.add('pz');
    $$('.bw-card', root).forEach((c) => {
      const b = G.BRAWLER[c.dataset.id]; if (!b || c.querySelector('.pz-cr')) return;
      c.insertAdjacentHTML('beforeend', `<div class="pz-cr">${esc(b.role)}</div>${b.prism ? '<div class="pz-newb">NOUVEAU</div>' : ''}`);
    });
    const d = $('#bwDetail'); if (!d) return;
    const id = UI.selBrawler, cv = d.querySelector('.anim-detail'), a = UI.anim.find((x) => x.cv === cv);
    if (cv) cv.style.background = 'transparent';
    if (a) Object.assign(a.opts, { stage: true, zoom: 0.8, y: 0.74, idleShow: true });
    const c = G.heroColor(id); d.style.setProperty('--hc', c[0]); d.style.setProperty('--hc2', c[1]);
  }
  const baseBw = UI.build.brawlers; UI.build.brawlers = function () { baseBw.apply(this, arguments); dressBrawlers(); };
  const baseSel = ACT.selBrawler; ACT.selBrawler = function () { baseSel.apply(this, arguments); dressBrawlers(); };

  /* ---------- résultats : le personnage sur sa scène, pose de victoire / défaite ---------- */
  const baseRes = UI.showResult;
  UI.showResult = function (Rr) {
    baseRes.apply(this, arguments);
    const o = document.querySelector('.fullscreen.result'); if (!o) return;
    const r = Rr.r, cls = r.win ? 'win' : r.draw ? 'draw' : 'lose', b = G.BRAWLER[Rr.brawler], mode = G.MODES[Rr.mode];
    o.classList.add('pz', cls); applyHero(Rr.brawler);
    const cv = o.querySelector('.rrow canvas'), a = UI.anim.find((x) => x.cv === cv);
    if (a) Object.assign(a.opts, { stage: true, pose: r.win ? 'win' : r.draw ? undefined : 'lose', zoom: 0.85, y: 0.76, happy: false });
    const rb = o.querySelector('.rb'); if (rb) rb.insertAdjacentHTML('afterend', `<div class="pz-rsub">${esc(mode ? mode.name : '')} · ${esc(b ? b.name : '')}</div>`);
  };

  /* ---------- recherche de partie / face-à-face ---------- */
  const baseMM = UI.matchmaking; UI.matchmaking = function () { const r = baseMM.apply(this, arguments); const o = document.querySelector('.fullscreen.mm'); if (o) o.classList.add('pz'); return r; };
  const baseVs = UI.versus; UI.versus = function () { const r = baseVs.apply(this, arguments); const o = document.querySelector('.fullscreen.vs'); if (o) o.classList.add('pz'); return r; };

  // premier affichage : couleur du brawler sélectionné
  try { applyHero(S().selected); } catch (e) { /* sauvegarde pas encore prête */ }
})();
