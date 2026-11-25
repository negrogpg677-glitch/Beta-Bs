/* Brawl Rush — écrans de compte : inscription, connexion, mot de passe oublié, profil/avatar, configuration */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, A = G.Account;
  const { $, $$, el, esc, animate, fmt, S, ic, skinOf } = UI.h;
  let tab = 'login', method = 'email', recStep = 1, recEmail = '';

  const msg = (txt, ok) => { const m = $('#accMsg'); if (m) { m.textContent = txt || ''; m.className = 'accmsg ' + (ok ? 'ok' : 'bad'); } };
  async function busy(btn, fn) {
    if (!btn || btn.disabled) return;
    const label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; msg('');
    try { await fn(); } catch (e) { msg(e.message || 'Erreur'); G.Audio.sfx('error'); }
    if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
  }
  const val = (id) => { const e = $('#' + id); return e ? e.value : ''; };
  const pwd = (id, ph) => `<div class="pwd"><input class="txt" id="${id}" type="password" placeholder="${ph}" autocomplete="${id === 'acc_pass' ? 'current-password' : 'new-password'}"><button class="eye" data-act="accEye" data-for="${id}" type="button">👁</button></div>`;

  /* ---------- fenêtre de compte ---------- */
  UI.accountModal = function (t, welcome) {
    if (t) tab = t;
    if (UI.modals.some((m) => m.dataset.acc)) return;
    const o = UI.modal('<div id="accBody"></div>', { style: 'min-width:92rem;max-width:100rem' });
    o.dataset.acc = '1'; o.dataset.welcome = welcome ? '1' : '';
    renderAcc();
  };
  function renderAcc() {
    const b = $('#accBody'); if (!b) return;
    const o = b.closest('.overlay'), welcome = o && o.dataset.welcome;
    if (!A.enabled()) {
      b.innerHTML = `<h2>Compte</h2><div class="accinfo">Les comptes en ligne ne sont pas encore activés dans cette version du jeu.<br>Votre progression est sauvegardée sur ce téléphone.</div>
        <div class="row" style="margin-top:2rem"><button class="btn small gray" data-act="accConfig">Configurer un serveur de comptes</button>${welcome ? '<button class="btn green" data-act="accGuest">Jouer</button>' : ''}</div>`;
      return;
    }
    const tabs = `<div class="tabs" style="justify-content:center">${[['login', 'Connexion'], ['signup', 'Inscription'], ['recover', 'Mot de passe oublié']].map(([k, l]) => `<button class="tab ${tab === k ? 'act' : ''}" data-act="accTab" data-k="${k}">${l}</button>`).join('')}</div>`;
    let f = '';
    const remember = `<label class="chk"><input type="checkbox" id="acc_rem" checked><span></span>Rester connecté</label>`;
    if (tab === 'login') {
      f = `<input class="txt" id="acc_id" placeholder="E-mail ou pseudo" autocomplete="username" autocapitalize="none">${pwd('acc_pass', 'Mot de passe')}${remember}
        <button class="btn green wide" data-act="accLogin">Se connecter</button>
        <div class="acclinks"><a data-act="accTab" data-k="recover">Mot de passe oublié ?</a> · <a data-act="accTab" data-k="signup">Créer un compte</a></div>`;
    } else if (tab === 'signup') {
      f = `<div class="seg"><button class="${method === 'email' ? 'on' : ''}" data-act="accMethod" data-m="email">Avec e-mail</button><button class="${method === 'user' ? 'on' : ''}" data-act="accMethod" data-m="user">Avec un pseudo</button></div>
        <input class="txt" id="acc_user" placeholder="Pseudo (3 à 16 : lettres, chiffres, _)" maxlength="16" autocomplete="username" autocapitalize="none">
        ${method === 'email' ? '<input class="txt" id="acc_mail" type="email" placeholder="Adresse e-mail" autocomplete="email" autocapitalize="none">' : '<div class="accwarn">⚠ Sans e-mail, un mot de passe oublié ne pourra pas être récupéré.</div>'}
        ${pwd('acc_new', 'Mot de passe (8 caractères min., lettres + chiffres)')}${pwd('acc_new2', 'Confirmer le mot de passe')}${remember}
        <button class="btn green wide" data-act="accSignup">Créer mon compte</button>
        <div class="acclinks">Votre progression actuelle sera rattachée au nouveau compte.</div>`;
    } else {
      f = recStep === 1
        ? `<div class="accinfo">Entrez l'e-mail de votre compte : vous recevrez un code à 6 chiffres.</div><input class="txt" id="acc_rmail" type="email" placeholder="Adresse e-mail" autocapitalize="none" value="${esc(recEmail)}"><button class="btn blue wide" data-act="accRecover">Recevoir le code</button>`
        : `<div class="accinfo">Code envoyé à <b>${esc(recEmail)}</b>. Vérifiez aussi les indésirables.</div><input class="txt" id="acc_code" inputmode="numeric" maxlength="10" placeholder="Code reçu par e-mail" autocomplete="one-time-code">${pwd('acc_rnew', 'Nouveau mot de passe')}${remember}
           <button class="btn green wide" data-act="accRecover2">Changer le mot de passe</button><div class="acclinks"><a data-act="accRecBack">Renvoyer un code</a></div>`;
    }
    b.innerHTML = `<h2>${tab === 'signup' ? 'Créer un compte' : tab === 'recover' ? 'Récupérer mon compte' : 'Connexion'}</h2>${tabs}<div class="accform">${f}<div id="accMsg" class="accmsg"></div></div>
      ${welcome ? '<div class="row" style="margin-top:1rem"><button class="btn small gray" data-act="accGuest">Jouer en invité</button></div>' : ''}`;
    const first = b.querySelector('input'); if (first && !('ontouchstart' in window)) first.focus();
    b.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const btn = b.querySelector('.accform .btn'); if (btn) btn.click(); } }));
  }
  ACT.accTab = (a) => { tab = a.dataset.k; recStep = tab === 'recover' ? recStep : 1; G.Audio.sfx('ui'); renderAcc(); };
  ACT.accMethod = (a) => { method = a.dataset.m; G.Audio.sfx('ui'); renderAcc(); };
  ACT.accEye = (a) => { const i = $('#' + a.dataset.for); if (i) i.type = i.type === 'password' ? 'text' : 'password'; };
  ACT.accGuest = () => { S().guestChoice = true; G.Save.commit(); UI.closeModal(); };
  ACT.accLogin = (btn) => busy(btn, async () => {
    await A.signIn({ identifier: val('acc_id'), password: val('acc_pass'), remember: $('#acc_rem').checked });
    G.Audio.sfx('buy'); closeAcc(); UI.toast('Bon retour, ' + S().name + ' ! Progression récupérée.', 3000);
  });
  ACT.accSignup = (btn) => busy(btn, async () => {
    if (val('acc_new') !== val('acc_new2')) throw new Error('Les deux mots de passe sont différents.');
    const r = await A.signUp({ username: val('acc_user').trim(), email: method === 'email' ? val('acc_mail').trim() : '', password: val('acc_new'), remember: $('#acc_rem').checked });
    if (r.confirm) { msg('Compte créé ! Ouvrez le lien reçu par e-mail pour l\'activer, puis connectez-vous.', true); return; }
    G.Audio.sfx('open'); closeAcc(); UI.toast('Compte créé ! Votre progression est sauvegardée en ligne.', 3200);
  });
  ACT.accRecover = (btn) => busy(btn, async () => { recEmail = val('acc_rmail').trim(); await A.recoverStart(recEmail); recStep = 2; renderAcc(); msg('Code envoyé ! (il peut mettre une minute à arriver)', true); });
  ACT.accRecover2 = (btn) => busy(btn, async () => {
    await A.recoverFinish({ email: recEmail, code: val('acc_code'), password: val('acc_rnew'), remember: $('#acc_rem').checked });
    G.Audio.sfx('buy'); recStep = 1; closeAcc(); UI.toast('Mot de passe changé, vous êtes connecté !', 3000);
  });
  ACT.accRecBack = () => { recStep = 1; renderAcc(); };
  function closeAcc() { const o = UI.modals.find((m) => m.dataset.acc); if (o) { o.remove(); UI.modals = UI.modals.filter((m) => m !== o); } }

  /* ---------- configuration (URL + clé publique du projet Supabase) ---------- */
  ACT.accConfig = () => {
    const s = S().settings;
    UI.modal(`<h2>Serveur de comptes</h2><div class="accinfo">Projet Supabase (voir COMPTES.md). La clé à saisir est la clé publique « anon », jamais la clé « service_role ».</div>
      <div class="accform"><input class="txt" id="sb_url" placeholder="https://xxxx.supabase.co" value="${esc(s.sbUrl || '')}" autocapitalize="none"><input class="txt" id="sb_key" placeholder="Clé anon (eyJ…)" value="${esc(s.sbKey || '')}" autocapitalize="none">
      <button class="btn green wide" data-act="accConfigSave">Enregistrer</button><div id="accMsg" class="accmsg"></div></div>`);
  };
  ACT.accConfigSave = (btn) => busy(btn, async () => {
    const s = S().settings; s.sbUrl = val('sb_url').trim(); s.sbKey = val('sb_key').trim(); G.Save.commit();
    if (s.sbUrl && s.sbKey) { await A.usernameAvailable('test_' + Date.now() % 1e6); msg('Connexion au serveur de comptes réussie !', true); } else msg('Configuration effacée.', true);
    renderAcc();
  });

  /* ---------- profil : bloc compte + avatar ---------- */
  const baseProfile = ACT.profile;
  ACT.profile = function () {
    baseProfile();
    const o = UI.modals[UI.modals.length - 1]; if (!o) return;
    const m = o.querySelector('.modal'), sv = S();
    const st = A.status, when = A.lastSync ? Math.max(0, Math.round((Date.now() - A.lastSync) / 1000)) : null;
    const accHtml = !A.enabled() ? '<div class="accbar"><span>☁ Progression enregistrée sur ce téléphone</span></div>'
      : A.loggedIn() ? `<div class="accbar"><span class="cloud ${st}">☁</span><span>Compte : <b>${esc(A.profile ? A.profile.username : sv.name)}</b>${A.isUsernameAccount() ? '' : ' · ' + esc(A.user.email || '')}<br><small>${st === 'online' ? 'Synchronisé' + (when !== null ? ' il y a ' + when + ' s' : '') : st === 'syncing' ? 'Synchronisation…' : st === 'offline' ? 'Hors ligne : la synchronisation reprendra automatiquement' : esc(A.err || '')}</small></span><button class="btn small red" data-act="accLogout">Se déconnecter</button></div>`
      : `<div class="accbar"><span class="cloud">☁</span><span>Joueur invité : la progression n'est que sur ce téléphone.<br><small>Créez un compte pour la retrouver partout.</small></span><button class="btn small green" data-act="accOpen">Créer un compte / Connexion</button></div>`;
    m.querySelector('h2').insertAdjacentHTML('afterend', accHtml);
    if (A.loggedIn()) { const rb = m.querySelector('[data-act=rename]'); if (rb) rb.remove(); } // le pseudo d'un compte sert d'identifiant : non modifiable
    const av = sv.unlocked.map((id) => `<canvas class="avpick ${(sv.avatar || sv.selected) === id ? 'on' : ''}" width="120" height="120" data-act="accAvatar" data-id="${id}"></canvas>`).join('');
    m.insertAdjacentHTML('beforeend', `<div style="font-size:2.4rem;margin:1.4rem 0 .6rem">Avatar</div><div class="avrow">${av}</div>`);
    m.querySelectorAll('.avpick').forEach((c) => G.Render.portrait(c, c.dataset.id, skinOf(c.dataset.id), 0, { aim: 0.4, zoom: 1.45, y: 0.95, shadow: false }));
  };
  ACT.accOpen = () => { UI.closeModal(); UI.accountModal('signup'); };
  ACT.accAvatar = (a) => { A.setAvatar(a.dataset.id); G.Audio.sfx('ui'); $$('.avpick').forEach((c) => c.classList.toggle('on', c === a)); if (UI.screen === 'home') UI.build.home(); };
  ACT.accLogout = () => {
    UI.modal(`<h2>Se déconnecter ?</h2><div class="accinfo">Votre progression reste sauvegardée dans votre compte. Ce téléphone repartira sur une partie invité.</div><div class="row" style="margin-top:2rem"><button class="btn gray" data-act="close">Annuler</button><button class="btn red" data-act="accLogout2">Se déconnecter</button></div>`);
  };
  ACT.accLogout2 = async () => { await A.signOut(); UI.hideAll(); UI.show('home'); UI.toast('Déconnecté.'); };

  /* ---------- intégration ---------- */
  UI.onAccountChange = function () { if (G.App.state === 'match') return; if (UI.screen && UI.build[UI.screen]) UI.build[UI.screen](); UI.refreshCur(); if (G.Net && G.Net.status === 'online') G.Net.sendProfile(); };
  A.on(() => { $$('.cloudst').forEach((e) => { e.className = 'cloudst ' + (A.loggedIn() ? A.status : 'guest'); e.title = A.loggedIn() ? 'Compte synchronisé' : 'Invité'; }); renderAcc(); });
  ACT.account = () => { G.Audio.sfx('ui'); if (A.loggedIn()) ACT.profile(); else UI.accountModal('login'); };
  // au premier lancement : proposer de se connecter / créer un compte (si les comptes sont configurés)
  UI.offerAccount = function () { if (A.enabled() && !A.loggedIn() && !S().guestChoice && A.status !== 'syncing') UI.accountModal('signup', true); };
})();
