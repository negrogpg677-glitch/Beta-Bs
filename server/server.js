/* Brawl Rush — serveur multijoueur autoritatif.
   Le serveur exécute LA MÊME simulation que le jeu (app/src/main/assets/www/js/game.js) :
   les clients n'envoient que leurs commandes (déplacement, tir, super), le serveur calcule tout
   (déplacements, projectiles, dégâts, éliminations) et diffuse l'état à 20 Hz.            */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

/* ---------- chargement de la simulation partagée ---------- */
const WWW = process.env.WWW_DIR || path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
global.window = global;
global.G = {};
for (const f of ['util', 'data', 'maps', 'game', 'ai']) require(path.join(WWW, 'js', f + '.js'));
const G = global.G;
const Sim = G.Sim;

const PORT = +process.env.PORT || 8080;
const FILL_WAIT = (+process.env.FILL_WAIT || 12) * 1000; // attente avant de compléter avec des bots étiquetés
const LOBBY_SECS = 4;
// paramètres en direct (modifiables depuis le menu développeur, enregistrés dans la base si elle est configurée)
const CFG = { afkSec: +process.env.AFK_SEC || 45, reconnectSec: +process.env.RECONNECT_SEC || 90 }; // AFK_SEC : tests uniquement
const CFG_LIM = { afkSec: [10, 600], reconnectSec: [15, 900] };
function setCfg(o) { for (const k in CFG_LIM) if (o && isFinite(+o[k])) CFG[k] = Math.round(Math.min(CFG_LIM[k][1], Math.max(CFG_LIM[k][0], +o[k]))); return CFG; }
const RECON = () => CFG.reconnectSec * 1000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PROTOCOL = 2; // 2 = cartes verticales (v3.7)

/* ---------- persistance (profils + classement) ---------- */
let players = {};
const DB = path.join(DATA_DIR, 'players.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); players = JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) { players = {}; }
let dirty = false;
setInterval(() => { if (dirty) { dirty = false; try { fs.writeFileSync(DB + '.tmp', JSON.stringify(players)); fs.renameSync(DB + '.tmp', DB); } catch (e) { console.error('save', e.message); } } }, 5000);
const rid = (n) => crypto.randomBytes(n).toString('hex');
const cleanName = (s) => String(s || 'Joueur').replace(/[<>&"'\\]/g, '').trim().slice(0, 14) || 'Joueur';

/* ---------- état ---------- */
const clients = new Map(); // pid -> client
const parties = new Map(); // code -> party
const queues = {}; // mode -> [ticket]
const matches = new Map(); // id -> match
for (const m of G.MODE_ORDER) queues[m] = [];

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!parties.has(c)) return c;
  }
}
const send = (c, msg) => { if (c && c.ws && c.ws.readyState === 1) { try { c.ws.send(JSON.stringify(msg)); } catch (e) { /* ignore */ } } };
const err = (c, code, msg) => send(c, { t: 'error', code, msg });
const markDirty = () => { dirty = true; };
let social = null; // initialisé plus bas (a besoin de createParty)

/* ---------- équipes (parties) ---------- */
function partyView(p) {
  return {
    code: p.code, leader: p.leader, mode: p.mode, fmt: p.fmt || 3, map: p.map || null, state: p.state, max: p.max, chat: (p.chat || []).slice(-20),
    members: p.members.map((m) => { const c = clients.get(m); return { pid: m, name: c.name, brawler: c.brawler, skin: c.skin, level: c.level, trophies: c.trophies, ready: !!c.ready, online: !!c.ws || !!c.test, test: !!c.test }; }),
  };
}
function pushParty(p) { const v = { t: 'party', party: partyView(p) }; for (const m of p.members) send(clients.get(m), v); }
function createParty(c, mode) {
  if (c.party) leaveParty(c);
  const p = { code: newCode(), leader: c.pid, mode: G.MODES[mode] ? mode : 'gemgrab', state: 'idle', members: [c.pid], max: 6, created: Date.now() };
  parties.set(p.code, p); c.party = p.code; c.ready = false;
  pushParty(p); return p;
}
function leaveParty(c) {
  const p = parties.get(c.party);
  c.party = null; c.ready = false;
  if (!p) { send(c, { t: 'party', party: null }); return; }
  removeTicket(p);
  p.members = p.members.filter((m) => m !== c.pid);
  send(c, { t: 'party', party: null });
  if (!p.members.length) { parties.delete(p.code); return; }
  if (p.leader === c.pid) p.leader = p.members[0];
  if (p.state === 'queue') { p.state = 'idle'; }
  pushParty(p);
}
function removeTicket(p) { for (const m in queues) queues[m] = queues[m].filter((t) => t.party !== p.code); if (p.state === 'queue') { p.state = 'idle'; } }

