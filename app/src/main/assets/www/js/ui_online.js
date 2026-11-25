/* Brawl Rush - interface multijoueur : équipes, codes, matchmaking, salle d'attente, profil, classement */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net;
  const { $, $$, el, esc, portraitCanvas, animate, fmt, S, ic, addTimer, skinOf } = UI.h;
  const MODE_ICON = { gem: 'gem', ball: 'ball', safe: 'safe', star: 'star', skull: 'skull', zone: 'flag', bolt: 'bolt' };
  const noServer = () => { UI.toast('Configurez d\'abord le serveur dans Réglages > Serveur.', 3200); return true; };
  const ensureNet = () => { if (!Net.serverUrl()) return noServer(); Net.ensure(); return false; };
  UI.teamModal = null; UI.queueOv = null; UI.lobbyOv = null;

  /* ---------- pastille de connexion + actions de l'accueil ---------- */
  ACT.onlinePlay = () => { // matchmaking rapide : joueur seul (ou avec son équipe)
    G.Audio.sfx('ui');
    if (ensureNet()) return;
    whenOnline(() => {
      if (Net.party) { if (Net.party.leader !== Net.pid) { UI.toast('Seul le chef d\'équipe lance la recherche.'); return; } Net.startQueue(S().mode); }
      else { Net.createParty(S().mode); setTimeout(() => Net.startQueue(S().mode), 250); }
    });
  };
  function whenOnline(fn) {
    if (Net.status === 'online') return fn();
    UI.toast(Net.waking() ? 'Réveil du serveur… (jusqu’à 1 minute)' : 'Connexion au serveur…', 2500);
    Net.ensure();
    let done = false; const h = (st) => { if (st === 'online' && !done) { done = true; Net.off('status', h); clearInterval(iv); setTimeout(fn, 150); } };
    Net.on('status', h);
    const iv = setInterval(() => { if (done) return clearInterval(iv); if (Net.waking()) UI.toast('Réveil du serveur… (jusqu’à 1 minute)', 2500); }, 6000);
    setTimeout(() => { if (!done) { done = true; Net.off('status', h); clearInterval(iv); UI.toast('Serveur injoignable pour le moment. Réessayez dans un instant.', 3500); } }, 90000);
  }
  Net.on('neterror', (e) => UI.toast(e.msg, 3500));
  Net.on('error', (e) => { UI.toast(e.msg, 3000); G.Audio.sfx('error'); });

  /* ---------- équipe ---------- */
  ACT.team = () => {
    G.Audio.sfx('ui');
    if (ensureNet()) return;
    Net.sendProfile();
    const o = UI.modal('<div id="teamBody"></div>', { style: 'min-width:100rem' });
    UI.teamModal = o; o.dataset.team = '1';
    renderTeam();
    whenOnline(() => { Net.sendProfile(); renderTeam(); });
  };
  function renderTeam() {
    const o = UI.teamModal; if (!o || !o.isConnected) { UI.teamModal = null; return; }
    const body = $('#teamBody', o); if (!body) return;
    const p = Net.party, st = Net.status;
    const dot = st === 'online' ? 'on' : st === 'off' ? 'off' : 'wait';
    const status = `<div style="text-align:center;font-size:2.4rem;margin-bottom:1rem"><span class="netdot ${dot}"></span>${st === 'online' ? 'Connecté · ' + Net.ping + ' ms' : Net.waking() ? 'Réveil du serveur… (jusqu’à 1 min)' : st === 'reconnecting' ? 'Reconnexion…' : st === 'connecting' ? 'Connexion…' : 'Hors ligne'}</div>`;
    if (!p) {
      body.innerHTML = `<h2>Équipe</h2>${status}<div class="row"><button class="btn green" data-act="teamCreate" ${st !== 'online' ? 'disabled' : ''}>Créer une équipe</button></div>
        <div class="row" style="margin-top:3rem;font-size:3rem">ou rejoindre un ami :</div>
        <div class="row" style="margin-top:1.4rem"><input class="txt" id="codeIn" maxlength="5" placeholder="CODE" autocapitalize="characters" autocomplete="off" style="width:30rem;text-align:center;text-transform:uppercase;letter-spacing:.8rem;font-size:5rem"><button class="btn blue" data-act="teamJoin" ${st !== 'online' ? 'disabled' : ''}>Rejoindre</button></div>`;
      return;
    }
    const me = p.leader === Net.pid, mode = G.MODES[p.mode];
    const mem = p.members.map((m) => `<div class="member">${p.leader === m.pid ? '<span class="crown">👑</span>' : ''}${me && m.pid !== Net.pid ? `<button class="kick" data-act="teamKick" data-pid="${m.pid}">✕</button>` : ''}<canvas width="260" height="260" data-id="${m.brawler}" data-s="${m.skin}"></canvas><div>${esc(m.name)}${m.pid === Net.pid ? ' (vous)' : ''}</div>${m.online ? `<div style="color:#ffd21f;font-size:2.2rem">${ic('trophy')} ${fmt(m.trophies || 0)}</div>` : '<div class="off">déconnecté</div>'}</div>`);
    while (mem.length < 3) mem.push('<div class="member empty">En attente d\'un ami…</div>');
    const busy = p.state !== 'idle';
    body.innerHTML = `<h2>Votre équipe</h2>${status}
      <div style="text-align:center;font-size:2.6rem">Code d'équipe — donnez-le à vos amis</div>
      <div class="code" data-act="copyCode">${p.code}</div>
      <div class="row"><button class="btn small blue" data-act="copyCode">Copier</button><button class="btn small green" data-act="shareCode">Partager</button></div>
      <div class="members">${mem.join('')}</div>
      <div class="row" style="font-size:2.8rem;margin-bottom:1.4rem">Mode : <button class="btn small" data-act="teamMode" ${me && !busy ? '' : 'disabled'} style="background:${mode.color}">${esc(mode.name)}</button></div>
      <div class="row">${busy ? `<div style="font-size:3rem;color:#ffd21f">${p.state === 'queue' ? 'Recherche en cours…' : p.state === 'lobby' ? 'Salle d\'attente…' : 'Partie en cours'}</div>` :
        me ? `<button class="btn green" data-act="teamQueue">Trouver des joueurs</button><button class="btn blue" data-act="teamPrivate">Match privé</button>${p.members.length > 1 ? '<button class="btn small gray" data-act="teamPrivateSplit">Amis contre amis</button>' : ''}` : '<div style="font-size:2.8rem">Le chef d\'équipe lance la partie.</div>'}
        <button class="btn small red" data-act="teamLeave">Quitter l'équipe</button></div>`;
    $$('canvas', body).forEach((c) => G.Render.portrait(c, c.dataset.id, c.dataset.s, 0, { aim: 0.4, zoom: 0.8, y: 0.74 }));
  }
  const refresh = () => { if (UI.teamModal) renderTeam(); };
  Net.on('party', refresh); Net.on('status', refresh); Net.on('error', refresh);
  Net.on('party', (m) => { if (UI.teamModal && m.party === null && !Net.party) renderTeam(); });
  Net.on('kicked', () => { UI.toast('Vous avez été retiré de l\'équipe.'); refresh(); });
  ACT.teamCreate = () => { G.Audio.sfx('ui'); Net.createParty(S().mode); };
  ACT.teamJoin = () => { const c = ($('#codeIn').value || '').trim(); if (c.length < 5) { UI.toast('Le code contient 5 caractères.'); return; } G.Audio.sfx('ui'); Net.joinParty(c); };
  ACT.teamLeave = () => { G.Audio.sfx('back'); Net.leaveParty(); };
  ACT.teamKick = (a) => Net.kick(a.dataset.pid);
  ACT.teamQueue = () => { G.Audio.sfx('ui'); Net.startQueue(Net.party.mode); };
  ACT.teamPrivate = () => { G.Audio.sfx('ui'); Net.startPrivate(Net.party.mode, false); };
  ACT.teamPrivateSplit = () => { G.Audio.sfx('ui'); Net.startPrivate(Net.party.mode, true); };
  ACT.teamMode = () => {
    const i = G.MODE_ORDER.indexOf(Net.party.mode); const next = G.MODE_ORDER[(i + 1) % G.MODE_ORDER.length];
    S().mode = next; G.Save.commit(); Net.setMode(next); G.Audio.sfx('ui');
  };
  const copyText = (txt) => {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt); return true; } } catch (e) { /* ignore */ }
    try { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0;user-select:text'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch (e) { return false; }
  };
  ACT.copyCode = () => { G.Audio.sfx('ui'); UI.toast(copyText(Net.party.code) ? 'Code copié : ' + Net.party.code : 'Code : ' + Net.party.code); };
  ACT.shareCode = () => {
    const txt = 'Rejoins mon équipe sur Brawl Rush ! Code d\'équipe : ' + Net.party.code;
    G.Audio.sfx('ui');
    try { if (window.AndroidBridge && AndroidBridge.share) { AndroidBridge.share(txt); return; } if (navigator.share) { navigator.share({ text: txt }); return; } } catch (e) { /* ignore */ }
    UI.toast(copyText(txt) ? 'Message copié, collez-le à vos amis !' : txt, 3000);
  };

  /* ---------- recherche / salle d'attente ---------- */
  function clearQueueOv() { if (UI.queueOv) { clearInterval(UI.queueOv._iv); UI.queueOv.remove(); UI.queueOv = null; } }
  function clearLobbyOv() { if (UI.lobbyOv) { clearInterval(UI.lobbyOv._iv); UI.lobbyOv.remove(); UI.lobbyOv = null; } }
  Net.on('queue', (m) => {
    clearQueueOv();
    if (m.state !== 'searching' || G.App.state === 'match') return;
    const mode = G.MODES[m.mode], t0 = Date.now(), leader = Net.party && Net.party.leader === Net.pid;
    const o = el(`<div class="fullscreen mm"><div class="spinner"></div><h2>Recherche de joueurs…</h2><div style="font-size:3.6rem">${esc(mode.name)}</div><div id="qt" style="font-size:5rem;color:#ffd21f">0:00</div>
      <div style="font-size:2.4rem;max-width:90rem;text-align:center">Les places libres seront complétées par des bots (clairement indiqués) si personne n'est trouvé.</div>
      ${leader || !Net.party ? '<button class="btn red" data-act="queueCancel">Annuler</button>' : '<div style="font-size:2.6rem">Le chef peut annuler.</div>'}</div>`);
    $('#ui').appendChild(o); UI.queueOv = o;
    o._iv = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); const q = $('#qt', o); if (q) q.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }, 500);
    G.Audio.startMusic('menu');
  });
  ACT.queueCancel = () => { G.Audio.sfx('back'); Net.cancelQueue(); clearQueueOv(); };
  Net.on('lobby', (m) => {
    clearQueueOv(); clearLobbyOv();
    const total = m.need, slots = [];
    for (let i = 0; i < total; i++) slots.push(m.slots[i] ? `<div class="slot in ${m.mode !== 'showdown' && m.slots[i].team === 1 ? 'foe' : ''}">${esc(m.slots[i].name)}</div>` : '<div class="slot">Bot (si libre)</div>');
    const o = el(`<div class="fullscreen mm"><h2>Salle d'attente</h2><div style="font-size:3.4rem">${esc(G.MODES[m.mode].name)} · ${esc(m.mapName)}</div><div class="slots">${slots.join('')}</div><div style="font-size:3.4rem">Départ dans <span id="lc" style="color:#ffd21f">${m.secs}</span> s</div><button class="btn small gray" data-act="lobbyLeave">Quitter</button></div>`);
    $('#ui').appendChild(o); UI.lobbyOv = o; G.Audio.sfx('go');
    let s = m.secs; o._iv = setInterval(() => { s = Math.max(0, s - 1); const c = $('#lc', o); if (c) c.textContent = s; }, 1000);
  });
  ACT.lobbyLeave = () => { Net.send({ t: 'lobby_leave' }); clearLobbyOv(); G.Audio.sfx('back'); };
  Net.on('lobby_closed', clearLobbyOv);
  Net.on('match', () => { clearQueueOv(); clearLobbyOv(); });
  UI.versusRoster = function (init) {
    const show = init.mode === 'showdown', mode = G.MODES[init.mode];
    const pl = (e) => `<div class="pl ${e.idx === init.you ? 'me' : ''}"><canvas width="220" height="220" data-id="${e.brawler}" data-s="${e.skin}"></canvas><span>${esc(e.name)}</span></div>`;
    const html = show ? `<div class="vtitle">${mode.name}<small>${esc(G.MAPS[init.mapKey].name)}</small></div><div class="grid">${init.roster.map(pl).join('')}</div>`
      : `<div class="vtitle">${mode.name}<small>${esc(G.MAPS[init.mapKey].name)}</small></div><div class="side l">${init.roster.filter((e) => e.team === 0).map(pl).join('')}</div><div class="side r">${init.roster.filter((e) => e.team === 1).map(pl).join('')}</div><div class="vsbig">VS</div>`;
    const o = el(`<div class="fullscreen vs ${show ? 'ffa' : ''}" style="pointer-events:none">${html}</div>`);
    $('#ui').appendChild(o);
    $$('canvas', o).forEach((c) => G.Render.portrait(c, c.dataset.id, c.dataset.s, 0, { aim: 0.5, zoom: 0.8, y: 0.74 }));
    setTimeout(() => o.remove(), 2400);
  };
  UI.netOverlay = function (show, txt) {
    let o = $('#netov');
    if (!show) { if (o) o.remove(); return; }
    if (!o) { o = el('<div class="netov" id="netov"><div class="spinner"></div><div id="netovt"></div></div>'); $('#ui').appendChild(o); }
    $('#netovt', o).textContent = txt || 'Reconnexion…';
  };

  /* ---------- profil ---------- */
  ACT.profile = () => {
    G.Audio.sfx('ui');
    const sv = S(), st = sv.stats, tot = G.Save.totalTrophies();
    const fav = Object.entries(sv.trophies).sort((a, b) => b[1] - a[1])[0];
    const o = UI.modal(`<h2>Profil</h2><div class="row"><canvas id="profCv" width="300" height="300" style="width:24rem;height:24rem;border-radius:2rem;background:radial-gradient(#7a86ff,#3a3fb0);border:.3rem solid var(--navy)"></canvas>
      <div><div style="font-size:5rem">${esc(sv.name)}</div><div style="font-size:3.4rem;color:#ffd21f">${ic('trophy')} ${fmt(tot)} trophées</div><div style="font-size:2.6rem">Rang ${G.rankOf(tot)} · Favori : ${fav ? G.BRAWLER[fav[0]].name : '—'}</div>
      <div id="onl" style="font-size:2.6rem;color:#9dffb4;margin-top:.6rem">${Net.status === 'online' ? 'En ligne' : 'Hors ligne'}</div></div></div>
      <div class="statgrid"><div><b>${st.matches}</b>Parties</div><div><b>${st.wins}</b>Victoires</div><div><b>${st.kills}</b>Éliminations</div><div><b>${st.goals}</b>Buts</div><div><b>${st.gemsGrabbed}</b>Cristaux</div><div><b>${fmt(st.damage)}</b>Dégâts</div></div>
      <div class="row"><button class="btn small blue" data-act="rename">Changer de pseudo</button><button class="btn small green" data-act="leaderboard">Classement</button></div>`);
    animate($('#profCv', o), sv.selected, skinOf(sv.selected), { zoom: 0.95, y: 0.76, happy: true });
  };

  /* ---------- classement ---------- */
  ACT.leaderboard = () => {
    G.Audio.sfx('ui');
    if (!Net.serverUrl()) { UI.modals.length && UI.closeModal(); return noServer(); }
    if (UI.modals.length && UI.modals[UI.modals.length - 1].dataset.lbm) return;
    const o = UI.modal('<h2>Classement mondial</h2><div id="lbBody" style="min-height:20rem;text-align:center;font-size:3rem">Chargement…</div>', { style: 'min-width:110rem' });
    o.dataset.lbm = '1';
    const fill = (m) => {
      const b = $('#lbBody'); if (!b) return;
      if (!m.top.length) { b.textContent = 'Personne n\'a encore joué en ligne. Soyez le premier !'; return; }
      b.style.textAlign = 'left';
      b.innerHTML = '<div class="lbrow h"><span>#</span><span>Joueur</span><span>Trophées</span><span>Vict.</span></div>' + m.top.map((r) => `<div class="lbrow ${r.me ? 'me' : ''}"><span class="rk">${r.rank}</span><span>${esc(r.name)}</span><span>${ic('trophy')} ${fmt(r.trophies)}</span><span>${r.wins}</span></div>`).join('') +
        (m.me.rank > 50 ? `<div class="lbrow me"><span class="rk">${m.me.rank}</span><span>Vous</span><span>${ic('trophy')} ${fmt(m.me.trophies)}</span><span>${m.me.wins}</span></div>` : '');
    };
    const h = (m) => { Net.off('lb', h); fill(m); };
    Net.on('lb', h);
    whenOnline(() => Net.getLeaderboard());
    setTimeout(() => { const b = $('#lbBody'); if (b && b.textContent === 'Chargement…') b.textContent = 'Serveur injoignable.'; }, 9000);
  };

  /* ---------- réglage du serveur ---------- */
  ACT.serverCfg = () => {
    G.Audio.sfx('ui');
    const cur = S().settings.server || '';
    UI.modal(`<h2>Serveur multijoueur</h2><div class="row" style="font-size:2.4rem;max-width:100rem;text-align:center;margin-bottom:1.6rem">Adresse du serveur Brawl Rush (ex. <b style="color:#ffd21f">mon-jeu.onrender.com</b>). Tous vos amis doivent utiliser la même.</div>
      <div class="row"><input class="txt" id="srvIn" value="${esc(cur)}" placeholder="mon-serveur.com" autocapitalize="none" autocomplete="off" style="width:70rem"></div>
      <div class="row" id="srvSt" style="font-size:2.8rem;margin-top:1.6rem;min-height:4rem"></div>
      <div class="row" style="margin-top:1.6rem"><button class="btn green" data-act="srvSave">Enregistrer et tester</button></div>`);
  };
  ACT.srvSave = () => {
    const v = ($('#srvIn').value || '').trim();
    S().settings.server = v; G.Save.commit();
    const st = $('#srvSt'); Net.disconnect();
    if (!v) { st.textContent = 'Serveur supprimé.'; return; }
    st.textContent = 'Connexion à ' + Net.normalize(v) + '…';
    const h = (s) => { if (s === 'online') { Net.off('status', h); if ($('#srvSt')) $('#srvSt').innerHTML = '<span class="netdot on"></span>Connecté ! (' + Net.online + ' joueur(s) en ligne)'; } };
    Net.on('status', h); Net.connect();
    setTimeout(() => { Net.off('status', h); if ($('#srvSt') && Net.status !== 'online') $('#srvSt').innerHTML = '<span class="netdot off"></span>Impossible de se connecter. Vérifiez l\'adresse.'; }, 10000);
  };
  const ob = UI.back; UI.back = function () { if (UI.queueOv) { ACT.queueCancel(); return true; } if (UI.lobbyOv) { ACT.lobbyLeave(); return true; } return ob.apply(this, arguments); };
  // le profil du joueur est renvoyé au serveur quand il change de brawler
  const eq = UI.ACT.equip; UI.ACT.equip = function () { eq.apply(this, arguments); if (Net.status === 'online') Net.sendProfile(); };
})();
