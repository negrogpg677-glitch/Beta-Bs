/* Brawl Rush — comptes joueurs et sauvegarde en ligne (Supabase : Auth + base Postgres via REST, sans bibliothèque).
   - inscription e-mail + mot de passe, ou pseudo + mot de passe
   - connexion, « rester connecté », déconnexion, récupération du mot de passe par code e-mail
   - progression sauvegardée dans la table `profiles` (règles RLS : chaque joueur ne lit/écrit QUE sa ligne)
   Configuration : G.SUPABASE (data.js) ou Réglages > Comptes. Schéma SQL : supabase/schema.sql */
(function () {
  const G = window.G;
  const KEY = 'brawlrush_session_v1';
  const USER_DOMAIN = 'joueurs.brawlrush.app'; // e-mail technique des comptes « pseudo » (jamais utilisé pour envoyer de courrier)
  const A = (G.Account = { session: null, user: null, profile: null, status: 'guest', lastSync: 0, syncing: false, pending: false, err: '', listeners: [] });

  A.config = function () {
    const s = (G.Save.data && G.Save.data.settings) || {};
    const B = G.SUPABASE && G.SUPABASE.url && G.SUPABASE.key ? G.SUPABASE : null; // le projet intégré au jeu passe avant une ancienne configuration enregistrée
    const url = String((B ? B.url : s.sbUrl) || '').trim().replace(/\/+$/, '');
    const key = String((B ? B.key : s.sbKey) || '').trim();
    return url && key ? { url, key } : null;
  };
  A.enabled = () => !!A.config();
  A.loggedIn = () => !!(A.session && A.user);
  A.on = (fn) => A.listeners.push(fn);
  const emit = () => A.listeners.forEach((f) => { try { f(A); } catch (e) { console.error(e); } });

  /* ---------- validation ---------- */
  A.validUsername = (u) => /^[A-Za-z0-9_]{3,16}$/.test(u || '');
  A.validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || '');
  A.passwordProblem = (p) => (!p || p.length < 8 ? 'Le mot de passe doit faire au moins 8 caractères.' : !/[A-Za-z]/.test(p) || !/[0-9]/.test(p) ? 'Le mot de passe doit contenir des lettres et des chiffres.' : '');
  const userEmail = (u) => u.toLowerCase() + '@' + USER_DOMAIN;
  A.isUsernameAccount = () => !!(A.user && A.user.email && A.user.email.endsWith('@' + USER_DOMAIN));

  /* ---------- traduction des erreurs Supabase ---------- */
  function frMsg(data, status) {
    const raw = String((data && (data.msg || data.message || data.error_description || data.error)) || '').toLowerCase();
    if (raw.includes('invalid login credentials')) return 'Identifiant ou mot de passe incorrect.';
    if (raw.includes('already registered') || raw.includes('already been registered') || raw.includes('duplicate key') || status === 409) return 'Ce compte existe déjà.';
    if (raw.includes('email not confirmed')) return 'E-mail non confirmé : ouvrez le lien reçu par e-mail.';
    if (raw.includes('rate limit') || status === 429) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    if (raw.includes('token has expired') || raw.includes('invalid') && raw.includes('token') || raw.includes('otp')) return 'Code invalide ou expiré.';
    if (raw.includes('password should') || raw.includes('weak password')) return 'Mot de passe trop faible.';
    if (raw.includes('signups not allowed') || raw.includes('signup is disabled')) return 'Les inscriptions sont désactivées sur ce serveur.';
    if (raw.includes('user not found')) return 'Compte introuvable.';
    if (status >= 500) return 'Le serveur de comptes rencontre un problème. Réessayez plus tard.';
    return 'Erreur (' + status + ') : ' + (data && (data.msg || data.message || data.error_description) || 'inconnue');
  }
  const fail = (code, msg) => { const e = new Error(msg); e.code = code; return e; };

  /* ---------- requêtes ---------- */
  async function api(path, opt) {
    opt = opt || {};
    const cfg = A.config(); if (!cfg) throw fail('config', 'Les comptes en ligne ne sont pas configurés.');
    const h = Object.assign({ apikey: cfg.key, 'Content-Type': 'application/json' }, opt.headers || {});
    // jeton du joueur si connecté ; sinon l'ancienne clé « anon » (JWT). Les nouvelles clés sb_publishable_… ne vont que dans « apikey ».
    const bearer = opt.auth !== false && A.session ? A.session.access_token : (/^eyJ/.test(cfg.key) ? cfg.key : '');
    if (bearer) h.Authorization = 'Bearer ' + bearer;
    let r;
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = ctl && setTimeout(() => ctl.abort(), 15000);
      r = await fetch(cfg.url + path, { method: opt.method || 'GET', headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined, signal: ctl ? ctl.signal : undefined });
      if (to) clearTimeout(to);
    } catch (e) { throw fail('network', 'Pas de connexion au serveur de comptes. Vérifiez internet.'); }
    const txt = await r.text(); let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { message: txt }; }
    if (r.status === 401 && opt.auth !== false && A.session && !opt.retried && !path.startsWith('/auth/v1/token')) {
      if (await A.refresh()) return api(path, Object.assign({}, opt, { retried: true }));
    }
    if (!r.ok) throw fail((data && (data.error_code || data.code)) || r.status, frMsg(data, r.status));
    return data;
  }
  A._api = api;

  /* ---------- appareil (un seul appareil connecté par compte) ---------- */
  A.deviceId = function () {
    let d = G.Store.get('br_device');
    if (!d || !/^[A-Za-z0-9_-]{8,48}$/.test(d)) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); G.Store.set('br_device', d); }
    return d;
  };
  A.fresh = false; // vrai juste après avoir saisi ses identifiants : cette connexion prend le relais sur les autres appareils
  A.logoutOthers = async function () { try { await api('/auth/v1/logout?scope=others', { method: 'POST' }); } catch (e) { /* ancienne version de Supabase : le serveur du jeu fait foi */ } };

  /* ---------- session ---------- */
  function storeSession(sess, remember) {
    A.session = { access_token: sess.access_token, refresh_token: sess.refresh_token, expires_at: sess.expires_at || Math.floor(Date.now() / 1000) + (sess.expires_in || 3600), remember: !!remember };
    A.user = sess.user || A.user;
    const raw = JSON.stringify({ s: A.session, u: A.user });
    try {
      if (remember) { G.Store.set(KEY, raw); sessionStorage.removeItem(KEY); }
      else { sessionStorage.setItem(KEY, raw); G.Store.del(KEY); }
    } catch (e) { /* ignore */ }
  }
  function clearSession() {
    A.session = null; A.user = null; A.profile = null; A.status = 'guest';
    G.Store.del(KEY); try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  A.refresh = async function () {
    if (!A.session || !A.session.refresh_token) return false;
    try {
      const d = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: A.session.refresh_token } });
      storeSession(d, A.session.remember); return true;
    } catch (e) {
      if (e.code !== 'network') { clearSession(); emit(); }
      return false;
    }
  };

  /* ---------- inscription / connexion ---------- */
  A.usernameAvailable = async function (u) {
    try { return await api('/rest/v1/rpc/username_available', { method: 'POST', auth: false, body: { name: u } }); } catch (e) { if (e.code === 'network' || e.code === 'config') throw e; return true; }
  };
  A.signUp = async function ({ email, username, password, remember }) {
    if (!A.validUsername(username)) throw fail('username', 'Pseudo : 3 à 16 caractères (lettres, chiffres, _).');
    const pb = A.passwordProblem(password); if (pb) throw fail('password', pb);
    if (email && !A.validEmail(email)) throw fail('email', 'Adresse e-mail invalide.');
    if (!(await A.usernameAvailable(username))) throw fail('taken', 'Ce pseudo est déjà pris.');
    const d = await api('/auth/v1/signup', { method: 'POST', auth: false, body: { email: email ? email.trim() : userEmail(username), password, data: { username } } });
    if (!d || !d.access_token) return { confirm: true }; // confirmation par e-mail activée sur le projet
    A.fresh = true;
    storeSession(d, remember);
    await afterLogin(true);
    return { ok: true };
  };
  A.signIn = async function ({ identifier, password, remember }) {
    identifier = String(identifier || '').trim();
    if (!identifier || !password) throw fail('empty', 'Remplissez l\'identifiant et le mot de passe.');
    const email = identifier.includes('@') ? identifier : userEmail(identifier);
    const d = await api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
    A.fresh = true;
    storeSession(d, remember);
    await afterLogin(false);
    return { ok: true };
  };
  A.signOut = async function (opt) {
    opt = opt || {};
    if (!opt.kicked) { // expulsé par un autre appareil : on n'envoie surtout pas cette sauvegarde (elle écraserait la progression de l'appareil actif)
      await A.flush();
      try { await api('/auth/v1/logout?scope=local', { method: 'POST' }); } catch (e) { /* ignore */ }
    }
    clearSession();
    // la progression du compte reste en ligne ; l'appareil repart sur une partie invité vierge (réglages conservés)
    const keep = G.Save.data.settings; G.Save.reset(); Object.assign(G.Save.data.settings, keep); G.Save.data.guestChoice = true; saveLocal();
    emit();
  };
  /* récupération : un code à 6 chiffres est envoyé par e-mail (modèle « Reset password » contenant {{ .Token }}) */
  A.recoverStart = async function (email) {
    if (!A.validEmail(email)) throw fail('email', 'Adresse e-mail invalide.');
    await api('/auth/v1/recover', { method: 'POST', auth: false, body: { email: email.trim() } });
    return true;
  };
  A.recoverFinish = async function ({ email, code, password, remember }) {
    const pb = A.passwordProblem(password); if (pb) throw fail('password', pb);
    const d = await api('/auth/v1/verify', { method: 'POST', auth: false, body: { type: 'recovery', email: email.trim(), token: String(code).trim() } });
    A.fresh = true; storeSession(d, remember);
    await api('/auth/v1/user', { method: 'PUT', body: { password } });
    await afterLogin(false);
    return true;
  };

  /* ---------- profil & progression ---------- */
  const PROFILE = () => '/rest/v1/profiles?id=eq.' + encodeURIComponent(A.user.id);
  async function fetchProfile() {
    const rows = await api(PROFILE() + '&select=id,username,avatar,save,trophies,updated_at');
    return rows && rows[0] ? rows[0] : null;
  }
  const isEmptySave = (s) => !s || !s.stats || (!s.stats.matches && G.Save.totalTrophies.call({ data: s }) === 0 && (s.unlocked || []).length <= 2 && (s.coins || 0) <= 300);
  function saveLocal() { G.Store.set('brawlrush_save_v1', JSON.stringify(G.Save.data)); }
  async function afterLogin(isNew) {
    A.status = 'syncing'; emit();
    let p = null;
    for (let i = 0; i < 3 && !p; i++) { p = await fetchProfile(); if (!p) await new Promise((r) => setTimeout(r, 400)); }
    if (!p) { // le déclencheur SQL crée normalement la ligne ; filet de sécurité
      const uname = (A.user.user_metadata && A.user.user_metadata.username) || ('joueur' + Math.floor(Math.random() * 9999));
      const rows = await api('/rest/v1/profiles', { method: 'POST', headers: { Prefer: 'return=representation' }, body: { id: A.user.id, username: uname } });
      p = rows && rows[0];
    }
    A.profile = p;
    const local = G.Save.data, cloud = p.save;
    const keepSettings = Object.assign({}, local.settings);
    if (isEmptySave(cloud) || isNew) {
      // nouveau compte (ou compte vide) : la progression actuelle de l'appareil lui est rattachée
      local.name = p.username; local.avatar = local.avatar || local.selected;
      await A.push(true);
    } else if (!local.accountId || local.accountId !== A.user.id || (cloud.rev || 0) >= (local.rev || 0)) {
      // compte existant : on récupère EXACTEMENT sa progression en ligne (les réglages de l'appareil sont conservés)
      G.Save.data = cloud;
      mergeDefaults(G.Save.data); G.Save.data.settings = Object.assign(G.Save.data.settings, keepSettings);
      G.Save.data.name = p.username;
    } else {
      await A.push(true); // cet appareil a une version plus récente du même compte
    }
    G.Save.data.accountId = A.user.id; G.Save.data.guestChoice = false;
    saveLocal();
    A.status = 'online'; A.lastSync = Date.now(); emit();
    if (G.UI && G.UI.onAccountChange) G.UI.onAccountChange();
  }
  function mergeDefaults(d) {
    const def = G.Save.defaults();
    for (const k in def) if (d[k] === undefined) d[k] = def[k];
    for (const k in def.settings) if (d.settings[k] === undefined) d.settings[k] = def.settings[k];
    for (const k in def.stats) if (d.stats[k] === undefined) d.stats[k] = def.stats[k];
  }
  A.push = async function (force) {
    if (!A.loggedIn() || (A.syncing && !force)) { A.pending = true; return; }
    A.syncing = true; A.pending = false;
    const d = G.Save.data, body = { save: d, trophies: G.Save.totalTrophies(), avatar: d.avatar || d.selected, updated_at: new Date().toISOString() };
    try { await api(PROFILE(), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body }); A.lastSync = Date.now(); A.err = ''; A.status = 'online'; }
    catch (e) { A.err = e.message; A.status = e.code === 'network' ? 'offline' : 'error'; A.pending = true; }
    A.syncing = false; emit();
    if (A.pending && A.status === 'online') A.schedule(1500);
  };
  let timer = null;
  A.schedule = function (ms) { if (!A.loggedIn()) return; clearTimeout(timer); timer = setTimeout(() => A.push(), ms || 3000); };
  A.flush = async function () { clearTimeout(timer); if (A.loggedIn()) await A.push(true); };
  A.setAvatar = function (id) { G.Save.data.avatar = id; G.Save.commit(); };
  A.leaderboard = () => api('/rest/v1/leaderboard?select=username,avatar,trophies&limit=50', { auth: false });

  /* chaque enregistrement local programme une synchronisation en ligne */
  const origCommit = G.Save.commit;
  G.Save.commit = function () { if (this.data) this.data.rev = (this.data.rev || 0) + 1; origCommit.call(this); A.schedule(3000); };

  /* ---------- démarrage : session mémorisée ---------- */
  A.init = async function () {
    let raw = null;
    try { raw = G.Store.get(KEY) || sessionStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw || !A.enabled()) { emit(); return; }
    try { const o = JSON.parse(raw); A.session = o.s; A.user = o.u; } catch (e) { clearSession(); emit(); return; }
    A.status = 'syncing'; emit();
    if (A.session.expires_at - Date.now() / 1000 < 120) { if (!(await A.refresh())) { if (!A.session) { emit(); return; } } }
    try {
      const p = await fetchProfile();
      if (p) {
        A.profile = p;
        if ((p.save && (p.save.rev || 0)) > (G.Save.data.rev || 0) || G.Save.data.accountId !== A.user.id) { // une autre partie (autre téléphone) est plus récente
          const keep = Object.assign({}, G.Save.data.settings); G.Save.data = p.save; mergeDefaults(G.Save.data); Object.assign(G.Save.data.settings, keep); G.Save.data.accountId = A.user.id; saveLocal();
          if (G.UI && G.UI.onAccountChange) G.UI.onAccountChange();
        } else if ((G.Save.data.rev || 0) > (p.save && p.save.rev || 0)) A.push();
      }
      A.status = 'online'; A.lastSync = Date.now();
    } catch (e) { A.status = e.code === 'network' ? 'offline' : 'error'; A.err = e.message; }
    emit();
  };
  // sauvegarde immédiate quand l'application passe en arrière-plan
  document.addEventListener('visibilitychange', () => { if (document.hidden) A.flush(); });
})();
