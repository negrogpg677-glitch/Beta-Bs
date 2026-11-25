/* Brawl Rush - social (amis, invitations, clubs, chat), profil détaillé, événements, résultats spectaculaires, effets tactiles, PWA */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net;
  const { $, $$, el, esc, portraitCanvas, animate, fmt, S, ic, addTimer, skinOf } = UI.h;
  UI.pendingInvites = 0; UI.socialTab = 'friends';

  UI.updateNetDot = function () { $$('.netdot.hd').forEach((d) => { d.className = 'netdot hd ' + (Net.status === 'online' ? 'on' : Net.status === 'off' ? 'off' : 'wait'); }); };
  Net.on('status', UI.updateNetDot);

  /* ---------- événement du jour ---------- */
  UI.eventBanner = function () {
    const ev = G.todayEvent();
    return `<div class="evbanner"><span class="evic">${ev.icon}</span><div><div class="evn">${esc(ev.name)}</div><div class="evd">${esc(ev.desc)}</div></div></div>`;
  };

  /* ---------- effets tactiles : étincelles + vibration légère ---------- */
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest && e.target.closest('.btn, .icon-btn, .side-btn, .nav button, .tab, .bw-card, .modecard, .rw');
    if (!t || document.body.classList.contains('in-match')) return;
    for (let i = 0; i < 7; i++) {
      const d = document.createElement('i'); d.className = 'spark';
      const a = Math.random() * 6.283, r = 40 + Math.random() * 50;
      d.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px;background:${['#ffd21f', '#fff', '#7df9ff', '#ff9ce0'][i % 4]}`;
      document.body.appendChild(d); setTimeout(() => d.remove(), 520);
    }
    G.vibrate(8);
  }, { passive: true });

  /* ---------- écran Social ---------- */
  ACT.goSocial = () => { G.Audio.sfx('ui'); UI.show('social'); };
  const statusDot = (s) => `<span class="netdot ${s === 'off' ? 'off' : s === 'menu' ? 'on' : 'wait'}"></span>`;
  const statusTxt = { off: 'Hors ligne', menu: 'En ligne', party: 'En équipe', match: 'En match' };
  UI.build.social = function () {
    const root = $('#social');
    root.innerHTML = UI.h.head('Social') + `<div class="body"><div class="tabs">${[['friends', 'Amis'], ['club', 'Club'], ['ranking', 'Classement']].map(([k, l]) => `<button class="tab ${UI.socialTab === k ? 'act' : ''}" data-act="socialTab" data-k="${k}">${l}</button>`).join('')}<div class="spacer"></div><span style="font-size:2.4rem;align-self:center"><span class="netdot ${Net.status === 'online' ? 'on' : Net.status === 'off' ? 'off' : 'wait'}"></span>${Net.status === 'online' ? 'Connecté' : Net.status === 'off' ? 'Hors ligne' : 'Connexion…'}</span></div><div id="socBody"></div></div>` + UI.h.nav('social');
    if (Net.serverUrl()) { Net.ensure(); whenOnline(() => { Net.send({ t: 'friends_get' }); Net.send({ t: 'club_get' }); }); }
    renderSocial();
  };
  function whenOnline(fn) { if (Net.status === 'online') return fn(); const h = (st) => { if (st === 'online') { Net.off('status', h); fn(); } }; Net.on('status', h); setTimeout(() => Net.off('status', h), 12000); }
  ACT.socialTab = (a) => { UI.socialTab = a.dataset.k; G.Audio.sfx('ui'); $$('#social .tab').forEach((t) => t.classList.toggle('act', t.dataset.act === 'socialTab' && t.dataset.k === UI.socialTab)); if (UI.socialTab === 'club') { Net.send({ t: 'club_get' }); Net.clubList2(); } if (UI.socialTab === 'ranking') Net.getLeaderboard(); renderSocial(); };
  function renderSocial() {
    const b = $('#socBody'); if (!b || UI.screen !== 'social') return;
    if (!Net.serverUrl()) { b.innerHTML = '<div class="row" style="font-size:3rem;margin-top:6rem">Le mode en ligne n\'est pas disponible dans cette version.</div>'; return; }
    if (Net.status !== 'online') { b.innerHTML = '<div class="row" style="font-size:3.2rem;margin-top:6rem;flex-direction:column"><div class="spinner"></div><div>' + (Net.waking() ? 'Réveil du serveur… (jusqu’à 1 min)' : 'Connexion au serveur…') + '</div></div>'; return; }
    if (UI.socialTab === 'friends') renderFriends(b); else if (UI.socialTab === 'club') renderClub(b); else renderRanking(b);
  }
  function renderFriends(b) {
    const f = Net.friends || { code: Net.friendCode, list: [] };
    const list = f.list.slice().sort((a, c) => (a.status === 'off') - (c.status === 'off') || c.trophies - a.trophies);
    b.innerHTML = `<div class="socgrid"><div class="soccard"><div style="font-size:2.4rem">Votre code d'ami</div><div class="code" style="font-size:8rem;margin:.4rem 0">${esc(f.code || '------')}</div>
      <div class="row"><button class="btn small blue" data-act="copyFriend">Copier</button><button class="btn small green" data-act="shareFriend">Partager</button></div>
      <div style="font-size:2.2rem;margin:1.6rem 0 .6rem">Ajouter un ami</div><div class="row"><input class="txt" id="fcIn" maxlength="6" placeholder="CODE" autocapitalize="characters" autocomplete="off" style="width:26rem;text-align:center;letter-spacing:.5rem;text-transform:uppercase;font-size:3.6rem"><button class="btn small" data-act="friendAdd">Ajouter</button></div></div>
      <div class="soclist">${list.length ? list.map((x) => `<div class="frow"><div class="fav" data-act="friendCard" data-pid="${x.pid}">${esc(x.name.slice(0, 1).toUpperCase())}</div><div class="finfo" data-act="friendCard" data-pid="${x.pid}"><div class="fn">${esc(x.name)}${x.club ? ' <span class="ctag">[' + esc(x.club) + ']</span>' : ''}</div><div class="fs">${statusDot(x.status)}${statusTxt[x.status]} · ${ic('trophy')} ${fmt(x.trophies)}</div></div>
        ${x.status === 'menu' || x.status === 'party' ? `<button class="btn small green" data-act="friendInvite" data-pid="${x.pid}">Inviter</button>` : ''}<button class="btn small red" data-act="friendDel" data-pid="${x.pid}">✕</button></div>`).join('') : '<div class="row" style="font-size:2.8rem;margin-top:4rem;text-align:center">Aucun ami pour l\'instant.<br>Échangez vos codes pour jouer ensemble !</div>'}</div></div>`;
  }
  ACT.copyFriend = () => { const t = (Net.friends && Net.friends.code) || Net.friendCode; try { navigator.clipboard.writeText(t); } catch (e) { /* ignore */ } UI.toast('Code copié : ' + t); };
  ACT.shareFriend = () => { const t = 'Ajoute-moi sur Brawl Rush ! Mon code d\'ami : ' + ((Net.friends && Net.friends.code) || Net.friendCode); try { if (window.AndroidBridge && AndroidBridge.share) { AndroidBridge.share(t); return; } if (navigator.share) { navigator.share({ text: t }); return; } navigator.clipboard.writeText(t); UI.toast('Message copié !'); } catch (e) { UI.toast(t, 3500); } };
  ACT.friendAdd = () => { const v = ($('#fcIn').value || '').trim(); if (v.length < 6) { UI.toast('Le code d\'ami contient 6 caractères.'); return; } G.Audio.sfx('ui'); Net.addFriend(v); $('#fcIn').value = ''; };
  ACT.friendDel = (a) => { Net.removeFriend(a.dataset.pid); };
  ACT.friendInvite = (a) => { G.Audio.sfx('ui'); Net.sendProfile(); Net.invite(a.dataset.pid, S().mode); setTimeout(() => ACT.team && ACT.team(), 400); };
  function renderClub(b) {
    const c = Net.club;
    if (c && c.members) {
      b.innerHTML = `<div class="socgrid"><div class="soccard"><div class="row" style="font-size:4rem">${ic('shield')} ${esc(c.name)} <span class="ctag">[${esc(c.tag)}]</span></div><div style="font-size:2.4rem;text-align:center">${c.count}/30 membres · ${ic('trophy')} ${fmt(c.trophies)}</div>
        <div class="soclist" style="max-height:34rem;margin-top:1rem">${c.members.map((m) => `<div class="frow"><div class="fav">${esc(m.name.slice(0, 1).toUpperCase())}</div><div class="finfo"><div class="fn">${m.owner ? '👑 ' : ''}${esc(m.name)}</div><div class="fs">${statusDot(m.online ? 'menu' : 'off')}${ic('trophy')} ${fmt(m.trophies)}</div></div></div>`).join('')}</div>
        <div class="row" style="margin-top:1rem"><button class="btn small red" data-act="clubLeave">Quitter le club</button></div></div>
        <div class="soccard chatc"><div id="chatBox" class="chatbox">${(c.chat || []).map(chatLine).join('')}</div><div class="row" style="margin-top:1rem;flex-wrap:nowrap"><input class="txt" id="chatIn" maxlength="120" placeholder="Votre message…" style="flex:1;font-size:2.6rem" autocomplete="off"><button class="btn small green" data-act="chatSend">${ic('chat')}</button></div></div></div>`;
      const cb = $('#chatBox'); if (cb) cb.scrollTop = 1e9;
      const inp = $('#chatIn'); if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') ACT.chatSend(); };
    } else {
      const list = Net.clubList || [];
      b.innerHTML = `<div class="socgrid"><div class="soccard"><div style="font-size:3.2rem;text-align:center">Créer un club</div><div class="row" style="margin-top:1rem"><input class="txt" id="clName" maxlength="18" placeholder="Nom du club" style="width:36rem;font-size:2.8rem"><input class="txt" id="clTag" maxlength="4" placeholder="TAG" style="width:14rem;text-transform:uppercase;font-size:2.8rem;text-align:center"></div><div class="row" style="margin-top:1.4rem"><button class="btn green" data-act="clubCreate">Créer</button></div></div>
        <div class="soclist"><div style="font-size:2.6rem;margin-bottom:.8rem">Clubs ouverts</div>${list.length ? list.map((x) => `<div class="frow"><div class="fav" style="background:#ffc21f">${ic('shield')}</div><div class="finfo"><div class="fn">${esc(x.name)} <span class="ctag">[${esc(x.tag)}]</span></div><div class="fs">${x.count}/30 · ${ic('trophy')} ${fmt(x.trophies)}</div></div><button class="btn small blue" data-act="clubJoin" data-id="${x.id}">Rejoindre</button></div>`).join('') : '<div style="font-size:2.4rem">Aucun club pour l\'instant : créez le premier !</div>'}</div></div>`;
    }
  }
  const chatLine = (m) => m.sys ? `<div class="cl sys">${esc(m.txt)}</div>` : `<div class="cl ${m.pid === Net.pid ? 'me' : ''}"><b>${esc(m.name)}</b> ${esc(m.txt)}</div>`;
  ACT.clubCreate = () => { const n = $('#clName').value.trim(); if (n.length < 3) { UI.toast('Nom trop court (3 caractères min)'); return; } G.Audio.sfx('buy'); Net.clubCreate(n, $('#clTag').value.trim()); };
  ACT.clubJoin = (a) => { G.Audio.sfx('buy'); Net.clubJoin(a.dataset.id); };
  ACT.clubLeave = () => { G.Audio.sfx('back'); Net.clubLeave(); };
  ACT.chatSend = () => { const i = $('#chatIn'); if (!i || !i.value.trim()) return; Net.clubChat(i.value); i.value = ''; };
  function renderRanking(b) {
    const m = Net.lb;
    if (!m) { b.innerHTML = '<div class="row" style="font-size:3rem;margin-top:5rem">Chargement…</div>'; return; }
    b.innerHTML = '<div class="soclist" style="max-width:110rem;margin:0 auto"><div class="lbrow h"><span>#</span><span>Joueur</span><span>Trophées</span><span>Vict.</span></div>' + (m.top.length ? m.top.map((r) => `<div class="lbrow ${r.me ? 'me' : ''}"><span class="rk">${r.rank}</span><span>${esc(r.name)}</span><span>${ic('trophy')} ${fmt(r.trophies)}</span><span>${r.wins}</span></div>`).join('') : '<div style="font-size:2.8rem;text-align:center;margin-top:3rem">Personne n\'a encore joué en ligne.</div>') + '</div>';
  }
  for (const t of ['friends', 'club', 'club_list', 'lb', 'status']) Net.on(t, () => renderSocial());
  Net.on('club_msg', (m) => { const c = Net.club; if (c && c.chat) { c.chat.push(m.msg); const cb = $('#chatBox'); if (cb && UI.socialTab === 'club') { cb.insertAdjacentHTML('beforeend', chatLine(m.msg)); cb.scrollTop = 1e9; } } });
  Net.on('toast', (m) => UI.toast(m.msg, 3000));

  /* ---------- invitations reçues ---------- */
  Net.on('invited', (m) => { if (UI.showInvite) UI.showInvite(m); });
  ACT.invAccept = (a) => { const code = a.dataset.code; a.closest('.invite').remove(); Net.sendProfile(); Net.joinParty(code); setTimeout(() => ACT.team && ACT.team(), 200); };
  ACT.invClose = (a) => a.closest('.invite').remove();

  /* ---------- profil détaillé ---------- */
  ACT.profile = () => {
    G.Audio.sfx('ui');
    const sv = S(), st = sv.stats, tot = G.Save.totalTrophies(), rank = G.rankOf(tot), lvl = G.playerLevel ? G.playerLevel() : { lvl: 1 };
    const wr = st.matches ? Math.round((st.wins / st.matches) * 100) : 0, bm = st.byMode || {};
    const hrs = Math.floor((st.playTime || 0) / 3600), mins = Math.floor(((st.playTime || 0) % 3600) / 60);
    let best = 0, cur = 0; (st.hist || []).slice().reverse().forEach((h) => { cur = h.w > 0 ? cur + 1 : 0; best = Math.max(best, cur); });
    const sdW = st.showdownWins || 0, teamW = Math.max(0, (st.wins || 0) - sdW);
    const owned = sv.unlocked.slice().sort((x, y) => (sv.trophies[y] || 0) - (sv.trophies[x] || 0));
    const code = (G.Net && ((G.Net.friends && G.Net.friends.code) || G.Net.friendCode)) || '';
    const hist = (st.hist || []).slice(0, 10).map((h) => `<span class="hdot ${h.w > 0 ? 'w' : h.w < 0 ? 'l' : 'd'}">${h.w > 0 ? 'V' : h.w < 0 ? 'D' : '='}</span>`).join('');
    const o = UI.modal(`<h2 class="pf-title">Profil</h2><div class="pf">
      <div class="pf-left"><div class="pf-card"><div class="pc-glow"></div><canvas id="profCv" width="600" height="600"></canvas>
        <div class="pf-lv">${lvl.lvl || 1}</div><div class="pf-rank" style="background:${G.rankColor(rank)}">Rang ${rank}</div></div>
        <div class="pf-name">${esc(sv.name)}</div><div class="pf-sub">${code ? 'Code ami : <b>' + esc(code) + '</b> · ' : ''}${hrs} h ${mins} min de jeu</div>
        <div class="row" style="gap:1rem;margin-top:1rem"><button class="btn small blue" data-act="rename">Changer de pseudo</button><button class="btn small green" data-act="leaderboard">Classement</button></div></div>
      <div class="pf-right">
        <div class="pf-row3"><div class="pf-box"><span>Voie des trophées</span><b>${ic('trophy')} ${fmt(tot)}</b><small>Record : ${fmt(st.bestTr || tot)}</small></div>
          <div class="pf-box"><span>Victoires en équipe</span><b>${fmt(teamW)}</b><small>${wr}% de victoires</small></div>
          <div class="pf-box"><span>Survie</span><b>${fmt(sdW)}</b><small>Meilleure série : ${best}</small></div></div>
        <div class="pf-sec"><span>Brawlers</span><small>Possédés : ${sv.unlocked.length} / ${G.BRAWLERS.length}</small></div>
        <div class="pf-grid">${owned.map((id) => `<button class="pf-b ${id === sv.selected ? 'on' : ''}" data-act="pfPick" data-id="${id}"><i class="pfi" data-id="${id}"></i><span>${ic('trophy')}${fmt(sv.trophies[id] || 0)}</span></button>`).join('')}</div>
        <div class="pf-row3"><div class="pf-box"><span>Éliminations</span><b>${fmt(st.kills)}</b></div><div class="pf-box"><span>Dégâts</span><b>${fmt(st.damage)}</b></div><div class="pf-box"><span>Parties</span><b>${fmt(st.matches)}</b></div></div>
        <div class="pf-sec"><span>Dernières parties</span><button class="btn small blue" data-act="battleLog">Carnet de combat</button></div>
        <div class="row" style="justify-content:flex-start;gap:.6rem">${hist || '<span style="font-size:2.2rem;color:#9aa7c8">Aucune partie.</span>'}</div>
      </div></div>`, { style: 'width:min(176rem,98vw)' });
    o.querySelectorAll('.pfi').forEach((v) => v.replaceWith(UI.h.portraitCanvas(v.dataset.id, skinOf(v.dataset.id), 120)));
    animate($('#profCv', o), sv.selected, skinOf(sv.selected), { zoom: 0.9, y: 0.8, happy: true, yaw: -0.25 });
    setTimeout(() => { const cv = $('#profCv', o); if (cv && G.Char3D) G.Char3D.poke(cv); }, 250);
  };
  ACT.pfPick = (a) => { // changer de personnage sur la carte : animation d'entrée
    const o = UI.modals[UI.modals.length - 1], cv = o && $('#profCv', o); if (!cv) return;
    G.Audio.sfx('ui'); UI.anim = UI.anim.filter((x) => x.cv !== cv);
    animate(cv, a.dataset.id, skinOf(a.dataset.id), { zoom: 0.9, y: 0.8, happy: true, yaw: -0.25 });
    o.querySelectorAll('.pf-b').forEach((x) => x.classList.toggle('on', x === a));
    cv.classList.remove('swap'); void cv.offsetWidth; cv.classList.add('swap'); if (G.Char3D) G.Char3D.poke(cv);
  };

  /* ---------- écran de résultat spectaculaire ---------- */
  UI.showResult = function (R) {
    UI.clearTutorial && UI.clearTutorial();
    const sv = S(), r = R.r, id = R.brawler, cls = r.win ? 'win' : r.draw ? 'draw' : 'lose';
    const show = R.mode === 'showdown';
    const title = show ? (r.win ? 'VICTOIRE !' : '#' + R.place + ' sur 10') : r.draw ? 'ÉGALITÉ' : r.win ? 'VICTOIRE !' : 'DÉFAITE';
    const tot = G.Save.totalTrophies(), rankNow = G.rankOf(tot), rankBefore = G.rankOf(tot - R.delta);
    const rows = [`<div class="rline" style="animation-delay:.7s">${ic('trophy')}<span>Trophées</span><span class="rv" id="rvTr" style="color:${R.delta >= 0 ? '#7dff7a' : '#ff7a7a'}">${R.delta >= 0 ? '+' : ''}0</span></div>`,
      `<div class="rline" style="animation-delay:.9s">${ic('coin')}<span>Pièces</span><span class="rv">+${R.coins}</span></div>`];
    if (R.gems) rows.push(`<div class="rline" style="animation-delay:1.1s">${ic('gem')}<span>Gemmes</span><span class="rv">+${R.gems}</span></div>`);
    if (R.box) rows.push(`<div class="rline" style="animation-delay:1.3s">${ic('chest')}<span>Coffre obtenu !</span><span class="rv">+${R.box}</span></div>`);
    rows.push(`<div class="rline sm" style="animation-delay:1.4s"><span>Éliminations : ${R.kills}</span><span class="rv">Dégâts : ${fmt(R.damage)}</span></div>`);
    if (R.passXp) rows.push(`<div class="rline" style="animation-delay:1.45s">${ic('star')}<span>Pass Rush</span><span class="rv">+${R.passXp} XP${R.passTier ? ' · palier ' + R.passTier : ''}</span></div>`);
    if (rankNow > rankBefore) rows.push(`<div class="rline" style="animation-delay:1.6s;background:linear-gradient(90deg,#ffd21f55,#0000)">⬆ <span>Nouveau rang !</span><span class="rv">Rang ${rankNow}</span></div>`);
    const o = el(`<div class="fullscreen result ${cls}"><canvas class="rays"></canvas><canvas class="confetti"></canvas>
      <div class="rb ${cls}">${title}</div>${R.online ? '<div class="onl">Partie en ligne</div>' : ''}
      <div class="rrow"><canvas class="hero" width="520" height="520"></canvas><div class="rlist">${rows.join('')}</div></div>
      <div class="row"><button class="btn big green" data-act="resultOk" style="animation:popIn .4s 1.8s backwards">Continuer</button></div></div>`);
    $('#ui').appendChild(o);
    $$('#ui .screen').forEach((s) => s.classList.remove('active')); UI.screen = 'result';
    const hero = $('.hero', o);
    animate(hero, id, skinOf(id), { zoom: 0.92, y: 0.72, pose: r.win ? 'win' : r.draw ? null : 'lose', happy: r.win });
    startRays($('.rays', o), r.win ? '255,225,120' : r.draw ? '160,180,255' : '255,90,100');
    if (r.win) startConfetti($('.confetti', o), 140);
    const tr = $('#rvTr', o); let k = 0; const steps = Math.abs(R.delta);
    if (steps) addTimer(() => { const iv = setInterval(() => { k++; tr.textContent = (R.delta > 0 ? '+' : '-') + k; G.Audio.sfx('coin'); tr.style.transform = 'scale(1.35)'; setTimeout(() => (tr.style.transform = ''), 90); if (k >= steps) clearInterval(iv); }, 110); }, 1000);
    else tr.textContent = '±0';
    G.Audio.sfx(r.win ? 'win' : 'lose'); if (r.win) G.vibrate(60);
  };
  function startRays(cv, rgb) {
    const c = cv.getContext('2d'); cv.width = Math.ceil(window.innerWidth / 2); cv.height = Math.ceil(window.innerHeight / 2);
    let t0 = performance.now();
    (function loop(now) {
      if (!cv.isConnected) return; const t = (now - t0) / 1000, W = cv.width, H = cv.height;
      c.clearRect(0, 0, W, H); c.save(); c.translate(W / 2, H * 0.55); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) { c.save(); c.rotate(t * 0.18 + i * 0.5236); const g = c.createLinearGradient(0, 0, 0, -H); g.addColorStop(0, 'rgba(' + rgb + ',0.35)'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); c.fillStyle = g; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-W * 0.09, -H); c.lineTo(W * 0.09, -H); c.lineTo(6, 0); c.fill(); c.restore(); }
      c.restore(); requestAnimationFrame(loop);
    })(t0);
  }
  function startConfetti(cv, n) {
    const c = cv.getContext('2d'); cv.width = window.innerWidth / 2; cv.height = window.innerHeight / 2;
    const ps = []; for (let i = 0; i < n; i++) ps.push({ x: Math.random() * cv.width, y: -Math.random() * cv.height, vy: 50 + Math.random() * 110, vx: (Math.random() - 0.5) * 50, col: G.pick(['#ffd21f', '#ff4a55', '#3a8cff', '#4cd964', '#b455ff', '#fff']), w: 4 + Math.random() * 6, a: Math.random() * 6 });
    let last = performance.now();
    (function loop(now) {
      if (!cv.isConnected) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; c.clearRect(0, 0, cv.width, cv.height);
      for (const p of ps) { p.y += p.vy * dt; p.x += p.vx * dt + Math.sin((p.a += dt * 4)) * 0.7; if (p.y > cv.height + 10) p.y = -10; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); c.restore(); }
      requestAnimationFrame(loop);
    })(last);
  }

  /* ---------- PWA : installation + service worker ---------- */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  ACT.installApp = () => {
    if (deferred) { deferred.prompt(); deferred = null; return; }
    UI.modal('<h2>Installer le jeu</h2><div style="font-size:2.8rem;text-align:center;line-height:1.3">Sur <b>iPhone</b> (Safari) : touchez <b>Partager</b> puis <b>« Sur l\'écran d\'accueil »</b>.<br>Sur <b>Android</b> (Chrome) : menu ⋮ puis <b>« Installer l\'application »</b>.</div>');
  };
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