/* ---------- social : amis, invitations, clubs ---------- */
social = require('./social.js')({ players, clients, parties, send, err, G, DATA_DIR, markDirty, createParty });
const acc = require('./accounts.js')({ clients, send, err, G });
acc.cfgLoad('live_cfg').then((v) => { if (v) setCfg(v); }).catch(() => {});

/* ---------- matchmaking ---------- */
function enqueue(p, ranked) {
  const mode = G.MODES[p.mode];
  if (ranked) {
    if (p.members.length > (mode.per || 3)) return mode.per === 1 ? 'Le duel classé se joue seul.' : 'Maximum 3 joueurs par équipe en classé.';
    const elo = Math.round(p.members.reduce((s, pid) => s + ((clients.get(pid) || {}).elo || 1000), 0) / p.members.length);
    p.state = 'queue'; const k = 'R:' + p.mode; (queues[k] = queues[k] || []).push({ party: p.code, since: Date.now(), elo });
    for (const m of p.members) send(clients.get(m), { t: 'queue', mode: p.mode, state: 'searching', ranked: true });
    pushParty(p); return null;
  }
  const fmt = mode.per === 3 && p.fmt === 2 ? 2 : 0, PER = fmt || mode.per || 3; // format 2 contre 2 (file séparée)
  if (mode.id !== 'showdown' && mode.id !== 'boss' && p.members.length > PER) return fmt ? 'Maximum 2 joueurs par équipe en 2 contre 2.' : mode.per === 1 ? 'Le duel se joue seul : utilisez « Défier » pour affronter un ami.' : 'Maximum 3 joueurs par équipe pour ce mode.';
  p.state = 'queue';
  const qk = fmt ? p.mode + '@2' : p.mode; (queues[qk] = queues[qk] || []).push({ party: p.code, since: Date.now() });
  for (const m of p.members) send(clients.get(m), { t: 'queue', mode: p.mode, state: 'searching' });
  pushParty(p);
  return null;
}
function runMatchmaker() {
  const now = Date.now();
  for (const qk in queues) {
    const q = queues[qk];
    if (!q.length) continue;
    if (qk.startsWith('R:')) { rankedMatch(qk, now); continue; }
    const [modeId, fmtS] = qk.split('@'), mode = G.MODES[modeId], fmt = +fmtS || 0;
    const tickets = q.map((t) => ({ t, p: parties.get(t.party) })).filter((x) => x.p && x.p.state === 'queue');
    queues[qk] = tickets.map((x) => x.t);
    if (!tickets.length) continue;
    const oldest = now - tickets[0].t.since;
    if (mode.id === 'showdown') {
      const picked = []; let n = 0;
      for (const x of tickets) { if (n + x.p.members.length <= 10) { picked.push(x); n += x.p.members.length; } }
      if (n >= 10 || (oldest >= FILL_WAIT + 3000 && n >= 1)) {
        const roster = [];
        picked.forEach((x) => x.p.members.forEach((pid) => roster.push({ pid, team: roster.length })));
        launchLobby(modeId, roster, picked.map((x) => x.p));
      }
    } else if (mode.id === 'boss') { // coopératif : tous dans la même équipe contre le boss
      const team = [], used = [];
      for (const x of tickets) { if (team.length + x.p.members.length <= 3) { x.p.members.forEach((pid) => team.push(pid)); used.push(x.p); } }
      if (team.length >= 3 || (oldest >= FILL_WAIT && team.length >= 1)) launchLobby(modeId, team.map((pid) => ({ pid, team: 0 })), used);
    } else {
      const teams = [[], []], used = [], PER = fmt || mode.per || 3;
      for (const x of tickets) {
        const sz = x.p.members.length;
        const ti = teams[0].length <= teams[1].length ? (teams[0].length + sz <= PER ? 0 : teams[1].length + sz <= PER ? 1 : -1) : (teams[1].length + sz <= PER ? 1 : teams[0].length + sz <= PER ? 0 : -1);
        if (ti >= 0) { x.p.members.forEach((pid) => teams[ti].push(pid)); used.push(x.p); }
      }
      const total = teams[0].length + teams[1].length;
      if (total >= PER * 2 || (oldest >= FILL_WAIT && total >= 1)) {
        const roster = []; teams.forEach((tm, ti) => tm.forEach((pid) => roster.push({ pid, team: ti })));
        launchLobby(modeId, roster, used, false, fmt);
      }
    }
  }
}
// classé : on regroupe les joueurs d'ELO proche (fenêtre qui s'élargit avec l'attente), puis on complète avec des bots
function rankedMatch(qk, now) {
  const modeId = qk.slice(2);
  const tickets = queues[qk].map((t) => ({ t, p: parties.get(t.party) })).filter((x) => x.p && x.p.state === 'queue');
  queues[qk] = tickets.map((x) => x.t); if (!tickets.length) return;
  const first = tickets[0], wait = (now - first.t.since) / 1000, win = 150 + wait * 15;
  const pool = tickets.filter((x) => Math.abs(x.t.elo - first.t.elo) <= win);
  const teams = [[], []], used = [], PER = (G.MODES[modeId] || {}).per || 3;
  for (const x of pool) {
    const sz = x.p.members.length, ti = teams[0].length + sz <= PER && teams[0].length <= teams[1].length ? 0 : teams[1].length + sz <= PER ? 1 : teams[0].length + sz <= PER ? 0 : -1;
    if (ti >= 0) { x.p.members.forEach((pid) => teams[ti].push(pid)); used.push(x.p); }
  }
  const total = teams[0].length + teams[1].length;
  if (total >= PER * 2 || (wait * 1000 >= FILL_WAIT * 1.5 && total >= 1)) {
    const roster = []; teams.forEach((tm, ti) => tm.forEach((pid) => roster.push({ pid, team: ti })));
    launchLobby(modeId, roster, used, true);
  }
}
setInterval(runMatchmaker, 700);

