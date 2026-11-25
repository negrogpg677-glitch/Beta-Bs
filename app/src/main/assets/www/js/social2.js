/* Brawl Rush - comptes en ligne (serveur + base) : identifiant en lettres, amis avec demandes et présence,
   changement de pseudo (délai + gemmes), mode classé ELO, cadeaux reçus, panneau développeur. */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net, A = G.Account;
  const { $, $$, el, esc, ic, S, fmt, portraitCanvas, unlockBrawler } = UI.h;
  const ago = (t) => { if (!t) return 'longtemps'; const s = Math.max(60, (Date.now() - t) / 1000); return s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' j'; };
  const stLabel = (f) => f.status === 'menu' ? 'Disponible' : f.status === 'party' ? 'Dans le salon' : f.status === 'match' ? 'En partie' : 'Hors ligne depuis ' + ago(f.lastSeen);
  const stDot = (s) => `<span class="netdot ${s === 'off' ? 'off' : s === 'match' ? 'wait' : 'on'}"></span>`;
  const handleFmt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 16);

  /* ---------- authentification auprès du serveur de jeu ---------- */
  let lastTok = null;
  function auth(force) {
    if (!A || !A.loggedIn() || !A.session || Net.status !== 'online') return;
    const t = A.session.access_token; if (!force && t === lastTok) return; lastTok = t; Net.send({ t: 'auth', token: t });
  }
  Net.on('welcome', () => { lastTok = null; setTimeout(() => auth(true), 30); });
  if (A) A.on(() => { if (A.loggedIn()) auth(false); else if (Net.me) { Net.me = null; Net.fr = null; lastTok = null; } });
  Net.on('status', (s) => { if (s !== 'online') lastTok = null; });
  Net.on('me', (m) => { Net.me = m; if (m.dev && G.DevTools) { G.DevTools.activate(); if (!UI._devHello) { UI._devHello = 1; UI.toast('🔧 Compte développeur reconnu : menu DEV activé', 3000); } } if (UI.screen === 'social') UI.renderSocial(); const pf = $('.pf-left'); if (pf) profileExtra(pf.closest('.modal')); });
  Net.on('fr', (m) => {
    Net.fr = m;
    Net.friends = { code: Net.me && Net.me.handle, list: m.friends.map((f) => ({ pid: f.pid, uid: f.uid, name: f.name, trophies: f.trophies, status: f.status, club: '', handle: f.handle })) };
    if (UI.screen === 'social') UI.renderSocial();
    $$('[data-act=goSocial] .frbadge').forEach((x) => x.remove());
    if (m.incoming.length) $$('[data-act=goSocial]').forEach((b) => b.insertAdjacentHTML('beforeend', `<span class="badge frbadge">${m.incoming.length}</span>`));
  });
  Net.on('fr_new', (m) => { UI.toast('👋 ' + m.from + ' vous a envoyé une demande d\'ami', 3000); G.Audio.sfx('pickup'); });
  Net.on('name_ok', (m) => { const sv = S(); sv.name = m.name; sv.gems = m.gems; sv.rev = Math.max(sv.rev || 0, m.rev || 0); G.Save.commit(); UI.refreshCur(); UI.closeModal(); UI.toast('Pseudo changé : ' + m.name + ' (−' + m.price + ' 💎)', 2600); G.Audio.sfx('buy'); if (UI.screen === 'home') UI.build.home(); });
  Net.on('end', (m) => { if (m.ranked && typeof m.ranked.delta === 'number' && m.ranked.rank) setTimeout(() => UI.toast('🏆 Classé : ' + (m.ranked.delta >= 0 ? '+' : '') + m.ranked.delta + ' ELO · ' + m.ranked.rank.name + ' (' + m.ranked.elo + ')', 4000), 2200); });

  /* ---------- cadeaux ---------- */
  Net.on('gift', (m) => {
    const sv = S(), b = G.BRAWLER[m.brawler]; if (!b) return;
    const fresh = unlockBrawler(m.brawler); if (fresh) G.Save.commit();
    Net.send({ t: 'gift_ack', id: m.id });
    if (G.App.state === 'match') { UI.toast('🎁 ' + m.from + ' vous a offert ' + b.name + ' !', 4000); return; }
    const o = UI.modal(`<div class="giftm"><div class="gm-h">🎁 CADEAU !</div><div class="gm-t"><b>${esc(m.from)}</b> vous offre un brawler</div><div class="gm-cv"><canvas width="420" height="420"></canvas></div><div class="gm-n">${esc(b.name)}</div><button class="btn green" data-act="close">Super !</button></div>`, { style: 'width:min(80rem,92vw)' });
    UI.h.animate($('canvas', o), m.brawler, 'classic', { zoom: 1, y: 0.82, happy: true }); G.Audio.sfx('win'); G.vibrate(80);
    if (!fresh) UI.toast('Vous possédiez déjà ' + b.name + '.', 2200);
    if (UI.screen === 'home') UI.build.home();
  });

  /* ---------- recherche de joueur (réponses « player ») ---------- */
  const waiting = {};
  const findPlayer = (handle, cb) => { const ref = (handleFmt(handle) || 'P') + ':' + Math.random().toString(36).slice(2, 6); waiting[ref] = cb; Net.send({ t: 'player_find', handle, ref }); };
  Net.on('player', (m) => { const cb = waiting[m.ref]; if (cb) { delete waiting[m.ref]; cb(m.card); } });

  /* ---------- écran Amis (comptes) ---------- */
  UI.frTab = 'list';
  UI.friends2 = function (b) {
    if (!A || !A.loggedIn() || !A.enabled()) return false;
    if (!Net.me || !Net.fr) { auth(false); b.innerHTML = '<div class="row" style="font-size:3rem;margin-top:6rem;flex-direction:column"><div class="spinner"></div><div>Connexion de votre compte…</div></div>'; return true; }
    const fr = Net.fr, sorted = fr.friends.slice().sort((x, y) => (x.status === 'off') - (y.status === 'off') || (y.lastSeen || 0) - (x.lastSeen || 0));
    const tab = (k, l, n) => `<button class="fr-tab ${UI.frTab === k ? 'act' : ''}" data-act="frTab" data-k="${k}">${l}${n ? '<span class="badge">' + n + '</span>' : ''}</button>`;
    const av = (f) => `<i class="fr-av" data-b="${esc(G.BRAWLER[f.avatar] ? f.avatar : 'sherry')}"></i>`;
    const who = (f) => `<div class="fr-who" data-act="frCard" data-h="${esc(f.handle)}"><div class="fn">${esc(f.name)}</div><div class="fh">${esc(f.handle)}</div></div>`;
    let body = '';
    if (UI.frTab === 'list') body = sorted.length ? sorted.map((f, i) => `<div class="fr-row ${f.status}" style="animation-delay:${Math.min(i, 10) * 0.035}s">${av(f)}${who(f)}<div class="fr-st">${stDot(f.status)}${stLabel(f)}</div><div class="fr-tr">${ic('trophy')} ${fmt(f.trophies)}</div>
        ${f.pid && (f.status === 'menu' || f.status === 'party') ? `<button class="btn small green" data-act="friendInvite" data-pid="${esc(f.pid)}">Inviter</button>` : ''}<button class="btn small gray" data-act="frRemove" data-uid="${esc(f.uid)}" data-n="${esc(f.name)}">✕</button></div>`).join('')
      : '<div class="fr-empty">Aucun ami pour l\'instant.<br>Ajoutez des joueurs grâce à leur identifiant (onglet « Ajouter »).</div>';
    else if (UI.frTab === 'req') body = `<div class="fr-sec">Demandes reçues (${fr.incoming.length})</div>` + (fr.incoming.map((f) => `<div class="fr-row">${av(f)}${who(f)}<div class="fr-tr">${ic('trophy')} ${fmt(f.trophies)}</div><button class="btn small green" data-act="frAccept" data-uid="${esc(f.uid)}">Accepter</button><button class="btn small red" data-act="frDecline" data-uid="${esc(f.uid)}">Refuser</button></div>`).join('') || '<div class="fr-none">Aucune demande reçue.</div>')
      + `<div class="fr-sec">Demandes envoyées (${fr.outgoing.length})</div>` + (fr.outgoing.map((f) => `<div class="fr-row">${av(f)}${who(f)}<div class="fr-st"><i class="dots"></i> En attente</div><button class="btn small gray" data-act="frCancel" data-uid="${esc(f.uid)}">Annuler</button></div>`).join('') || '<div class="fr-none">Aucune demande envoyée.</div>');
    else body = `<div class="fr-mine">Mon identifiant : <b>${esc(Net.me.handle)}</b><button class="btn small blue" data-act="copyHandle">Copier</button></div>
      <div class="fr-add"><input id="frIn" maxlength="16" placeholder="IDENTIFIANT DU JOUEUR" autocomplete="off" autocapitalize="characters"><button class="btn green" data-act="frSearch">Rechercher</button></div><div id="frRes"></div>`;
    b.innerHTML = `<div class="fr2"><div class="fr-tabs">${tab('list', 'Amis', 0)}${tab('req', 'Demandes', fr.incoming.length)}${tab('add', 'Ajouter', 0)}<div class="fr-count">${fr.friends.filter((f) => f.status !== 'off').length} en ligne / ${fr.friends.length}</div></div><div class="fr-body">${body}</div></div>`;
    $$('.fr-av', b).forEach((v) => v.replaceWith(portraitCanvas(v.dataset.b, 'classic', 110)));
    const inp = $('#frIn', b); if (inp) { inp.addEventListener('input', () => { inp.value = handleFmt(inp.value); }); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ACT.frSearch(); }); }
    return true;
  };
  setInterval(() => { if (UI.screen === 'social' && UI.socialTab === 'friends' && Net.me && Net.status === 'online') Net.send({ t: 'fr_list' }); }, 20000);
  ACT.frTab = (a) => { UI.frTab = a.dataset.k; G.Audio.sfx('ui'); UI.renderSocial(); };
  ACT.frAccept = (a) => { G.Audio.sfx('buy'); Net.send({ t: 'fr_accept', uid: a.dataset.uid }); };
  ACT.frDecline = (a) => { G.Audio.sfx('back'); Net.send({ t: 'fr_decline', uid: a.dataset.uid }); };
  ACT.frCancel = (a) => { G.Audio.sfx('back'); Net.send({ t: 'fr_cancel', uid: a.dataset.uid }); };
  ACT.frRemove = (a) => { UI.modal(`<h2>Retirer ${esc(a.dataset.n)} ?</h2><div class="row" style="margin-top:2rem"><button class="btn gray" data-act="close">Annuler</button><button class="btn red" data-act="frRemove2" data-uid="${esc(a.dataset.uid)}">Retirer</button></div>`); };
  ACT.frRemove2 = (a) => { Net.send({ t: 'fr_remove', uid: a.dataset.uid }); UI.closeModal(); };
  ACT.copyHandle = () => { const h = Net.me && Net.me.handle; try { navigator.clipboard.writeText(h); } catch (e) { /* rien */ } UI.toast('Identifiant copié : ' + h); };
  ACT.frSearch = () => {
    const inp = $('#frIn'), h = handleFmt(inp && inp.value); const res = $('#frRes'); if (!res) return;
    if (h.length < 4) { UI.toast('L\'identifiant contient au moins 4 lettres.'); return; }
    res.innerHTML = '<div class="spinner"></div>';
    findPlayer(h, (cdd) => {
      if (!$('#frRes')) return;
      if (!cdd) { res.innerHTML = '<div class="fr-none">Aucun joueur avec l\'identifiant ' + esc(h) + '.</div>'; return; }
      const act = cdd.me ? '<span class="invok">C\'est vous !</span>' : cdd.friend === 'yes' ? '<span class="invok">✔ Déjà ami</span>' : cdd.friend === 'sent' ? '<span class="invok">Demande envoyée</span>' : cdd.friend === 'received' ? `<button class="btn small green" data-act="frAccept" data-uid="${esc(cdd.uid)}">Accepter sa demande</button>` : `<button class="btn green" data-act="frReq" data-h="${esc(cdd.handle)}">Demander en ami</button>`;
      res.innerHTML = `<div class="fr-card"><canvas width="220" height="220"></canvas><div class="fr-ci"><div class="fn">${esc(cdd.name)}</div><div class="fh">${esc(cdd.handle)}</div><div class="fs">${stDot(cdd.status)}${stLabel(cdd)} · ${ic('trophy')} ${fmt(cdd.trophies)} · <span style="color:${cdd.rank.color}">${esc(cdd.rank.name)}</span></div></div><div>${act}</div></div>`;
      G.Render.portrait($('canvas', res), G.BRAWLER[cdd.avatar] ? cdd.avatar : 'sherry', 'classic', 1, { zoom: 1.4, y: 0.95 });
    });
  };
  ACT.frReq = (a) => { G.Audio.sfx('buy'); Net.send({ t: 'fr_req', handle: a.dataset.h }); a.outerHTML = '<span class="invok">Demande envoyée</span>'; };
  ACT.frCard = (a) => { if (a.dataset.h) UI.playerCard({ c: a.dataset.h, n: a.querySelector('.fn').textContent, b: 'sherry' }); };

  /* ---------- fiche joueur : identifiants en lettres ---------- */
  const basePC = UI.playerCard;
  UI.playerCard = function (pl) {
    if (!(pl.c && /^[A-Z]{4,16}$/.test(pl.c) && Net.me && Net.status === 'online')) return basePC(pl);
    basePC(Object.assign({}, pl, { c: null, pid: null, bot: false }));
    const o = UI.modals[UI.modals.length - 1]; const st = o && $('#pcSt', o); if (st) st.textContent = 'Chargement du profil…';
    findPlayer(pl.c, (cdd) => {
      if (!o.isConnected) return; const s2 = $('#pcSt', o); if (!cdd) { if (s2) s2.textContent = 'Profil introuvable'; return; }
      s2.innerHTML = `${stDot(cdd.status)}${stLabel(cdd)} · ID ${esc(cdd.handle)}`;
      $('#pcTr', o).textContent = fmt(cdd.trophies); $('#pcClub', o).innerHTML = `<span style="color:${cdd.rank.color}">${esc(cdd.rank.name)}</span>`; $('#pcClub', o).nextElementSibling.textContent = 'Rang classé';
      $('#pcActs', o).innerHTML = cdd.me ? '' : cdd.friend === 'yes' ? '<span class="pc-badge">✔ Ami</span>' + (cdd.pid && cdd.status !== 'off' && cdd.status !== 'match' ? `<button class="btn small blue" data-act="friendInvite" data-pid="${esc(cdd.pid)}">Inviter dans l'équipe</button>` : '') : cdd.friend === 'sent' ? '<span class="pc-badge">Demande envoyée</span>' : `<button class="btn small green" data-act="frReq" data-h="${esc(cdd.handle)}">Ajouter en ami</button>`;
    });
  };

  /* ---------- profil : identifiant + pseudo ---------- */
  function profileExtra(m) {
    if (!m || !Net.me) return; const left = $('.pf-left', m); if (!left || $('.pf-id', left)) return;
    const me = Net.me, nameOk = Date.now() >= me.nameAt;
    $('.pf-sub', left).insertAdjacentHTML('afterend', `<div class="pf-id">ID : <b>${esc(me.handle)}</b><button class="btn small blue" data-act="copyHandle">Copier</button>${me.canHandle ? '<button class="btn small green" data-act="handleEdit">Modifier</button>' : ''}</div>
      <div class="pf-name2"><button class="btn small ${nameOk ? 'blue' : 'gray'}" data-act="nameEdit">Changer de pseudo</button><small>${nameOk ? me.namePrice + ' 💎' : 'possible le ' + new Date(me.nameAt).toLocaleDateString('fr-FR')}</small></div>`);
  }
  const baseProfile = ACT.profile;
  ACT.profile = function () { baseProfile.apply(this, arguments); const o = UI.modals[UI.modals.length - 1]; if (o) profileExtra(o.querySelector('.modal')); if (Net.me) Net.send({ t: 'me' }); };
  ACT.handleEdit = () => {
    const o = UI.modal(`<h2>Modifier mon identifiant</h2><div class="accinfo">⚠ Vous ne pouvez modifier votre identifiant qu'<b>une seule fois</b>. Il devient ensuite définitif.<br>Lettres uniquement (A à Z), de 4 à 16.</div>
      <input id="hdIn" class="acc-in" maxlength="16" value="${esc(Net.me.handle)}" autocapitalize="characters" autocomplete="off"><div class="row" style="margin-top:2rem"><button class="btn gray" data-act="close">Annuler</button><button class="btn green" data-act="handleSave">Confirmer</button></div>`);
    const i = $('#hdIn', o); i.addEventListener('input', () => { i.value = handleFmt(i.value); }); i.focus();
  };
  ACT.handleSave = () => { const h = handleFmt($('#hdIn').value); if (h.length < 4) { UI.toast('4 lettres minimum.'); return; } Net.send({ t: 'handle_set', handle: h }); UI.closeModal(); };
  ACT.nameEdit = () => {
    const me = Net.me; if (!me) return;
    if (Date.now() < me.nameAt) { UI.toast('Prochain changement de pseudo possible le ' + new Date(me.nameAt).toLocaleDateString('fr-FR') + '.', 3000); return; }
    const o = UI.modal(`<h2>Changer de pseudo</h2><div class="accinfo">Prix : <b>${me.namePrice} 💎</b> (le prix double si vous changez souvent).<br>Ensuite, il faudra attendre 31 jours avant le prochain changement.</div>
      <input id="nmIn" class="acc-in" maxlength="16" placeholder="Nouveau pseudo" autocomplete="off"><div class="row" style="margin-top:2rem"><button class="btn gray" data-act="close">Annuler</button><button class="btn green" data-act="nameSave">Payer ${me.namePrice} 💎</button></div>`);
    $('#nmIn', o).focus();
  };
  ACT.nameSave = () => { const n = ($('#nmIn').value || '').trim(); if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) { UI.toast('3 à 16 lettres, chiffres ou _.'); return; } Net.send({ t: 'name_set', name: n }); };

  /* ---------- mode classé ---------- */
  const RMODES = { gemgrab: 'Razzia', brawlball: 'Foot brawl', bounty: 'Primes', hotzone: 'Zone', knockout: 'Hors-jeu' };
  UI.rankedMode = 'gemgrab';
  UI.ranked = function () {
    if (!A || !A.enabled() || !A.loggedIn()) { UI.modal('<h2>Mode classé</h2><div class="accinfo">Connectez-vous à votre compte pour jouer en classé : votre ELO et votre rang sont enregistrés en ligne.</div><div class="row" style="margin-top:2rem"><button class="btn green" data-act="accOpen">Se connecter</button></div>'); return; }
    const o = UI.modal('<div class="rk" id="rkBody"><div class="row" style="flex-direction:column;font-size:3rem;margin:6rem 0"><div class="spinner"></div>Chargement…</div></div>', { style: 'width:min(170rem,98vw)' });
    o.dataset.rk = '1'; Net.ensure(); const go = () => { auth(false); setTimeout(() => Net.send({ t: 'ranked_info' }), 150); };
    if (Net.status === 'online') go(); else { const h = (s) => { if (s === 'online') { Net.off('status', h); go(); } }; Net.on('status', h); }
  };
  let rkTimer = null;
  Net.on('ranked', (r) => {
    const box = $('#rkBody'); if (!box) return;
    const wr = r.games ? Math.round((r.wins / r.games) * 100) : 0, nextTxt = r.rank.next ? (r.rank.next - r.elo) + ' ELO avant ' + nextTier(r.rank.tier) : 'Rang maximal';
    box.innerHTML = `<h2>Mode classé</h2><div class="rk-grid">
      <div class="rk-me"><div class="rk-badge" style="--rc:${r.rank.color}"><b>${esc(r.rank.tier)}</b><span>${esc(r.rank.name.replace(r.rank.tier, '').trim() || '★')}</span></div><div class="rk-elo">${r.elo} <small>ELO</small></div><div class="rk-sub">${esc(r.rank.name)} · ${nextTxt}</div>
        <div class="rk-stats"><div><b>${r.games}</b>Parties</div><div><b>${r.wins}</b>Victoires</div><div><b>${wr}%</b>Taux</div></div></div>
      <div class="rk-play"><div class="rk-modes">${r.modes.map((k) => `<button class="rk-m ${UI.rankedMode === k ? 'act' : ''}" data-act="rkMode" data-k="${k}">${esc(RMODES[k] || k)}</button>`).join('')}</div>
        ${r.open ? `<button class="btn play rk-go" data-act="rkPlay">JOUER EN CLASSÉ</button>${r.dev && Date.now() < r.openAt ? '<div class="rk-early">🔧 Accès anticipé développeur</div>' : ''}` : `<div class="rk-lock">🔒 Ouverture le ${new Date(r.openAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}<br><b id="rkCd"></b></div>`}
        <div class="rk-help">Matchs 3 contre 3 entre joueurs de niveau proche. Victoire : + ELO, défaite : − ELO. Les places libres sont complétées par des bots si l'attente est trop longue.</div></div>
      <div class="rk-side"><div class="rk-t">Historique</div><div class="rk-hist">${r.hist.length ? r.hist.map((h) => `<div class="rk-h ${h.result > 0 ? 'w' : h.result < 0 ? 'l' : 'd'}"><span>${esc(RMODES[h.mode] || h.mode)}</span><b>${h.delta >= 0 ? '+' : ''}${h.delta}</b><i>${h.elo_after}</i></div>`).join('') : '<div class="fr-none">Aucune partie classée.</div>'}</div>
        <div class="rk-t">Meilleurs joueurs</div><div class="rk-top">${r.top.slice(0, 10).map((p, i) => `<div class="rk-p"><span>${i + 1}</span><b>${esc(p.username)}</b><i style="color:${p.rank.color}">${p.elo}</i></div>`).join('') || '<div class="fr-none">Personne encore.</div>'}</div></div></div>`;
    clearInterval(rkTimer);
    if (!r.open) { const tick = () => { const e = $('#rkCd'); if (!e) return clearInterval(rkTimer); const s = Math.max(0, (r.openAt - Date.now()) / 1000); e.textContent = s <= 0 ? 'C\'est ouvert ! Rouvrez cette fenêtre.' : 'dans ' + Math.floor(s / 3600) + ' h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ' min ' + String(Math.floor(s % 60)).padStart(2, '0') + ' s'; }; tick(); rkTimer = setInterval(tick, 1000); }
  });
  const nextTier = (t) => { const L = ['Bronze', 'Argent', 'Or', 'Diamant', 'Mythique', 'Légendaire', 'Maître']; return L[L.indexOf(t) + 1] || ''; };
  ACT.ranked = () => { G.Audio.sfx('ui'); UI.ranked(); };
  ACT.rkMode = (a) => { UI.rankedMode = a.dataset.k; $$('.rk-m').forEach((x) => x.classList.toggle('act', x === a)); G.Audio.sfx('ui'); };
  ACT.rkPlay = () => {
    G.Audio.sfx('go'); const mode = UI.rankedMode; UI.closeModal();
    const start = () => Net.send({ t: 'party_start', kind: 'ranked', mode });
    if (!Net.party) { Net.createParty(mode); setTimeout(start, 350); } else start();
  };

  /* ---------- panneau développeur (vérifié par le serveur) ---------- */
  UI.devPanel = function () {
    if (!Net.me || !Net.me.dev) { UI.toast('Réservé au compte développeur.'); return; }
    UI.modal(`<h2>🔧 Panneau développeur</h2><div class="fr-add"><input id="dvIn" maxlength="16" placeholder="Identifiant ou pseudo du joueur" autocomplete="off" style="text-transform:none"><button class="btn green" data-act="dvSearch">Rechercher</button></div><div id="dvRes"></div>
      <div class="dv-all"><span>Identifiants (tous les joueurs) :</span><button class="btn small green" data-act="dvAll" data-v="1">Autoriser 1 modification</button><button class="btn small red" data-act="dvAll" data-v="0">Rétablir la restriction</button></div>`, { style: 'width:min(150rem,96vw)' });
  };
  ACT.devPanel = () => UI.devPanel();
  ACT.devTools = () => { if (G.Dev && G.Dev.open) G.Dev.open(); };
  UI.devStatusRow = () => {
    const me = Net.me;
    if (!A || !A.loggedIn()) return '';
    if (!me) return '<div class="setrow"><span>🔧 Mode développeur : compte en cours de connexion au serveur…</span></div>';
    if (me.dev) return '<div class="setrow"><span>🔧 Compte développeur ✔</span><span><button class="btn small green" data-act="devTools">Outils DEV</button> <button class="btn small blue" data-act="devPanel">Cadeaux / joueurs</button></span></div>';
    return '<div class="setrow"><span style="font-size:2.2rem">🔧 Mode développeur : non activé pour ce compte (e-mail : <b>' + esc(me.email || '?') + '</b>).' + (me.devConfigured ? ' Mettez exactement cet e-mail dans DEV_EMAILS sur Render.' : ' DEV_EMAILS est vide sur Render.') + '</span></div>';
  };
  ACT.dvAll = (a) => Net.send({ t: 'dev_unlock_handle', all: a.dataset.v === '1' });
  ACT.dvSearch = () => {
    const h = ($('#dvIn').value || '').trim(), res = $('#dvRes'); if (h.length < 3) { UI.toast('Entrez un identifiant ou un pseudo.'); return; } res.innerHTML = '<div class="spinner"></div>';
    findPlayer(h, (cdd) => {
      if (!cdd) { res.innerHTML = '<div class="fr-none">Joueur introuvable. Il doit s\'être connecté à son compte au moins une fois avec la dernière version du jeu.</div>'; return; }
      const owned = cdd.owned || [];
      res.innerHTML = `<div class="fr-card"><div class="fr-ci"><div class="fn">${esc(cdd.name)}</div><div class="fh">${esc(cdd.handle)}</div><div class="fs">${ic('trophy')} ${fmt(cdd.trophies)} · ${owned.length}/${G.BRAWLERS.length} brawlers · ${esc(cdd.rank.name)}</div></div><button class="btn small blue" data-act="dvUnlock" data-uid="${esc(cdd.uid)}">Autoriser à modifier son identifiant</button></div>
        <div class="fr-sec">Offrir un brawler (touchez pour l'offrir)</div><div class="dv-grid">${G.BRAWLERS.map((b) => `<button class="dv-b ${owned.includes(b.id) ? 'own' : ''}" data-act="dvGift" data-id="${b.id}" data-uid="${esc(cdd.uid)}" ${owned.includes(b.id) ? 'disabled' : ''}><i class="dv-pv" data-id="${b.id}"></i><span>${esc(b.name)}</span>${owned.includes(b.id) ? '<em>Possédé</em>' : ''}</button>`).join('')}</div>`;
      $$('.dv-pv', res).forEach((v) => v.replaceWith(portraitCanvas(v.dataset.id, 'classic', 110)));
    });
  };
  ACT.dvUnlock = (a) => Net.send({ t: 'dev_unlock_handle', uid: a.dataset.uid });
  ACT.dvGift = (a) => { if (a.disabled) return; G.Audio.sfx('buy'); Net.send({ t: 'dev_gift', uid: a.dataset.uid, brawler: a.dataset.id }); a.classList.add('own'); a.disabled = true; a.insertAdjacentHTML('beforeend', '<em>Offert</em>'); };
})();
