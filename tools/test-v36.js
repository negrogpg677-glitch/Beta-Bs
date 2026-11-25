/* Test v3.6 sur téléphone émulé (écran tactile type iPhone) + serveur local :
   rouleau des modes au doigt, partie en ligne sans bouton « Quitter », inactivité → sortie avec message,
   « Reprendre la partie » depuis l'accueil (état restauré par le serveur), classement mondial.
   Usage : node tools/test-v36.js [dossier_captures] */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'), os = require('os');
const GAME = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html'), OUT = process.argv[2] || os.tmpdir(), PORT = 18096;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', [path.resolve(__dirname, '../server/server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), AFK_SEC: '5', DATA_DIR: path.join(os.tmpdir(), 'br36' + Date.now()) }), stdio: 'ignore' });
  await sleep(1200);
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await ctx.addInitScript(() => localStorage.setItem('brawlrush_save_v1', JSON.stringify({ name: 'Iphone', tutorialDone: true, lastDaily: 99999999, guestChoice: true, unlocked: ['sherry', 'rex'], selected: 'rex', trophies: { rex: 320 }, levels: { rex: 4 } })));
  await p.goto(GAME + '?server=127.0.0.1:' + PORT); await p.waitForTimeout(2500);
  await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.hideAll(); G.UI.show('home'); });
  const cdp = await ctx.newCDPSession(p);
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1 })) });
  async function swipe(x0, x1, y, steps = 12) { await T('touchStart', [[x0, y]]); for (let i = 1; i <= steps; i++) { await T('touchMove', [[x0 + ((x1 - x0) * i) / steps, y + i * 0.6]]); await sleep(12); } await T('touchEnd', []); }

  // --- 1. rouleau des modes au doigt
  await p.evaluate(() => G.UI.ACT.modes()); await sleep(600);
  const IDX = () => p.evaluate(() => G.MODE_ORDER.indexOf(G.UI._mw.sel));
  const s0 = await IDX();
  await swipe(620, 260, 200); await sleep(900);
  const s1 = await IDX();
  ok(s1 !== s0, 'glisser le doigt fait tourner le rouleau (' + s0 + ' → ' + s1 + ')');
  await p.screenshot({ path: path.join(OUT, 'v36_1_rouleau.png') });
  await swipe(300, 640, 210); await sleep(900);
  const s2 = await IDX();
  ok(s2 !== s1, 'glisser dans l\'autre sens revient en arrière (' + s1 + ' → ' + s2 + ')');
  await swipe(422, 60, 200, 4); await sleep(1000); // geste rapide : élan
  const s3 = await IDX();
  ok(s3 >= s2 + 1, 'geste rapide : le rouleau garde de l\'élan (' + s2 + ' → ' + s3 + ')');
  const box = await p.evaluate(() => { const c = document.querySelector('.mw-card.on').getBoundingClientRect(); return { x: c.x + c.width / 2, y: c.y + c.height / 2, cx: innerWidth / 2 }; });
  ok(Math.abs(box.x - box.cx) < 30, 'la carte choisie est centrée (écart ' + Math.round(box.x - box.cx) + ' px)');
  const want = await p.evaluate(() => G.UI._mw.sel);
  await T('touchStart', [[box.x, box.y]]); await sleep(60); await T('touchEnd', []); await sleep(500);
  const picked = await p.evaluate(() => ({ mode: G.Save.data.mode, open: !!document.querySelector('.mw:not(.out)') }));
  ok(picked.mode === want && !picked.open, 'toucher la carte centrale choisit le mode « ' + picked.mode + ' » et ferme le rouleau');

  // --- 2. partie en ligne : pas de « Quitter »
  for (let i = 0; i < 40 && (await p.evaluate(() => G.Net.status)) !== 'online'; i++) await sleep(250);
  await p.evaluate(() => G.Net.startPrivate('gemgrab'));
  for (let i = 0; i < 40 && !(await p.evaluate(() => G.App.state === 'match' && G.App.M && G.App.M.ready !== false && G.App.M.ents && G.App.M.ents.length)); i++) await sleep(250);
  ok(await p.evaluate(() => G.App.state === 'match' && G.App.M.net), 'partie en ligne lancée');
  await p.evaluate(() => { G.UI.vsSkip && G.UI.vsSkip(); G.App.togglePause(); }); await sleep(400);
  const pz = await p.evaluate(() => ({ quit: !!document.querySelector('.overlay [data-act=quit]'), note: !!document.querySelector('.noquit') }));
  ok(!pz.quit && pz.note, 'pause en ligne : pas de bouton « Quitter », message explicatif');
  await p.screenshot({ path: path.join(OUT, 'v36_2_pause.png') });
  await p.evaluate(() => { G.App.quitMatch(); }); await sleep(300);
  ok(await p.evaluate(() => G.App.state === 'match'), 'forcer « quitter » ne sort pas de la partie');
  await p.evaluate(() => G.App.togglePause()); await sleep(200);

  // --- 3. inactivité
  for (let i = 0; i < 40 && (await p.evaluate(() => G.App.state === 'match')); i++) await sleep(300);
  const af = await p.evaluate(() => ({ st: G.App.state, modal: !!document.querySelector('.afkm'), res: !!G.Net.resumable }));
  ok(af.st !== 'match' && af.modal && af.res, 'inactif : sorti de la partie avec un message, partie toujours reprenable');
  await p.screenshot({ path: path.join(OUT, 'v36_3_inactif.png') });
  await p.evaluate(() => G.UI.closeModal()); await sleep(300);
  ok(await p.isVisible('#home .resumebar'), 'accueil : bouton « Reprendre la partie » visible');
  await p.screenshot({ path: path.join(OUT, 'v36_4_reprendre.png') });
  await p.click('#home .resumebar', { force: true });
  for (let i = 0; i < 30 && !(await p.evaluate(() => G.App.state === 'match' && G.App.M && G.App.M.ready !== false)); i++) await sleep(250);
  await sleep(600);
  const rs = await p.evaluate(() => { const M = G.App.M; return { st: G.App.state, ready: M && M.ready, you: M && M.you, hp: M && M.player && M.player.hp, bar: !!document.querySelector('#home .resumebar') }; });
  console.log(JSON.stringify(rs));
  ok(rs.st === 'match' && rs.hp > 0 && !rs.bar, 'reprise : retour dans la même partie (pv ' + rs.hp + '), bouton retiré');

  // --- 4. classement
  await p.evaluate(() => { G.App.leaveOnline(); G.UI.ACT.leaderboard(); }); await sleep(1500);
  ok(await p.evaluate(() => !!document.querySelector('#lbBody .lb-head') || /Personne/.test(document.querySelector('#lbBody').textContent)), 'classement : affiché depuis le serveur');
  await p.screenshot({ path: path.join(OUT, 'v36_5_classement.png') });
  // --- 5. joystick : mode fixe + sensibilité + réglages
  await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.ACT.settings(); }); await sleep(400);
  ok(await p.isVisible('#joySens') && await p.isVisible('#joySize') && await p.isVisible('[data-act=joyMode][data-v=fixed]'), 'réglages : mode du joystick, sensibilité et taille');
  await p.click('[data-act=joyMode][data-v=fixed]', { force: true }); await p.screenshot({ path: path.join(OUT, 'v36_6_reglages_joystick.png') });
  await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.hideAll(); G.App.begin(G.Sim.create({ mode: 'bounty', mapKey: 'canyon', brawlerId: 'sherry', skin: 'classic', level: 3, trophies: 300, name: 'Moi', event: 'none' })); });
  await sleep(4300); await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); });
  const L = await p.evaluate(() => G.Render.layout(G.Input.W, G.Input.H));
  await T('touchStart', [[L.joyX + 60, L.joyY - 30]]); await sleep(80);
  const jf = await p.evaluate(() => ({ bx: G.Input.joy.bx, by: G.Input.joy.by, mx: G.Input.joy.mx, act: G.Input.joy.active, en: G.Input.enabled, st: G.App.state, W: G.Input.W, top: (document.elementFromPoint(100, 300) || {}).className, html: ((document.elementFromPoint(100, 300) || {}).outerHTML || '').slice(0, 300) }));
  ok(Math.abs(jf.bx - L.joyX) < 2 && Math.abs(jf.by - L.joyY) < 2 && jf.mx > 0.5, 'mode fixe : la base reste à sa place, le doigt donne la direction');
  await T('touchMove', [[L.joyX + 400, L.joyY]]); await sleep(60);
  const jf2 = await p.evaluate(() => ({ bx: G.Input.joy.bx, mx: G.Input.joy.mx }));
  ok(Math.abs(jf2.bx - L.joyX) < 2 && jf2.mx > 0.95, 'mode fixe : la base ne suit pas le doigt, vitesse maximale');
  await T('touchEnd', []); await sleep(60);
  await p.evaluate(() => { G.Save.data.settings.joyMode = 'float'; G.Save.data.settings.joySens = 1; });
  const small = async () => { await T('touchStart', [[200, 250]]); await T('touchMove', [[200 + L.joyR * 0.18, 250]]); await sleep(50); const v = await p.evaluate(() => G.Input.joy.mx); await T('touchEnd', []); await sleep(50); return v; };
  const v1 = await small(); await p.evaluate(() => { G.Save.data.settings.joySens = 2; }); const v2 = await small();
  ok(v2 > v1 + 0.15, 'sensibilité : un petit geste va plus vite quand la sensibilité augmente (' + v1.toFixed(2) + ' → ' + v2.toFixed(2) + ')');
  await p.evaluate(() => { G.Save.data.settings.joySens = 1; });
  // --- 6. format 2 contre 2 hors ligne + entraînement
  const f2 = await p.evaluate(() => { G.App.quitMatch && G.App.state === 'match' && (G.App.M.state = 'end'); G.Save.data.fmt = 2; const M = G.App.prepare('gemgrab'); G.Save.data.fmt = 3; return { n: M.ents.length, t0: M.ents.filter((e) => e.team === 0).length }; });
  ok(f2.n === 4 && f2.t0 === 2, '2 contre 2 hors ligne : 4 brawlers, 2 par équipe');
  await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.App.state = 'menu'; G.App.M = null; G.UI.hideAll(); G.UI.show('home'); }); await sleep(400);
  ok(await p.isVisible('#home [data-act=training]'), 'accueil : bouton « Entraînement »');
  await p.evaluate(() => G.UI.ACT.training()); await sleep(5200);
  const tr = await p.evaluate(() => { const M = G.App.M, foes = M.ents.filter((e) => e.team !== M.player.team); return { training: M.training, moved: foes.some((e) => Math.hypot(e.x - e.spawn.x, e.y - e.spawn.y) > 4) }; });
  ok(tr.training && !tr.moved, 'entraînement : les adversaires restent immobiles (mannequins)');
  ok(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); srv.kill();
  console.log(fails ? '\n' + fails + ' ÉCHEC(S)' : '\nTOUS LES TESTS v3.6 PASSENT');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e); process.exit(2); });
