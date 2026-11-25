/* Brawl Rush - fiabilité du multijoueur : reprise de partie, inactivité, un seul appareil par compte,
   classement mondial réel, synchronisation de l'équipe (chef, arrivées, départs). Les règles sont vérifiées par le serveur. */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net, A = G.Account;
  const { $, $$, esc, ic, fmt } = UI.h;
  const MODE = (id) => (G.MODES[id] || {}).name || id;

  /* ---------- « Reprendre la partie » ---------- */
  function syncResumeBar() {
    const home = $('#home'); if (!home) return;
    const box = $('.hm-br', home), r = Net.resumable, cur = $('.resumebar', home);
    if (!r || !box || Net.status !== 'online' || (G.App && G.App.state === 'match')) { if (cur) cur.remove(); return; }
    if (cur && cur.dataset.id === r.id) return; if (cur) cur.remove();
    box.insertAdjacentHTML('afterbegin', `<button class="resumebar" data-act="resumeMatch" data-id="${esc(r.id)}"><span class="rb-ic">▶</span><span class="rb-t">REPRENDRE LA PARTIE<small>${esc(MODE(r.mode))}${r.mapName ? ' · ' + esc(r.mapName) : ''} — en cours</small></span></button>`);
  }
  const baseHome = UI.build.home;
  UI.build.home = function () {
    baseHome.apply(this, arguments); syncResumeBar();
    const sr = $('#home .subrow'); if (sr && !$('[data-act=training]', sr)) sr.insertAdjacentHTML('beforeend', '<button class="chip" data-act="training">🎯 Entraînement</button>');
    const sv = G.Save.data, m = G.MODES[sv.mode], mn = $('#home .modepanel .mn');
    if (mn && m && m.per === 3 && sv.fmt === 2) mn.insertAdjacentHTML('beforeend', '<span class="fmt-badge">2c2</span>');
  };
  ACT.training = () => { // entraînement hors ligne contre des mannequins, sans récompense
    G.Audio.sfx('ui'); if (UI.busy) return;
    const mode = G.Save.data.mode === 'showdown' || G.Save.data.mode === 'boss' ? 'bounty' : G.Save.data.mode;
    const M = G.App.prepare(mode); M.training = true; UI.toast('🎯 Entraînement : les adversaires ne bougent pas, aucune récompense', 2600); G.App.begin(M);
  };
  ['resumable', 'afk', 'resume_fail', 'end', 'match', 'status', 'welcome'].forEach((t) => Net.on(t, () => setTimeout(syncResumeBar, 20)));
  ACT.resumeMatch = (a) => {
    if (a) a.disabled = true; G.Audio.sfx('go'); UI.closeModal && UI.modals.some((m) => m.dataset.afk) && closeAfk();
    if (!Net.send({ t: 'resume' })) { UI.toast('Connexion au serveur…', 1800); if (a) a.disabled = false; return; }
    UI.toast('Retour dans la partie…', 1500);
  };
  Net.on('resume_fail', (m) => { UI.toast(m.msg || 'Cette partie est terminée.', 2600); closeAfk(); });
  Net.on('end', (e) => {
    if (G.App && G.App.state === 'match') return;
    closeAfk(); // la partie s'est terminée pendant l'absence : pas de bouton, simple récapitulatif
    UI.toast('Partie terminée : ' + (e.draw ? 'égalité' : e.win ? 'victoire 🏆' : 'défaite') + (e.delta ? ' (' + (e.delta > 0 ? '+' : '') + e.delta + ' trophées)' : ''), 3500);
  });
  function closeAfk() { UI.modals.filter((m) => m.dataset.afk).forEach((m) => { UI.modals.splice(UI.modals.indexOf(m), 1); m.remove(); }); }
  UI.afkNotice = function (m) {
    closeAfk(); G.Audio.sfx('back');
    if (G.App && G.App.state === 'match') { UI.toast('⏸ ' + (m.msg || 'Retiré de la partie en ligne pour inactivité.'), 3500); return; } // en plein combat contre des bots : simple message
    const o = UI.modal(`<div class="afkm"><div class="afk-ic">⏸</div><h2>Retiré de la partie</h2><div class="afk-t">${esc(m.msg || 'Inactif trop longtemps.')}</div>
      <div class="afk-n">La partie continue sur le serveur. Vous pouvez la reprendre tant qu'elle n'est pas terminée.</div>
      <div class="row" style="gap:2rem;margin-top:2.4rem"><button class="btn gray" data-act="close">Plus tard</button><button class="btn green" data-act="resumeMatch">▶ Reprendre la partie</button></div></div>`, { style: 'width:min(110rem,94vw)' });
    o.dataset.afk = '1';
  };

  /* ---------- pause : quitter seulement en duel entre amis ---------- */
  const basePause = UI.showPause;
  UI.showPause = function () {
    basePause.apply(this, arguments);
    const M = G.App && G.App.M, o = UI.modals[UI.modals.length - 1], q = o && $('[data-act="quit"]', o);
    if (!q || !M || !M.net) return;
    if (M.mode === 'duel') { q.textContent = 'Abandonner (défaite)'; return; }
    q.outerHTML = '<div class="noquit">🔒 Partie en ligne : on ne peut pas la quitter.<br><small>En cas de coupure, vous pourrez la reprendre.</small></div>';
  };

  /* ---------- un seul appareil par compte ---------- */
  Net.on('session_taken', async (m) => {
    if (!A || !A.loggedIn()) return;
    try { await A.signOut({ kicked: true }); } catch (e) { /* ignore */ }
    Net.me = null; if (G.App && G.App.state !== 'match') { UI.show && UI.show('home'); }
    const o = UI.modal(`<h2>Session ouverte ailleurs</h2><div class="accinfo">${esc(m.msg || 'Votre compte est utilisé sur un autre appareil.')}</div>
      <div class="row" style="gap:2rem;margin-top:2rem"><button class="btn gray" data-act="close">OK</button><button class="btn green" data-act="reLogin">Me reconnecter ici</button></div>`, { style: 'width:min(110rem,94vw)' });
    o.dataset.kick = '1'; G.Audio.sfx('back');
  });
  ACT.reLogin = () => { UI.closeModal(); UI.accountModal && UI.accountModal('login'); };
  Net.on('error', (m) => { if (m.code === 'no_quit' || m.code === 'not_leader') UI.toast(m.msg, 2600); });

  /* ---------- équipe : chef, arrivées, départs (temps réel) ---------- */
  let prev = null;
  Net.on('party', () => {
    const p = Net.party;
    if (p && prev && prev.code === p.code && prev.leader !== p.leader) {
      const L = p.members.find((x) => x.pid === p.leader);
      UI.toast(p.leader === Net.pid ? '👑 Vous êtes maintenant chef d\'équipe' : '👑 ' + (L ? L.name : '?') + ' est maintenant chef', 2400);
    }
    if (!p && prev && prev.members.length > 1 && !UI._leftByMe) UI.toast('Vous n\'êtes plus dans l\'équipe', 2000);
    UI._leftByMe = false; prev = p ? { code: p.code, leader: p.leader, members: p.members.slice() } : null;
  });
  const baseLeave = Net.leaveParty; Net.leaveParty = function () { UI._leftByMe = true; return baseLeave.apply(this, arguments); };
  const baseMate = ACT.mateCard;
  ACT.mateCard = function (a) {
    baseMate.apply(this, arguments);
    const p = Net.party, pid = a.dataset.pid, o = UI.modals[UI.modals.length - 1];
    if (!p || p.leader !== Net.pid || pid === Net.pid || p.state !== 'idle' || !o) return;
    const acts = $('#pcActs', o); if (!acts) return;
    acts.insertAdjacentHTML('afterend', `<div class="pc-acts pc-lead"><button class="btn small yellow" data-act="partyPromote" data-pid="${esc(pid)}">👑 Nommer chef</button><button class="btn small red" data-act="partyKick" data-pid="${esc(pid)}">Exclure</button></div>`);
  };
  ACT.partyPromote = (a) => { Net.send({ t: 'party_promote', pid: a.dataset.pid }); UI.closeModal(); G.Audio.sfx('buy'); };
  ACT.partyKick = (a) => { Net.kick(a.dataset.pid); UI.closeModal(); G.Audio.sfx('back'); };

  /* ---------- classement mondial (base de données : vrais joueurs, persistant) ---------- */
  const MED = ['🥇', '🥈', '🥉'];
  UI.lbRender = function (b, m) {
    if (!b) return;
    if (!m) { b.innerHTML = '<div class="lb-wait">Chargement du classement…</div>'; return; }
    const rows = m.top || [], me = m.me || {};
    const row = (r, mine) => `<div class="lbr ${mine ? 'me' : ''} ${r.rank <= 3 ? 'top' : ''}"><span class="lb-rk">${r.rank <= 3 ? MED[r.rank - 1] : '#' + r.rank}</span>
      <span class="lb-av" style="--c:${(G.BRAWLER[r.avatar] || G.BRAWLERS[0]).color || '#3c9bff'}">${esc(((G.BRAWLER[r.avatar] || {}).name || r.name || '?').slice(0, 1))}</span>
      <span class="lb-n"><b>${esc(r.name || '?')}</b>${r.handle ? `<small>${esc(r.handle)}</small>` : ''}</span><span class="lb-tr">${ic('trophy')} ${fmt(r.trophies || 0)}</span></div>`;
    const inTop = rows.some((r) => r.me);
    b.innerHTML = `<div class="lb-head"><span>${m.src === 'db' ? '🌍 ' + fmt(m.total || rows.length) + ' joueurs classés' : '🌍 Classement du serveur'}</span><button class="btn small blue" data-act="lbRefresh">↻</button></div>
      <div class="lb-list">${rows.length ? rows.map((r) => row(r, r.me)).join('') : '<div class="lb-wait">Personne n\'est encore classé. Jouez une partie pour apparaître !</div>'}</div>
      <div class="lb-me">${me.rank ? row({ rank: me.rank, name: (me.name || 'Vous') + ' (vous)', handle: me.handle, trophies: me.trophies, avatar: G.Save.data.avatar || G.Save.data.selected }, true) : `<div class="lbr me"><span class="lb-n"><b>Vous</b><small>Gagnez des trophées pour être classé</small></span></div>`}
      ${me.guest ? '<div class="lb-note">Invité : position estimée. Connectez-vous à un compte pour apparaître dans le classement.</div>' : inTop ? '' : ''}</div>`;
  };
  async function askLb() {
    if (A && A.loggedIn()) { try { await A.flush(); } catch (e) { /* ignore */ } } // trophées à jour dans la base avant de lire
    Net.send({ t: 'lb', tr: G.Save.totalTrophies(), fresh: 1 });
  }
  ACT.leaderboard = () => {
    G.Audio.sfx('ui');
    if (UI.modals.length && UI.modals[UI.modals.length - 1].dataset.lbm) return;
    const o = UI.modal('<h2>Classement mondial</h2><div id="lbBody" class="lbwrap"></div>', { style: 'width:min(130rem,96vw)' });
    o.dataset.lbm = '1'; UI.lbRender($('#lbBody', o), null);
    if (Net.status !== 'online') { Net.ensure && Net.ensure(); $('#lbBody', o).innerHTML = '<div class="lb-wait">Connexion au serveur…</div>'; }
    const go = () => { if (Net.status === 'online') askLb(); else setTimeout(go, 700); }; go();
    setTimeout(() => { const b = $('#lbBody'); if (b && $('.lb-wait', b) && !Net.lb) b.innerHTML = '<div class="lb-wait">Serveur injoignable. Réessayez dans un instant.</div>'; }, 15000);
  };
  ACT.lbRefresh = () => { G.Audio.sfx('ui'); askLb(); };
  Net.on('lb', (m) => { const b = $('#lbBody'); if (b) UI.lbRender(b, m); });
  // onglet « Classement » de l'écran social : même source
  const baseSocTab = ACT.socialTab;
  ACT.socialTab = function (a) { baseSocTab.apply(this, arguments); if (a && a.dataset.k === 'ranking') askLb(); };
})();

