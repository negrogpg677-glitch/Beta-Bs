/* Test de bout en bout en ligne : 2 « téléphones » (navigateurs séparés) + serveur local.
   Amis -> invitation (liste d'amis) -> fenêtre d'invitation -> acceptation -> coéquipier 3D dans le salon -> chat en temps réel.
   Usage : node tools/test-team.js [dossier_captures] */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'), os = require('os');
const GAME = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html'), OUT = process.argv[2] || os.tmpdir(), PORT = 18093;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', [path.resolve(__dirname, '../server/server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: path.join(os.tmpdir(), 'brteam' + Date.now()) }), stdio: 'ignore' });
  await sleep(1200);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }); const errs = [];
  async function phone(name, brawler) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await ctx.addInitScript(([n, br]) => localStorage.setItem('brawlrush_save_v1', JSON.stringify({ name: n, tutorialDone: true, lastDaily: 99999999, unlocked: ['sherry', 'rex', br], selected: br, trophies: { [br]: 150 }, levels: { [br]: 3 }, settings: { quality: 'high', sound: false, music: false, vibrate: false, aimAssist: true, lefty: false } })), [name, brawler]);
    await p.goto(GAME + '?server=127.0.0.1:' + PORT); await p.waitForTimeout(2500); await p.mouse.click(422, 200); await p.waitForTimeout(800);
    await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.hideAll(); G.UI.show('home'); });
    for (let i = 0; i < 40 && (await p.evaluate(() => G.Net.status)) !== 'online'; i++) await sleep(250);
    return p;
  }
  const A = await phone('Alice', 'taurus'), B = await phone('Bruno', 'pyro');
  ok(await A.evaluate(() => G.Net.status === 'online') && await B.evaluate(() => G.Net.status === 'online'), 'les deux téléphones sont connectés au serveur');
  // amitié
  await B.evaluate(() => G.Net.send({ t: 'friends_get' })); await sleep(300);
  const codeB = await B.evaluate(() => (G.Net.friends && G.Net.friends.code) || G.Net.friendCode);
  await A.evaluate((c) => G.Net.send({ t: 'friend_add', code: c }), codeB); await sleep(500);
  // A ouvre « Inviter des amis » depuis le + du salon
  await A.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); }); await A.click('.mate.l .tslot', { force: true }); await sleep(700);
  ok(await A.isVisible('.invpanel [data-act=invFriend]'), 'liste d\'amis disponibles avec bouton INVITER');
  await A.screenshot({ path: path.join(OUT, 'team_1_liste.png') });
  await A.click('.invpanel [data-act=invFriend]', { force: true }); await sleep(800);
  ok(await B.isVisible('.invm'), 'B reçoit la fenêtre « Invitation d\'équipe »');
  await sleep(600); await B.screenshot({ path: path.join(OUT, 'team_2_invitation.png') });
  await A.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); }); await sleep(300);
  ok(await A.isVisible('.inv-card'), 'A voit la carte « INVITATION » en attente dans le salon');
  await A.screenshot({ path: path.join(OUT, 'team_3_attente.png') });
  await B.click('.invm [data-act=invAccept2]', { force: true }); await sleep(1500);
  const sa = await A.evaluate(() => ({ party: G.Net.party && G.Net.party.members.length, mate: !!document.querySelector('.mate .mate-cv'), name: (document.querySelector('.mate .mate-name') || {}).textContent }));
  ok(sa.party === 2 && sa.mate && /Bruno/.test(sa.name), 'B a rejoint : son personnage 3D apparaît à côté de celui de A (' + sa.name + ')');
  const sb = await B.evaluate(() => ({ mate: !!document.querySelector('.mate .mate-cv'), name: (document.querySelector('.mate .mate-name') || {}).textContent }));
  ok(sb.mate && /Alice/.test(sb.name), 'chez B aussi, le personnage de A est affiché (' + sb.name + ')');
  await sleep(900); await A.screenshot({ path: path.join(OUT, 'team_4_salon.png') });
  // chat en temps réel
  await B.evaluate(() => G.UI.ACT.chatQuick({ dataset: { t: 'Salut !' } })); await sleep(700);
  ok(await A.evaluate(() => G.UI.team.chat.some((m) => m.text === 'Salut !' && m.name === 'Bruno')), 'A reçoit le message rapide de B en temps réel');
  await A.evaluate(() => G.UI.chatOpen()); await A.fill('#chatIn', 'On lance une partie ?'); await A.press('#chatIn', 'Enter'); await sleep(700);
  ok(await B.evaluate(() => G.UI.team.chat.some((m) => m.text === 'On lance une partie ?' && m.name === 'Alice')), 'B reçoit le message écrit de A');
  ok(await B.evaluate(() => G.UI.team.unread >= 1 && !document.querySelector('.chatbtn .badge').hidden), 'badge de messages non lus chez B');
  await A.screenshot({ path: path.join(OUT, 'team_5_chat.png') });
  console.log(errs.length ? 'ERREURS : ' + errs.join(' | ') : 'aucune erreur JS');
  await b.close(); srv.kill(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
