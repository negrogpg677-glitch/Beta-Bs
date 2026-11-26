/* Brawl Rush - effets de combat « NEO 2030 » : annonces de séries
   (DOUBLE / TRIPLE / MÉGA ÉLIMINATION), éclair d'écran à la super. Basé sur l'état des brawlers : marche hors ligne et en ligne. */
(function () {
  const G = window.G;
  let feed = null, ann = null, lastM = null, alive = [], kills = 0, streak = [], superWas = false;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function ensure() {
    if (!feed) { feed = document.createElement('div'); feed.id = 'neoFeed'; document.getElementById('app').appendChild(feed); }
    if (!ann) { ann = document.createElement('div'); ann.id = 'neoAnn'; document.getElementById('app').appendChild(ann); }
  }
  function push(html, cls) {
    ensure(); const d = document.createElement('div'); d.className = 'nf ' + (cls || ''); d.innerHTML = html; feed.prepend(d);
    while (feed.children.length > 4) feed.lastChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 4200);
  }
  function announce(txt, sub, color) {
    ensure(); ann.innerHTML = `<div class="na" style="--na:${color}"><b>${esc(txt)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    ann.classList.remove('go'); void ann.offsetWidth; ann.classList.add('go');
    if (G.Audio) G.Audio.sfx('pickup');
  }
  const WORDS = { 2: ['DOUBLE ÉLIMINATION', '#34f5ff'], 3: ['TRIPLE ÉLIMINATION', '#8a5cff'], 4: ['MÉGA SÉRIE', '#ff3dc8'], 5: ['INARRÊTABLE', '#ffd21f'] };
  function tick() {
    const A = G.App, M = A && A.state === 'match' ? A.M : null;
    if (!M || !M.ents || !M.player) { if (lastM) { lastM = null; if (feed) feed.innerHTML = ''; } return; }
    if (M !== lastM) { lastM = M; alive = M.ents.map((e) => !!(e && e.alive)); kills = M.player.kills || 0; streak = []; superWas = false; if (feed) feed.innerHTML = ''; return; }
    const me = M.player;
    // (le fil des éliminations existe déjà dans le rendu du jeu)
    // séries du joueur
    const nk = me.kills || 0;
    if (nk > kills) { const now = performance.now(); for (let j = kills; j < nk; j++) streak.push(now); streak = streak.filter((t) => now - t < 5000); kills = nk; const w = WORDS[Math.min(5, streak.length)]; if (w && streak.length >= 2) announce(w[0], streak.length + ' en série', w[1]); }
    // super prête → léger éclair néon sur les bords
    const sr = (me.superCharge || 0) >= 1; if (sr && !superWas) { document.body.classList.remove('neo-super'); void document.body.offsetWidth; document.body.classList.add('neo-super'); } superWas = sr;
  }
  setInterval(tick, 90);
})();

/* ---------- transitions : entrée en combat (saut néon), fin de partie (éclair), changement d'écran ---------- */
(function () {
  const G = window.G, App = G.App; if (!App) return;
  function fx(cls, ms) { const d = document.createElement('div'); d.className = cls; document.getElementById('app').appendChild(d); setTimeout(() => d.remove(), ms); }
  const baseBegin = App.begin;
  App.begin = function (M) { const r = baseBegin.apply(this, arguments); if (!(M && M.spectate) && !(G.Save.data.settings.quality === 'eco')) fx('neo-warp', 900); return r; };
  const baseFinish = App.finish;
  App.finish = function () { const won = App.M && App.M.result && App.M.result.win; const r = baseFinish.apply(this, arguments); fx('neo-endflash ' + (won ? 'win' : 'lose'), 700); return r; };
})();
