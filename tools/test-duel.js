/* Test de bout en bout du duel entre amis (2 téléphones + serveur local) : défi, acceptation, salon du duel,
   choix de l'arène, « Prêt » des deux joueurs, lancement automatique d'une vraie partie 1 contre 1 en ligne.
   Usage : node tools/test-duel.js [dossier_captures] */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'), os = require('os');
const GAME = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html'), OUT = process.argv[2] || os.tmpdir(), PORT = 18094;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', [path.resolve(__dirname, '../server/server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: path.join(os.tmpdir(), 'brduel' + Date.now()) }), stdio: 'ignore' });
  await sleep(1200);
  const b = await chromium.launch(); const errs = [];
  async function phone(name, brawler) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await ctx.addInitScript(([n, br]) => localStorage.setItem('brawlrush_save_v1', JSON.stringify({ name: n, tutorialDone: true, lastDaily: 99999999, guestChoice: true, unlocked: ['sherry', 'rex', br], selected: br, trophies: { [br]: 220 }, levels: { [br]: 4 }, settings: { quality: 'medium', sound: false, music: false, vibrate: false, aimAssist: true, lefty: false } })), [name, brawler]);
    await p.goto(GAME + '?server=127.0.0.1:' + PORT); await p.waitForTimeout(2500); await p.mouse.click(422, 200); await p.waitForTimeout(800);
    await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.hideAll(); G.UI.show('home'); });
    for (let i = 0; i < 40 && (await p.evaluate(() => G.Net.status)) !== 'online'; i++) await sleep(250);
    return p;
  }
  const A = await phone('Alice', 'taurus'), B = await phone('Bruno', 'pyro');
  await B.evaluate(() => G.Net.send({ t: 'friends_get' })); await sleep(300);
  const codeB = await B.evaluate(() => (G.Net.friends && G.Net.friends.code) || G.Net.friendCode);
  await A.evaluate((c) => G.Net.send({ t: 'friend_add', code: c }), codeB); await sleep(600);
  const pidB = await A.evaluate(() => (G.Net.friends.list.find((f) => f.name === 'Bruno') || {}).pid);
  ok(!!pidB, 'Alice et Bruno sont amis');
  await A.evaluate((pid) => G.UI.ACT.duelFriend({ dataset: { pid } }), pidB); await sleep(900);
  ok(await B.evaluate(() => /DÉFI EN DUEL/.test((document.querySelector('.invm-h') || {}).textContent || '')), 'Bruno reçoit « ⚔ DÉFI EN DUEL »');
  await B.screenshot({ path: path.join(OUT, 'duel_1_defi.png') });
  await B.click('.invm [data-act=invAccept2]', { force: true }); await sleep(1300);
  ok(await A.isVisible('#duelBody') && await B.isVisible('#duelBody'), 'salon du duel ouvert chez les deux joueurs (cartes face à face)');
  await A.click('[data-act=duelMap][data-k=arene2]', { force: true }); await sleep(600);
  ok(await B.evaluate(() => G.Net.party && G.Net.party.map === 'arene2'), 'le chef choisit l\'arène « Toit de minuit », synchronisée chez l\'adversaire');
  await A.click('[data-act=duelReady]', { force: true }); await sleep(600);
  await A.screenshot({ path: path.join(OUT, 'duel_2_salon.png') });
  ok(await A.evaluate(() => G.App.state !== 'match'), 'pas de lancement tant qu\'un seul joueur est prêt');
  await B.click('[data-act=duelReady]', { force: true });
  for (let i = 0; i < 40 && !(await A.evaluate(() => G.App.state === 'match' && G.App.M && G.App.M.ready !== false && G.App.M.ents && G.App.M.ents.length)); i++) await sleep(300);
  const ma = await A.evaluate(() => ({ st: G.App.state, mode: G.App.M && G.App.M.mode, n: G.App.M && G.App.M.ents.filter(Boolean).length, map: G.App.M && G.App.M.mapKey, humans: G.App.M && G.App.M.ents.filter((e) => e && e.human).length }));
  ok(ma.st === 'match' && ma.mode === 'duel' && ma.n === 2 && ma.humans === 2, 'les deux prêts : vraie partie en ligne 1 contre 1 (' + JSON.stringify(ma) + ')');
  ok(ma.map === 'arene2', 'la partie se joue sur l\'arène choisie');
  await sleep(4500); await A.screenshot({ path: path.join(OUT, 'duel_3_combat.png') });
  console.log(errs.length ? 'ERREURS : ' + errs.join(' | ') : 'aucune erreur JS');
  await b.close(); srv.kill(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
