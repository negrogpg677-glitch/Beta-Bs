/* Test de bout en bout des comptes, à travers la VRAIE interface du jeu (Playwright).
   Lance l'imitation Supabase puis : node tools/test-accounts.js <port_mock>
   Chaque « contexte » de navigateur = un téléphone différent (stockage séparé). */
const { chromium } = require('playwright');
const PORT = process.argv[2] || 54321, URLM = 'http://127.0.0.1:' + PORT;
const GAME = 'file://' + require('path').resolve(__dirname, '../app/src/main/assets/www/index.html');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(URLM + p)).json();

(async () => {
  const browser = await chromium.launch(); const errs = [];
  async function phone(name) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 } });
    await ctx.addInitScript(([url]) => { // configuration du serveur de comptes (comme si elle était intégrée à l'APK)
      if (!localStorage.getItem('brawlrush_save_v1')) localStorage.setItem('brawlrush_save_v1', JSON.stringify({ settings: { sbUrl: url, sbKey: 'anon-test-key' }, tutorialDone: true, lastDaily: 99999999 }));
    }, [URLM]);
    await ctx.addInitScript(([url, dev]) => { // pont natif Android émulé : stockage synchrone propre au téléphone (comme SharedPreferences)
      const x = (m, k, v) => { const r = new XMLHttpRequest(); r.open(m, url + '/_kv/' + encodeURIComponent(dev + '/' + k), false); r.send(v === undefined ? null : v); return r.status === 200 ? r.responseText : null; };
      window.AndroidBridge = { kvGet: (k) => x('GET', k), kvSet: (k, v) => { x('PUT', k, v); }, kvDel: (k) => { x('DELETE', k); } };
    }, [URLM, name]);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.goto(GAME); await p.waitForTimeout(3300); await p.mouse.click(640, 300); await p.waitForTimeout(1200);
    p.ctx = ctx; return p;
  }
  const state = (p) => p.evaluate(() => ({ logged: G.Account.loggedIn(), status: G.Account.status, name: G.Save.data.name, coins: G.Save.data.coins, gems: G.Save.data.gems, tr: G.Save.totalTrophies(), unlocked: G.Save.data.unlocked.length }));
  const click = (p, act, extra) => p.click(`[data-act=${act}]${extra || ''}`, { force: true });

  // 1. premier lancement : la fenêtre de compte est proposée
  const A = await phone('A');
  ok(await A.isVisible('#accBody'), 'premier lancement : inscription/connexion proposée');
  // 2. inscription par e-mail
  await A.fill('#acc_user', 'Alice_1'); await A.fill('#acc_mail', 'alice@test.fr'); await A.fill('#acc_new', 'secret123'); await A.fill('#acc_new2', 'secret123');
  await click(A, 'accSignup'); await A.waitForTimeout(1500);
  let s = await state(A); ok(s.logged && s.name === 'Alice_1', 'inscription e-mail + connexion automatique (' + s.name + ')');
  let rows = await getJSON('/_test/profiles'); ok(rows.length === 1 && rows[0].username === 'Alice_1', 'profil créé en base');
  // 3. progression -> sauvegarde en ligne
  await A.evaluate(() => { const d = G.Save.data; d.coins = 4321; d.gems = 77; d.trophies.sherry = 150; d.unlocked.push('taurus'); G.Save.commit(); });
  await A.waitForTimeout(4200);
  rows = await getJSON('/_test/profiles'); ok(rows[0].save.coins === 4321 && rows[0].trophies === 150, 'progression sauvegardée en ligne (pièces ' + rows[0].save.coins + ', trophées ' + rows[0].trophies + ')');
  // 4. fermeture / réouverture de l'application : toujours connecté
  await A.reload(); await A.waitForTimeout(3300); await A.mouse.click(640, 300); await A.waitForTimeout(1500);
  s = await state(A);
  ok(s.logged && s.coins === 4321, 'réouverture : toujours connecté, progression intacte');
  ok(!(await A.isVisible('#accBody')), 'réouverture : pas de demande de connexion');
  // 5. autre téléphone : connexion avec l'e-mail
  const B = await phone('B');
  await click(B, 'accTab', '[data-k=login]'); await B.fill('#acc_id', 'alice@test.fr'); await B.fill('#acc_pass', 'secret123'); await click(B, 'accLogin'); await B.waitForTimeout(1500);
  s = await state(B); ok(s.logged && s.coins === 4321 && s.tr === 150 && s.unlocked === 3, 'nouveau téléphone : progression exacte récupérée (' + s.coins + ' pièces, ' + s.tr + ' trophées, ' + s.unlocked + ' brawlers)');
  // 6. mauvais mot de passe
  const C = await phone('C');
  await click(C, 'accTab', '[data-k=login]'); await C.fill('#acc_id', 'alice@test.fr'); await C.fill('#acc_pass', 'mauvais99'); await click(C, 'accLogin'); await C.waitForTimeout(900);
  ok((await C.textContent('#accMsg')).includes('incorrect') && !(await state(C)).logged, 'mauvais mot de passe refusé avec message clair');
  // 7. compte par pseudo + pseudo déjà pris
  await click(C, 'accTab', '[data-k=signup]'); await click(C, 'accMethod', '[data-m=user]');
  await C.fill('#acc_user', 'alice_1'); await C.fill('#acc_new', 'motdepasse1'); await C.fill('#acc_new2', 'motdepasse1'); await click(C, 'accSignup'); await C.waitForTimeout(900);
  ok((await C.textContent('#accMsg')).includes('déjà pris'), 'pseudo déjà pris refusé (insensible à la casse)');
  await C.fill('#acc_user', 'Bob_2'); await C.fill('#acc_new', 'court'); await C.fill('#acc_new2', 'court'); await click(C, 'accSignup'); await C.waitForTimeout(500);
  ok((await C.textContent('#accMsg')).includes('8 caractères'), 'mot de passe trop court refusé');
  await C.fill('#acc_new', 'motdepasse1'); await C.fill('#acc_new2', 'motdepasse1'); await click(C, 'accSignup'); await C.waitForTimeout(1500);
  s = await state(C); ok(s.logged && s.name === 'Bob_2', 'inscription par pseudo sans e-mail');
  await C.evaluate(() => { G.Save.data.coins = 999; G.Save.data.trophies.rex = 42; G.Save.commit(); }); await C.evaluate(() => G.Account.flush());
  const D = await phone('D');
  await click(D, 'accTab', '[data-k=login]'); await D.fill('#acc_id', 'bob_2'); await D.fill('#acc_pass', 'motdepasse1'); await click(D, 'accLogin'); await D.waitForTimeout(1500);
  s = await state(D); ok(s.logged && s.coins === 999 && s.tr === 42, 'connexion par pseudo sur un autre téléphone : progression récupérée');
  // 8. déconnexion
  await D.evaluate(() => G.Account.signOut()); await D.waitForTimeout(500);
  s = await state(D); ok(!s.logged && s.coins !== 999, 'déconnexion : le téléphone repart en invité, le compte reste en ligne');
  // 9. mot de passe oublié (code par e-mail)
  const E = await phone('E');
  await click(E, 'accTab', '[data-k=recover]'); await E.fill('#acc_rmail', 'alice@test.fr'); await click(E, 'accRecover'); await E.waitForTimeout(900);
  const mail = (await getJSON('/_test/outbox')).pop(); ok(mail && mail.to === 'alice@test.fr', 'code de récupération envoyé par e-mail');
  await E.fill('#acc_code', '000000'); await E.fill('#acc_rnew', 'nouveau456'); await click(E, 'accRecover2'); await E.waitForTimeout(800);
  ok((await E.textContent('#accMsg')).includes('invalide'), 'mauvais code refusé');
  await E.fill('#acc_code', mail.code); await click(E, 'accRecover2'); await E.waitForTimeout(1500);
  s = await state(E); ok(s.logged && s.coins === 4321, 'nouveau mot de passe défini + connecté + progression récupérée');
  const F = await phone('F');
  await click(F, 'accTab', '[data-k=login]'); await F.fill('#acc_id', 'alice@test.fr'); await F.fill('#acc_pass', 'secret123'); await click(F, 'accLogin'); await F.waitForTimeout(900);
  ok(!(await state(F)).logged, 'ancien mot de passe refusé');
  await F.fill('#acc_pass', 'nouveau456'); await click(F, 'accLogin'); await F.waitForTimeout(1500);
  ok((await state(F)).logged, 'nouveau mot de passe accepté');
  // 10. sans « rester connecté » : une nouvelle ouverture (nouvel onglet = nouvelle session) demande de se reconnecter
  const G1 = await phone('G');
  await click(G1, 'accTab', '[data-k=login]'); await G1.fill('#acc_id', 'Bob_2'); await G1.fill('#acc_pass', 'motdepasse1'); await G1.click('.chk span'); await click(G1, 'accLogin'); await G1.waitForTimeout(1500);
  ok((await state(G1)).logged, 'connexion sans « rester connecté »');
  const G2 = await G1.ctx.newPage(); await G2.goto(GAME); await G2.waitForTimeout(2500);
  ok(!(await G2.evaluate(() => G.Account.loggedIn())), 'sans « rester connecté » : session non conservée à la réouverture');
  console.log(errs.length ? 'ERREURS JS :\n' + errs.join('\n') : 'aucune erreur JS');
  console.log(fails ? '\n' + fails + ' ÉCHEC(S)' : '\nTOUS LES TESTS DE COMPTES PASSENT');
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e); process.exit(2); });
