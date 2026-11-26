/* Test : fenêtre « Nouveautés » après une mise à jour (joueur normal / développeur, versions sautées, première installation).
   Usage : node tools/test-changelog.js [dossier_captures] */
const { chromium } = require('playwright'); const path = require('path'), os = require('os');
const GAME = 'file://' + path.resolve(__dirname, '../app/src/main/assets/www/index.html'), OUT = process.argv[2] || os.tmpdir();
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [];
  async function launch(seen, withSave, dev) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await ctx.addInitScript(([s, w]) => { window.__clTest = true; if (w) localStorage.setItem('brawlrush_save_v1', JSON.stringify({ name: 'Joueur', tutorialDone: true, lastDaily: 99999999, guestChoice: true })); if (s && !localStorage.getItem('__clInit')) localStorage.setItem('br_seen_version', s); localStorage.setItem('__clInit', '1'); }, [seen, withSave]);
    await p.goto(GAME); if (dev) { await p.waitForTimeout(600); await p.evaluate(() => G.DevTools.activate(true)); }
    await p.waitForTimeout(2300); await p.mouse.click(422, 200); // toucher l'écran d'accueil, comme un joueur
    for (let i = 0; i < 60 && !(await p.evaluate(() => !!document.querySelector('.clm'))); i++) await sleep(250);
    return p;
  }
  // 1. joueur normal qui passe de la 3.9 à la 4.0
  let p = await launch('3.9', true, false);
  let st = await p.evaluate(() => ({ open: !!document.querySelector('.clm'), vers: [...document.querySelectorAll('.cl-vh b')].map((x) => x.textContent), players: !!document.querySelector('.cl-sec:not(.dev)'), dev: !!document.querySelector('.cl-sec.dev'), seen: localStorage.getItem('br_seen_version') }));
  ok(st.open && st.vers.join() === 'Version 4.2,Version 4.1,Version 4.0' && st.players && !st.dev, 'mise à jour 3.9 → 4.2 : nouveautés pour les joueurs, sans la partie développeurs');
  ok(st.seen === '4.2', 'version marquée comme vue');
  await p.screenshot({ path: path.join(OUT, 'changelog_joueur.png') });
  await p.reload(); await sleep(2300); await p.mouse.click(422, 200); await sleep(5000); ok(!(await p.evaluate(() => !!document.querySelector('.clm'))), 'relance suivante : la fenêtre ne réapparaît pas');
  // 2. versions sautées
  p = await launch('3.6', true, false); st = await p.evaluate(() => [...document.querySelectorAll('.cl-vh b')].map((x) => x.textContent));
  ok(st.join() === 'Version 4.2,Version 4.1,Version 4.0,Version 3.9,Version 3.8,Version 3.7', 'versions sautées (3.6 → 4.2) : toutes les nouveautés manquées (' + st.length + ')');
  // 3. première installation : rien
  p = await launch(null, false, false); await sleep(3000);
  ok(!(await p.evaluate(() => !!document.querySelector('.clm'))) && (await p.evaluate(() => localStorage.getItem('br_seen_version'))) === '4.2', 'première installation : pas de fenêtre, version enregistrée');
  // 4. développeur : partie « Développeurs » en plus
  p = await launch('3.9', true, true); st = await p.evaluate(() => ({ open: !!document.querySelector('.clm'), dev: !!document.querySelector('.cl-sec.dev'), badge: !!document.querySelector('.cl-devb') }));
  ok(st.open && st.dev && st.badge, 'compte développeur : nouveautés joueurs + partie « Développeurs »');
  await p.screenshot({ path: path.join(OUT, 'changelog_dev.png') });
  // 5. consultable plus tard : Réglages et Dev Hub
  await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.UI.ACT.settings(); }); await sleep(300);
  await p.click('[data-act=changelog]', { force: true }); await sleep(300);
  ok((await p.evaluate(() => document.querySelectorAll('.clm .cl-v').length)) === 7, 'Réglages → « Nouveautés » : historique complet des versions');
  await p.evaluate(() => { while (G.UI.modals.length) G.UI.closeModal(); G.DevPro.open('notes'); }); await sleep(300);
  ok(await p.evaluate(() => document.querySelectorAll('.dh-notes .cl-v').length === 7 && !!document.querySelector('.dh-notes .cl-sec.dev')), 'Dev Hub → Accueil → « Notes de version »');
  ok(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e); process.exit(2); });
