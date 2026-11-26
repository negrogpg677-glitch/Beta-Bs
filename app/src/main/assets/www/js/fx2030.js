/* Brawl Rush - effets de combat « NEO 2030 » : fil des éliminations (verre néon), annonces de séries
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
    M.ents.forEach((e, i) => {
      if (!e) return; const was = alive[i]; alive[i] = !!e.alive;
      if (was && !e.alive && !e.isBoss) {
        const k = e.lastHitBy, mine = (x) => x && x.team === me.team;
        const kn = k ? `<span class="${mine(k) ? 'b' : 'r'}">${esc(k === me ? 'Vous' : k.name)}</span>` : '';
        push(`${kn}<i>✖</i><span class="${mine(e) ? 'b' : 'r'}">${esc(e === me ? 'Vous' : e.name)}</span>`, e === me ? 'me-dead' : k === me ? 'me-kill' : '');
      }
    });
    // séries du joueur
    const nk = me.kills || 0;
    if (nk > kills) { const now = performance.now(); for (let j = kills; j < nk; j++) streak.push(now); streak = streak.filter((t) => now - t < 5000); kills = nk; const w = WORDS[Math.min(5, streak.length)]; if (w && streak.length >= 2) announce(w[0], streak.length + ' en série', w[1]); }
    // super prête → léger éclair néon sur les bords
    const sr = (me.superCharge || 0) >= 1; if (sr && !superWas) { document.body.classList.remove('neo-super'); void document.body.offsetWidth; document.body.classList.add('neo-super'); } superWas = sr;
  }
  setInterval(tick, 90);
})();
