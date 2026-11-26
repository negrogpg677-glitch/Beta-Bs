/* Brawl Rush - thème « NEO 2030 » du salon : fond animé (aurore, grille néon en perspective, particules, faisceaux),
   plateforme holographique sous le brawler, panneaux en verre aux bordures néon, entrées animées.
   Léger : 30 images/s maximum, arrêté hors du salon et en partie, version fixe en qualité « éco ». */
(function () {
  const G = window.G, UI = G.UI;
  document.body.classList.add('t2030');
  let cv = null, ctx = null, raf = 0, last = 0, t0 = performance.now(), parts = [], W = 0, H = 0, dpr = 1;
  function ensure() {
    const home = document.getElementById('home'); if (!home) return null;
    const bg = home.querySelector('.hm-bg'); if (!bg) return null;
    if (!cv || !cv.isConnected) {
      cv = document.createElement('canvas'); cv.className = 'neo-bg'; bg.prepend(cv); ctx = cv.getContext('2d');
      const holo = document.createElement('div'); holo.className = 'neo-holo'; holo.innerHTML = '<i class="r1"></i><i class="r2"></i><i class="r3"></i><i class="beam"></i><i class="scan"></i>';
      const st = home.querySelector('.stage2'); if (st && !st.querySelector('.neo-holo')) st.insertBefore(holo, st.querySelector('.hero'));
      resize();
    }
    return cv;
  }
  function resize() {
    if (!cv) return; dpr = Math.min(2, window.devicePixelRatio || 1) * (eco() ? 0.5 : 0.75);
    W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    parts = []; for (let i = 0; i < (eco() ? 18 : 55); i++) parts.push(newP(true));
  }
  const eco = () => { const q = G.Save && G.Save.data.settings.quality; return q === 'eco' || q === 'low'; };
  function newP(any) { return { x: Math.random() * W, y: any ? Math.random() * H : H + 10, v: 8 + Math.random() * 26, r: 0.6 + Math.random() * 2.2, h: Math.random() < 0.6 ? 190 : Math.random() < 0.5 ? 275 : 320, a: 0.25 + Math.random() * 0.6, w: Math.random() * 6.28 }; }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const home = document.getElementById('home'), visible = home && UI.screen === 'home' && !(G.App && G.App.state === 'match');
    if (!visible || document.hidden) return;
    if (now - last < 33) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!ensure()) return;
    if (cv.clientWidth !== W || cv.clientHeight !== H) resize();
    const t = (now - t0) / 1000, c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ciel : dégradé profond + aurore
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#060a1f'); g.addColorStop(0.55, '#141a4a'); g.addColorStop(1, '#2a0f45');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const hue = [190, 270, 320][k], yb = H * (0.22 + k * 0.08);
      c.beginPath(); c.moveTo(0, yb);
      for (let x = 0; x <= W; x += W / 24) c.lineTo(x, yb + Math.sin(x / W * 6.28 * (1 + k * 0.3) + t * (0.35 + k * 0.12)) * H * 0.06 + Math.sin(x / 90 + t) * 6);
      c.lineTo(W, 0); c.lineTo(0, 0); c.closePath();
      const ag = c.createLinearGradient(0, yb - H * 0.25, 0, yb + H * 0.05); ag.addColorStop(0, 'hsla(' + hue + ',100%,60%,0)'); ag.addColorStop(1, 'hsla(' + hue + ',100%,62%,' + (eco() ? 0.10 : 0.16) + ')');
      c.fillStyle = ag; c.fill();
    }
    // grille néon en perspective (sol qui défile vers nous)
    const hz = H * 0.58, vx = W * 0.5;
    c.lineWidth = 1;
    for (let i = -14; i <= 14; i++) { const x1 = vx + i * W * 0.11; c.strokeStyle = 'rgba(52,245,255,' + (0.20 - Math.abs(i) * 0.011) + ')'; c.beginPath(); c.moveTo(vx + i * 6, hz); c.lineTo(x1, H); c.stroke(); }
    const sp = (t * 0.35) % 1;
    for (let j = 0; j < 12; j++) { const z = (j + sp) / 12, y = hz + (H - hz) * z * z; c.strokeStyle = 'rgba(138,92,255,' + (0.05 + z * 0.35) + ')'; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const hg = c.createLinearGradient(0, hz - 30, 0, hz + 40); hg.addColorStop(0, 'rgba(52,245,255,0)'); hg.addColorStop(0.5, 'rgba(52,245,255,.22)'); hg.addColorStop(1, 'rgba(52,245,255,0)');
    c.fillStyle = hg; c.fillRect(0, hz - 30, W, 70);
    // faisceaux lumineux
    if (!eco()) for (let k = 0; k < 2; k++) {
      const a = Math.sin(t * 0.4 + k * 2.1) * 0.35, x = W * (0.3 + k * 0.4);
      c.save(); c.translate(x, H); c.rotate(a); const bg2 = c.createLinearGradient(0, 0, 0, -H); bg2.addColorStop(0, 'rgba(255,61,200,.10)'); bg2.addColorStop(1, 'rgba(255,61,200,0)');
      c.fillStyle = bg2; c.beginPath(); c.moveTo(-18, 0); c.lineTo(18, 0); c.lineTo(80, -H); c.lineTo(-80, -H); c.closePath(); c.fill(); c.restore();
    }
    // particules qui montent
    for (const p of parts) {
      p.y -= p.v * dt; p.w += dt; p.x += Math.sin(p.w) * 0.25; if (p.y < -10) Object.assign(p, newP(false));
      c.fillStyle = 'hsla(' + p.h + ',100%,70%,' + p.a * (0.6 + 0.4 * Math.sin(p.w * 3)) + ')'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.29); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    // vignette
    const vg = c.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  // le salon est reconstruit souvent : on remet le fond et la plateforme à chaque fois
  const baseHome = UI.build.home;
  UI.build.home = function () { baseHome.apply(this, arguments); cv = null; ensure(); const h = document.getElementById('home'); if (h) { h.classList.remove('neo-in'); void h.offsetWidth; h.classList.add('neo-in'); } };
  window.addEventListener('resize', () => setTimeout(resize, 50));
  raf = requestAnimationFrame(frame);
  G.Neo2030 = { resize };
})();
