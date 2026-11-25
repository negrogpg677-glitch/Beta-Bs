/* Imitation locale de l'API Supabase (Auth/GoTrue + REST/PostgREST) utilisée par le jeu, pour les tests automatiques.
   Reproduit : routes, formats d'erreur, déclencheur de création de profil, unicité du pseudo, règles RLS « sa propre ligne ».
   Usage : node tools/supabase-mock.js <port> [expiration_jeton_s]   — clé anon de test : "anon-test-key"
   Routes de test : GET /_test/outbox (codes de récupération envoyés), GET /_test/profiles */
'use strict';
const http = require('http');
const crypto = require('crypto');
const PORT = +process.argv[2] || 54321, EXP = +process.argv[3] || 3600, ANON = 'anon-test-key', SERVICE = 'service-test-key'; // clé secrète de test (serveur de jeu)
const users = new Map(); // email -> {id, email, hash, salt, meta}
const byId = new Map(); const tokens = new Map(); const refresh = new Map(); const profiles = new Map(); const outbox = []; const codes = new Map(); const kv = new Map();
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const now = () => Math.floor(Date.now() / 1000);
function session(u) {
  const at = 'at_' + crypto.randomBytes(16).toString('hex'), rt = 'rt_' + crypto.randomBytes(16).toString('hex');
  tokens.set(at, { id: u.id, exp: now() + EXP }); refresh.set(rt, u.id);
  return { access_token: at, token_type: 'bearer', expires_in: EXP, expires_at: now() + EXP, refresh_token: rt, user: pubUser(u) };
}
const pubUser = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.meta, created_at: u.created });
const gerr = (res, code, ec, msg) => send(res, code, { code, error_code: ec, msg });
function send(res, code, body, extra) { res.writeHead(code, Object.assign({ 'content-type': 'application/json' }, cors, extra || {})); res.end(body === undefined ? '' : JSON.stringify(body)); }
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey, authorization, content-type, prefer, x-client-info, accept', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS' };
function authUid(req) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (t === ANON) return { anon: true };
  const s = tokens.get(t); if (!s) return null; if (s.exp < now()) return { expired: true }; return { id: s.id };
}
const PROTECTED = ['handle', 'handle_changes', 'handle_unlock', 'name_changed_at', 'name_changes', 'elo', 'ranked_games', 'ranked_wins'];
const newProfile = (id, username) => ({ id, username, avatar: 'sherry', save: {}, trophies: 0, handle: null, handle_changes: 0, handle_unlock: false, name_changed_at: null, name_changes: [], elo: 1000, ranked_games: 0, ranked_wins: 0, last_seen: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
const T = { friendships: [], gifts: [], ranked_matches: [], game_config: [] }; let seq = 1;
const rowsOf = (t) => (t === 'profiles' ? [...profiles.values()] : T[t]);
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function cond(row, col, expr) {
  const i = expr.indexOf('.'), op = expr.slice(0, i), v = expr.slice(i + 1), x = row[col];
  switch (op) {
    case 'eq': return String(x) === v; case 'neq': return String(x) !== v;
    case 'gt': return +x > +v; case 'gte': return +x >= +v; case 'lt': return +x < +v; case 'lte': return +x <= +v;
    case 'in': return v.replace(/^\(|\)$/g, '').split(',').includes(String(x));
    case 'ilike': return new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i').test(String(x));
    case 'is': return v === 'null' ? x === null || x === undefined : String(x) === v;
  }
  return false;
}
function logic(row, s, and) { const parts = splitTop(s.replace(/^\(|\)$/g, '')); const f = (t) => { const m = t.match(/^(and|or)\((.*)\)$/); if (m) return logic(row, '(' + m[2] + ')', m[1] === 'and'); const j = t.indexOf('.'); return cond(row, t.slice(0, j), t.slice(j + 1)); }; return and ? parts.every(f) : parts.some(f); }
function match(row, sp) { for (const [k, v] of sp) { if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue; if (k === 'or' || k === 'and') { if (!logic(row, v, k === 'and')) return false; } else if (!cond(row, k, v)) return false; } return true; }
function uniqueClash(t, row, self) {
  const others = rowsOf(t).filter((r) => r !== self);
  if (t === 'profiles') return others.some((r) => (row.handle && r.handle === row.handle) || (row.username && String(r.username).toLowerCase() === String(row.username).toLowerCase()));
  if (t === 'friendships') return others.some((r) => r.a === row.a && r.b === row.b);
  if (t === 'game_config') return others.some((r) => r.key === row.key);
  return false;
}
function rest(req, res, url, t, body) {
  if (!rowsOf(t)) return send(res, 404, { message: 'table inconnue ' + t });
  const sp = url.searchParams, rep = /return=representation/.test(req.headers.prefer || '');
  let rows = rowsOf(t).filter((r) => match(r, sp));
  if (req.method === 'GET') {
    const o = sp.get('order'); if (o) { const [c, d] = o.split('.'); rows.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === 'desc' ? -1 : 1)); }
    if (sp.get('limit')) rows = rows.slice(0, +sp.get('limit'));
    return send(res, 200, rows);
  }
  if (req.method === 'POST') {
    const out = [];
    for (const b of Array.isArray(body) ? body : [body]) {
      const row = Object.assign(t === 'gifts' ? { id: seq++, claimed: false } : t === 'ranked_matches' ? { id: seq++ } : t === 'friendships' ? { status: 'pending' } : {}, { created_at: new Date().toISOString() }, b);
      const dup = t === 'game_config' ? T[t].find((r) => r.key === row.key) : t === 'friendships' ? T[t].find((r) => r.a === row.a && r.b === row.b) : null;
      if (dup) { if (/merge-duplicates/.test(req.headers.prefer || '')) { Object.assign(dup, b); out.push(dup); continue; } return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' }); }
      if (t === 'friendships' && (!profiles.has(row.a) || !profiles.has(row.b) || row.a === row.b)) return send(res, 409, { code: '23503', message: 'foreign key / check violation' });
      T[t].push(row); out.push(row);
    }
    return send(res, rep ? 201 : 201, rep ? out : undefined);
  }
  if (req.method === 'PATCH') {
    for (const r of rows) { const nr = Object.assign({}, r, body); if (uniqueClash(t, nr, r)) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' }); if (t === 'profiles' && nr.handle && !/^[A-Z]{4,16}$/.test(nr.handle)) return send(res, 400, { code: '23514', message: 'violates check constraint handle_format' }); }
    rows.forEach((r) => Object.assign(r, body, t === 'profiles' ? { updated_at: new Date().toISOString() } : {}));
    return send(res, rep ? 200 : 204, rep ? rows : undefined);
  }
  if (req.method === 'DELETE') { if (t === 'profiles') return send(res, 403, {}); T[t] = T[t].filter((r) => !rows.includes(r)); return send(res, 204); }
  send(res, 405, {});
}
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (p === '/_test/outbox') return send(res, 200, outbox);
  if (p === '/_test/profiles') return send(res, 200, [...profiles.values()]);
  if (p.startsWith('/_kv/')) { // émulation des SharedPreferences Android d'un « téléphone » de test (pont natif synchrone)
    const k = decodeURIComponent(p.slice(5));
    if (req.method === 'GET') return kv.has(k) ? (res.writeHead(200, Object.assign({ 'content-type': 'text/plain' }, cors)), res.end(kv.get(k))) : send(res, 404);
    if (req.method === 'DELETE') { kv.delete(k); return send(res, 204); }
    let v = ''; req.on('data', (d) => (v += d)); req.on('end', () => { kv.set(k, v); send(res, 204); }); return;
  }
  if (req.headers.apikey !== ANON && req.headers.apikey !== SERVICE) return send(res, 401, { message: 'Invalid API key' });
  const svc = req.headers.apikey === SERVICE;
  let raw = ''; req.on('data', (d) => (raw += d)); req.on('end', () => {
    let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return gerr(res, 400, 'bad_json', 'Invalid JSON'); }
    const a = authUid(req);
    // ---------------- Auth ----------------
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return gerr(res, 400, 'validation_failed', 'Unable to validate email address: invalid format');
      if (String(body.password || '').length < 6) return gerr(res, 422, 'weak_password', 'Password should be at least 6 characters.');
      if (users.has(email)) return gerr(res, 422, 'user_already_exists', 'User already registered');
      const meta = body.data || {}, uname = meta.username || 'joueur' + crypto.randomBytes(4).toString('hex');
      if ([...profiles.values()].some((x) => x.username.toLowerCase() === uname.toLowerCase())) return gerr(res, 500, 'unexpected_failure', 'Database error saving new user');
      const salt = crypto.randomBytes(8).toString('hex'), u = { id: crypto.randomUUID(), email, salt, hash: hash(body.password, salt), meta, created: new Date().toISOString() };
      users.set(email, u); byId.set(u.id, u);
      profiles.set(u.id, newProfile(u.id, uname)); // déclencheur handle_new_user
      return send(res, 200, session(u));
    }
    if (p === '/auth/v1/token' && req.method === 'POST') {
      const gt = url.searchParams.get('grant_type');
      if (gt === 'password') {
        const u = users.get(String(body.email || '').toLowerCase());
        if (!u || u.hash !== hash(String(body.password || ''), u.salt)) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return send(res, 200, session(u));
      }
      if (gt === 'refresh_token') {
        const id = refresh.get(body.refresh_token); if (!id) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
        refresh.delete(body.refresh_token); return send(res, 200, session(byId.get(id)));
      }
    }
    if (p === '/auth/v1/user') {
      if (!a || a.anon || a.expired) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT: token is expired' });
      const u = byId.get(a.id);
      if (req.method === 'PUT') { if (body.password) { if (body.password.length < 6) return gerr(res, 422, 'weak_password', 'Password should be at least 6 characters.'); u.salt = crypto.randomBytes(8).toString('hex'); u.hash = hash(body.password, u.salt); } return send(res, 200, pubUser(u)); }
      return send(res, 200, pubUser(u));
    }
    if (p === '/auth/v1/recover' && req.method === 'POST') {
      const u = users.get(String(body.email || '').toLowerCase());
      if (u) { const code = String(crypto.randomInt(100000, 999999)); codes.set(u.email, { code, exp: now() + 3600 }); outbox.push({ to: u.email, code }); }
      return send(res, 200, {}); // Supabase répond toujours 200 (ne révèle pas si l'e-mail existe)
    }
    if (p === '/auth/v1/verify' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase(), c = codes.get(email);
      if (body.type !== 'recovery' || !c || c.code !== String(body.token) || c.exp < now()) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      codes.delete(email); return send(res, 200, session(users.get(email)));
    }
    if (p === '/auth/v1/logout' && req.method === 'POST') { tokens.delete((req.headers.authorization || '').replace(/^Bearer /, '')); return send(res, 204); }
    // ---------------- REST (PostgREST) ----------------
    if (svc && p.startsWith('/rest/v1/') && !p.startsWith('/rest/v1/rpc/')) return rest(req, res, url, p.slice(9), body); // clé secrète : accès complet (contourne la RLS)
    if (a && a.expired) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
    if (p === '/rest/v1/rpc/username_available' && req.method === 'POST') return send(res, 200, ![...profiles.values()].some((x) => x.username.toLowerCase() === String(body.name || '').toLowerCase()));
    if (p === '/rest/v1/leaderboard') return send(res, 200, [...profiles.values()].sort((x, y) => y.trophies - x.trophies).slice(0, 100).map((x) => ({ username: x.username, avatar: x.avatar, trophies: x.trophies })));
    if (p === '/rest/v1/profiles') {
      const uid = a && a.id; // RLS : le rôle anon ne voit rien ; un joueur ne voit que sa ligne
      const f = (url.searchParams.get('id') || '').replace(/^eq\./, '');
      if (req.method === 'GET') return send(res, 200, uid && f === uid && profiles.has(uid) ? [profiles.get(uid)] : []);
      if (req.method === 'POST') { if (!uid || body.id !== uid) return send(res, 403, { code: '42501', message: 'new row violates row-level security policy for table "profiles"' }); if (profiles.has(uid)) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "profiles_pkey"' }); const row = Object.assign(newProfile(uid, body.username), body, { updated_at: new Date().toISOString() }); profiles.set(uid, row); return send(res, 201, [row]); }
      if (req.method === 'PATCH') {
        if (!uid || f !== uid || !profiles.has(uid)) return send(res, 204);
        const row = profiles.get(uid);
        if (body.username && body.username !== row.username) return send(res, 400, { code: 'P0001', message: 'Le pseudo ne peut pas être modifié' });
        if (PROTECTED.some((k) => k in body && JSON.stringify(body[k]) !== JSON.stringify(row[k]))) return send(res, 400, { code: 'P0001', message: 'Champ protégé' });
        Object.assign(row, body, { updated_at: new Date().toISOString() }); return send(res, 204);
      }
    }
    send(res, 404, { message: 'route inconnue ' + req.method + ' ' + p });
  });
});
server.listen(PORT, () => console.log('supabase-mock sur http://127.0.0.1:' + PORT + ' (jetons valables ' + EXP + ' s)'));
