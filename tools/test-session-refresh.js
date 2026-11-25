/* Test : jeton de session expiré -> renouvelé automatiquement. Lancer le mock avec des jetons de 3 s : node tools/supabase-mock.js 54340 3 */
const { chromium } = require('playwright');
const U = 'http://127.0.0.1:' + (process.argv[2] || 54340);
const GAME = 'file://' + require('path').resolve(__dirname, '../app/src/main/assets/www/index.html');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext();
  await ctx.addInitScript((u) => { if (!localStorage.getItem('brawlrush_save_v1')) localStorage.setItem('brawlrush_save_v1', JSON.stringify({ settings: { sbUrl: u, sbKey: 'anon-test-key' }, tutorialDone: true })); }, U);
  const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('E', e.message));
  await p.goto(GAME); await p.waitForTimeout(1500);
  await p.evaluate(() => G.Account.signUp({ username: 'Exp_1', password: 'secret123', remember: true }));
  const t1 = await p.evaluate(() => G.Account.session.access_token);
  await p.waitForTimeout(4500); // le jeton (3 s) a expiré
  await p.evaluate(async () => { G.Save.data.coins = 7777; G.Save.commit(); await G.Account.flush(); });
  const r = await p.evaluate(() => ({ logged: G.Account.loggedIn(), status: G.Account.status, err: G.Account.err, tok: G.Account.session.access_token }));
  const rows = await (await fetch(U + '/_test/profiles')).json();
  console.log(r.logged && r.status === 'online' && r.tok !== t1 && rows[0].save.coins === 7777 ? 'PASS jeton expiré → renouvelé automatiquement, sauvegarde réussie, toujours connecté' : 'FAIL ' + JSON.stringify(r) + ' coins=' + rows[0].save.coins);
  await b.close();
})();