/* ---------- réglages du joystick : mode, sensibilité, taille ---------- */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, { $ } = UI.h;
  const S = () => G.Save.data.settings;
  const baseSettings = ACT.settings;
  ACT.settings = function () {
    baseSettings.apply(this, arguments);
    const o = UI.modals[UI.modals.length - 1], ce = o && $('[data-act="ctrlEdit"]', o); if (!ce) return;
    const s = S(), sens = Math.round((+s.joySens || 1) * 100), cp = s.ctrlPos && s.ctrlPos.joy, size = Math.round(((cp && cp.s) || 1) * 100), fixed = s.joyMode === 'fixed';
    ce.closest('.setrow').insertAdjacentHTML('afterend', `<div class="setrow joyset"><span>Joystick</span><div class="seg"><button class="${fixed ? '' : 'on'}" data-act="joyMode" data-v="float">Flottant</button><button class="${fixed ? 'on' : ''}" data-act="joyMode" data-v="fixed">Fixe</button></div></div>
      <div class="setrow joyset"><span>Sensibilité du joystick</span><div class="rng"><input type="range" min="50" max="200" step="5" value="${sens}" id="joySens"><b>${sens} %</b></div></div>
      <div class="setrow joyset"><span>Taille du joystick</span><div class="rng"><input type="range" min="60" max="160" step="5" value="${size}" id="joySize"><b>${size} %</b></div></div>`);
    const bind = (id, fn) => { const i = $('#' + id, o); i.addEventListener('input', () => { i.nextElementSibling.textContent = i.value + ' %'; fn(+i.value / 100); }); i.addEventListener('change', () => G.Save.commit()); };
    bind('joySens', (v) => { S().joySens = v; });
    bind('joySize', (v) => {
      const st = S(), d = G.Render.CTRL_DEF.joy; st.ctrlPos = st.ctrlPos || {};
      st.ctrlPos.joy = Object.assign({ x: st.lefty && !st.ctrlPos.joy ? 1 - d[0] : d[0], y: d[1] }, st.ctrlPos.joy || {}, { s: v });
    });
  };
  ACT.joyMode = (a) => { S().joyMode = a.dataset.v; G.Save.commit(); G.Audio.sfx('ui'); a.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === a)); };
})();
