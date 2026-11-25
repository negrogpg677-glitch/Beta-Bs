/* Brawl Rush - équipe dans le salon : coéquipiers en 3D à côté de son personnage, invitations (envoi, attente, refus, annulation),
   fenêtre d'invitation reçue, liste d'amis à inviter, chat d'équipe en temps réel (serveur) avec discussion rapide. */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net;
  const { $, $$, el, esc, ic, S, fmt, animate } = UI.h;
  const T = (UI.team = { pending: {}, chat: [], unread: 0, muted: {}, known: {}, code: null });
  const QUICK = ['Salut !', 'C\'est bon ? On y va !', 'Je dois y aller, à plus !', 'GG !', 'Oups, pardon !', 'Quel brawler je devrais choisir ?', 'Deux secondes !', 'Yo !'];
  const mates = () => (Net.party ? Net.party.members.filter((m) => m.pid !== Net.pid) : []);
  const sysMsg = (name, text) => { T.chat.push({ sys: 1, name, text, ts: Date.now() }); if (T.chat.length > 60) T.chat.shift(); renderChat(); };

  /* ---------- coéquipiers en 3D dans le salon ---------- */
  UI.renderMates = function () {
    const st = UI.screen === 'home' && $('#home .stage2'); if (!st) return;
    const list = mates(), now = Date.now();
    for (const k in T.pending) if (now - T.pending[k].t > 60000 || list.some((m) => m.pid === k)) delete T.pending[k];
    const entries = list.map((m) => ({ k: 'm', m })).concat(Object.keys(T.pending).map((pid) => ({ k: 'p', pid, v: T.pending[pid] }))).slice(0, 2);
    while (entries.length < 2) entries.push({ k: 'e' });
    ['l', 'r'].forEach((side, i) => {
      const slot = $('.mate.' + side, st), e = entries[i]; if (!slot) return;
      const key = e.k === 'm' ? 'm:' + e.m.pid + ':' + e.m.brawler + ':' + e.m.skin + ':' + e.m.name : e.k === 'p' ? 'p:' + e.pid + ':' + e.v.st : 'e';
      if (slot.dataset.key === key) return; slot.dataset.key = key; slot.className = 'mate ' + side;
      if (e.k === 'm') {
        const lead = Net.party && Net.party.leader === e.m.pid;
        slot.innerHTML = `<div class="mate-name"><span class="netdot on"></span>${lead ? '👑 ' : ''}${esc(e.m.name)}</div><canvas class="mate-cv" width="420" height="420" data-act="mateCard" data-pid="${esc(e.m.pid)}"></canvas><div class="mate-bubble"></div>`;
        const cv = $('canvas', slot); if (G.Char3D) G.Char3D.bindRotate(cv); animate(cv, G.BRAWLER[e.m.brawler] ? e.m.brawler : 'sherry', e.m.skin || 'classic', { zoom: 0.92, y: 0.8, yaw: side === 'l' ? 0.45 : -0.45 });
        if (!T.known[e.m.pid]) { slot.classList.add('join'); if (G.Char3D) setTimeout(() => G.Char3D.poke(cv), 120); G.Audio.sfx('pickup'); }
      } else if (e.k === 'p') {
        slot.innerHTML = `<div class="inv-card ${e.v.st}"><div class="inv-t">INVITATION</div><div class="inv-n">${esc(e.v.name)}</div><div class="inv-s">${e.v.st === 'declined' ? 'Refusée' : '<i class="dots"></i> En attente'}</div><button class="inv-x" data-act="invCancel" data-pid="${esc(e.pid)}" aria-label="Annuler">✕</button></div>`;
      } else slot.innerHTML = '<button class="tslot" data-act="invitePanel" aria-label="Inviter un ami">+</button>';
    });
    // bandeau d'équipe (code + quitter) et bouton de chat
    const bar = $('#home .teambar'), chatB = $('#home .chatbtn');
    if (bar) { bar.hidden = !Net.party; if (Net.party) $('b', bar).textContent = Net.party.code; }
    if (chatB) { chatB.hidden = !Net.party; const bd = $('.badge', chatB); bd.hidden = !T.unread; bd.textContent = T.unread; }
  };
  function onParty() {
    const p = Net.party, now = {};
    if (p && p.code !== T.code) { T.code = p.code; T.chat = (p.chat || []).map((m) => Object.assign({}, m)); T.known = {}; p.members.forEach((m) => { if (m.pid !== Net.pid) T.known[m.pid] = m.name; }); T.unread = 0; }
    if (!p) { T.code = null; T.known = {}; }
    if (p) p.members.forEach((m) => { if (m.pid === Net.pid) return; now[m.pid] = m.name; if (!T.known[m.pid]) { sysMsg(m.name, 'nous rejoint.'); UI.toast('👋 ' + m.name + ' a rejoint votre équipe !', 2200); } });
    for (const pid in T.known) if (!now[pid]) { sysMsg(T.known[pid], 'a quitté l\'équipe.'); }
    UI.renderMates(); T.known = now;
  }
  Net.on('party', onParty);
  Net.on('status', () => setTimeout(UI.renderMates, 50));
  Net.on('invite_sent', (m) => { T.pending[m.pid] = { name: m.name, t: Date.now(), st: 'wait' }; UI.renderMates(); G.Audio.sfx('ui'); });
  Net.on('invite_declined', (m) => { if (T.pending[m.pid]) { T.pending[m.pid].st = 'declined'; T.pending[m.pid].t = Date.now() - 56000; UI.renderMates(); setTimeout(UI.renderMates, 4200); } UI.toast(m.name + ' a refusé l\'invitation', 2200); });
  ACT.invCancel = (a) => { const pid = a.dataset.pid; Net.send({ t: 'invite_cancel', pid }); delete T.pending[pid]; UI.renderMates(); G.Audio.sfx('back'); };
  ACT.mateCard = (a) => { if (a._dragged) return; const m = mates().find((x) => x.pid === a.dataset.pid); if (m) UI.playerCard({ n: m.name, pid: m.pid, b: m.brawler, s: m.skin, tr: m.trophies }); };
  ACT.teamLeaveHome = () => { G.Audio.sfx('back'); Net.leaveParty(); };

  const hideAll0 = UI.hideAll; UI.hideAll = function () { const p = $('.chatp'); if (p) p.remove(); return hideAll0.apply(this, arguments); };

  /* ---------- liste d'amis à inviter ---------- */
  UI.invitePanel = function () {
    if (!Net.serverUrl()) { UI.toast('Le jeu en ligne n\'est pas configuré.'); return; }
    Net.ensure(); Net.send({ t: 'friends_get' });
    const o = UI.modal(`<h2>Inviter des amis</h2><div id="invList" class="invlist"></div>
      <div class="invcode"><span>Ou partagez le code d'équipe :</span><b id="invCode">${Net.party ? esc(Net.party.code) : '—'}</b><button class="btn small blue" data-act="team">Rejoindre avec un code</button></div>`, { style: 'width:min(120rem,94vw)' });
    o.classList.add('invpanel'); renderInvList();
  };
  function renderInvList() {
    const box = $('.invpanel #invList'); if (!box) return;
    const fr = ((Net.friends || {}).list || []).slice().sort((a, b) => (a.status === 'off') - (b.status === 'off') || b.trophies - a.trophies);
    const inTeam = (pid) => Net.party && Net.party.members.some((m) => m.pid === pid);
    const lab = { menu: 'En ligne', party: 'En équipe', match: 'En partie', off: 'Hors ligne' };
    box.innerHTML = Net.status !== 'online' ? '<div class="invempty"><div class="spinner"></div>' + (Net.waking && Net.waking() ? 'Réveil du serveur… (jusqu\'à 1 min)' : 'Connexion au serveur…') + '</div>'
      : !fr.length ? '<div class="invempty">Aucun ami pour l\'instant.<br>Ajoutez des amis avec leur code dans l\'onglet Amis.</div>'
        : fr.map((f, i) => `<div class="invrow ${f.status}" style="animation-delay:${Math.min(i, 10) * 0.04}s"><div class="fav" data-act="friendCard" data-pid="${esc(f.pid)}">${esc(f.name.slice(0, 1).toUpperCase())}</div>
          <div class="finfo" data-act="friendCard" data-pid="${esc(f.pid)}"><div class="fn">${esc(f.name)}</div><div class="fs"><span class="netdot ${f.status === 'off' ? 'off' : f.status === 'match' ? 'wait' : 'on'}"></span>${lab[f.status] || ''} · ${ic('trophy')} ${fmt(f.trophies)}</div></div>
          ${inTeam(f.pid) ? '<span class="invok">✔ Dans l\'équipe</span>' : T.pending[f.pid] ? '<span class="invok">Invité…</span>' : f.status === 'menu' || f.status === 'party' ? `<button class="btn small green" data-act="invFriend" data-pid="${esc(f.pid)}">INVITER</button>` : '<span class="invoff">Indisponible</span>'}</div>`).join('');
  }
  for (const t of ['friends', 'status', 'party', 'invite_sent', 'invite_declined']) Net.on(t, () => setTimeout(renderInvList, 30));
  ACT.invitePanel = () => { G.Audio.sfx('ui'); UI.invitePanel(); };
  ACT.invFriend = (a) => { G.Audio.sfx('ui'); Net.sendProfile(); Net.invite(a.dataset.pid, S().mode); a.outerHTML = '<span class="invok">Invité…</span>'; };

  /* ---------- invitation reçue ---------- */
  UI.showInvite = function (m) {
    if (G.App.state === 'match') return;
    if ((T.muted[m.fromPid] || 0) > Date.now()) { Net.send({ t: 'invite_decline', pid: m.fromPid }); return; }
    G.Audio.sfx('go'); G.vibrate(40);
    const old = UI.modals.find((x) => x.dataset.inv); if (old) { old.remove(); UI.modals.splice(UI.modals.indexOf(old), 1); }
    const mode = G.MODES[m.mode] || { name: '' };
    const o = UI.modal(`<div class="invm"><div class="invm-h">INVITATION D'ÉQUIPE</div>
      <div class="invm-t"><b>${esc(m.from)}</b> veut faire équipe avec vous !</div>
      <div class="invm-card"><div class="invm-av"><canvas width="260" height="260"></canvas></div>
        <div class="invm-i"><div class="invm-n">${esc(m.from)}</div><div class="invm-tr">${ic('trophy')} ${fmt(m.trophies || 0)}</div></div><div class="invm-mode">${esc(mode.name)}</div></div>
      <div class="invm-b"><button class="btn red" data-act="invDecline" data-pid="${esc(m.fromPid || '')}">REFUSER</button><button class="btn green" data-act="invAccept2" data-code="${esc(m.code)}">ACCEPTER</button></div>
      <label class="invm-mute"><input type="checkbox" id="invMute"><span>Masquer ${esc(m.from)} pendant 10 minutes</span></label></div>`, { noClose: true, style: 'width:min(112rem,94vw);padding:0;overflow:hidden' });
    o.dataset.inv = m.fromPid || '1';
    animate($('canvas', o), G.BRAWLER[m.brawler] ? m.brawler : 'sherry', m.skin || 'classic', { zoom: 1.55, y: 1.0, yaw: -0.2 });
    setTimeout(() => { if (o.isConnected) closeInv(o); }, 30000);
  };
  function closeInv(o) { const i = UI.modals.indexOf(o); if (i >= 0) UI.modals.splice(i, 1); o.remove(); }
  const muted = () => { const c = $('#invMute'); return c && c.checked; };
  ACT.invAccept2 = (a) => { const code = a.dataset.code; closeInv(a.closest('.overlay')); G.Audio.sfx('buy'); Net.sendProfile(); Net.joinParty(code); if (UI.screen !== 'home') { UI.hideAll && UI.hideAll(); UI.show('home'); } };
  ACT.invDecline = (a) => { const pid = a.dataset.pid; if (muted()) T.muted[pid] = Date.now() + 600000; Net.send({ t: 'invite_decline', pid }); closeInv(a.closest('.overlay')); G.Audio.sfx('back'); };
  Net.on('invite_cancelled', (m) => { const o = UI.modals.find((x) => x.dataset.inv === m.from); if (o) { closeInv(o); UI.toast('Invitation annulée', 1800); } });

  /* ---------- chat d'équipe ---------- */
  function bubble(pid, text) {
    const st = $('#home .stage2'); if (!st) return;
    let host = null;
    if (pid === Net.pid) host = $('.hero-bubble', st); else { const cv = $(`.mate-cv[data-pid="${CSS.escape(pid)}"]`, st); host = cv && cv.parentNode.querySelector('.mate-bubble'); }
    if (!host) return; host.textContent = text; host.classList.remove('show'); void host.offsetWidth; host.classList.add('show');
    clearTimeout(host._t); host._t = setTimeout(() => host.classList.remove('show'), 3200);
  }
  Net.on('party_chat', (m) => {
    T.chat.push(m); if (T.chat.length > 60) T.chat.shift();
    if ($('.chatp')) renderChat(); else if (m.pid !== Net.pid) { T.unread++; UI.renderMates(); G.Audio.sfx('ui', 1.4); }
    bubble(m.pid, m.text);
  });
  function renderChat() {
    const box = $('#chatMsgs'); if (!box) return;
    const hm = (ts) => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    box.innerHTML = T.chat.map((m) => m.sys ? `<div class="cm sys"><b>${esc(m.name)}</b> ${esc(m.text)} <i>${hm(m.ts)}</i></div>`
      : `<div class="cm ${m.pid === Net.pid ? 'me' : ''}"><div class="cm-h"><b>${esc(m.name)}</b><i>${hm(m.ts)}</i></div><div class="cm-t">${esc(m.text)}</div></div>`).join('') || '<div class="cm sys">Dites bonjour à votre équipe !</div>';
    box.scrollTop = box.scrollHeight;
  }
  UI.chatOpen = function () {
    if (!Net.party) { UI.toast('Créez ou rejoignez une équipe pour discuter.'); return; }
    if ($('.chatp')) return;
    const p = el(`<div class="chatp"><div class="chat-l"><div class="chat-h"><div><small>Code d'équipe</small><b>${esc(Net.party.code)}</b></div><button class="chat-x" data-act="chatClose" aria-label="Fermer">✕</button></div>
      <div class="chat-msgs" id="chatMsgs"></div>
      <div class="chat-in"><input id="chatIn" maxlength="140" placeholder="Dites quelque chose…" enterkeyhint="send" autocomplete="off"><button class="chat-send" data-act="chatSend" aria-label="Envoyer">➤</button></div></div>
      <div class="chat-r"><div class="chat-qh">💬 Discussion rapide</div><div class="chat-ql">${QUICK.map((q) => `<button class="chat-q" data-act="chatQuick" data-t="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="chat-emo">${G.EMOTES.map((e) => `<button data-act="chatQuick" data-t="${e}">${e}</button>`).join('')}</div></div></div>`);
    $('#ui').appendChild(p); T.unread = 0; UI.renderMates(); renderChat(); G.Audio.sfx('ui');
    $('#chatIn', p).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ACT.chatSend(); } });
  };
  const sendChat = (text, q) => { text = String(text || '').trim(); if (!text) return; if (!Net.send({ t: 'party_chat', text, q: q ? 1 : 0 })) UI.toast('Hors ligne : message non envoyé.'); };
  ACT.chatOpen = () => UI.chatOpen();
  ACT.chatClose = () => { const p = $('.chatp'); if (p) { p.classList.add('out'); setTimeout(() => p.remove(), 180); } G.Audio.sfx('back'); };
  ACT.chatSend = () => { const i = $('#chatIn'); if (!i) return; sendChat(i.value); i.value = ''; i.focus(); };
  ACT.chatQuick = (a) => sendChat(a.dataset.t, true);
})();
