/* Test de bout en bout des comptes côté serveur (base Supabase imitée, clé secrète de test) :
   identifiants en lettres, 1 modification à vie + déblocage développeur, demandes d'amis, présence, invitations,
   pseudo (délai 31 j + gemmes), mode classé (ouverture programmée, accès anticipé dev, ELO), cadeaux de brawlers.
   Usage : node tools/test-social.js */
'use strict';
const { spawn } = require('child_process'); const path = require('path');
const MOCK = 54390;
process.env.SUPABASE_URL = 'http://127.0.0.1:' + MOCK; process.env.SUPABASE_SECRET = 'service-test-key';
process.env.DEV_EMAILS = 'dev@test.fr'; process.env.RANKED_AT = new Date(Date.now() + 3600e3).toISOString(); process.env.FILL_WAIT = '1';
process.env.DATA_DIR = path.join(require('os').tmpdir(), 'brsoc' + Date.now());
const WebSocket = require('../server/node_modules/ws');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p, o) => { o = o || {}; const r = await fetch('http://127.0.0.1:' + MOCK + p, { method: o.method || 'GET', headers: Object.assign({ apikey: o.key || 'anon-test-key', 'content-type': 'application/json' }, o.h || {}), body: o.body ? JSON.stringify(o.body) : undefined }); const t = await r.text(); return t ? JSON.parse(t) : null; };
const svc = (p, o) => api(p, Object.assign({ key: 'service-test-key' }, o));
class Cl {
  constructor(name) { this.name = name; this.msgs = []; this.w = []; }
  open(url) { return new Promise((res) => { this.ws = new WebSocket(url); this.ws.on('open', () => this.ws.send(JSON.stringify({ t: 'hello', name: this.name, v: 3 }))); this.ws.on('message', (raw) => { const m = JSON.parse(raw); if (this.on) this.on(m); if (m.t === 'snap') return; this.msgs.push(m); if (m.t === 'welcome') { this.pid = m.pid; res(); } this.w = this.w.filter((x) => { if (x.t === m.t && (!x.f || x.f(m))) { x.r(m); return false; } return true; }); }); }); }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(t, f, ms = 5000) { return new Promise((r, j) => { const to = setTimeout(() => j(new Error('délai : ' + t)), ms); this.w.push({ t, f, r: (m) => { clearTimeout(to); r(m); } }); }); }
  last(t) { return [...this.msgs].reverse().find((m) => m.t === t); }
  clear() { this.msgs = []; }
}
(async () => {
  const mock = spawn('node', [path.join(__dirname, 'supabase-mock.js'), String(MOCK)], { stdio: 'ignore' }); await sleep(700);
  const S = require('../server/server.js'); await new Promise((r) => S.server.listen(0, r)); const url = 'ws://127.0.0.1:' + S.server.address().port;
  const signup = async (email, username) => (await api('/auth/v1/signup', { method: 'POST', body: { email, password: 'secret123', data: { username } } })).access_token;
  const tok = { dev: await signup('dev@test.fr', 'DevBoss'), al: await signup('alice@test.fr', 'Alice'), bo: await signup('bob@test.fr', 'Bob') };
  const D = new Cl('Dev'), A = new Cl('Alice'), B = new Cl('Bob');
  for (const [c, t] of [[D, tok.dev], [A, tok.al], [B, tok.bo]]) { await c.open(url); const w = c.wait('me'); c.send({ t: 'auth', token: t }); c.me = await w; }
  // --- identifiants
  const hs = [D.me.handle, A.me.handle, B.me.handle];
  ok(hs.every((h) => /^[A-Z]{4,16}$/.test(h)) && new Set(hs).size === 3, 'identifiants générés : uniquement des lettres, uniques (' + hs.join(', ') + ')');
  ok(D.me.dev === true && A.me.dev === false, 'compte développeur reconnu par le serveur (e-mail), pas les autres');
  let w = A.wait('me'); A.send({ t: 'handle_set', handle: 'Tigrébleu' }); let m = await w;
  ok(m.handle === 'TIGREBLEU' && m.canHandle === false, 'modification de l\'identifiant (accents retirés, majuscules) : ' + m.handle + ', puis verrouillé');
  w = A.wait('error'); A.send({ t: 'handle_set', handle: 'DRAGONVERT' }); ok((await w).code === 'handle_locked', 'seconde modification refusée par le serveur (à vie)');
  w = B.wait('error'); B.send({ t: 'handle_set', handle: 'BOB7X' }); ok((await w).code === 'handle_bad', 'identifiant avec chiffre refusé');
  w = B.wait('error'); B.send({ t: 'handle_set', handle: 'tigrebleu' }); ok((await w).code === 'handle_taken', 'identifiant déjà pris refusé');
  w = B.wait('error'); B.send({ t: 'dev_unlock_handle', handle: 'TIGREBLEU' }); ok((await w).code === 'forbidden', 'déblocage réservé au compte développeur');
  w = D.wait('toast'); D.send({ t: 'dev_unlock_handle', handle: 'TIGREBLEU' }); await w; w = A.wait('me'); A.send({ t: 'me' });
  ok((await w).canHandle === true, 'le développeur autorise Alice à modifier une nouvelle fois');
  w = A.wait('me'); A.send({ t: 'handle_set', handle: 'PHENIXDORE' }); m = await w; ok(m.handle === 'PHENIXDORE' && !m.canHandle, 'nouvelle modification puis re-verrouillage');
  w = D.wait('toast'); D.send({ t: 'dev_unlock_handle', all: true }); await w; w = B.wait('me'); B.send({ t: 'me' }); ok((await w).canHandle === true, 'déblocage global (tous les joueurs)');
  w = D.wait('toast'); D.send({ t: 'dev_unlock_handle', all: false }); await w;
  // --- amis
  const bh = B.me.handle;
  let wb = B.wait('fr_new'); w = A.wait('fr', (x) => x.outgoing.length === 1); A.send({ t: 'fr_req', handle: bh.toLowerCase() }); await w; await wb;
  ok(B.last('fr') && true, 'demande d\'ami envoyée par identifiant (notification reçue par Bob)');
  await sleep(200); ok((B.last('fr').incoming[0] || {}).name === 'Alice', 'Bob voit la demande reçue ; Alice la voit dans « envoyées »');
  w = A.wait('fr', (x) => !x.outgoing.length); A.send({ t: 'fr_cancel', uid: B.me.uid }); await w; await sleep(150); ok(!B.last('fr').incoming.length, 'annulation d\'une demande envoyée');
  w = B.wait('fr', (x) => x.incoming.length === 1); A.send({ t: 'fr_req', handle: bh }); await w;
  w = B.wait('fr', (x) => !x.incoming.length); B.send({ t: 'fr_decline', uid: A.me.uid }); await w; ok(true, 'refus d\'une demande reçue');
  w = B.wait('fr', (x) => x.incoming.length === 1); A.send({ t: 'fr_req', handle: bh }); await w;
  w = A.wait('fr', (x) => x.friends.length === 1); B.send({ t: 'fr_accept', uid: A.me.uid }); m = await w;
  ok(m.friends[0].name === 'Bob' && m.friends[0].status === 'menu' && m.friends[0].pid === B.pid, 'demande acceptée : amis, statut « en ligne » visible');
  w = A.wait('error'); A.send({ t: 'fr_req', handle: bh }); ok((await w).code === 'fr_dup', 'pas de doublon de demande');
  // invitation entre amis du compte
  w = B.wait('invited'); A.send({ t: 'invite', pid: B.pid, mode: 'gemgrab' }); ok((await w).from === 'Alice', 'invitation entre amis du compte');
  // présence : Bob se déconnecte
  w = A.wait('fr', (x) => x.friends[0] && x.friends[0].status === 'off'); B.ws.close(); m = await w;
  ok(m.friends[0].lastSeen > Date.now() - 10000, '« hors ligne depuis » : dernière connexion enregistrée');
  await B.open(url); w = B.wait('me'); B.send({ t: 'auth', token: tok.bo }); await w;
  // carte d'un joueur
  w = A.wait('player'); A.send({ t: 'player_find', handle: bh }); m = await w; ok(m.card && m.card.name === 'Bob' && m.card.friend === 'yes' && m.card.rank, 'profil d\'un joueur trouvé par identifiant (rang, statut d\'amitié)');
  // --- pseudo : délai 31 j + gemmes
  w = A.wait('error'); A.send({ t: 'name_set', name: 'AliceNew' }); ok((await w).code === 'name_wait', 'pseudo : changement refusé avant 31 jours');
  const old = new Date(Date.now() - 40 * 864e5).toISOString();
  await svc('/rest/v1/profiles?id=eq.' + A.me.uid, { method: 'PATCH', body: { created_at: old, save: { gems: 15, rev: 1 } } });
  w = A.wait('error'); A.send({ t: 'name_set', name: 'AliceNew' }); ok((await w).code === 'name_gems', 'pseudo : refusé sans les 20 gemmes');
  await svc('/rest/v1/profiles?id=eq.' + A.me.uid, { method: 'PATCH', body: { save: { gems: 100, rev: 1 } } });
  w = A.wait('error'); A.send({ t: 'name_set', name: 'bob' }); ok((await w).code === 'name_taken', 'pseudo déjà pris refusé');
  w = A.wait('name_ok'); A.send({ t: 'name_set', name: 'AliceNew' }); m = await w; ok(m.gems === 80 && m.price === 20, 'pseudo changé contre 20 gemmes (reste ' + m.gems + ')');
  w = A.wait('error'); A.send({ t: 'name_set', name: 'Alice3' }); ok((await w).code === 'name_wait', 'nouveau délai de 31 jours après le changement');
  await svc('/rest/v1/profiles?id=eq.' + A.me.uid, { method: 'PATCH', body: { name_changed_at: old } }); w = A.wait('me'); A.send({ t: 'me' }); ok((await w).namePrice === 40, 'prix qui augmente après un changement récent (40 gemmes)');
  // --- classé
  w = A.wait('error'); A.send({ t: 'party_create', mode: 'gemgrab' }); await sleep(150); A.send({ t: 'party_start', kind: 'ranked', mode: 'gemgrab' }); ok((await w).code === 'ranked_locked', 'classé fermé avant l\'heure d\'ouverture (contrôle serveur)');
  D.send({ t: 'party_create', mode: 'bounty' }); await sleep(150); w = D.wait('match', null, 9000); D.send({ t: 'party_start', kind: 'ranked', mode: 'bounty' });
  const mt = await w; ok(mt && mt.mode === 'bounty', 'accès anticipé : le développeur lance une partie classée');
  const mm = [...S.matches.values()].find((x) => x.id === mt.id); ok(mm && mm.ranked, 'la partie est marquée « classée » côté serveur');
  await sleep(500); const meIdx = mt.you, team = mm.M.ents[meIdx].team;
  w = D.wait('end', null, 12000); mm.M.state = 'play'; mm.M.left = 0.05; mm.M.score = team === 0 ? [5, 0] : [0, 5]; mm.M.bounty = mm.M.score;
  m = await w; ok(m.ranked && typeof m.ranked.delta === 'number' && m.delta === 0, 'fin de partie classée : ELO ' + (m.ranked.delta >= 0 ? '+' : '') + m.ranked.delta + ' → ' + m.ranked.elo + ' (' + (m.ranked.rank && m.ranked.rank.name) + '), trophées inchangés');
  await sleep(400); w = D.wait('ranked'); D.send({ t: 'ranked_info' }); const ri = await w;
  ok(ri.games === 1 && ri.hist.length === 1 && ri.elo === m.ranked.elo && ri.top.length >= 1, 'historique classé + classement enregistrés en base');
  // --- classé 1 contre 1 (duel)
  await sleep(6500); w = D.wait('match', null, 9000); D.send({ t: 'party_start', kind: 'ranked', mode: 'duel' });
  const md1 = await w.catch(() => null); const mmd = md1 && [...S.matches.values()].find((x) => x.id === md1.id);
  ok(md1 && md1.mode === 'duel' && md1.roster.length === 2 && mmd && mmd.ranked, 'classé 1 contre 1 : duel classé (ELO) contre un adversaire');
  if (mmd) { w = D.wait('error'); D.send({ t: 'match_leave' }); ok((await w).code === 'no_quit', 'duel classé : impossible de quitter (seul le duel entre amis le permet)'); mmd.M.state = 'end'; }
  // --- cadeaux
  w = A.wait('error'); A.send({ t: 'dev_gift', handle: bh, brawler: 'yeti' }); ok((await w).code === 'forbidden', 'cadeau refusé à un joueur ordinaire');
  wb = B.wait('gift'); w = D.wait('toast'); D.send({ t: 'dev_gift', handle: bh, brawler: 'yeti' }); const g = await wb; await w;
  ok(g.brawler === 'yeti' && g.from === 'DevBoss', 'Bob (en ligne) reçoit immédiatement le brawler offert');
  B.send({ t: 'gift_ack', id: g.id }); await sleep(250); const gr = await svc('/rest/v1/gifts?id=eq.' + g.id); ok(gr[0].claimed === true, 'cadeau marqué « reçu » en base');
  await svc('/rest/v1/profiles?id=eq.' + B.me.uid, { method: 'PATCH', body: { save: { unlocked: ['sherry', 'rex', 'yeti'] } } });
  w = D.wait('error'); D.send({ t: 'dev_gift', handle: bh, brawler: 'yeti' }); ok((await w).code === 'dev_owned', 'cadeau refusé si le joueur possède déjà le brawler');
  A.ws.close(); await sleep(200); w = D.wait('toast'); D.send({ t: 'dev_gift', handle: 'PHENIXDORE', brawler: 'luna' }); await w;
  await A.open(url); const wg = A.wait('gift'); A.send({ t: 'auth', token: tok.al }); ok((await wg).brawler === 'luna', 'joueur hors ligne : le cadeau arrive à la reconnexion');
  // --- classement mondial : vrais comptes de la base, mon rang, persistant
  await svc('/rest/v1/profiles?id=eq.' + A.me.uid, { method: 'PATCH', body: { trophies: 900 } });
  await svc('/rest/v1/profiles?id=eq.' + B.me.uid, { method: 'PATCH', body: { trophies: 450 } });
  await svc('/rest/v1/profiles?id=eq.' + D.me.uid, { method: 'PATCH', body: { trophies: 120 } });
  w = B.wait('lb'); B.send({ t: 'lb', fresh: 1 }); m = await w;
  ok(m.src === 'db' && m.top[0].trophies === 900 && m.top[0].trophies === 900 && m.me.rank === 2 && m.top[1].me === true && m.total === 3, 'classement mondial depuis la base : ordre réel, mon rang (#' + m.me.rank + '/' + m.total + ')');
  const G0 = new Cl('Invité'); await G0.open(url); w = G0.wait('lb'); G0.send({ t: 'lb', tr: 500 }); m = await w;
  ok(m.me.guest && m.me.rank === 2 && !m.top.some((x) => x.me), 'invité : position estimée sans apparaître dans le classement');
  // --- un seul appareil par compte
  const A2 = new Cl('Alice-tel2'); await A2.open(url);
  const A1 = new Cl('Alice-tel1'); await A1.open(url);
  w = A1.wait('me'); A1.send({ t: 'auth', token: tok.al, device: 'devAAA', fresh: true }); await w;
  let kick = A1.wait('session_taken'); w = A2.wait('me'); A2.send({ t: 'auth', token: tok.al, device: 'devBBB', fresh: true }); await w;
  ok(!!(await kick.catch(() => null)), 'nouvelle connexion sur un autre appareil : l\'ancien appareil est déconnecté avec un message');
  const u = await svc('/auth/v1/admin/users/' + A.me.uid);
  ok(u && u.app_metadata && u.app_metadata.device === 'devBBB', 'appareil actif enregistré côté serveur (persistant)');
  w = A1.wait('session_taken'); A1.send({ t: 'auth', token: tok.al, device: 'devAAA' }); ok(!!(await w.catch(() => null)), 'l\'ancien appareil ne peut pas reprendre la session sans se reconnecter');
  w = A1.wait('error'); A1.send({ t: 'fr_list' }); ok((await w).code === 'login', 'ancien appareil : plus aucun accès au compte');
  w = A2.wait('fr'); A2.send({ t: 'fr_list' }); ok(!!(await w.catch(() => null)), 'le nouvel appareil garde l\'accès');
  // --- outils développeur (serveur)
  w = A2.wait('error'); A2.send({ t: 'dv_state' }); ok((await w).code === 'forbidden', 'menu développeur serveur refusé aux joueurs');
  w = D.wait('dv_state'); D.send({ t: 'dv_cfg', cfg: { afkSec: 30, reconnectSec: 120 } }); m = await w;
  ok(m.cfg.afkSec === 30 && m.cfg.reconnectSec === 120 && S.CFG.afkSec === 30, 'développeur : délais d\'inactivité et de reconnexion modifiés en direct');
  const cfgRow = await svc('/rest/v1/game_config?key=eq.live_cfg'); ok(cfgRow[0] && cfgRow[0].value.afkSec === 30, 'paramètres en direct enregistrés (survivent au redémarrage)');
  w = D.wait('dv_state'); D.send({ t: 'dv_sim', act: 'join' }); m = await w; await sleep(100);
  ok(m.fakes.length === 1 && D.last('party').party.members.length === 2 && D.last('party').party.members[1].test, 'joueur de test simulé dans l\'équipe (jamais enregistré dans la base)');
  w = D.wait('invited'); D.send({ t: 'dv_sim', act: 'invite' }); m = await w; ok(m.test && /^[A-Z0-9]{5}$/.test(m.code), 'invitation simulée reçue');
  D.send({ t: 'party_join', code: m.code }); await sleep(250); ok(D.last('party').party.leader !== D.pid, 'en rejoignant : l\'inviteur reste le chef');
  w = D.wait('dv_state'); D.send({ t: 'dv_sim', act: 'clear' }); m = await w; ok(!m.fakes.length, 'joueurs de test supprimés');
  w = D.wait('toast'); D.send({ t: 'dev_grant', handle: B.me.handle }); await w; w = B.wait('me'); B.send({ t: 'me' }); m = await w;
  ok(m.dev === true && !m.superDev, 'le développeur principal autorise un autre compte');
  w = B.wait('error'); B.send({ t: 'dev_grant', handle: D.me.handle }); ok((await w).code === 'forbidden', 'un compte autorisé ne peut pas en autoriser d\'autres');
  w = D.wait('toast'); D.send({ t: 'dev_grant', handle: B.me.handle, revoke: true }); await w; await sleep(150); ok(B.last('me').dev === false, 'accès développeur retiré');
  // ===================== MODE DÉVELOPPEUR (serveur) =====================
  w = B.wait('error'); B.send({ t: 'dv_dash' }); ok((await w).code === 'forbidden', 'joueur normal : tableau de bord refusé par le serveur');
  w = B.wait('error'); B.send({ t: 'dv_cheats', cheats: { god: true } }); ok((await w).code === 'forbidden', 'joueur normal : triches refusées par le serveur (même en envoyant la commande)');
  w = D.wait('dv_dash'); D.send({ t: 'dv_dash' }); m = await w;
  ok(m.players.online >= 3 && typeof m.server.tickAvg === 'number' && m.services.db === 'ok' && Array.isArray(m.activity) && m.activity.length > 0, 'tableau de bord : données réelles du serveur (' + m.players.online + ' en ligne, base ' + m.services.db + ', ' + m.activity.length + ' activités)');
  // droits séparés : Bob reçoit seulement « observer »
  w = D.wait('toast'); D.send({ t: 'dev_grant', handle: B.me.handle, roles: ['observe'] }); await w; await sleep(200);
  w = B.wait('dv_dash'); B.send({ t: 'dv_dash' }); ok(!!(await w.catch(() => null)), 'droit « observer » : tableau de bord accessible');
  w = B.wait('error'); B.send({ t: 'dv_kick', pid: A2.pid }); ok((await w).code === 'forbidden', 'droit « observer » seul : déconnecter un joueur est refusé (droit « administrer » requis)');
  w = B.wait('error'); B.send({ t: 'dv_lab', mode: 'bounty' }); ok((await w).code === 'forbidden', 'droit « observer » seul : laboratoire refusé (droit « développer » requis)');
  w = D.wait('toast'); D.send({ t: 'dev_grant', handle: B.me.handle, revoke: true }); await w; await sleep(150);
  // laboratoire + triches appliquées par le serveur
  D.send({ t: 'party_leave' }); await sleep(150);
  w = D.wait('dv_cheats'); D.send({ t: 'dv_cheats', cheats: { god: true, aim: true, dodge: true, ammo: true } }); await w;
  w = D.wait('match', (x) => !x.spectate, 9000); D.send({ t: 'dv_lab', mode: 'bounty', passiveBots: true, botLevel: 3 }); const lm = await w.catch(() => null);
  const lab = lm && S.matches.get(lm.id);
  ok(lm && lm.lab && lm.cheatsOK && lab && lab.lab, 'laboratoire : partie de test lancée (triches de test autorisées)');
  await sleep(4000);
  if (lab) { const LM = lab.M, me = LM.ents[lm.you], foe = LM.ents.find((e) => e.team !== me.team && e.alive);
    const hp0 = me.hp; me.invuln = 0; global.G.Sim.damage(LM, me, 3000, foe);
    ok(me.hp === hp0, 'triche « invincible » appliquée par le serveur dans le labo (aucun dégât)');
    foe.x = me.x; foe.y = me.y - 240; foe.hidden = false; me.ammo = 3; me.reload = 0; LM.state = 'play';
    const n0 = LM.projs.length; D.send({ t: 'input', seq: 900, mx: 0, my: 0, a: [0, 300] }); await sleep(120);
    const pj = LM.projs.slice(n0).find((p) => p.owner === me);
    ok(pj && Math.abs(Math.atan2(Math.sin(pj.ang + Math.PI / 2), Math.cos(pj.ang + Math.PI / 2))) < 0.35, 'visée auto en ligne (labo) : le serveur corrige le tir vers l\'ennemi (' + (pj ? pj.ang.toFixed(2) : '—') + ' rad, attendu −1.57)'); }
  // spectateur (2e connexion du compte développeur)
  const D2 = new Cl('Dev-obs'); await D2.open(url); w = D2.wait('me'); D2.send({ t: 'auth', token: tok.dev }); await w;
  w = D2.wait('match', (x) => x.spectate, 4000); D2.send({ t: 'dv_spectate', pid: D.pid }); const sm = await w.catch(() => null);
  ok(sm && sm.spectate && sm.id === lm.id && lab.specs.has(D2.pid), 'spectateur : la partie du joueur suivi est transmise à l\'observateur');
  ok(lab.M.ents.every((b) => b.pid !== D2.pid), 'spectateur : n\'est pas un joueur de la partie (aucune influence)');
  w = D2.wait('dv_matches'); D2.send({ t: 'dv_matches' }); m = await w; ok(m.list.some((x) => x.id === lm.id && x.lab && x.specs === 1), 'liste des parties en cours (mode, carte, joueurs, spectateurs)');
  w = D2.wait('dv_players'); D2.send({ t: 'dv_players', q: 'bob' }); m = await w; ok(m.list.some((x) => x.pid === B.pid && x.online), 'gestion des joueurs : recherche par pseudo');
  w = D2.wait('dv_player'); D2.send({ t: 'dv_player', pid: D.pid }); m = await w; const js = JSON.stringify(m);
  ok(m.p.match && m.p.match.id === lm.id && !/@|token|secret/i.test(js), 'profil joueur : partie en cours, session ; aucun e-mail ni secret exposé');
  // signalement, avertissement, journal
  B.send({ t: 'report', pid: A2.pid, why: 'insultes' }); await sleep(200);
  w = D2.wait('dv_reports'); D2.send({ t: 'dv_reports' }); m = await w; ok(m.list.some((r) => r.target === A2.pid && r.why === 'insultes'), 'signalements : reçus par l\'administration');
  w = B.wait('admin_warn'); D2.send({ t: 'dv_warn', pid: B.pid, text: 'Restez correct' }); ok((await w).text === 'Restez correct', 'avertissement envoyé au joueur');
  // arrêt de la partie de test → replay
  w = D.wait('end', null, 6000); D2.send({ t: 'dv_endmatch', id: lm.id, reason: 'test' }); const le = await w.catch(() => null);
  ok(le && le.delta === 0, 'administration : partie arrêtée (aucun trophée en jeu)');
  await sleep(300); w = D2.wait('dv_replays'); D2.send({ t: 'dv_replays', q: 'devboss' }); m = await w; const rp = m.list.find((x) => x.id === lm.id);
  ok(rp && rp.n > 20 && rp.players.length >= 2, 'replays : partie enregistrée (' + (rp ? rp.n : 0) + ' images), recherche par joueur');
  let parts = 0, frames = 0; D2.on = (x) => { if (x.t === 'dv_replay') { parts++; frames += (x.frames || []).length; } };
  w = D2.wait('dv_replay', (x) => x.last, 5000); D2.send({ t: 'dv_replay', id: lm.id }); await w.catch(() => null); D2.on = null;
  ok(rp && frames === rp.n, 'replay téléchargé en entier (' + frames + ' images en ' + parts + ' parties)');
  // triches bloquées en partie publique
  await sleep(6500); D.send({ t: 'party_leave' }); await sleep(150);
  w = D.wait('match', (x) => !x.spectate, 12000); D.send({ t: 'party_start', mode: 'gemgrab', kind: 'queue' }); const pm = await w.catch(() => null); const pub = pm && S.matches.get(pm.id);
  ok(pub && !pub.cheatsOK && !pub.M.cheats && !pm.cheatsOK, 'partie publique : triches de test bloquées côté serveur');
  if (pub) { await sleep(3600); const me = pub.M.ents[pm.you], foe = pub.M.ents.find((e) => e.team !== me.team); me.invuln = 0; const h0 = me.hp; global.G.Sim.damage(pub.M, me, 1000, foe); ok(me.hp < h0, 'partie publique : « invincible » sans effet'); pub.M.state = 'end'; }
  // déconnexion de session et sanction (journalisées)
  w = B.wait('admin_kick'); D2.send({ t: 'dv_kick', pid: B.pid, reason: 'test' }); ok(!!(await w.catch(() => null)), 'administration : session déconnectée');
  w = A2.wait('banned'); D2.send({ t: 'dv_ban', pid: A2.pid, hours: 1, reason: 'test' }); ok(!!(await w.catch(() => null)), 'administration : compte sanctionné');
  const A3 = new Cl('Alice-retour'); await A3.open(url); w = A3.wait('banned', null, 3000); A3.send({ t: 'auth', token: tok.al, device: 'devBBB' }); ok(!!(await w.catch(() => null)), 'compte sanctionné : reconnexion refusée par le serveur');
  w = D2.wait('dv_audit'); D2.send({ t: 'dv_audit' }); m = await w; ok(['Déconnexion de session', 'Sanction (1 h)', 'Arrêt de partie', 'Avertissement'].every((x) => m.list.some((e) => e.action === x)), 'journal d\'activité : chaque intervention est enregistrée (' + m.list.length + ')');
  await sleep(1800); const aud = await svc('/rest/v1/game_config?key=eq.audit'); ok(aud[0] && aud[0].value.length >= 4, 'journal enregistré dans la base');
  w = D2.wait('dv_bans'); D2.send({ t: 'dv_bans' }); m = await w; const bk = m.list[0] && m.list[0].key; w = D2.wait('dv_bans'); D2.send({ t: 'dv_unban', key: bk }); m = await w; ok(!m.list.length, 'sanction levée');
  w = D2.wait('dv_selftest', null, 30000); D2.send({ t: 'dv_selftest' }); m = await w.catch(() => null); ok(m && m.res.every((r) => r.ok), 'tests automatiques côté serveur : ' + (m ? m.res.filter((r) => r.ok).length + '/' + m.res.length + ' modes' : 'échec'));
  console.log(fails ? '\n' + fails + ' ÉCHEC(S)' : '\nTOUS LES TESTS COMPTES/SOCIAL/CLASSÉ PASSENT');
  mock.kill(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