/* ---------- salle d'attente puis match ---------- */
function launchLobby(modeId, roster, usedParties, ranked, per) {
  for (const p of usedParties) { removeTicket(p); p.state = 'lobby'; pushParty(p); }
  const id = rid(4);
  const mode = G.MODES[modeId];
  const pm = usedParties[0] && usedParties[0].map, mapKey = pm && mode.maps.includes(pm) ? pm : G.pick(mode.maps); // arène choisie par le chef (duel)
  const seed = mode.id === 'showdown' ? crypto.randomInt(1, 99999) : G.MAPS[mapKey].seed;
  const slots = roster.map((r) => {
    const c = clients.get(r.pid);
    return { pid: r.pid, name: c.name, brawler: c.brawler, skin: c.skin, level: c.level, team: r.team, trophies: c.trophies };
  });
  const m = { id, ranked: !!ranked, mode: modeId, mapKey, seed, slots, parties: usedParties.map((p) => p.code), per: per || 0, state: 'lobby', M: null, startAt: Date.now() + LOBBY_SECS * 1000, lastT: 0, tick: 0, ended: false };
  matches.set(id, m);
  // aperçu de la composition (les bots sont ajoutés au démarrage et étiquetés)
  const preview = { t: 'lobby', id, mode: modeId, mapName: G.MAPS[mapKey].name, secs: LOBBY_SECS, slots: slots.map((s) => ({ name: s.name, brawler: s.brawler, skin: s.skin, team: s.team, bot: false })), need: modeId === 'showdown' ? 10 : modeId === 'boss' ? 3 : (per || mode.per || 3) * 2 };
  for (const s of slots) { const c = clients.get(s.pid); c.match = id; send(c, preview); }
  setTimeout(() => startMatch(m), LOBBY_SECS * 1000);
}
function startMatch(m) {
  if (m.state !== 'lobby') return;
  m.slots = m.slots.filter((s) => clients.get(s.pid) && clients.get(s.pid).match === m.id);
  if (!m.slots.length) { matches.delete(m.id); return; }
  m.event = G.todayEvent(new Date()).id;
  m.M = Sim.createOnline({ mode: m.mode, mapKey: m.mapKey, seed: m.seed, players: m.slots, event: m.event, per: m.per || undefined });
  m.state = 'play'; m.lastT = process.hrtime.bigint();
  m.M.ents.forEach((b) => { if (b.pid) { const c = clients.get(b.pid); c.ent = b.idx; c.away = false; b.isPlayer = !!c.ws; b.disc = c.ws ? 0 : Date.now(); b.lastAct = Date.now(); } });
  for (const pc of m.parties) { const p = parties.get(pc); if (p) { p.state = 'match'; pushParty(p); } }
  for (const b of m.M.ents) if (b.pid) sendInit(clients.get(b.pid), m);
}
function rosterOf(m) {
  return m.M.ents.map((b) => ({ idx: b.idx, name: b.name, brawler: b.id, skin: b.skin, level: b.level, team: b.team, bot: !!b.isBot, pid: b.pid ? true : false, code: b.pid ? ((clients.get(b.pid) || {}).handle || (social ? social.ensureCode(b.pid) : null)) : null, test: !!(b.pid && (clients.get(b.pid) || {}).test) }));
}
function sendInit(c, m) {
  const M = m.M;
  send(c, { t: 'match', id: m.id, mode: m.mode, mapKey: m.mapKey, seed: m.seed, roster: rosterOf(m), event: m.event, you: c.ent, tiles: Buffer.from(M.map.tiles).toString('base64'), proto: PROTOCOL });
}

