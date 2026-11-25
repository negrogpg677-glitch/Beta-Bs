/* Brawl Rush - comptes côté serveur (Supabase, clé secrète uniquement sur le serveur) :
   identité vérifiée, identifiant unique en lettres (1 modification à vie), amis avec demandes, présence / « hors ligne depuis »,
   pseudo (délai 31 jours + prix en gemmes croissant), mode classé ELO (ouverture programmée + accès anticipé développeur),
   cadeaux de brawlers et permissions réservées au compte développeur. Toutes les règles sont vérifiées ici. */
'use strict';
module.exports = function (ctx) {
  const { clients, send, err, G } = ctx;
  const URL0 = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const SECRET = String(process.env.SUPABASE_SECRET || '').trim();
  const DEVS = String(process.env.DEV_EMAILS || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const RANKED_AT = Date.parse(process.env.RANKED_AT || '2026-11-26T10:00:00Z'); // 26/11/2026 à 11 h (heure de Paris)
  const enabled = !!(URL0 && SECRET);
  const DAY = 86400000, NAME_DELAY = 31 * DAY;
  const byUid = new Map(); // uid -> pid (session en ligne)
  // auto-diagnostic sans secret (visible dans /health) : base joignable ? tables v2 ? clé valide ? combien d'e-mails développeur ?
  const D = { db: enabled ? 'test en cours' : 'non configurée (SUPABASE_URL / SUPABASE_SECRET absents)', v2: '?', devs: DEVS.length, auths: 0, devAuths: 0, lastAuthErr: '', sessions: 'mémoire', takeovers: 0, lb: '?' };
  const devices = new Map(); // uid -> identifiant de l'appareil actif (un seul appareil par compte)
  let devUids = []; // comptes autorisés en plus des e-mails DEV_EMAILS (accordé par le développeur principal)
  async function loadDevUids() { try { const r = await db('/rest/v1/game_config?key=eq.dev_uids&select=value'); devUids = (r && r[0] && Array.isArray(r[0].value)) ? r[0].value : []; } catch (e) { /* table absente */ } }
  if (enabled) setTimeout(loadDevUids, 800);
  async function selfCheck() {
    if (!enabled) return;
    try { await db('/rest/v1/profiles?select=id&limit=1'); D.db = 'ok'; } catch (e) { D.db = 'erreur ' + (e.status || '') + ' : ' + String(e.message).slice(0, 120); }
    try { await db('/rest/v1/friendships?select=a&limit=1'); D.v2 = 'ok'; } catch (e) { D.v2 = 'erreur ' + (e.status || '') + ' : ' + String(e.message).slice(0, 120); }
  }
  if (enabled) { setTimeout(selfCheck, 500); setInterval(selfCheck, 300000); }

  async function db(path, opt) {
    opt = opt || {};
    const h = { apikey: SECRET, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(SECRET)) h.Authorization = 'Bearer ' + SECRET; // ancienne clé service_role (JWT)
    if (opt.prefer) h.Prefer = opt.prefer;
    if (opt.count) { h.Prefer = 'count=exact'; h.Range = '0-0'; h['Range-Unit'] = 'items'; }
    if (opt.user) h.Authorization = 'Bearer ' + opt.user;
    const r = await fetch(URL0 + path, { method: opt.method || 'GET', headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined });
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok && r.status !== 416) { const e = new Error((data && (data.message || data.msg)) || ('HTTP ' + r.status)); e.status = r.status; e.data = data; throw e; }
    if (opt.count) { const m = String(r.headers.get('content-range') || '').match(/\/(\d+)$/); return m ? +m[1] : 0; }
    return data;
  }
  const enc = encodeURIComponent;
  const COLS = 'id,username,handle,handle_changes,handle_unlock,name_changed_at,name_changes,elo,ranked_games,ranked_wins,trophies,avatar,last_seen,created_at';
  const one = async (q) => { const r = await db('/rest/v1/profiles?' + q + '&limit=1'); return r && r[0] || null; };
  const patchProfile = (id, body) => db('/rest/v1/profiles?id=eq.' + enc(id), { method: 'PATCH', body, prefer: 'return=minimal' });

  /* ---------- identifiants en lettres ---------- */
  const A1 = ['TIGRE', 'DRAGON', 'LOUP', 'FAUCON', 'OURS', 'RENARD', 'LYNX', 'COBRA', 'AIGLE', 'ORQUE', 'PANDA', 'LION', 'PHENIX', 'CORBEAU', 'REQUIN', 'PUMA', 'GECKO', 'HIBOU', 'BISON', 'CASTOR', 'KOALA', 'LUTIN', 'GOLEM', 'TITAN', 'COMETE', 'ORAGE', 'ECLAIR', 'VOLCAN', 'GLACIER', 'TORNADE', 'OMBRE', 'LUNE', 'SOLEIL', 'ETOILE', 'NOVA', 'ZEPHYR', 'PIRATE', 'NINJA', 'SAMOURAI', 'VIKING', 'SORCIER', 'ROBOT', 'PIXEL', 'TURBO', 'FUSEE', 'RUBIS', 'SAPHIR', 'JADE', 'ONYX', 'CRISTAL'];
  const A2 = ['BLEU', 'VERT', 'NOIR', 'ROUGE', 'DORE', 'ARGENT', 'SAUVAGE', 'RAPIDE', 'FURTIF', 'GEANT', 'ROYAL', 'MAGIQUE', 'GIVRE', 'FEU', 'NUIT', 'AURORE', 'TONNERRE', 'CELESTE', 'LUNAIRE', 'SOLAIRE', 'MYSTIQUE', 'FUREUR', 'BRAVE', 'RUSE', 'POLAIRE', 'ROSE', 'VIOLET', 'CORAIL', 'ACIER', 'BRONZE'];
  const SOLO = ['LUNARIS', 'ZEPHYRA', 'NOCTIS', 'ASTRAL', 'VORTEX', 'SOLARIS', 'NEBULA', 'KRONOS', 'ORION', 'ALTAIR', 'PEGASE', 'CYCLONE', 'TEMPETE', 'ECLIPSE', 'BOREAL'];
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const cand = () => { const r = Math.random(); const s = r < 0.15 ? pick(SOLO) : pick(A1) + pick(A2); return s.length <= 16 ? s : pick(A1) + pick(A2).slice(0, 4); };
  const normHandle = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  const validHandle = (h) => /^[A-Z]{4,16}$/.test(h);
  async function freeHandle(h) { return !(await one('handle=eq.' + enc(h) + '&select=id')); }
  async function newHandle() {
    for (let i = 0; i < 40; i++) { let h = cand(); if (i > 20) h = (h + pick(A2)).slice(0, 16); if (validHandle(h) && await freeHandle(h)) return h; }
    throw new Error('identifiant introuvable');
  }
  async function globalUnlock() { try { const r = await db('/rest/v1/game_config?key=eq.handle_unlock_all&select=value'); return !!(r && r[0] && r[0].value === true); } catch (e) { return false; } }

  /* ---------- rangs du mode classé ---------- */
  const TIERS = [['Bronze', 0, '#c88a4a'], ['Argent', 1100, '#c8d0e0'], ['Or', 1250, '#ffd21f'], ['Diamant', 1400, '#5ad0ff'], ['Mythique', 1550, '#c15bff'], ['Légendaire', 1700, '#ff5a5a'], ['Maître', 1850, '#fff3a0']];
  function rankOf(elo) {
    let i = 0; while (i + 1 < TIERS.length && elo >= TIERS[i + 1][1]) i++;
    const t = TIERS[i], lo = i === 0 ? 900 : t[1], hi = i + 1 < TIERS.length ? TIERS[i + 1][1] : null;
    const div = hi ? Math.min(3, 1 + Math.floor(((elo - lo) / (hi - lo)) * 3)) : 0;
    return { name: t[0] + (div ? ' ' + ['I', 'II', 'III'][div - 1] : ''), tier: t[0], color: t[2], next: hi };
  }
  const rankedOpen = (c) => !!c.dev || Date.now() >= RANKED_AT;
  const RANKED_MODES = ['gemgrab', 'brawlball', 'bounty', 'hotzone', 'knockout', 'duel']; // duel = classé 1 contre 1

  /* ---------- profil envoyé au joueur ---------- */
  async function me(c, p) {
    p = p || await one('id=eq.' + enc(c.uid) + '&select=' + COLS);
    if (!p) return;
    c.handle = p.handle; c.elo = p.elo; c.rg = p.ranked_games; c.rw = p.ranked_wins; c.uname = p.username;
    const last = Date.parse(p.name_changed_at || p.created_at || 0) || 0, recent = (p.name_changes || []).filter((t) => Date.now() - Date.parse(t) < 365 * DAY).length;
    const gu = await globalUnlock();
    send(c, { t: 'me', uid: c.uid, email: c.email, devConfigured: DEVS.length > 0, handle: p.handle, name: p.username, dev: !!c.dev, superDev: !!c.superDev, canHandle: (p.handle_changes || 0) < 1 || p.handle_unlock || gu,
      nameAt: last + NAME_DELAY, namePrice: Math.min(640, 20 * Math.pow(2, recent)), elo: p.elo, rank: rankOf(p.elo), games: p.ranked_games, wins: p.ranked_wins,
      rankedAt: RANKED_AT, rankedOpen: rankedOpen(c) });
  }

  /* ---------- présence ---------- */
  function liveStatus(uid) { const pid = byUid.get(uid), c = pid && clients.get(pid); if (!c || !c.ws) return { status: 'off' }; return { status: c.match ? 'match' : c.party ? 'party' : 'menu', pid }; }
  async function friendLists(c) {
    const rows = await db('/rest/v1/friendships?or=(a.eq.' + c.uid + ',b.eq.' + c.uid + ')&select=a,b,status,created_at');
    const other = (r) => (r.a === c.uid ? r.b : r.a), ids = [...new Set(rows.map(other))];
    const ps = ids.length ? await db('/rest/v1/profiles?id=in.(' + ids.join(',') + ')&select=id,username,handle,trophies,avatar,last_seen,elo') : [];
    const P = {}; ps.forEach((p) => (P[p.id] = p));
    const view = (r) => { const id = other(r), p = P[id] || {}, ls = liveStatus(id); return { uid: id, name: p.username || '?', handle: p.handle || '', trophies: p.trophies || 0, avatar: p.avatar || 'sherry', elo: p.elo || 1000, status: ls.status, pid: ls.pid || null, lastSeen: p.last_seen ? Date.parse(p.last_seen) : 0, since: Date.parse(r.created_at) || 0 }; };
    const friends = rows.filter((r) => r.status === 'accepted').map(view), incoming = rows.filter((r) => r.status === 'pending' && r.b === c.uid).map(view), outgoing = rows.filter((r) => r.status === 'pending' && r.a === c.uid).map(view);
    c.friendUids = new Set(friends.map((f) => f.uid));
    return { friends, incoming, outgoing };
  }
  async function pushFriends(c) { if (!c || !c.uid) return; try { send(c, Object.assign({ t: 'fr' }, await friendLists(c))); } catch (e) { /* base injoignable */ } }
  function pushTo(uid) { const pid = byUid.get(uid), c = pid && clients.get(pid); if (c && c.ws) pushFriends(c); }
  async function notifyFriends(c) { // un joueur change de statut : ses amis en ligne reçoivent la liste à jour
    if (!c.friendUids) return; for (const u of c.friendUids) { const pid = byUid.get(u), fc = pid && clients.get(pid); if (fc && fc.ws) pushFriends(fc); }
  }

  /* ---------- carte publique d'un joueur ---------- */
  async function findProfile(q, cols) {
    const raw = String(q || '').trim(), h = normHandle(raw);
    let p = validHandle(h) ? await one('handle=eq.' + enc(h) + '&select=' + cols) : null;
    if (!p && /^[A-Za-z0-9_]{3,16}$/.test(raw)) p = await one('username=ilike.' + enc(raw) + '&select=' + cols); // recherche par pseudo
    return p;
  }
  async function card(c, handle) {
    const p = await findProfile(handle, 'id,username,handle,trophies,avatar,elo,ranked_games,ranked_wins,last_seen' + (c.dev ? ',save' : ''));
    if (!p) return null;
    const ls = liveStatus(p.id), fr = await db('/rest/v1/friendships?or=(and(a.eq.' + c.uid + ',b.eq.' + p.id + '),and(a.eq.' + p.id + ',b.eq.' + c.uid + '))&select=a,b,status');
    const f = fr && fr[0];
    return { uid: p.id, name: p.username, handle: p.handle, trophies: p.trophies, avatar: p.avatar, elo: p.elo, rank: rankOf(p.elo), games: p.ranked_games, wins: p.ranked_wins, status: ls.status, pid: ls.pid || null,
      lastSeen: p.last_seen ? Date.parse(p.last_seen) : 0, me: p.id === c.uid, friend: f ? (f.status === 'accepted' ? 'yes' : f.a === c.uid ? 'sent' : 'received') : 'no',
      owned: c.dev && p.save && p.save.unlocked ? p.save.unlocked : undefined };
  }

  /* ---------- messages ---------- */
  const guard = (fn) => async (c, msg) => { try { await fn(c, msg); } catch (e) { err(c, 'db', 'Serveur de comptes indisponible : ' + (e.message || 'erreur')); } };
  const H = {};
  H.auth = async (c, msg) => {
    if (!enabled) return err(c, 'no_db', 'Base de données non configurée sur le serveur.');
    let why = '';
    const u = await db('/auth/v1/user', { user: String(msg.token || '') }).catch((e) => { why = (e.status || '') + ' ' + String(e.message || ''); return null; });
    if (!u || !u.id) {
      D.lastAuthErr = why.slice(0, 120);
      if (/api ?key/i.test(why)) return err(c, 'auth', 'Le serveur ne peut pas vérifier les comptes : clé SUPABASE_SECRET invalide sur Render.');
      return err(c, 'auth', 'Session expirée : reconnectez-vous.');
    }
    D.auths++;
    // un seul appareil par compte : une nouvelle connexion (identifiants saisis) prend le relais, l'ancien appareil est déconnecté
    const devId = String(msg.device || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);
    if (devId) {
      let cur = devices.get(u.id) || (u.app_metadata && u.app_metadata.device) || '';
      if (msg.fresh || !cur) {
        devices.set(u.id, devId);
        if (cur !== devId) db('/auth/v1/admin/users/' + u.id, { method: 'PUT', body: { app_metadata: { device: devId, device_at: new Date().toISOString() } } }).then(() => { D.sessions = 'ok (persistant)'; }).catch((e) => { D.sessions = 'mémoire (' + (e.status || '') + ')'; });
        for (const o of clients.values()) {
          if (o !== c && o.uid === u.id && o.devId !== devId) { D.takeovers++; send(o, { t: 'session_taken', msg: 'Votre compte vient d\'être ouvert sur un autre appareil. Vous avez été déconnecté de celui-ci.' }); byUid.delete(o.uid); o.uid = null; o.dev = false; o.email = ''; }
        }
      } else if (cur !== devId) {
        D.takeovers++;
        return send(c, { t: 'session_taken', msg: 'Votre compte est ouvert sur un autre appareil. Reconnectez-vous pour l\'utiliser ici (l\'autre appareil sera déconnecté).' });
      }
      c.devId = devId;
    }
    if (c.uid && c.uid !== u.id) byUid.delete(c.uid);
    c.uid = u.id; c.email = String(u.email || '').toLowerCase(); c.superDev = DEVS.includes(c.email); c.dev = c.superDev || devUids.includes(u.id); byUid.set(c.uid, c.pid); if (c.dev) D.devAuths++;
    let p = await one('id=eq.' + enc(c.uid) + '&select=' + COLS);
    if (!p) return err(c, 'auth', 'Profil introuvable.');
    if (!p.handle) {
      try { for (let i = 0; i < 3 && !p.handle; i++) { const h = await newHandle(); try { await patchProfile(c.uid, { handle: h }); p.handle = h; } catch (e) { if (e.status !== 409) throw e; } } }
      catch (e) { err(c, 'db_handle', 'Identifiant non créé : ' + (e.message || 'erreur base') + ' (exécutez supabase/v2b.sql dans Supabase).'); }
    }
    await patchProfile(c.uid, { last_seen: new Date().toISOString() }).catch(() => {});
    c.name = p.username || c.name;
    await me(c, p); await pushFriends(c); await notifyFriends(c);
    const gifts = await db('/rest/v1/gifts?to_id=eq.' + c.uid + '&claimed=eq.false&select=id,brawler,from_name').catch(() => []);
    for (const g of gifts || []) send(c, { t: 'gift', id: g.id, brawler: g.brawler, from: g.from_name || 'Le développeur' });
  };
  const need = (fn) => async (c, msg) => { if (!c.uid) return err(c, 'login', 'Connectez-vous à votre compte pour utiliser cette fonction.'); await fn(c, msg); };
  H.me = need(async (c) => me(c));
  H.handle_set = need(async (c, msg) => {
    const raw = String(msg.handle || '').trim(), h = normHandle(raw);
    if (/[^A-Za-zÀ-ÖØ-öø-ÿ]/.test(raw) || !validHandle(h)) return err(c, 'handle_bad', 'L\'identifiant doit contenir de 4 à 16 lettres (A à Z), sans chiffre.');
    const p = await one('id=eq.' + enc(c.uid) + '&select=handle,handle_changes,handle_unlock');
    if (!((p.handle_changes || 0) < 1 || p.handle_unlock || await globalUnlock())) return err(c, 'handle_locked', 'Votre identifiant a déjà été modifié : il est définitif.');
    if (h === p.handle) return err(c, 'handle_same', 'C\'est déjà votre identifiant.');
    if (!(await freeHandle(h))) return err(c, 'handle_taken', 'Cet identifiant est déjà pris.');
    try { await patchProfile(c.uid, { handle: h, handle_changes: (p.handle_changes || 0) + 1, handle_unlock: false }); } catch (e) { if (e.status === 409) return err(c, 'handle_taken', 'Cet identifiant est déjà pris.'); throw e; }
    send(c, { t: 'toast', msg: 'Identifiant changé : ' + h }); await me(c); await notifyFriends(c);
  });
  H.name_set = need(async (c, msg) => {
    const n = String(msg.name || '').trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) return err(c, 'name_bad', 'Pseudo : 3 à 16 lettres, chiffres ou _.');
    const p = await one('id=eq.' + enc(c.uid) + '&select=username,name_changed_at,name_changes,created_at,save');
    const last = Date.parse(p.name_changed_at || p.created_at || 0) || 0;
    if (Date.now() - last < NAME_DELAY) return err(c, 'name_wait', 'Prochain changement possible le ' + new Date(last + NAME_DELAY).toLocaleDateString('fr-FR') + '.');
    if (n.toLowerCase() === String(p.username).toLowerCase()) return err(c, 'name_same', 'C\'est déjà votre pseudo.');
    const taken = await db('/rest/v1/profiles?username=ilike.' + enc(n) + '&select=id&limit=1'); if (taken && taken.length) return err(c, 'name_taken', 'Ce pseudo est déjà pris.');
    const hist = (p.name_changes || []).filter((t) => Date.now() - Date.parse(t) < 365 * DAY), price = Math.min(640, 20 * Math.pow(2, hist.length));
    const save = p.save || {}; if ((save.gems || 0) < price) return err(c, 'name_gems', 'Il faut ' + price + ' gemmes pour changer de pseudo.');
    save.gems -= price; save.name = n; save.rev = (save.rev || 0) + 1;
    const now = new Date().toISOString();
    try { await patchProfile(c.uid, { username: n, name_changed_at: now, name_changes: hist.concat([now]), save }); } catch (e) { if (e.status === 409) return err(c, 'name_taken', 'Ce pseudo est déjà pris.'); throw e; }
    c.name = n; send(c, { t: 'name_ok', name: n, gems: save.gems, price, rev: save.rev }); await me(c); await notifyFriends(c);
  });
  H.fr_list = need(async (c) => pushFriends(c));
  H.player_find = need(async (c, msg) => { send(c, { t: 'player', ref: msg.ref || msg.handle, card: await card(c, msg.handle) }); });
  H.fr_req = need(async (c, msg) => {
    const h = normHandle(msg.handle), p = validHandle(h) && await one('handle=eq.' + enc(h) + '&select=id,username');
    if (!p) return err(c, 'fr_nf', 'Aucun joueur avec l\'identifiant ' + (h || '?') + '.');
    if (p.id === c.uid) return err(c, 'fr_self', 'C\'est votre propre identifiant !');
    const ex = await db('/rest/v1/friendships?or=(and(a.eq.' + c.uid + ',b.eq.' + p.id + '),and(a.eq.' + p.id + ',b.eq.' + c.uid + '))&select=a,b,status');
    if (ex.length) {
      const r = ex[0];
      if (r.status === 'accepted') return err(c, 'fr_dup', p.username + ' est déjà votre ami.');
      if (r.a === c.uid) return err(c, 'fr_dup', 'Demande déjà envoyée à ' + p.username + '.');
      await db('/rest/v1/friendships?a=eq.' + p.id + '&b=eq.' + c.uid, { method: 'PATCH', body: { status: 'accepted' }, prefer: 'return=minimal' }); // il vous avait déjà demandé
      send(c, { t: 'toast', msg: 'Vous êtes maintenant amis avec ' + p.username + ' !' });
    } else {
      await db('/rest/v1/friendships', { method: 'POST', body: { a: c.uid, b: p.id, status: 'pending' }, prefer: 'return=minimal' });
      send(c, { t: 'toast', msg: 'Demande d\'ami envoyée à ' + p.username });
      const pid = byUid.get(p.id), tc = pid && clients.get(pid); if (tc) send(tc, { t: 'fr_new', from: c.name, handle: c.handle });
    }
    await pushFriends(c); pushTo(p.id);
  });
  const edge = (fn) => need(async (c, msg) => { const o = String(msg.uid || ''); if (!/^[0-9a-f-]{36}$/i.test(o)) return; await fn(c, o); await pushFriends(c); pushTo(o); });
  H.fr_accept = edge(async (c, o) => { await db('/rest/v1/friendships?a=eq.' + o + '&b=eq.' + c.uid + '&status=eq.pending', { method: 'PATCH', body: { status: 'accepted' }, prefer: 'return=minimal' }); });
  H.fr_decline = edge(async (c, o) => { await db('/rest/v1/friendships?a=eq.' + o + '&b=eq.' + c.uid + '&status=eq.pending', { method: 'DELETE', prefer: 'return=minimal' }); });
  H.fr_cancel = edge(async (c, o) => { await db('/rest/v1/friendships?a=eq.' + c.uid + '&b=eq.' + o + '&status=eq.pending', { method: 'DELETE', prefer: 'return=minimal' }); });
  H.fr_remove = edge(async (c, o) => { await db('/rest/v1/friendships?or=(and(a.eq.' + c.uid + ',b.eq.' + o + '),and(a.eq.' + o + ',b.eq.' + c.uid + '))', { method: 'DELETE', prefer: 'return=minimal' }); });
  H.ranked_info = need(async (c) => {
    const p = await one('id=eq.' + enc(c.uid) + '&select=elo,ranked_games,ranked_wins');
    const hist = await db('/rest/v1/ranked_matches?player=eq.' + c.uid + '&select=mode,result,delta,elo_after,created_at&order=created_at.desc&limit=15');
    const top = await db('/rest/v1/profiles?ranked_games=gt.0&select=username,handle,elo,avatar&order=elo.desc&limit=30');
    send(c, { t: 'ranked', elo: p.elo, rank: rankOf(p.elo), games: p.ranked_games, wins: p.ranked_wins, hist, top: top.map((x) => Object.assign(x, { rank: rankOf(x.elo) })), openAt: RANKED_AT, open: rankedOpen(c), dev: !!c.dev, modes: RANKED_MODES });
  });
  H.gift_ack = need(async (c, msg) => { await db('/rest/v1/gifts?id=eq.' + (+msg.id | 0) + '&to_id=eq.' + c.uid, { method: 'PATCH', body: { claimed: true }, prefer: 'return=minimal' }); });
  let lbCache = null, lbAt = 0, lbTotal = 0;
  H.lb = async (c, msg) => {
    if (!lbCache || Date.now() - lbAt > 8000 || msg.fresh) {
      lbCache = await db('/rest/v1/profiles?trophies=gt.0&select=id,username,handle,trophies,avatar,elo&order=trophies.desc,created_at.asc&limit=100') || [];
      lbTotal = await db('/rest/v1/profiles?trophies=gt.0&select=id', { count: true }).catch(() => lbCache.length);
      lbAt = Date.now(); D.lb = 'ok';
    }
    let mine = null;
    if (c.uid) mine = await one('id=eq.' + enc(c.uid) + '&select=trophies,username,handle,avatar');
    const tr = mine ? (mine.trophies || 0) : Math.max(0, Math.min(1e6, +msg.tr | 0));
    const above = tr > 0 ? await db('/rest/v1/profiles?trophies=gt.' + tr + '&select=id', { count: true }) : 0;
    send(c, { t: 'lb', src: 'db', total: lbTotal, top: lbCache.map((p, i) => ({ rank: i + 1, name: p.username, handle: p.handle, trophies: p.trophies, avatar: p.avatar, me: !!c.uid && p.id === c.uid })),
      me: { rank: tr > 0 ? above + 1 : 0, trophies: tr, guest: !c.uid, name: mine ? mine.username : c.name, handle: mine ? mine.handle : '' } });
  };
  const dev = (fn) => need(async (c, msg) => { if (!c.dev) return err(c, 'forbidden', 'Réservé au compte développeur.'); await fn(c, msg); });
  // le développeur principal (DEV_EMAILS) peut autoriser d'autres comptes ; les comptes autorisés ne peuvent pas en autoriser d'autres
  H.dev_grant = dev(async (c, msg) => {
    if (!c.superDev) return err(c, 'forbidden', 'Seul le compte développeur principal peut autoriser d\'autres comptes.');
    const p = await findProfile(msg.handle, 'id,username'); if (!p) return err(c, 'dev', 'Joueur introuvable.');
    await loadDevUids();
    devUids = msg.revoke ? devUids.filter((x) => x !== p.id) : Array.from(new Set(devUids.concat([p.id])));
    await db('/rest/v1/game_config?on_conflict=key', { method: 'POST', body: { key: 'dev_uids', value: devUids }, prefer: 'resolution=merge-duplicates,return=minimal' });
    for (const o of clients.values()) if (o.uid === p.id) { o.dev = !msg.revoke; me(o); }
    send(c, { t: 'toast', msg: msg.revoke ? 'Accès développeur retiré à ' + p.username : 'Accès développeur accordé à ' + p.username });
  });
  H.dev_gift = dev(async (c, msg) => {
    const id = String(msg.brawler || ''); if (!G.BRAWLER[id] || id === 'robot') return err(c, 'dev', 'Brawler inconnu.');
    const p = /^[0-9a-f-]{36}$/i.test(String(msg.uid || '')) ? await one('id=eq.' + enc(msg.uid) + '&select=id,username,save') : await findProfile(msg.handle, 'id,username,save');
    if (!p) return err(c, 'dev', 'Joueur introuvable. Il doit s\'être connecté à son compte au moins une fois avec la dernière version du jeu.');
    if (p.save && (p.save.unlocked || []).includes(id)) return err(c, 'dev_owned', p.username + ' possède déjà ' + G.BRAWLER[id].name + '.');
    const pend = await db('/rest/v1/gifts?to_id=eq.' + p.id + '&brawler=eq.' + enc(id) + '&claimed=eq.false&select=id'); if (pend.length) return err(c, 'dev_owned', 'Ce cadeau attend déjà ' + p.username + '.');
    const row = await db('/rest/v1/gifts', { method: 'POST', body: { to_id: p.id, brawler: id, from_name: c.name }, prefer: 'return=representation' });
    const pid = byUid.get(p.id), tc = pid && clients.get(pid); if (tc && tc.ws) send(tc, { t: 'gift', id: row[0].id, brawler: id, from: c.name });
    send(c, { t: 'toast', msg: '🎁 ' + G.BRAWLER[id].name + ' offert à ' + p.username + (tc && tc.ws ? ' (reçu immédiatement)' : ' (il le recevra à sa prochaine connexion)') });
  });
  H.dev_unlock_handle = dev(async (c, msg) => {
    if (msg.all !== undefined) { await db('/rest/v1/game_config?on_conflict=key', { method: 'POST', body: { key: 'handle_unlock_all', value: !!msg.all }, prefer: 'resolution=merge-duplicates,return=minimal' }); return send(c, { t: 'toast', msg: msg.all ? 'Tous les joueurs peuvent modifier leur identifiant.' : 'Restriction d\'identifiant rétablie pour tous.' }); }
    const p = /^[0-9a-f-]{36}$/i.test(String(msg.uid || '')) ? await one('id=eq.' + enc(msg.uid) + '&select=id,username') : await findProfile(msg.handle, 'id,username');
    if (!p) return err(c, 'dev', 'Joueur introuvable.');
    await patchProfile(p.id, { handle_unlock: true }); send(c, { t: 'toast', msg: p.username + ' peut à nouveau modifier son identifiant (une fois).' });
  });

  /* ---------- fin de partie classée ---------- */
  async function rankedEnd(m, M, r) {
    const humans = M.ents.filter((b) => b.pid && clients.get(b.pid) && clients.get(b.pid).uid);
    if (!humans.length) return {};
    const eloOf = (b) => { const c = clients.get(b.pid); return (c && c.elo) || 1000; };
    const avgH = humans.reduce((s, b) => s + eloOf(b), 0) / humans.length;
    const teamAvg = (t) => { const xs = M.ents.filter((b) => b.team === t && !b.isBoss); return xs.reduce((s, b) => s + (b.pid ? eloOf(b) : avgH), 0) / Math.max(1, xs.length); };
    const out = {};
    for (const b of humans) {
      const c = clients.get(b.pid), mine = teamAvg(b.team), opp = teamAvg(b.team === 0 ? 1 : 0);
      const exp = 1 / (1 + Math.pow(10, (opp - mine) / 400)), score = r.draw ? 0.5 : r.winnerTeam === b.team ? 1 : 0;
      const K = (c.rg || 0) < 10 ? 48 : 32; let delta = Math.round(K * (score - exp));
      if (score === 1) delta = Math.max(5, delta); else if (score === 0) delta = Math.min(-5, delta);
      const elo = Math.max(0, (c.elo || 1000) + delta);
      c.elo = elo; c.rg = (c.rg || 0) + 1; c.rw = (c.rw || 0) + (score === 1 ? 1 : 0);
      out[b.pid] = { delta, elo, rank: rankOf(elo) };
      try {
        await patchProfile(c.uid, { elo, ranked_games: c.rg, ranked_wins: c.rw });
        await db('/rest/v1/ranked_matches', { method: 'POST', body: { player: c.uid, mode: M.mode, result: score === 1 ? 1 : score === 0 ? -1 : 0, delta, elo_after: elo }, prefer: 'return=minimal' });
      } catch (e) { /* la base est momentanément injoignable : l'ELO est conservé en mémoire pour cette session */ }
    }
    return out;
  }

  function onClose(c) { if (c.uid) { patchProfile(c.uid, { last_seen: new Date().toISOString() }).catch(() => {}); setTimeout(() => notifyFriends(c), 50); } }
  function onPresence(c) { if (c && c.uid) notifyFriends(c); }
  function handle(c, msg) { const f = H[msg.t]; if (!f || (msg.t === 'lb' && !enabled)) return false; guard(f)(c, msg); return true; }
  async function cfgLoad(key) { if (!enabled) return null; try { const r = await db('/rest/v1/game_config?key=eq.' + enc(key) + '&select=value'); return r && r[0] ? r[0].value : null; } catch (e) { return null; } }
  async function cfgSave(key, value) { if (!enabled) return; await db('/rest/v1/game_config?on_conflict=key', { method: 'POST', body: { key, value }, prefer: 'resolution=merge-duplicates,return=minimal' }); }
  return { diag: () => D, enabled, handle, cfgLoad, cfgSave, me, rankedOpen, rankedEnd, rankOf, RANKED_MODES, RANKED_AT, onClose, onPresence, byUid };
};
