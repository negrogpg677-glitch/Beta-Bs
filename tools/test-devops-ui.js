/* Test de bout en bout de la CONSOLE DÉVELOPPEUR (interface réelle + serveur + base imitée) :
   tableau de bord, joueurs, déconnexion de session (confirmation), labo + triches serveur, spectateur (suivre, caméra libre,
   zoom), arrêt de partie, replay. Usage : node tools/test-devops-ui.js [dossier_captures] */
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'), os = require('os');
const MOCK = 54392, OUT = process.argv[2] || os.tmpdir();
process.env.SUPABASE_URL = 'http://127.0.0.1:' + MOCK; process.env.SUPABASE_SECRET = 'service-test-key'; process.env.FILL_WAIT = '1';
process.env.DEV_EMAILS = 'dev@test.fr'; process.env.DATA_DIR = path.join(os.tmpdir(), 'brdops' + Date.now());
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
  const wait = async (p, f, ms) => { for (let i = 0; i < (ms || 8000) / 200; i++) { if (await p.evaluate(f)) return true; await sleep(200); } return false; };
  await D.click('#devBtn', { force: true }); await sleep(500);
  ok(await D.evaluate(() => [...document.querySelectorAll('.rg-side .rg-cat b')].map((b) => b.textContent).join('|') === 'Observer|Administrer|Studio'), 'menu développeur : 3 espaces (Observer, Administrer, Studio)');
  await D.click('.rg-card[data-card=dash]', { force: true });
  ok(await wait(D, () => /Connectés/.test((document.querySelector('#rgBody') || {}).textContent || '') && /Base de données/.test(document.querySelector('#rgBody').textContent)), 'tableau de bord : données du serveur affichées');
  const dk = await D.evaluate(() => { const k = [...document.querySelectorAll('.dp-kpi')].find((x) => /Connectés/.test(x.textContent)); return k ? +k.querySelector('b').textContent : -1; });
  ok(dk >= 2, 'tableau de bord : ' + dk + ' joueurs connectés (réels)');
  await D.screenshot({ path: path.join(OUT, 'ops_1_dashboard.png') });
  // joueurs → profil de Bob → déconnecter la session (avec confirmation)
  await D.click('[data-back]', { force: true }); await D.click('.rg-card[data-card=players]', { force: true });
  ok(await wait(D, () => [...document.querySelectorAll('.dv-pl b')].some((b) => /Bob/.test(b.textContent))), 'joueurs : Bob apparaît dans la liste');
  await D.evaluate(() => [...document.querySelectorAll('.dv-pl')].find((b) => /Bob/.test(b.textContent)).click());
  ok(await wait(D, () => /Modération/.test(document.querySelector('#rgBody').textContent) && /Plateforme/.test(document.querySelector('#rgBody').textContent)), 'profil : statut, session, plateforme, historique, modération');
  await D.screenshot({ path: path.join(OUT, 'ops_2_profil.png') });
  await D.click('[data-dv=kick]', { force: true }); await sleep(200);
  ok(await D.isVisible('.dv-confirm'), 'déconnexion : confirmation demandée');
  await D.fill('#cbR', 'test'); await D.click('.dv-confirm [data-c=ok]', { force: true });
  ok(await wait(B, () => /administrateur/.test(document.body.textContent), 4000), 'Bob : déconnecté par l\'administrateur (message reçu)');
  await wait(B, () => G.Net.status === 'online' && !!G.Net.me, 9000);
  ok(await B.evaluate(() => !document.getElementById('devBtn')), 'Bob (compte normal) : aucun menu développeur');
  // labo : partie de test en ligne avec triches appliquées par le serveur
  await D.evaluate(() => { G.DevPro.ui.detail = null; }); await D.click('.rg-cat[data-g=studio]', { force: true }); await sleep(200);
  await D.click('.rg-card[data-card=lab]', { force: true }); await sleep(300);
  await D.click('[data-dv=ltog][data-k=passiveBots]', { force: true }); await D.click('[data-dv=lstart]', { force: true });
  ok(await wait(D, () => G.App.state === 'match' && G.App.M && G.App.M.lab && G.App.M.cheatsOK && G.App.M.ready, 12000), 'labo : partie de test en ligne lancée (triches autorisées)');
  const labId = await D.evaluate(() => G.App.M.id); const lab = S.matches.get(labId);
  await sleep(3500); await D.evaluate(() => { G.Dev.cfg.god = true; G.Net.send({ t: 'dv_cheats', cheats: G.Dev.cfg }); }); await sleep(300);
  { const me = lab.M.ents.find((b) => b.pid), foe = lab.M.ents.find((b) => !b.pid && b.team !== me.team); me.invuln = 0; const h = me.hp; global.G.Sim.damage(lab.M, me, 2000, foe); ok(me.hp === h, 'labo : « invincible » appliqué par le serveur'); }
  await D.evaluate(() => G.Net.send({ t: 'dv_labset', act: 'end' })); await wait(D, () => G.App.state !== 'match', 9000);
  await D.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.hideAll(); G.UI.show('home'); }); await sleep(6500);
  // Bob lance une partie privée → le développeur l'observe
  await B.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.Net.startPrivate('gemgrab'); });
  ok(await wait(B, () => G.App.state === 'match' && G.App.M && G.App.M.ready, 12000), 'Bob joue une partie en ligne');
  await D.evaluate(() => { G.DevPro.ui.detail = null; G.DevPro.open(); }); await D.click('.rg-cat[data-g=observe]', { force: true }); await sleep(200);
  await D.click('.rg-card[data-card=matches]', { force: true });
  ok(await wait(D, () => !!document.querySelector('[data-dv=watchm]')), 'parties en cours : bouton « Observer »');
  await D.screenshot({ path: path.join(OUT, 'ops_3_parties.png') });
  await D.click('[data-dv=watchm]', { force: true });
  ok(await wait(D, () => G.App.state === 'match' && G.App.M && G.App.M.spectate && !!document.getElementById('specUI'), 8000), 'spectateur : la partie de Bob s\'affiche (aucune commande envoyée)');
  await sleep(1500);
  const sp = await D.evaluate(() => { const M = G.App.M; return { n: M.ents.length, moving: M.ents.some((e) => e.x > 0) }; });
  ok(sp.n === 6 && sp.moving, 'spectateur : les 6 brawlers sont synchronisés');
  await D.evaluate(() => document.querySelectorAll('#spList .sp-pl')[3].click()); await sleep(300);
  ok(await D.evaluate(() => G.App.M.player === G.App.M.ents[3]), 'spectateur : passer d\'un joueur à l\'autre');
  const pad = await D.evaluate(() => { const r = document.getElementById('spPad').getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; });
  await D.mouse.move(pad.x, pad.y); await D.mouse.down(); await D.mouse.move(pad.x - 200, pad.y - 80, { steps: 6 }); await D.mouse.up(); await sleep(400);
  const fc = await D.evaluate(() => ({ free: !!G.App.M.freeCam, dx: G.App.M.freeCam && Math.round(G.App.M.freeCam.x - G.App.M.player.x) }));
  ok(fc.free && Math.abs(fc.dx) > 100, 'caméra libre : glisser déplace la caméra (' + fc.dx + ' px)');
  await D.click('[data-sp=zin]', { force: true }); await D.click('[data-sp=zin]', { force: true }); ok(await D.evaluate(() => G.App.M.freeCam.zoom > 1.3), 'caméra libre : zoom');
  await D.screenshot({ path: path.join(OUT, 'ops_4_spectateur.png') });
  await D.click('[data-sp=back]', { force: true }); await sleep(200); ok(await D.evaluate(() => !G.App.M.freeCam), 'retour rapide à la caméra du joueur suivi');
  ok(await B.evaluate(() => G.App.state === 'match' && !G.App.M.spectate), 'la partie de Bob n\'est pas perturbée');
  // arrêt de la partie par l'administration (confirmation) → replay
  await D.click('[data-sp=exit]', { force: true }); await wait(D, () => G.App.state !== 'match', 4000);
  await D.evaluate(() => { G.DevPro.ui.detail = null; G.DevPro.ui.g = 'observe'; G.DevPro.open(); }); await D.click('.rg-card[data-card=matches]', { force: true }); await wait(D, () => !!document.querySelector('[data-dv=endm]'));
  await D.click('[data-dv=endm]', { force: true }); await D.fill('#cbR', 'test'); await D.click('.dv-confirm [data-c=ok]', { force: true });
  ok(await wait(B, () => /arrêtée par un administrateur/.test(document.body.textContent) || G.App.state !== 'match', 8000), 'partie arrêtée par l\'administration (Bob prévenu)');
  await sleep(1000); await D.evaluate(() => { G.DevPro.ui.detail = null; G.DevPro._render(); }); await sleep(200); await D.click('.rg-card[data-card=replays]', { force: true });
  ok(await wait(D, () => document.querySelectorAll('[data-dv=play]').length >= 2), 'replays : les parties terminées sont listées');
  await D.screenshot({ path: path.join(OUT, 'ops_5_replays.png') });
  await D.click('[data-dv=play]', { force: true });
  ok(await wait(D, () => G.Replay.active && G.App.M && G.App.M.replay && !!document.querySelector('#specUI.replay'), 8000), 'replay : lecture lancée');
  await sleep(1500); const t1 = await D.evaluate(() => G.Replay.t - G.Replay.t0); ok(t1 > 0.5, 'replay : le temps avance (' + t1.toFixed(1) + ' s)');
  await D.evaluate(() => G.Replay.seek(G.Replay.dur * 0.6)); await sleep(500); const t2 = await D.evaluate(() => G.Replay.t - G.Replay.t0);
  ok(t2 > (await D.evaluate(() => G.Replay.dur)) * 0.5, 'replay : barre de temps (saut à ' + t2.toFixed(1) + ' s)');
  await D.click('[data-sp=events]', { force: true }); await sleep(200);
  await D.screenshot({ path: path.join(OUT, 'ops_6_replay.png') });
  await D.click('[data-sp=exit]', { force: true }); ok(await wait(D, () => G.App.state !== 'match' && !G.Replay.active, 3000), 'replay : retour au menu');
  console.log(errs.length ? 'ERREURS JS : ' + errs.join(' | ') : 'aucune erreur JS');
  await b.close(); mock.kill(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