setInterval(() => {
  const nowN = process.hrtime.bigint();
  for (const m of matches.values()) {
    if (m.state !== 'play') continue;
    const M = m.M;
    let dt = Number(nowN - m.lastT) / 1e9; m.lastT = nowN;
    dt = Math.min(dt, 0.1);
    try {
      while (dt > 0) { const step = Math.min(dt, 0.033); Sim.update(M, step); dt -= step; }
      m.tick++;
      // reprise automatique des joueurs déconnectés par l'IA ; libération du slot après le délai
      if (m.tick % 2 === 0) {
        const snap = Sim.snapshot(M); snap.ev = Sim.flushEvents(M); snap.t = 'snap'; snap.n = m.tick;
        const raw = JSON.stringify(snap);
        for (const b of M.ents) { if (b.pid) { const c = clients.get(b.pid); if (c && c.ws && c.ws.readyState === 1 && c.match === m.id && !c.away) { try { c.ws.send(raw); } catch (e) { /* ignore */ } } } }
      }
      if (M.state === 'end' && !m.ended) endMatch(m);
    } catch (e) { console.error('match error', m.id, e.stack); m.state = 'dead'; endMatch(m, true); }
  }
}, 1000 / 60);

function endMatch(m, crashed) {
  m.ended = true; m.state = 'over';
  const M = m.M, r = M.result || { winnerTeam: -1, draw: true };
  if (m.ranked && !crashed) acc.rankedEnd(m, M, r).then((rk) => sendEnds(m, M, r, crashed, rk)).catch(() => sendEnds(m, M, r, crashed, {}));
  else sendEnds(m, M, r, crashed, {});
}
function sendEnds(m, M, r, crashed, rk) {
  for (const b of M.ents) {
    if (!b.pid) continue;
    const c = clients.get(b.pid); if (!c) continue;
    const pl = players[b.pid]; if (!pl) continue; // joueur de test (menu développeur) : rien n'est enregistré
    const showdown = M.mode === 'showdown';
    const place = b.place || (r.places ? r.places[b.idx] : 0) || 10;
    const win = showdown ? place === 1 : !r.draw && r.winnerTeam === b.team;
    let delta = 0, coins;
    if (showdown) { delta = [10, 8, 6, 4, 2, 0, -1, -2, -3, -4][Math.min(10, place) - 1]; coins = [95, 75, 60, 48, 38, 30, 24, 18, 14, 10][Math.min(10, place) - 1]; }
    else if (win) { delta = 8; coins = 60; } else if (r.draw) { delta = 0; coins = 28; } else { delta = -Math.min(pl.trophies, G.clamp(Math.round(2 + pl.trophies / 70), 2, 8)); coins = 22; }
    if (crashed) { delta = 0; coins = 0; }
    if (m.ranked) delta = 0; // en classé : l'ELO remplace les trophées
    coins += b.kills * 4;
    pl.trophies = Math.max(0, pl.trophies + delta); pl.matches++; if (win) pl.wins++; pl.kills += b.kills; dirty = true;
    c.trophies = pl.trophies;
    c.lastEnd = { t: 'end', id: m.id, win, draw: !!r.draw, place, delta, coins, online: pl.trophies, kills: b.kills, damage: Math.round(b.st.damage), stats: b.st, crashed: !!crashed, ranked: rk[b.pid] || (m.ranked ? { delta: 0 } : undefined) };
    send(c, c.lastEnd);
  }
  setTimeout(() => {
    for (const b of M.ents) { const c = b.pid && clients.get(b.pid); if (c && c.match === m.id) { c.match = null; c.ent = null; c.away = false; } }
    for (const pc of m.parties) { const p = parties.get(pc); if (p) { p.state = 'idle'; for (const pid of p.members) { const c = clients.get(pid); if (c) c.ready = false; } pushParty(p); } }
    matches.delete(m.id);
  }, 6000);
}

