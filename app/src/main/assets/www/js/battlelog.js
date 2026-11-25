/* Brawl Rush - carnet de combat (dernières parties + joueurs rencontrés) et fiches de joueur */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net;
  const { $, el, esc, ic, S, fmt, portraitCanvas } = UI.h;
  const ago = (t) => { const s = Math.max(1, (Date.now() - t) / 1000); return s < 3600 ? 'il y a ' + Math.ceil(s / 60) + ' min' : s < 86400 ? 'il y a ' + Math.floor(s / 3600) + ' h' : 'il y a ' + Math.floor(s / 86400) + ' j'; };
  const ST = { menu: ['on', 'En ligne'], party: ['on', 'En équipe'], match: ['busy', 'En partie'], off: ['off', 'Hors ligne'] };

  /* ---------- fiche d'un joueur (soi, ami, joueur croisé, bot) ---------- */
  let cardRef = null;
  UI.playerCard = function (pl) {
    if (pl.me) { ACT.profile && ACT.profile(); return; }
    G.Audio.sfx('ui');
    const def = G.BRAWLER[pl.b] || G.BRAWLERS[0];
    const o = UI.modal(`<div class="pcard"><div class="pc-hero"><div class="pc-glow"></div><div class="pc-port"></div></div>
      <div class="pc-info"><div class="pc-name">${esc(pl.n || '?')}</div>
        <div class="pc-sub">${pl.bot ? '🤖 Joueur contrôlé par l\'ordinateur' : '<span id="pcSt">' + (pl.c || pl.pid ? 'Chargement du profil…' : 'Joueur') + '</span>'}</div>
        <div class="pc-stats"><div><b>${esc(def.name)}</b><span>Brawler joué</span></div><div><b id="pcTr">${pl.tr != null ? fmt(pl.tr) : '—'}</b><span>${ic('trophy')} Trophées</span></div><div><b id="pcClub">${esc(pl.club || '—')}</b><span>Club</span></div></div>
        <div class="pc-acts" id="pcActs"></div></div></div>`, { style: 'width:min(120rem,94vw)' });
    const cv = portraitCanvas(pl.b, pl.s || 'classic', 420); $('.pc-port', o).appendChild(cv);
    cardRef = pl.bot ? null : (pl.c || pl.pid || null);
    if (cardRef && Net.status === 'online') Net.send(pl.c ? { t: 'profile_get', code: pl.c } : { t: 'profile_get', pid: pl.pid });
    else if (!pl.bot) { const s = $('#pcSt', o); if (s) s.textContent = Net.status === 'online' ? 'Profil indisponible' : 'Connectez-vous en ligne pour voir son profil'; }
  };
  Net.on('profile_card', (m) => {
    const o = UI.modals[UI.modals.length - 1]; if (!o || !$('.pcard', o) || m.ref !== cardRef) return;
    const c = m.card, st = $('#pcSt', o), acts = $('#pcActs', o);
    if (!c) { st.textContent = 'Profil introuvable'; return; }
    const [k, label] = ST[c.status] || ST.off;
    st.innerHTML = `<span class="netdot ${k === 'busy' ? 'wait' : k}"></span>${label} · code ${esc(c.code)}`;
    $('#pcTr', o).textContent = fmt(c.trophies); $('#pcClub', o).textContent = c.club ? '[' + c.club + ']' : '—';
    acts.innerHTML = (c.friend ? '<span class="pc-badge">✔ Ami</span>' : `<button class="btn small green" data-act="cardAddFriend" data-code="${esc(c.code)}">Ajouter en ami</button>`) +
      (c.friend && c.pid && (c.status === 'menu' || c.status === 'party') ? `<button class="btn small blue" data-act="friendInvite" data-pid="${esc(c.pid)}">Inviter dans l'équipe</button>` : '');
  });
  ACT.cardAddFriend = (a) => { G.Audio.sfx('buy'); Net.addFriend(a.dataset.code); a.outerHTML = '<span class="pc-badge">Demande envoyée ✔</span>'; };
  ACT.friendCard = (a) => { const f = ((Net.friends || {}).list || []).find((x) => x.pid === a.dataset.pid); if (f) UI.playerCard({ n: f.name, pid: f.pid, b: f.brawler || 'sherry', tr: f.trophies, club: f.club }); };

  /* ---------- carnet de combat ---------- */
  UI.battleLog = function () {
    const hist = (S().stats.hist || []);
    const rows = hist.map((h, i) => {
      const mode = G.MODES[h.m] || { name: h.m }, res = h.w > 0 ? ['win', h.m === 'showdown' ? 'TOP ' + (h.pl0 || 1) : 'VICTOIRE'] : h.w < 0 ? ['lose', h.m === 'showdown' ? 'TOP ' + (h.pl0 || '?') : 'DÉFAITE'] : ['draw', 'ÉGALITÉ'];
      const pl = h.pl || [{ n: S().name, b: h.b, me: 1, tm: 0 }];
      const chip = (x, j) => `<button class="blp ${x.me ? 'me' : ''}" data-act="blPlayer" data-i="${i}" data-j="${j}"><i class="blpic" data-b="${x.b}" data-s="${x.s || 'classic'}"></i><span>${esc(x.n)}</span>${x.bot ? '<em>BOT</em>' : ''}</button>`;
      const teamA = pl.map((x, j) => [x, j]).filter(([x]) => x.tm === h.tm), teamB = pl.map((x, j) => [x, j]).filter(([x]) => x.tm !== h.tm);
      return `<div class="blrow" style="animation-delay:${Math.min(i, 8) * 0.05}s"><div class="blhd"><b>${esc(mode.name)}</b><span class="blres ${res[0]}">${res[1]}</span><span class="bltr">${h.d > 0 ? '+' : ''}${h.d} ${ic('trophy')}</span><span class="blago">${h.on ? '🌐 ' : ''}${ago(h.t)}</span></div>
        <div class="blteams"><div class="blteam">${teamA.map(([x, j]) => chip(x, j)).join('')}</div>${teamB.length ? '<div class="blvs">VS</div><div class="blteam">' + teamB.map(([x, j]) => chip(x, j)).join('') + '</div>' : ''}</div></div>`;
    }).join('');
    const o = UI.modal(`<h2>Carnet de combat</h2><div class="blist">${rows || '<div style="font-size:2.8rem;text-align:center;margin:4rem 0">Aucune partie pour l\'instant. Jouez un match !</div>'}</div>`, { style: 'width:min(150rem,96vw)' });
    o.querySelectorAll('.blpic').forEach((v) => { v.replaceWith(portraitCanvas(v.dataset.b, v.dataset.s, 120)); });
  };
  ACT.battleLog = () => { G.Audio.sfx('ui'); UI.battleLog(); };
  ACT.blPlayer = (a) => { const h = (S().stats.hist || [])[+a.dataset.i]; const x = h && h.pl && h.pl[+a.dataset.j]; if (x) UI.playerCard(x); };
})();
