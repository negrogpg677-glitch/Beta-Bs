/* Test de l'interface des comptes en ligne (2 téléphones, serveur réel, Supabase imité) : connexion, identifiant, demande d'ami
   par identifiant, acceptation, présence, modification d'identifiant, cadeau du développeur, mode classé (fermé / accès anticipé).
   Usage : node tools/test-social-ui.js [dossier_captures] */
'use strict';
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'), os = require('os');
const MOCK = 54391, OUT = process.argv[2] || os.tmpdir();
process.env.SUPABASE_URL = 'http://127.0.0.1:' + MOCK; process.env.SUPABASE_SECRET = 'service-test-key';
process.env.DEV_EMAILS = 'dev@test.fr'; process.env.RANKED_AT = new Date(Date.now() + 5 * 3600e3).toISOString();
process.env.DATA_DIR = path.join(os.tmpdir(), 'brsui' + Date.now());
const GAME = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const mock = spawn('node', [path.join(__dirname, 'supabase-mock.js'), String(MOCK)], { stdio: 'ignore' }); await sleep(700);
  const S = require('../server/server.js'); await new Promise((r) => S.server.listen(0, r)); const port = S.server.address().port;
  const api = async (p, b) => (await fetch('http://127.0.0.1:' + MOCK + p, { method: 'POST', headers: { apikey: 'anon-test-key', 'content-type': 'application/json' }, body: JSON.stringify(b) })).json();
  await api('/auth/v1/signup', { email: 'dev@test.fr', password: 'secret123', data: { username: 'DevBoss' } });
  await api('/auth/v1/signup', { email: 'bob@test.fr', password: 'secret123', data: { username: 'Bob' } });
  const b = await chromium.launch(); const errs = [];
  async function phone(name, email) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    await ctx.route(/supabase\.co\//, async (route) => { // le vrai projet est remplacé par l'imitation locale
      const r = route.request(), u = new URL(r.url()), h = Object.assign({}, r.headers(), { apikey: 'anon-test-key' });
      const res = await route.fetch({ url: 'http://127.0.0.1:' + MOCK + u.pathname + u.search, headers: h }); await route.fulfill({ response: res });
    });
    await ctx.addInitScript(() => localStorage.setItem('brawlrush_save_v1', JSON.stringify({ tutorialDone: true, lastDaily: 99999999, gems: 50, settings: { quality: 'medium', sound: false, music: false, vibrate: false, aimAssist: true, lefty: false } })));
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.goto(GAME + '?server=127.0.0.1:' + port); await p.waitForTimeout(2500); await p.mouse.click(422, 200); await p.waitForTimeout(800);
    if (!(await p.isVisible('#accBody'))) await p.evaluate(() => G.UI.accountModal('login'));
    await p.click('[data-act=accTab][data-k=login]', { force: true }); await p.fill('#acc_id', email); await p.fill('#acc_pass', 'secret123'); await p.click('[data-act=accLogin]', { force: true });
    for (let i = 0; i < 40 && !(await p.evaluate(() => !!(G.Net.me && G.Net.fr))); i++) await sleep(250);
    await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); });
    return p;
  }
  const D = await phone('Dev', 'dev@test.fr'), B = await phone('Bob', 'bob@test.fr');
  const md = await D.evaluate(() => G.Net.me), mb = await B.evaluate(() => G.Net.me);
  ok(md && /^[A-Z]{4,16}$/.test(md.handle) && md.dev === true, 'connexion du compte développeur : identifiant ' + (md && md.handle) + ', droits développeur reconnus');
  ok(mb && /^[A-Z]{4,16}$/.test(mb.handle) && !mb.dev, 'connexion de Bob : identifiant ' + (mb && mb.handle));
  // Bob ajoute le développeur par son identifiant
  await B.evaluate(() => { G.UI.socialTab = 'friends'; G.UI.frTab = 'add'; G.UI.show('social'); }); await sleep(600);
  await B.fill('#frIn', md.handle.toLowerCase()); await B.click('[data-act=frSearch]', { force: true }); await sleep(700);
  ok(await B.isVisible('#frRes [data-act=frReq]'), 'recherche par identifiant : profil trouvé avec « Demander en ami »');
  await B.screenshot({ path: path.join(OUT, 'soc_add.png') });
  await B.click('#frRes [data-act=frReq]', { force: true }); await sleep(800);
  ok(await B.evaluate(() => G.Net.fr.outgoing.length === 1), 'demande envoyée (catégorie « envoyées »)');
  await D.evaluate(() => { G.UI.socialTab = 'friends'; G.UI.frTab = 'req'; G.UI.show('social'); }); await sleep(600);
  ok(await D.isVisible('[data-act=frAccept]'), 'le développeur voit la demande reçue (Accepter / Refuser)');
  await D.screenshot({ path: path.join(OUT, 'soc_req.png') });
  await D.click('[data-act=frAccept]', { force: true }); await sleep(800);
  await D.evaluate(() => { G.UI.frTab = 'list'; G.UI.renderSocial(); }); await sleep(400);
  ok(await D.evaluate(() => { const f = G.Net.fr.friends[0]; return f && f.name === 'Bob' && f.status === 'menu'; }), 'amis : Bob apparaît « Disponible »');
  await D.screenshot({ path: path.join(OUT, 'soc_list.png') });
  // Bob modifie son identifiant depuis son profil
  await B.evaluate(() => { G.UI.show('home'); G.UI.ACT.profile(); }); await sleep(900);
  ok(await B.isVisible('.pf-id [data-act=handleEdit]'), 'profil : identifiant affiché avec « Copier » et « Modifier »');
  await B.screenshot({ path: path.join(OUT, 'soc_profile.png') });
  await B.click('.pf-id [data-act=handleEdit]', { force: true }); await sleep(300); await B.fill('#hdIn', 'loupgivre'); await B.click('[data-act=handleSave]', { force: true }); await sleep(900);
  ok(await B.evaluate(() => G.Net.me.handle === 'LOUPGIVRE' && !G.Net.me.canHandle), 'identifiant modifié (LOUPGIVRE) puis verrouillé');
  // cadeau du développeur
  await D.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.show('home'); G.UI.devPanel(); }); await sleep(400);
  await D.fill('#dvIn', 'LOUPGIVRE'); await D.click('[data-act=dvSearch]', { force: true }); await sleep(800);
  ok(await D.isVisible('.dv-b[data-id=yeti]'), 'panneau développeur : profil du joueur + liste des brawlers à offrir');
  await D.screenshot({ path: path.join(OUT, 'soc_dev.png') });
  await B.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); });
  await D.click('.dv-b[data-id=yeti]', { force: true }); await sleep(1200);
  ok(await B.evaluate(() => G.Save.data.unlocked.includes('yeti') && !!document.querySelector('.giftm')), 'Bob reçoit le cadeau (fenêtre + Yéti débloqué dans sa sauvegarde)');
  await B.screenshot({ path: path.join(OUT, 'soc_gift.png') });
  // classé
  await B.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.ranked(); }); await sleep(1000);
  ok(await B.isVisible('.rk-lock') && !(await B.isVisible('[data-act=rkPlay]')), 'classé fermé pour un joueur : compte à rebours jusqu\'à l\'ouverture');
  await B.screenshot({ path: path.join(OUT, 'soc_ranked_lock.png') });
  await D.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.ranked(); }); await sleep(1000);
  ok(await D.isVisible('[data-act=rkPlay]') && await D.isVisible('.rk-early'), 'classé ouvert en avant-première pour le compte développeur');
  await D.screenshot({ path: path.join(OUT, 'soc_ranked_dev.png') });
  console.log(errs.length ? 'ERREURS JS : ' + errs.join(' | ') : 'aucune erreur JS');
  await b.close(); mock.kill(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