function forfeit(m, loserTeam) { if (!m.M || m.M.state === 'end') return; Sim.finish(m.M, loserTeam === 0 ? 1 : 0); m.M.result.forfeit = true; }
function resumable(m) { return { t: 'resumable', id: m.id, mode: m.mode, mapName: G.MAPS[m.mapKey] ? G.MAPS[m.mapKey].name : '', reconnectSec: CFG.reconnectSec, afkSec: CFG.afkSec }; }

/* ---------- connexions ---------- */
function onMessage(c, raw) {
  c.msgs = (c.msgs || 0) + 1;
  let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
  if (!msg || typeof msg.t !== 'string') return;
  if (social.handle(c, msg)) return;
  if (acc.handle(c, msg)) return;
  if (devsrv.handle(c, msg)) return;
  if (c.v < 3 && (msg.t === 'party_start' || msg.t === 'resume' || msg.t === 'party_join')) return err(c, 'update', 'Nouvelle version de Brawl Rush disponible : mettez le jeu à jour pour jouer en ligne.');
  switch (msg.t) {
    case 'ping': send(c, { t: 'pong', ts: msg.ts }); break;
    case 'input': {
      const m = c.match && matches.get(c.match);
      if (!m || m.state !== 'play') return;
      if (c.away) return; // sorti de la partie (inactif) : il doit d'abord la reprendre
      const b = m.M.ents[c.ent]; if (!b || !b.alive) return;
      const mx = +msg.mx || 0, my = +msg.my || 0, l = Math.hypot(mx, my);
      if (l > 0.08 || msg.a || msg.s || msg.gd || typeof msg.d === 'number' || typeof msg.em === 'number') b.lastAct = Date.now();
      b.input.mx = l > 1 ? mx / l : mx; b.input.my = l > 1 ? my / l : my;
      b.ack = msg.seq | 0;
      if (typeof msg.face === 'number' && isFinite(msg.face)) b.face = msg.face;
      else if (l > 0.1) b.face = Math.atan2(my, mx);
      if (typeof msg.rtt === 'number' && isFinite(msg.rtt)) b.rtt = G.clamp(msg.rtt, 0, 300);
      const comp = Math.min(0.1, (b.rtt || 0) / 2000); // compensation : la moitié du ping, 100 ms max
      if (typeof msg.d === 'number' && isFinite(msg.d)) Sim.tryDodge(m.M, b, msg.d);
      if (msg.gd) Sim.tryGadget(m.M, b);
      if (typeof msg.em === 'number' && isFinite(msg.em)) Sim.emote(m.M, b, msg.em);
      if (msg.a) { const [ang, dist] = msg.a; if (isFinite(ang) && isFinite(dist)) { const n0 = m.M.projs.length; if (Sim.tryAttack(m.M, b, ang, G.clamp(dist, 0, 900))) Sim.advanceProjs(m.M, n0, comp); } }
      if (msg.s) { const [ang, dist] = msg.s; if (isFinite(ang) && isFinite(dist)) { const n0 = m.M.projs.length; if (Sim.trySuper(m.M, b, ang, G.clamp(dist, 0, 900))) Sim.advanceProjs(m.M, n0, comp); } }
      break;
    }
    case 'profile': { // brawler choisi (niveau borné pour limiter la triche)
      if (G.BRAWLER[msg.brawler]) c.brawler = msg.brawler;
      c.skin = G.SKIN[msg.skin] ? msg.skin : 'classic';
      c.level = G.clamp(Math.round(+msg.level || 1), 1, G.MAX_LEVEL);
      if (msg.name) { c.name = cleanName(msg.name); players[c.pid].name = c.name; dirty = true; }
      const p = parties.get(c.party); if (p) pushParty(p);
      break;
    }
    case 'party_create': createParty(c, msg.mode); break;
    case 'party_join': {
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const p = parties.get(code);
      if (!p) return err(c, 'not_found', 'Code d\'équipe introuvable.');
      if (c.party === code) return pushParty(p);
      if (p.state !== 'idle') return err(c, 'busy', 'Cette équipe est déjà en recherche ou en match.');
      if (p.members.length >= (p.mode === 'duel' ? 2 : p.max)) return err(c, 'full', p.mode === 'duel' ? 'Ce duel est déjà complet.' : 'Cette équipe est complète.');
      if (c.party) leaveParty(c);
      p.members.push(c.pid); c.party = code; c.ready = false; pushParty(p);
      break;
    }
    case 'mchat': { // message en partie, envoyé aux coéquipiers
      const m = c.match && matches.get(c.match); if (!m || !m.M) break;
      const b = m.M.ents[c.ent]; if (!b) break;
      const now = Date.now(); if (now - (c.lastMChat || 0) < 1200) break; c.lastMChat = now;
      const text = String(msg.text || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 60); if (!text) break;
      for (const e of m.M.ents) { if (!e.pid || e.team !== b.team) continue; const cl = clients.get(e.pid); if (cl && cl.match === m.id) send(cl, { t: 'mchat', idx: b.idx, name: b.name, text }); }
      break;
    }
    case 'party_leave': if (c.party) leaveParty(c); break;
    case 'party_get': { const pp = parties.get(c.party); if (pp) send(c, { t: 'party', party: partyView(pp) }); break; }
    case 'party_kick': {
      const p = parties.get(c.party); if (!p || p.leader !== c.pid || p.state !== 'idle') return;
      const k = clients.get(msg.pid); if (k && k.party === p.code && k.pid !== c.pid) { leaveParty(k); send(k, { t: 'kicked' }); }
      break;
    }
    case 'party_set': {
      const p = parties.get(c.party); if (!p) return;
      if (msg.mode && G.MODES[msg.mode] && p.leader === c.pid && p.state === 'idle') { p.mode = msg.mode; p.map = null; }
      if (msg.map && p.leader === c.pid && G.MODES[p.mode].maps.includes(msg.map)) p.map = msg.map;
      if ((msg.fmt === 2 || msg.fmt === 3) && p.leader === c.pid && p.state === 'idle') p.fmt = msg.fmt;
      if (typeof msg.ready === 'boolean') c.ready = msg.ready;
      pushParty(p);
      // duel : la partie démarre toute seule quand les deux joueurs sont prêts
      if (p.mode === 'duel' && p.state === 'idle' && p.members.length === 2 && p.members.every((m) => (clients.get(m) || {}).ready)) {
        p.members.forEach((m) => { const mc = clients.get(m); if (mc) mc.ready = false; });
        launchLobby('duel', p.members.map((pid, i) => ({ pid, team: i })), [p]);
      }
      break;
    }
    case 'party_start': {
      let p = parties.get(c.party);
      if (!p) p = createParty(c, msg.mode || 'gemgrab');
      if (p.leader !== c.pid) return err(c, 'not_leader', 'Seul le chef d\'équipe peut lancer la partie.');
      if (p.state !== 'idle') return;
      if (msg.mode && G.MODES[msg.mode]) p.mode = msg.mode;
      if (msg.fmt === 2 || msg.fmt === 3) p.fmt = msg.fmt;
      if (msg.kind === 'ranked') {
        if (!acc.enabled) return err(c, 'no_db', 'Le mode classé nécessite la base de données du serveur.');
        if (p.members.some((pid) => !(clients.get(pid) || {}).uid)) return err(c, 'login', 'Tous les membres de l\'équipe doivent être connectés à un compte.');
        if (p.members.some((pid) => !acc.rankedOpen(clients.get(pid)))) return err(c, 'ranked_locked', 'Le mode classé ouvre le ' + new Date(acc.RANKED_AT).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + '.');
        if (!acc.RANKED_MODES.includes(p.mode)) p.mode = 'gemgrab';
        const e = enqueue(p, true); if (e) err(c, 'bad_party', e); break;
      }
      if (msg.kind === 'private') {
        const mode = G.MODES[p.mode], f2 = mode.per === 3 && p.fmt === 2, mem = p.members.slice(0, mode.id === 'showdown' ? 10 : f2 ? 4 : 6);
        const roster = mem.map((pid, i) => ({ pid, team: mode.id === 'showdown' ? i : mode.id === 'boss' ? 0 : (msg.split || mode.per === 1 || (f2 && mem.length > 2) ? i % 2 : 0) }));
        launchLobby(p.mode, roster, [p], false, f2 ? 2 : 0);
      } else { const e = enqueue(p); if (e) err(c, 'bad_party', e); }
      break;
    }
    case 'queue_cancel': { const p = parties.get(c.party); if (p && p.state === 'queue') { if (p.leader !== c.pid) return err(c, 'not_leader', 'Seul le chef peut annuler.'); removeTicket(p); for (const m of p.members) send(clients.get(m), { t: 'queue', state: 'cancelled' }); pushParty(p); } break; }
    case 'lobby_leave': { // quitter la salle d'attente avant le début
      const m = matches.get(c.match); if (m && m.state === 'lobby') { c.match = null; send(c, { t: 'lobby_closed' }); } break;
    }
    case 'match_leave': { // quitter volontairement : seulement en duel entre amis (abandon = défaite)
      const m = matches.get(c.match);
      if (m && m.M && m.state === 'play' && m.M.state !== 'end') {
        if (m.mode !== 'duel' || m.ranked) return err(c, 'no_quit', 'Impossible de quitter une partie en cours. Seul le duel entre amis peut être abandonné.');
        const b = m.M.ents[c.ent]; if (b) forfeit(m, b.team);
        break;
      }
      if (m && m.state === 'lobby') return err(c, 'no_quit', 'La partie va commencer.');
      c.match = null; c.ent = null; c.away = false; break;
    }
    case 'resume': { // « Reprendre la partie » : personnage, position, vie et état viennent du serveur
      const m = c.match && matches.get(c.match), b = m && m.M && m.M.ents[c.ent];
      if (m && m.state === 'play' && m.M.state !== 'end' && b && b.pid === c.pid) { c.away = false; b.isPlayer = true; b.disc = 0; b.afk = false; b.lastAct = Date.now(); sendInit(c, m); }
      else { send(c, { t: 'resume_fail', msg: 'Cette partie est terminée.' }); if (c.lastEnd) { send(c, c.lastEnd); c.lastEnd = null; } }
      break;
    }
    case 'party_promote': { // le chef passe la main à un membre
      const p = parties.get(c.party); if (!p || p.leader !== c.pid || p.state !== 'idle' || !p.members.includes(msg.pid)) return;
      p.leader = msg.pid; pushParty(p); break;
    }
    case 'lb': {
      const list = Object.entries(players).filter(([, v]) => v.matches > 0).sort((a, b) => b[1].trophies - a[1].trophies);
      const top = list.slice(0, 50).map(([pid, v], i) => ({ rank: i + 1, name: v.name, trophies: v.trophies, wins: v.wins, me: pid === c.pid }));
      const idx = list.findIndex(([pid]) => pid === c.pid);
      send(c, { t: 'lb', top, me: { rank: idx < 0 ? 0 : idx + 1, trophies: players[c.pid].trophies, wins: players[c.pid].wins, matches: players[c.pid].matches }, total: list.length });
      break;
    }
  }
}

