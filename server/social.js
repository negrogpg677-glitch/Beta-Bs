/* Brawl Rush — amis (codes), invitations d'équipe, clubs avec discussion. Persistant (clubs.json). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function (ctx) {
  const { players, clients, parties, send, err, G, DATA_DIR, markDirty } = ctx;
  const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const FILE = path.join(DATA_DIR, 'clubs.json');
  let clubs = {};
  try { clubs = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { clubs = {}; }
  let dirty = false;
  setInterval(() => { if (dirty) { dirty = false; try { fs.writeFileSync(FILE + '.tmp', JSON.stringify(clubs)); fs.renameSync(FILE + '.tmp', FILE); } catch (e) { console.error('clubs save', e.message); } } }, 5000);

  const clean = (s, n) => String(s || '').replace(/[<>&"'\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const online = (pid) => { const c = clients.get(pid); return !!(c && c.ws); };
  const status = (pid) => { const c = clients.get(pid); if (!c || !c.ws) return 'off'; if (c.match) return 'match'; if (c.party) return 'party'; return 'menu'; };
  const byCode = {};
  function ensureCode(pid) {
    const p = players[pid]; if (!p) return null;
    if (!p.friendCode) { let c; do { c = ''; for (let i = 0; i < 6; i++) c += CODE[crypto.randomInt(CODE.length)]; } while (byCode[c]); p.friendCode = c; markDirty(); }
    byCode[p.friendCode] = pid; return p.friendCode;
  }
  for (const pid in players) if (players[pid].friendCode) byCode[players[pid].friendCode] = pid;

  const friendView = (pid) => { const p = players[pid], c = clients.get(pid); return { pid, name: p.name, trophies: p.trophies, status: status(pid), party: c && c.party && status(pid) === 'party' ? c.party : null, club: p.club && clubs[p.club] ? clubs[p.club].tag : '' }; };
  function pushFriends(pid) {
    const c = clients.get(pid), p = players[pid]; if (!c || !p) return;
    send(c, { t: 'friends', code: ensureCode(pid), list: (p.friends || []).filter((f) => players[f]).map(friendView) });
  }
  function notifyPresence(pid) { // un ami change de statut : on rafraîchit les listes de ses amis connectés
    const p = players[pid]; if (!p) return;
    for (const f of p.friends || []) if (online(f)) pushFriends(f);
  }
  const clubView = (id, full) => {
    const cl = clubs[id]; if (!cl) return null;
    const mem = cl.members.filter((m) => players[m]);
    const v = { id, name: cl.name, tag: cl.tag, desc: cl.desc, owner: cl.owner, count: mem.length, trophies: mem.reduce((a, m) => a + (players[m].trophies || 0), 0) };
    if (full) { v.members = mem.map((m) => ({ pid: m, name: players[m].name, trophies: players[m].trophies, online: online(m), owner: m === cl.owner })).sort((a, b) => b.trophies - a.trophies); v.chat = cl.chat.slice(-40); }
    return v;
  };
  function pushClub(pid) { const c = clients.get(pid), p = players[pid]; if (c) send(c, { t: 'club', club: p.club && clubs[p.club] ? clubView(p.club, true) : null }); }
  function leaveClub(pid) {
    const p = players[pid], cl = p && clubs[p.club]; if (!cl) { if (p) p.club = null; return; }
    cl.members = cl.members.filter((m) => m !== pid); p.club = null; markDirty();
    if (!cl.members.length) delete clubs[p.club || ''];
    else if (cl.owner === pid) cl.owner = cl.members[0];
    dirty = true; for (const m of cl.members) if (online(m)) pushClub(m);
    for (const id in clubs) if (!clubs[id].members.length) delete clubs[id];
  }

  /* point d'entrée : renvoie true si le message a été traité */
  function handle(c, msg) {
    const pid = c.pid, p = players[pid];
    switch (msg.t) {
      case 'friends_get': pushFriends(pid); return true;
      case 'profile_get': { // fiche publique d'un joueur (par code d'ami, ou par identifiant pour ses propres amis)
        const tp = msg.code ? byCode[String(msg.code).toUpperCase()] : (msg.pid && ((p.friends || []).includes(msg.pid) || msg.pid === pid) ? msg.pid : null);
        const q = tp && players[tp], cc = tp && clients.get(tp);
        send(c, { t: 'profile_card', ref: msg.code || msg.pid || '', card: q ? { name: q.name, trophies: q.trophies || 0, club: q.club && clubs[q.club] ? clubs[q.club].tag : '', status: status(tp), code: ensureCode(tp), pid: (p.friends || []).includes(tp) ? tp : null, friend: (p.friends || []).includes(tp), me: tp === pid, brawler: (cc && cc.brawler) || 'sherry', skin: (cc && cc.skin) || 'classic', level: (cc && cc.level) || 1 } : null });
        return true;
      }
      case 'friend_add': {
        const code = clean(msg.code, 8).toUpperCase(), fid = byCode[code];
        if (!fid || !players[fid]) { err(c, 'friend_nf', 'Code d\'ami introuvable.'); return true; }
        if (fid === pid) { err(c, 'friend_self', 'C\'est votre propre code !'); return true; }
        p.friends = p.friends || []; players[fid].friends = players[fid].friends || [];
        if (p.friends.length >= 100) { err(c, 'friend_full', 'Liste d\'amis pleine.'); return true; }
        if (!p.friends.includes(fid)) p.friends.push(fid);
        if (!players[fid].friends.includes(pid)) players[fid].friends.push(pid);
        markDirty(); pushFriends(pid); if (online(fid)) { pushFriends(fid); send(clients.get(fid), { t: 'toast', msg: p.name + ' vous a ajouté en ami !' }); }
        send(c, { t: 'toast', msg: players[fid].name + ' est maintenant votre ami !' });
        return true;
      }
      case 'friend_remove': {
        const fid = msg.pid; p.friends = (p.friends || []).filter((f) => f !== fid);
        if (players[fid]) players[fid].friends = (players[fid].friends || []).filter((f) => f !== pid);
        markDirty(); pushFriends(pid); if (online(fid)) pushFriends(fid); return true;
      }
      case 'invite': {
        const fid = msg.pid, tc0 = clients.get(fid); if (!(p.friends || []).includes(fid) && !(c.friendUids && tc0 && tc0.uid && c.friendUids.has(tc0.uid))) return true;
        const target = clients.get(fid); if (!target || !target.ws) { err(c, 'offline', 'Cet ami est hors ligne.'); return true; }
        let party = parties.get(c.party);
        if (!party) party = ctx.createParty(c, msg.mode || 'gemgrab');
        c.lastInvite = Date.now();
        send(target, { t: 'invited', from: p.name, fromPid: pid, trophies: c.trophies || p.trophies || 0, brawler: c.brawler || 'sherry', skin: c.skin || 'classic', code: party.code, mode: party.mode });
        send(c, { t: 'invite_sent', pid: fid, name: players[fid].name });
        return true;
      }
      case 'invite_cancel': { // l'expéditeur annule : la fenêtre se ferme chez l'invité
        const t2 = clients.get(msg.pid); if (t2 && ((p.friends || []).includes(msg.pid) || (c.friendUids && t2.uid && c.friendUids.has(t2.uid)))) send(t2, { t: 'invite_cancelled', from: pid });
        return true;
      }
      case 'invite_decline': { // l'invité refuse : l'expéditeur voit « Refusée »
        const t2 = clients.get(msg.pid); if (t2) send(t2, { t: 'invite_declined', pid, name: p.name });
        return true;
      }
      case 'party_chat': { // chat d'équipe en temps réel (texte nettoyé, limité en fréquence, 20 derniers messages conservés)
        const party = parties.get(c.party); if (!party) return true;
        const now = Date.now(); if (now - (c.lastPChat || 0) < 600) return true; c.lastPChat = now; // compteur distinct du chat de club
        const text = String(msg.text || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 140); if (!text) return true;
        const m = { pid, name: p.name, text, ts: now, q: msg.q ? 1 : 0 };
        (party.chat = party.chat || []).push(m); if (party.chat.length > 30) party.chat.shift();
        for (const mem of party.members) { const cl = clients.get(mem); if (cl) send(cl, Object.assign({ t: 'party_chat' }, m)); }
        return true;
      }
      case 'club_list': {
        const list = Object.keys(clubs).map((id) => clubView(id, false)).filter((v) => v && v.count < 30).sort((a, b) => b.trophies - a.trophies).slice(0, 30);
        send(c, { t: 'club_list', list }); return true;
      }
      case 'club_get': pushClub(pid); return true;
      case 'club_create': {
        if (p.club) { err(c, 'club_in', 'Vous êtes déjà dans un club.'); return true; }
        const name = clean(msg.name, 18), tag = clean(msg.tag, 4).toUpperCase() || name.slice(0, 3).toUpperCase();
        if (name.length < 3) { err(c, 'club_name', 'Nom de club trop court (3 caractères min).'); return true; }
        if (Object.values(clubs).some((x) => x.name.toLowerCase() === name.toLowerCase())) { err(c, 'club_dup', 'Ce nom de club existe déjà.'); return true; }
        const id = crypto.randomBytes(4).toString('hex');
        clubs[id] = { name, tag, desc: clean(msg.desc, 60), owner: pid, members: [pid], chat: [], created: Date.now() };
        p.club = id; markDirty(); dirty = true; pushClub(pid); pushFriends(pid); return true;
      }
      case 'club_join': {
        const cl = clubs[msg.id]; if (!cl) { err(c, 'club_nf', 'Club introuvable.'); return true; }
        if (p.club) { err(c, 'club_in', 'Quittez d\'abord votre club.'); return true; }
        if (cl.members.length >= 30) { err(c, 'club_full', 'Ce club est complet.'); return true; }
        cl.members.push(pid); p.club = msg.id; markDirty(); dirty = true;
        cl.chat.push({ sys: 1, txt: p.name + ' a rejoint le club', ts: Date.now() });
        for (const m of cl.members) if (online(m)) pushClub(m);
        return true;
      }
      case 'club_leave': leaveClub(pid); pushClub(pid); return true;
      case 'club_chat': {
        const cl = clubs[p.club]; if (!cl) return true;
        const txt = clean(msg.txt, 120); if (!txt) return true;
        const now = Date.now(); if (c.lastChat && now - c.lastChat < 600) return true; c.lastChat = now; // anti-spam
        const m = { pid, name: p.name, txt, ts: now }; cl.chat.push(m); if (cl.chat.length > 80) cl.chat.shift(); dirty = true;
        for (const id of cl.members) if (online(id)) send(clients.get(id), { t: 'club_msg', msg: m });
        return true;
      }
    }
    return false;
  }
  return { handle, ensureCode, pushFriends, pushClub, notifyPresence, clubView: (pid) => (players[pid] && players[pid].club ? clubView(players[pid].club, false) : null) };
};
