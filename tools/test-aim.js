/* Test de précision du tir (toucher réel émulé) : node tools/test-aim.js
   Pour plusieurs brawlers : doigt posé hors du centre du bouton, visée dans 8 directions avec des ennemis proches de la ligne de tir,
   le projectile doit partir exactement dans la direction visée (plus d'aimantation imprévisible). */
const { chromium } = require('playwright');
const GAME = 'file://' + require('path').resolve(__dirname, '../app/src/main/assets/www/index.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('brawlrush_save_v1', JSON.stringify({ tutorialDone: true, lastDaily: 99999999, settings: { chars3dMatch: false } }))); // test de la visée (pas du rendu 3D)
  await p.goto(GAME); await p.waitForTimeout(2500);
  const cdp = await ctx.newCDPSession(p); const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  let fails = 0, id = 1;
  for (const bid of ['rex', 'sherry', 'boomer', 'volt']) {
    await p.evaluate((bid) => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.hideAll(); G.App.begin(G.Sim.create({ mode: 'bounty', mapKey: 'canyon', brawlerId: bid, skin: 'classic', level: 3, trophies: 300, name: 'Moi', event: 'none' })); }, bid);
    await p.waitForTimeout(1500); for (let w = 0; w < 60 && !(await p.evaluate(() => G.App.M && G.App.M.state === 'play')); w++) await p.waitForTimeout(200); // fin du compte à rebours (rendu logiciel plus lent)
    const L = await p.evaluate(() => G.Render.layout(844, 390));
    let worst = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      await p.evaluate((a) => { const M = G.App.M, me = M.player; me.ammo = 3; me.atkCd = 0; me.queue && (me.queue.length = 0); const free = (x, y) => [0, 1, 2, 3, 4, 5, 6, 7].every((j) => { const t = j / 8 * 6.283; for (let r = 0; r <= 240; r += 20) if (G.isBulletTile(G.Sim.tileAt(M, x + Math.cos(t) * r, y + Math.sin(t) * r))) return false; return true; });
        let fx = M.w * G.T / 2, fy = M.h * G.T / 2; for (let tries = 0; tries < 4000 && !free(fx, fy); tries++) { fx = G.T * (3 + Math.random() * (M.w - 6)); fy = G.T * (3 + Math.random() * (M.h - 6)); } me.x = fx; me.y = fy; window.__shots = []; if (!G.Sim.__h) { const o = G.Sim.tryAttack; G.Sim.tryAttack = function (M2, b2, ang) { const r = o.apply(this, arguments); if (r && b2 === M2.player) (window.__shots = window.__shots || []).push(ang); return r; }; G.Sim.__h = 1; } me.px = me.x; me.py = me.y; M.projs.length = 0;
        M.ents.forEach((e, i) => { if (e !== me) { const off = a + (i % 2 ? 0.09 : -0.09); e.x = me.x + Math.cos(off) * 220; e.y = me.y + Math.sin(off) * 220; e.stun = 99; } }); }, a);
      const sx = L.atkX + 14, sy = L.atkY - 10, f = ++id; // doigt posé hors du centre du bouton
      await T('touchStart', [[sx, sy, f]]); await T('touchMove', [[sx + Math.cos(a) * 25, sy + Math.sin(a) * 25, f]]); await T('touchMove', [[sx + Math.cos(a) * 60 + 1.5, sy + Math.sin(a) * 60 - 1.5, f]]);
      await p.waitForTimeout(40); await T("touchEnd", [[sx + Math.cos(a) * 60, sy + Math.sin(a) * 60, f]]); await p.waitForTimeout(80);
      const shot = await p.evaluate(() => (window.__shots && window.__shots.length ? window.__shots[0] : null));
      if (shot === null) { worst = 9; continue; }
      const d = Math.abs(Math.atan2(Math.sin(shot - a), Math.cos(shot - a))) * 180 / Math.PI; worst = Math.max(worst, d);
    }
    const ok = worst < 4; if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + bid + ' : écart maximal entre visée et tir sur 8 directions = ' + (worst === 9 ? 'aucun tir' : worst.toFixed(1) + '°'));
  }
  console.log(errs.length ? 'ERREURS : ' + errs.join(' | ') : 'aucune erreur'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