function handshake(ws, msg) {
  let pid = msg.pid, pl = pid && players[pid];
  if (!pl || pl.token !== msg.token) { pid = rid(6); pl = players[pid] = { token: rid(12), name: cleanName(msg.name), trophies: 0, wins: 0, matches: 0, kills: 0, created: Date.now() }; dirty = true; }
  let c = clients.get(pid);
  if (c && c.ws && c.ws !== ws) { try { c.ws.close(4000, 'replaced'); } catch (e) { /* ignore */ } }
  const resumed = !!c;
  if (!c) { c = { pid, party: null, match: null, ent: null, ready: false, brawler: 'sherry', skin: 'classic', level: 1, trophies: pl.trophies }; clients.set(pid, c); }
  c.ws = ws; ws.pid = pid; c.v = msg.v | 0; c.name = pl.name; c.trophies = pl.trophies; c.lastSeen = Date.now(); c.dropAt = 0;
  if (msg.name) { c.name = pl.name = cleanName(msg.name); dirty = true; }
  send(c, { t: 'welcome', pid, token: pl.token, name: c.name, proto: PROTOCOL, trophies: pl.trophies, online: wss.clients.size, resumed, friendCode: social.ensureCode(pid), club: social.clubView(pid) });
  social.pushFriends(pid); social.pushClub(pid); social.notifyPresence(pid);
  // reprise de partie / retour dans l'équipe
  const m = c.match && matches.get(c.match);
  if (m && m.state === 'play' && m.M && m.M.ents[c.ent] && m.M.ents[c.ent].pid === pid) {
    const b = m.M.ents[c.ent];
    if (msg.inMatch === m.id && !c.away) { b.isPlayer = true; b.disc = 0; b.lastAct = Date.now(); sendInit(c, m); }
    else { c.away = true; b.isPlayer = false; if (!b.disc) b.disc = Date.now(); send(c, resumable(m)); }
  } else if (m && m.state === 'lobby') { /* le lobby continue */ } else { c.match = null; if (resumed && c.lastEnd) { send(c, c.lastEnd); c.lastEnd = null; } }
  const p = parties.get(c.party); if (p) pushParty(p); else send(c, { t: 'party', party: null });
}

