/* Test des commandes tactiles (vrai toucher multipoint émulé, écran de téléphone 844x390) : node tools/test-touch.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message + (e.stack || '').split('\n').slice(0, 3).join('|')));
  await p.addInitScript(() => localStorage.setItem('brawlrush_save_v1', JSON.stringify({ tutorialDone: true, lastDaily: 99999999 })));
  await p.goto('file://' + require('path').resolve(__dirname, '../app/src/main/assets/www/index.html')); await p.waitForTimeout(3000);
  const cdp = await ctx.newCDPSession(p);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  const S = (f, a) => p.evaluate(f, a);
  await S(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.hideAll(); G.App.begin(G.Sim.create({ mode: 'bounty', mapKey: 'canyon', brawlerId: 'sherry', skin: 'classic', level: 3, trophies: 300, name: 'Moi', event: 'none' })); });
  await p.waitForTimeout(4300);
  await S(() => { const M = G.App.M; M.ents.forEach(e => { if (e !== M.player) { e.stun = 999; } }); }); // bots figés pour un test propre
  const L = await S(() => G.Render.layout(844, 390));
  const res = {};
  // 1. joystick flottant : petit glissement -> pleine vitesse
  await T('touchStart', [[150, 250, 1]]); await p.waitForTimeout(40);
  const j0 = await S(() => ({ bx: G.Input.joy.bx, by: G.Input.joy.by, a: G.Input.joy.active }));
  await T('touchMove', [[156, 250, 1]]); await p.waitForTimeout(30); res.tiny = await S(() => +G.Input.joy.mx.toFixed(2));
  await T('touchMove', [[172, 250, 1]]); await p.waitForTimeout(30); res.small = await S(() => +G.Input.joy.mx.toFixed(2));
  const x0 = await S(() => G.App.M.player.x); await p.waitForTimeout(500); const x1 = await S(() => G.App.M.player.x);
  res.joyBase = [Math.round(j0.bx), Math.round(j0.by), j0.a]; res.moved05s = Math.round(x1 - x0);
  // base qui suit le doigt
  await T('touchMove', [[320, 250, 1]]); await p.waitForTimeout(30); res.follow = await S(() => Math.round(G.Input.joy.bx));
  // 2. multi-doigts : joystick + glisser l'attaque vers le haut puis relâcher
  const am0 = await S(() => G.App.M.player.ammo);
  await T('touchStart', [[320, 250, 1], [L.atkX, L.atkY, 2]]); await p.waitForTimeout(40);
  await T('touchMove', [[320, 250, 1], [L.atkX - 60, L.atkY - 20, 2]]); await p.waitForTimeout(60);
  await p.screenshot({ path: require('os').tmpdir() + '/touch_aim.png' });
  res.aimDrag = await S(() => ({ drag: G.Input.atk.drag, prev: !!G.Input.aimPreview(G.App.M), joyStill: G.Input.joy.active }));
  await T('touchEnd', [[L.atkX - 60, L.atkY - 20, 2]]); await p.waitForTimeout(80);
  res.dragShot = +(am0 - await S(() => G.App.M.player.ammo)).toFixed(2);
  // 3. annulation : glisser puis revenir au centre
  const am1 = await S(() => G.App.M.player.ammo);
  await T('touchStart', [[320, 250, 1], [L.atkX, L.atkY, 3]]); await T('touchMove', [[320, 250, 1], [L.atkX - 70, L.atkY, 3]]); await p.waitForTimeout(40);
  await T('touchMove', [[320, 250, 1], [L.atkX - 3, L.atkY + 2, 3]]); await p.waitForTimeout(40);
  res.cancelState = await S(() => G.Input.atk.cancel);
  await p.screenshot({ path: require('os').tmpdir() + '/touch_cancel.png' });
  await T('touchEnd', [[L.atkX - 3, L.atkY + 2, 3]]); await p.waitForTimeout(80);
  res.cancelNoShot = Math.abs(am1 - await S(() => G.App.M.player.ammo)) < 0.05 || (await S(() => G.App.M.player.ammo)) > am1;
  // 4. tap rapide = tir automatique
  await S(() => { G.App.M.player.ammo = 3; });
  await T('touchStart', [[320, 250, 1], [L.atkX + 3, L.atkY, 4]]); await p.waitForTimeout(30); await T('touchEnd', [[L.atkX + 3, L.atkY, 4]]); await p.waitForTimeout(60);
  res.tapShot = await S(() => G.App.M.player.ammo < 2.5);
  // 5. super glissé (aperçu)
  await S(() => { G.App.M.player.superCharge = 1; });
  await T('touchStart', [[320, 250, 1], [L.supX, L.supY, 5]]); await T('touchMove', [[320, 250, 1], [L.supX - 50, L.supY - 40, 5]]); await p.waitForTimeout(60);
  await p.screenshot({ path: require('os').tmpdir() + '/touch_super.png' });
  await T('touchEnd', [[L.supX - 50, L.supY - 40, 5]]); await p.waitForTimeout(80);
  res.superUsed = await S(() => G.App.M.player.superCharge < 1);
  // 6. doigt annulé par le système -> joystick relâché
  await T('touchCancel', []); await p.waitForTimeout(60);
  res.afterCancel = await S(() => ({ joy: G.Input.joy.active, mx: G.Input.joy.mx }));
  // 7. glisse dans un coin de mur
  res.corner = await S(() => {
    const M = G.App.M, b = M.player, Tt = G.T; let found = null;
    for (let ty = 2; ty < M.h - 2 && !found; ty++) for (let tx = 2; tx < M.w - 2 && !found; tx++) {
      const s = (x, y) => G.isSolidTile(G.Sim.tile(M, x, y));
      if (s(tx, ty) && !s(tx - 1, ty) && !s(tx - 1, ty - 1) && !s(tx, ty - 1) && !s(tx + 1, ty - 1) && !s(tx - 2, ty) && !s(tx - 1, ty + 1) && !s(tx - 2, ty - 1)) found = [tx, ty];
    }
    if (!found) return 'pas de coin';
    const [tx, ty] = found; b.x = tx * Tt - b.r - 1; b.y = ty * Tt + 7; b.px = b.x; b.py = b.y; b.kx = b.ky = 0;
    const sx = b.x; b.input.mx = 1; b.input.my = 0;
    for (let i = 0; i < 30; i++) G.Sim.update(M, 1 / 60);
    b.input.mx = 0; return { passed: Math.round(b.x - sx), dy: Math.round(b.y - (ty * Tt + 7)) };
  });
  console.log(JSON.stringify(res));
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