const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, players: clients.size, online: wss.clients.size, matches: matches.size, parties: parties.size, proto: PROTOCOL, cfg: CFG, accounts: acc.diag() })); }
  // le jeu peut aussi être servi directement : http://serveur/ (jouable dans un navigateur)
  const rel = u === '/' ? 'index.html' : u.replace(/\.\./g, '');
  const fp = path.join(WWW, rel);
  fs.readFile(fp, (e, data) => {
    if (e) { res.writeHead(404); return res.end('Brawl Rush server'); }
    const ext = path.extname(fp);
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': mime, 'cache-control': ext === '.html' || rel === 'sw.js' ? 'no-cache' : 'public, max-age=3600' });
    res.end(data);
  });
});
const wss = new WebSocket.Server({ server, maxPayload: 8192 });
wss.on('connection', (ws) => {
  ws.alive = true; ws.isReady = false; ws.msgWin = 0;
  const hs = setTimeout(() => { if (!ws.isReady) ws.close(4001, 'no hello'); }, 8000);
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (raw) => {
    ws.alive = true;
    if (++ws.msgWin > 120) return; // limite : 120 messages / seconde
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!ws.isReady) { if (msg && msg.t === 'hello') { clearTimeout(hs); ws.isReady = true; handshake(ws, msg); } return; }
    const c = clients.get(ws.pid); if (c && c.ws === ws) onMessage(c, raw);
  });
  ws.on('close', () => {
    clearTimeout(hs);
    const c = clients.get(ws.pid);
    if (!c || c.ws !== ws) return;
    c.ws = null; c.dropAt = Date.now(); social.notifyPresence(c.pid); acc.onClose(c);
    const m = c.match && matches.get(c.match);
    if (m && m.M && m.state === 'play') { const b = m.M.ents[c.ent]; if (b) { b.isPlayer = false; b.disc = Date.now(); } }
    const p = parties.get(c.party); if (p) { if (p.state === 'queue') { /* reste en file */ } pushParty(p); }
  });
  ws.on('error', () => {});
});
setInterval(() => { // battement de cœur + nettoyage
  for (const ws of wss.clients) { ws.msgWin = 0; if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch (e) { /* ignore */ } }
  const now = Date.now();
  for (const [pid, c] of clients) {
    if (c.test) { if (now > c.expire) { if (c.party) leaveParty(c); clients.delete(pid); } continue; }
    if (!c.ws && c.dropAt && now - c.dropAt > RECON()) {
      if (c.party) leaveParty(c);
      const m = c.match && matches.get(c.match); if (m && m.M && m.M.ents[c.ent]) { m.M.ents[c.ent].disc = 1; }
      clients.delete(pid);
    }
  }
  for (const [id, m] of matches) { // inactivité (AFK) : le joueur est sorti de la partie, qui continue sur le serveur
    if (m.state !== 'play' || !m.M || m.M.state !== 'play') continue;
    for (const b of m.M.ents) {
      const c = b.pid && clients.get(b.pid); if (!c || c.match !== id || c.test) continue;
      if (!b.alive) { b.lastAct = now; continue; }
      if (c.ws && !c.away && b.isPlayer && now - (b.lastAct || now) > CFG.afkSec * 1000) {
        c.away = true; b.isPlayer = false; b.afk = true; b.disc = now;
        send(c, Object.assign(resumable(m), { t: 'afk', msg: 'Inactif depuis ' + CFG.afkSec + ' s : vous avez été retiré de la partie. Elle continue sans vous (ce n\'est pas compté comme un abandon).' }));
      }
      // duel : un joueur absent plus longtemps que le délai de reconnexion perd la partie
      if (m.mode === 'duel' && (c.away || !c.ws) && b.disc > 1 && now - b.disc > RECON()) forfeit(m, b.team);
    }
  }
  for (const [id, m] of matches) { // match sans humains connectés depuis un moment
    if (m.state !== 'play') continue;
    const any = m.M.ents.some((b) => b.pid && clients.get(b.pid) && clients.get(b.pid).ws && !clients.get(b.pid).test && clients.get(b.pid).match === id);
    m.empty = any ? 0 : (m.empty || now);
    if (m.empty && now - m.empty > RECON()) { m.state = 'dead'; matches.delete(id); }
  }
}, 1000);

const devsrv = require('./devsrv.js')({ clients, parties, matches, players, send, err, G, Sim, CFG, setCfg, acc, createParty, leaveParty, pushParty, partyView, forfeit, rid, wss, launchLobby });
if (require.main === module) server.listen(PORT, () => console.log('Brawl Rush server — port ' + PORT + ' — jeu servi depuis ' + WWW));
module.exports = { server, wss, players, parties, matches, clients, runMatchmaker, CFG, setCfg };
