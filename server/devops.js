/* Brawl Rush - MODE DÉVELOPPEUR côté serveur (opérations).
   Trois droits séparés, vérifiés ICI (jamais seulement dans l'interface) :
     observe : tableau de bord, joueurs, parties, spectateur, replays, diagnostics
     admin   : déconnecter une session, sanctionner, arrêter une partie, avertir, signalements, journal
     dev     : laboratoire de test, bots, triches de test, paramètres en direct, tests serveur
   Les triches (aimbot, esquive auto, invincible…) ne s'appliquent QUE dans les parties de test ou privées lancées par un
   développeur (m.cheatsOK) ; dans les parties publiques et classées, le serveur les ignore.
   Aucune donnée privée n'est envoyée : ni e-mail, ni jeton, ni identifiant d'appareil, ni adresse IP. */
'use strict';
module.exports = function (ctx) {
  const { clients, parties, matches, players, send, err, G, Sim, CFG, acc } = ctx;
  const T = G.T;
  const now = () => Date.now();
  const ring = (arr, x, n) => { arr.push(x); if (arr.length > n) arr.splice(0, arr.length - n); };
  const S = { boot: now(), conns: 0, started: 0, ended: 0, byMode: {}, durations: [], tick: { avg: 0, max: 0, samples: [] } };
  const activity = [], errors = [], alerts = [], sessions = [], audit = [], reports = [], replays = [];
  const hist = {}; // pid -> { matches: [], drops: [] }
  let bans = {}; // clé (uid ou pid) -> { until, reason, by, name }
  const H = (pid) => (hist[pid] = hist[pid] || { matches: [], drops: [] });
  const act = (kind, text) => ring(activity, { at: now(), kind, text }, 120);
  const alert = (level, text) => { ring(alerts, { at: now(), level, text }, 60); act('alerte', text); };
  function error(where, e) { ring(errors, { at: now(), where, msg: String((e && e.message) || e).slice(0, 200) }, 80); }
  process.on('uncaughtException', (e) => { error('serveur', e); console.error(e); });

  // persistance (table game_config) : journal, signalements, sanctions
  const loadP = async () => { try { bans = (await acc.cfgLoad('bans')) || {}; const a = await acc.cfgLoad('audit'); if (Array.isArray(a)) audit.push(...a.slice(-300)); const r = await acc.cfgLoad('reports'); if (Array.isArray(r)) reports.push(...r.slice(-200)); } catch (e) { /* base absente */ } };
  setTimeout(loadP, 900);
  let saveT = null; const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { acc.cfgSave('audit', audit.slice(-300)).catch(() => {}); acc.cfgSave('reports', reports.slice(-200)).catch(() => {}); acc.cfgSave('bans', bans).catch(() => {}); }, 1500); };
  function log(c, action, target, detail) { const e = { at: now(), by: c.name, role: rolesOf(c).join('+'), action, target: target || '', detail: detail || '' }; ring(audit, e, 300); persist(); act('admin', c.name + ' : ' + action + (target ? ' → ' + target : '')); return e; }

  /* ---------- droits ---------- */
  function rolesOf(c) { if (!c || !c.uid) return []; if (c.superDev) return ['observe', 'admin', 'dev']; return Array.isArray(c.roles) ? c.roles : c.dev ? ['observe', 'dev'] : []; }
  const can = (c, r) => rolesOf(c).includes(r);
  const NEED = {
    dv_state: 'observe', dv_dash: 'observe', dv_players: 'observe', dv_player: 'observe', dv_matches: 'observe', dv_spectate: 'observe', dv_unspectate: 'observe', dv_replays: 'observe', dv_replay: 'observe',
    dv_kick: 'admin', dv_ban: 'admin', dv_unban: 'admin', dv_endmatch: 'admin', dv_warn: 'admin', dv_reports: 'admin', dv_report_close: 'admin', dv_audit: 'admin', dv_bans: 'admin',
    dv_cfg: 'dev', dv_sim: 'dev', dv_lab: 'dev', dv_labset: 'dev', dv_cheats: 'dev', dv_selftest: 'dev',
  };

  /* ---------- vues sans données privées ---------- */
  const statusOf = (c) => (!c.ws ? 'hors ligne' : c.spec ? 'spectateur' : c.match ? (c.away ? 'absent (partie)' : 'en partie') : c.party ? 'en groupe' : 'en ligne');
  const pubP = (c) => ({ pid: c.pid, name: c.name, handle: c.handle || '', account: !!c.uid, test: !!c.test, status: statusOf(c), online: !!c.ws, party: c.party || null, match: c.match || null, ping: c.ping || 0, plat: c.plat || '?', since: c.since || 0, roles: rolesOf(c).length ? rolesOf(c) : undefined });
  function matchView(m) {
    const M = m.M;
    return { id: m.id, mode: m.mode, map: G.MAPS[m.mapKey] ? G.MAPS[m.mapKey].name : m.mapKey, mapKey: m.mapKey, state: m.state, ranked: !!m.ranked, lab: !!m.lab, private: !!m.priv, cheats: !!m.cheatsOK,
      t: M ? Math.round(M.t) : 0, score: M && M.score ? M.score : null, specs: m.specs ? m.specs.size : 0,
      players: M ? M.ents.map((b) => ({ idx: b.idx, name: b.name, team: b.team, brawler: b.id, bot: !!b.isBot || !b.pid, test: !!(b.pid && (clients.get(b.pid) || {}).test), alive: !!b.alive, kills: b.kills, hp: Math.round(b.hp), pid: b.pid || null })) :
        m.slots.map((s) => ({ name: s.name, team: s.team, brawler: s.brawler, bot: false, pid: s.pid })) };
  }

  /* ---------- tableau de bord (données réelles du serveur) ---------- */
  function dash() {
    const all = [...clients.values()], online = all.filter((c) => c.ws && !c.test), mu = process.memoryUsage();
    const pings = online.map((c) => c.ping).filter((p) => p > 0), avgPing = pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 0;
    const ms = [...matches.values()];
    return { t: 'dv_dash', at: now(), uptime: Math.round(process.uptime()),
      players: { online: online.length, inMatch: online.filter((c) => c.match && !c.away).length, away: online.filter((c) => c.away).length, inParty: online.filter((c) => c.party).length, accounts: online.filter((c) => c.uid).length, spectators: online.filter((c) => c.spec).length, tests: all.filter((c) => c.test).length },
      parties: parties.size, matches: { total: ms.length, play: ms.filter((m) => m.state === 'play').length, lobby: ms.filter((m) => m.state === 'lobby').length, lab: ms.filter((m) => m.lab).length },
      net: { avgPing, maxPing: pings.length ? Math.max(...pings) : 0, laggy: pings.filter((p) => p > 180).length },
      server: { tickAvg: +S.tick.avg.toFixed(2), tickMax: +S.tick.max.toFixed(2), heap: Math.round(mu.heapUsed / 1048576), rss: Math.round(mu.rss / 1048576), node: process.version },
      services: { db: acc.diag().db, tables: acc.diag().v2, sessions: acc.diag().sessions, lb: acc.diag().lb },
      stats: { conns: S.conns, started: S.started, ended: S.ended, byMode: S.byMode, avgDuration: S.durations.length ? Math.round(S.durations.reduce((a, b) => a + b, 0) / S.durations.length) : 0, replays: replays.length, reports: reports.filter((r) => !r.closed).length },
      cfg: CFG, errors: errors.slice(-15).reverse(), alerts: alerts.slice(-12).reverse(), activity: activity.slice(-30).reverse() };
  }

  /* ---------- spectateur ---------- */
  function specInit(c, m, follow) {
    const M = m.M, you = Math.max(0, Math.min(M.ents.length - 1, follow | 0));
    send(c, { t: 'match', spectate: true, id: m.id, mode: m.mode, mapKey: m.mapKey, seed: m.seed, roster: ctx.rosterOf(m), event: m.event, you, tiles: Buffer.from(M.map.tiles).toString('base64'), proto: ctx.PROTOCOL, info: matchView(m) });
  }
  function stopSpec(c) { if (!c.spec) return; const m = matches.get(c.spec); if (m && m.specs) m.specs.delete(c.pid); c.spec = null; }

  /* ---------- triches de test (appliquées par le serveur, parties de test/privées uniquement) ---------- */
  const cheatOf = (M, b) => { if (!b || !b.pid || !M._cheatsOK) return null; const c = clients.get(b.pid); return c && can(c, 'dev') && c.cheats ? c.cheats : null; };
  function nearestFoe(M, b, maxD) { let best = null, bd = maxD || 1e9; for (const e of M.ents) { if (!e.alive || e.team === b.team) continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e; } } return best; }
  function makeCheats(m) {
    const lab = m.labCfg || {};
    return {
      onDamage(M, tgt, amt, src) {
        const ct = cheatOf(M, tgt); if (ct && ct.god) return 0;
        const cs = cheatOf(M, src); if (cs) { amt *= (+cs.dmg || 1) * (cs.ohk ? 1000 : 1); }
        const ce = lab.charEdit && src && lab.charEdit[src.id]; if (ce && ce.dmg) amt *= ce.dmg;
        return amt;
      },
      speedMul(M, b) { const c = cheatOf(M, b), ce = lab.charEdit && lab.charEdit[b.id]; return (c ? (+c.speed || 1) : 1) * (ce && ce.speed ? ce.speed : 1); },
      passive(M, b) { return !!lab.passiveBots && !b.pid; },
      onUpdate(M, dt) {
        for (const b of M.ents) {
          const c = cheatOf(M, b); if (!c || !b.alive) continue;
          if (c.ammo) b.ammo = 3; if (c.sup) b.superCharge = 1; if (c.gad) { b.gadgetCd = 0; b.gadgets = Math.max(b.gadgets || 0, 1); }
          if (c.dodge && !(b.rollCd > 0)) { // esquive automatique : un projectile ennemi va toucher → roulade perpendiculaire
            for (const p of M.projs) {
              if (!p.owner || p.owner.team === b.team) continue;
              const vx = Math.cos(p.ang), vy = Math.sin(p.ang), rx = b.x - p.x, ry = b.y - p.y, along = rx * vx + ry * vy;
              if (along < 0 || along > 260) continue; const perp = Math.abs(rx * vy - ry * vx);
              if (perp < (b.r || 21) + (p.r || 6) + 6) { Sim.tryDodge(M, b, p.ang + Math.PI / 2 * ((rx * vy - ry * vx) > 0 ? -1 : 1)); break; }
            }
          }
          if (c.auto && b.ammo >= 1 && (b.reload || 0) <= 0) { const f = nearestFoe(M, b, b.def.atk.range * T * 0.95); if (f) Sim.tryAttack(M, b, Math.atan2(f.y - b.y, f.x - b.x), Math.hypot(f.x - b.x, f.y - b.y)); }
        }
      },
    };
  }
  // visée automatique : corrige l'angle du tir du développeur (avec anticipation du mouvement de la cible)
  function aim(m, b, ang, dist) {
    const c = cheatOf(m.M, b); if (!c || !c.aim) return [ang, dist];
    const f = nearestFoe(m.M, b, (b.def.atk.range + 2) * T); if (!f) return [ang, dist];
    const spd = (b.def.atk.speed || 15) * T / 1.2, d0 = Math.hypot(f.x - b.x, f.y - b.y), tt = d0 / Math.max(1, spd), vx = (f.vx || 0), vy = (f.vy || 0);
    const tx = f.x + vx * tt, ty = f.y + vy * tt;
    return [Math.atan2(ty - b.y, tx - b.x), Math.hypot(tx - b.x, ty - b.y)];
  }

  /* ---------- cycle de vie des parties ---------- */
  function onStart(m) {
    S.started++; S.byMode[m.mode] = (S.byMode[m.mode] || 0) + 1; m.specs = m.specs || new Set();
    const M = m.M; M._cheatsOK = !!m.cheatsOK; if (m.cheatsOK) M.cheats = makeCheats(m);
    const lab = m.labCfg;
    if (lab) {
      if (lab.tiles) { const bin = Buffer.from(String(lab.tiles), 'base64'); if (bin.length === M.map.tiles.length) for (let i = 0; i < bin.length; i++) { const t = bin[i] <= 6 ? bin[i] : 0; M.map.tiles[i] = t; M.map.hp[i] = t === 2 ? 2400 : t === 6 ? 3600 : 0; } }
      for (const b of M.ents) {
        if (!b.pid && lab.botLevel) { b.level = lab.botLevel; }
        const ce = lab.charEdit && lab.charEdit[b.id];
        if (ce) { if (ce.hp && ce.hp !== 1) { b.maxhp = Math.round(b.maxhp * ce.hp); b.hp = b.maxhp; } if ((ce.range && ce.range !== 1) || (ce.reload && ce.reload !== 1)) { const d = b.def; b.def = Object.assign({}, d, { atk: Object.assign({}, d.atk, { range: d.atk.range * (ce.range || 1), reload: d.atk.reload * (ce.reload || 1) }) }); } }
      }
      if (lab.skill) M.skill = Math.max(0.05, Math.min(1, lab.skill));
    }
    m.rec = { init: { id: m.id, mode: m.mode, mapKey: m.mapKey, seed: m.seed, event: m.event, roster: ctx.rosterOf(m), tiles: Buffer.from(M.map.tiles).toString('base64') }, frames: [], bytes: 0, ev: [], k: 0 };
    act('partie', 'Début : ' + (G.MODES[m.mode] || {}).name + ' (' + M.ents.filter((b) => b.pid).length + ' humain(s))' + (m.lab ? ' — LABO' : ''));
  }
  const REC_MAX = 7 * 1024 * 1024;
  function onSnap(m, snap, raw) {
    // spectateurs : mêmes instantanés que les joueurs, rien de plus (pas d'avantage, pas d'influence)
    if (m.specs && m.specs.size) for (const pid of m.specs) { const c = clients.get(pid); if (c && c.ws && c.ws.readyState === 1 && c.spec === m.id) { try { c.ws.send(raw); } catch (e) { /* ignore */ } } else m.specs.delete(pid); }
    // replay : 1 instantané sur 2 (15/s), les évènements des instantanés sautés sont conservés
    const r = m.rec; if (!r || r.bytes > REC_MAX) return;
    if (++r.k % 2) { if (snap.ev && snap.ev.length) r.ev.push(...snap.ev); return; }
    const s = r.ev.length ? JSON.stringify(Object.assign({}, snap, { ev: r.ev.concat(snap.ev || []) })) : raw; r.ev = [];
    r.frames.push(s); r.bytes += s.length;
  }
  function onEnd(m, res) {
    S.ended++; const M = m.M; if (!M) return; S.durations.push(Math.round(M.t)); if (S.durations.length > 100) S.durations.shift();
    const meta = { id: m.id, at: now(), mode: m.mode, map: G.MAPS[m.mapKey] ? G.MAPS[m.mapKey].name : m.mapKey, duration: Math.round(M.t), lab: !!m.lab, ranked: !!m.ranked,
      result: res ? { winnerTeam: res.winnerTeam, draw: !!res.draw, forfeit: !!res.forfeit } : null, score: M.score || null,
      players: M.ents.map((b) => ({ idx: b.idx, name: b.name, team: b.team, brawler: b.id, bot: !b.pid, test: !!(b.pid && (clients.get(b.pid) || {}).test), kills: b.kills, deaths: b.deaths || 0, damage: Math.round((b.st && b.st.damage) || 0), pid: b.pid || null, handle: b.pid ? ((clients.get(b.pid) || {}).handle || '') : '' })) };
    for (const p of meta.players) if (p.pid) { const win = res && !res.draw && res.winnerTeam === p.team; ring(H(p.pid).matches, { at: meta.at, id: m.id, mode: m.mode, map: meta.map, win, draw: !!(res && res.draw), kills: p.kills, damage: p.damage, duration: meta.duration }, 15); }
    if (m.rec && m.rec.frames.length > 5) { ring(replays, Object.assign({ frames: m.rec.frames, init: m.rec.init, size: m.rec.bytes }, meta), 8); }
    m.rec = null;
    for (const pid of (m.specs || [])) { const c = clients.get(pid); if (c) { send(c, { t: 'spec_end', id: m.id, result: meta.result }); c.spec = null; } }
    act('partie', 'Fin : ' + (G.MODES[m.mode] || {}).name + ' en ' + meta.duration + ' s' + (res && res.draw ? ' (égalité)' : ''));
  }
  function onTick(ms) { const t = S.tick; t.avg = t.avg * 0.98 + ms * 0.02; t.samples.push(ms); if (t.samples.length > 600) t.samples.shift(); t.max = Math.max(...t.samples); if (ms > 30 && now() - (t.lastAlert || 0) > 60000) { t.lastAlert = now(); alert('attention', 'Boucle de simulation lente : ' + ms.toFixed(1) + ' ms'); } }
  function onMatchError(m, e) { error('partie ' + m.id, e); alert('grave', 'Erreur de simulation (partie ' + m.id + ') : ' + String(e.message).slice(0, 80)); }

  /* ---------- connexions ---------- */
  function onHello(c, msg) {
    S.conns++; c.since = now(); c.plat = /^(android|ios|web)$/.test(msg.plat) ? msg.plat : 'web';
    act('connexion', c.name + ' (' + c.plat + ')');
    const b = bans['p:' + c.pid]; if (b && b.until > now()) { send(c, { t: 'banned', until: b.until, reason: b.reason }); try { c.ws.close(4004, 'banned'); } catch (e) { /* ignore */ } return true; }
    return false;
  }
  function onAuth(c) { const b = bans['u:' + c.uid]; if (b && b.until > now()) { send(c, { t: 'banned', until: b.until, reason: b.reason }); try { c.ws.close(4004, 'banned'); } catch (e) { /* ignore */ } return true; } return false; }
  function onClose(c, code) {
    stopSpec(c);
    const dur = Math.round((now() - (c.since || now())) / 1000);
    ring(sessions, { pid: c.pid, name: c.name, handle: c.handle || '', account: !!c.uid, plat: c.plat || '?', start: c.since || 0, end: now(), dur, inMatch: !!c.match, code: code || 0 }, 200);
    ring(H(c.pid).drops, { at: now(), dur, inMatch: !!c.match, code: code || 0 }, 15);
    act('déconnexion', c.name + (c.match ? ' (pendant une partie)' : '') + ' après ' + dur + ' s');
    if (c.match && code !== 1000 && code !== 4003) { const n = sessions.filter((s) => s.inMatch && now() - s.end < 60000).length; if (n >= 5) alert('attention', n + ' déconnexions en partie en 1 minute'); }
  }

  /* ---------- messages ---------- */
  const Hd = {};
  Hd.dv_dash = (c) => send(c, dash());
  Hd.dv_players = (c, msg) => {
    const q = String(msg.q || '').toLowerCase().trim(), st = String(msg.status || '');
    const live = [...clients.values()].filter((x) => !msg.noTest || !x.test).map(pubP);
    const gone = sessions.slice().reverse().filter((s) => !clients.get(s.pid) || !clients.get(s.pid).ws).map((s) => ({ pid: s.pid, name: s.name, handle: s.handle, account: s.account, status: 'hors ligne', online: false, plat: s.plat, lastSeen: s.end }));
    const seen = new Set(); let list = live.concat(gone).filter((p) => { if (seen.has(p.pid)) return false; seen.add(p.pid); return true; });
    if (q) list = list.filter((p) => (p.name + ' ' + p.handle + ' ' + p.pid).toLowerCase().includes(q));
    if (st) list = list.filter((p) => p.status === st || (st === 'en ligne' && p.online));
    send(c, { t: 'dv_players', list: list.slice(0, 150), total: list.length });
  };
  Hd.dv_player = (c, msg) => {
    const p = clients.get(String(msg.pid || '')), h = hist[msg.pid] || { matches: [], drops: [] };
    const s = sessions.slice().reverse().find((x) => x.pid === msg.pid);
    if (!p && !s) return err(c, 'dev', 'Joueur introuvable (aucune session récente).');
    const base = p ? pubP(p) : { pid: s.pid, name: s.name, handle: s.handle, account: s.account, status: 'hors ligne', online: false, plat: s.plat, lastSeen: s.end };
    const party = p && p.party && parties.get(p.party);
    const m = p && p.match && matches.get(p.match);
    const ban = bans['p:' + base.pid] || (p && p.uid && bans['u:' + p.uid]);
    send(c, { t: 'dv_player', p: Object.assign(base, {
      session: p ? { since: p.since, reconnects: p.reconnects || 0, away: !!p.away, ping: p.ping || 0, plat: p.plat } : null,
      party: party ? { code: party.code, leader: (clients.get(party.leader) || {}).name, members: party.members.map((x) => ({ pid: x, name: (clients.get(x) || {}).name, test: !!(clients.get(x) || {}).test })) } : null,
      match: m ? matchView(m) : null, matches: h.matches.slice().reverse(), drops: h.drops.slice().reverse(),
      reports: reports.filter((r) => r.target === base.pid).length, banned: ban && ban.until > now() ? { until: ban.until, reason: ban.reason } : null }) });
  };
  Hd.dv_matches = (c) => send(c, { t: 'dv_matches', list: [...matches.values()].map(matchView) });
  Hd.dv_spectate = (c, msg) => {
    const m = matches.get(String(msg.id || '')) || [...matches.values()].find((x) => x.M && x.M.ents.some((b) => b.pid === msg.pid));
    if (!m || !m.M || m.state !== 'play') return err(c, 'dev', 'Aucune partie en cours à observer.');
    const cur = c.match && matches.get(c.match); if (cur && cur.state !== 'over') return err(c, 'dev', 'Quittez votre partie avant d\'observer.');
    stopSpec(c); c.spec = m.id; m.specs = m.specs || new Set(); m.specs.add(c.pid);
    const follow = msg.pid ? (m.M.ents.find((b) => b.pid === msg.pid) || {}).idx : msg.follow;
    specInit(c, m, follow || 0); act('spectateur', c.name + ' observe ' + (G.MODES[m.mode] || {}).name);
  };
  Hd.dv_unspectate = (c) => { stopSpec(c); send(c, { t: 'spec_end', id: null }); };
  Hd.dv_replays = (c, msg) => {
    const q = String(msg.q || '').toLowerCase(), mode = String(msg.mode || ''), day = String(msg.day || '');
    const list = replays.slice().reverse().filter((r) => (!mode || r.mode === mode) && (!day || new Date(r.at).toISOString().slice(0, 10) === day) && (!q || r.players.some((p) => (p.name + ' ' + p.handle).toLowerCase().includes(q))))
      .map((r) => Object.assign({}, r, { frames: undefined, init: undefined, n: r.frames.length, size: Math.round(r.size / 1024) }));
    send(c, { t: 'dv_replays', list });
  };
  Hd.dv_replay = (c, msg) => {
    const r = replays.find((x) => x.id === msg.id); if (!r) return err(c, 'dev', 'Replay introuvable (le serveur garde les 8 dernières parties depuis son démarrage).');
    const meta = Object.assign({}, r, { frames: undefined, init: undefined });
    send(c, { t: 'dv_replay', part: 0, init: r.init, meta, n: r.frames.length });
    for (let i = 0; i < r.frames.length; i += 150) send(c, { t: 'dv_replay', part: i / 150 + 1, frames: r.frames.slice(i, i + 150), last: i + 150 >= r.frames.length });
  };
  // administration
  const target = (pid) => clients.get(String(pid || ''));
  const reason = (msg) => String(msg.reason || '').replace(/[<>]/g, '').slice(0, 120) || 'non précisée';
  Hd.dv_kick = (c, msg) => {
    const t = target(msg.pid); if (!t || !t.ws) return err(c, 'dev', 'Session introuvable ou déjà déconnectée.');
    if (t === c) return err(c, 'dev', 'Vous ne pouvez pas vous déconnecter vous-même ici.');
    log(c, 'Déconnexion de session', t.name, reason(msg));
    send(t, { t: 'admin_kick', reason: reason(msg) }); setTimeout(() => { try { t.ws && t.ws.close(4003, 'admin'); } catch (e) { /* ignore */ } }, 200);
    send(c, { t: 'toast', msg: 'Session de ' + t.name + ' déconnectée (journalisé).' });
  };
  Hd.dv_ban = (c, msg) => {
    const t = target(msg.pid); const s = t || sessions.slice().reverse().find((x) => x.pid === msg.pid); if (!s) return err(c, 'dev', 'Joueur introuvable.');
    if (t === c) return err(c, 'dev', 'Impossible de vous sanctionner vous-même.');
    const hours = Math.max(1, Math.min(24 * 365, +msg.hours || 24)), until = now() + hours * 3600e3;
    const key = t && t.uid ? 'u:' + t.uid : 'p:' + s.pid; bans[key] = { until, reason: reason(msg), by: c.name, name: s.name, pid: s.pid }; persist();
    log(c, 'Sanction (' + hours + ' h)', s.name, reason(msg));
    if (t && t.ws) { send(t, { t: 'banned', until, reason: reason(msg) }); setTimeout(() => { try { t.ws && t.ws.close(4004, 'banned'); } catch (e) { /* ignore */ } }, 200); }
    send(c, { t: 'toast', msg: s.name + ' est sanctionné ' + hours + ' h (journalisé).' });
  };
  Hd.dv_unban = (c, msg) => { const k = String(msg.key || ''); if (!bans[k]) return err(c, 'dev', 'Sanction introuvable.'); log(c, 'Levée de sanction', bans[k].name); delete bans[k]; persist(); send(c, { t: 'dv_bans', list: banList() }); };
  const banList = () => Object.entries(bans).filter(([, b]) => b.until > now()).map(([key, b]) => ({ key, name: b.name, until: b.until, reason: b.reason, by: b.by }));
  Hd.dv_bans = (c) => send(c, { t: 'dv_bans', list: banList() });
  Hd.dv_endmatch = (c, msg) => {
    const m = matches.get(String(msg.id || '')); if (!m || !m.M || m.M.state === 'end') return err(c, 'dev', 'Partie introuvable ou déjà terminée.');
    log(c, 'Arrêt de partie', (G.MODES[m.mode] || {}).name + ' ' + m.id, reason(msg));
    for (const b of m.M.ents) { const t = b.pid && clients.get(b.pid); if (t) send(t, { t: 'toast', msg: '⚠ Partie arrêtée par un administrateur : ' + reason(msg) }); }
    m.adminStop = true; Sim.finish(m.M, -1); m.M.result.draw = true;
  };
  Hd.dv_warn = (c, msg) => { const t = target(msg.pid); if (!t || !t.ws) return err(c, 'dev', 'Joueur hors ligne.'); const txt = String(msg.text || '').replace(/[<>]/g, '').slice(0, 140); if (!txt) return; log(c, 'Avertissement', t.name, txt); send(t, { t: 'admin_warn', text: txt }); send(c, { t: 'toast', msg: 'Avertissement envoyé à ' + t.name }); };
  Hd.dv_reports = (c) => send(c, { t: 'dv_reports', list: reports.slice().reverse() });
  Hd.dv_report_close = (c, msg) => { const r = reports.find((x) => x.id === msg.id); if (!r) return; r.closed = { by: c.name, at: now(), note: String(msg.note || '').slice(0, 120) }; log(c, 'Signalement traité', r.targetName, r.closed.note); persist(); send(c, { t: 'dv_reports', list: reports.slice().reverse() }); };
  Hd.dv_audit = (c) => send(c, { t: 'dv_audit', list: audit.slice().reverse() });
  // studio : triches de test, laboratoire, tests serveur
  const CH = ['god', 'ammo', 'sup', 'ohk', 'aim', 'dodge', 'auto', 'gad'];
  Hd.dv_cheats = (c, msg) => {
    const o = msg.cheats || {}, ch = {}; CH.forEach((k) => { if (o[k]) ch[k] = true; });
    ch.dmg = Math.max(0.25, Math.min(10, +o.dmg || 1)); ch.speed = Math.max(0.5, Math.min(3, +o.speed || 1));
    c.cheats = ch; send(c, { t: 'dv_cheats', cheats: ch, note: 'Actives seulement dans les parties de test (labo) et vos parties privées. Bloquées par le serveur dans les parties publiques et classées.' });
  };
  const LAB = {};
  Hd.dv_lab = (c, msg) => {
    const mode = G.MODES[msg.mode] ? msg.mode : 'gemgrab', md = G.MODES[mode];
    const cur = c.match && matches.get(c.match);
    if (cur && cur.state !== 'over') return err(c, 'dev', 'Vous êtes déjà dans une partie.');
    c.match = null; c.ent = null; c.away = false;
    const map = md.maps.includes(msg.map) ? msg.map : md.maps[0];
    const per = md.per === 3 ? Math.max(1, Math.min(3, +msg.per || 3)) : md.per;
    const cfg = { mode, map, per, botLevel: Math.max(1, Math.min(11, +msg.botLevel || 5)), skill: Math.max(0.05, Math.min(1, +msg.skill || 0.5)), passiveBots: !!msg.passiveBots, tiles: typeof msg.tiles === 'string' && msg.tiles.length < 4000 ? msg.tiles : null, charEdit: msg.charEdit && typeof msg.charEdit === 'object' ? msg.charEdit : null, mates: Math.max(0, Math.min(per - 1, +msg.mates || 0)), testPlayers: Math.max(0, Math.min(per * 2 - 1, +msg.testPlayers || 0)) };
    let p = parties.get(c.party); if (!p) p = ctx.createParty(c, mode); p.mode = mode; p.map = map;
    // joueurs de test (identifiés comme tels, jamais enregistrés) pour remplir les équipes
    for (let i = 0; i < cfg.testPlayers && p.members.length < 6; i++) ctx.devsrvSim(c, 'join');
    const roster = [{ pid: c.pid, team: 0 }];
    p.members.filter((x) => x !== c.pid).slice(0, per * 2 - 1).forEach((pid, i) => roster.push({ pid, team: i < cfg.mates ? 0 : 1 }));
    LAB[c.pid] = cfg;
    log(c, 'Labo : partie de test', md.name + ' / ' + (G.MAPS[map] || {}).name);
    ctx.launchLobby(mode, roster, [p], false, per !== md.per ? per : 0, { lab: cfg });
  };
  Hd.dv_labset = (c, msg) => {
    const m = c.match && matches.get(c.match); if (!m || !m.lab || !m.M) return err(c, 'dev', 'Ces réglages ne s\'appliquent qu\'à votre partie de test (labo).');
    const M = m.M, cfg = m.labCfg;
    if (typeof msg.passiveBots === 'boolean') cfg.passiveBots = msg.passiveBots;
    if (isFinite(+msg.ts)) m.ts = Math.max(0.25, Math.min(3, +msg.ts));
    if (isFinite(+msg.skill)) M.skill = Math.max(0.05, Math.min(1, +msg.skill));
    if (msg.act === 'healAll') M.ents.forEach((b) => { if (b.alive) b.hp = b.maxhp; });
    if (msg.act === 'killBots') M.ents.forEach((b) => { if (!b.pid && b.alive && !b.isBoss) Sim.damage(M, b, 1e9, null); });
    if (msg.act === 'reset') { m.labReset = true; Sim.finish(M, -1); setTimeout(() => Hd.dv_lab(c, Object.assign({}, LAB[c.pid] || cfg)), 6600); }
    if (msg.act === 'end') Sim.finish(M, -1);
    send(c, { t: 'dv_labstate', cfg: { passiveBots: cfg.passiveBots, ts: m.ts || 1, skill: +M.skill.toFixed(2) } });
  };
  Hd.dv_selftest = (c) => { // vrai test côté serveur : chaque mode est simulé jusqu'au bout avec la simulation du serveur
    const res = [], t0 = Date.now();
    for (const mode of G.MODE_ORDER) {
      const s = Date.now();
      try { const M = Sim.createOnline({ mode, mapKey: G.MODES[mode].maps[0], seed: 7, players: [], event: 'none' }); let n = 0; while (M.state !== 'end' && n < 20 * 200) { Sim.update(M, 0.05); n++; } res.push({ name: G.MODES[mode].name, ok: true, d: M.state === 'end' ? 'fin en ' + Math.round(M.t) + ' s' : '200 s sans fin (normal pour certains modes)', ms: Date.now() - s }); }
      catch (e) { res.push({ name: G.MODES[mode].name, ok: false, d: e.message, ms: Date.now() - s }); error('test serveur ' + mode, e); }
    }
    log(c, 'Tests automatiques serveur', '', res.filter((r) => r.ok).length + '/' + res.length);
    send(c, { t: 'dv_selftest', at: Date.now(), ms: Date.now() - t0, res });
  };

  /* ---------- signalements (tous les joueurs, limités) ---------- */
  function report(c, msg) {
    if (now() - (c.lastReport || 0) < 20000) return send(c, { t: 'toast', msg: 'Patientez avant un nouveau signalement.' });
    const t = clients.get(String(msg.pid || '')), sname = t ? t.name : String(msg.name || '?').slice(0, 20);
    c.lastReport = now();
    const r = { id: Math.random().toString(36).slice(2, 10), at: now(), from: c.name, target: t ? t.pid : String(msg.pid || ''), targetName: sname, why: String(msg.why || 'comportement').replace(/[<>]/g, '').slice(0, 60), text: String(msg.text || '').replace(/[<>]/g, '').slice(0, 200), match: c.match || null };
    ring(reports, r, 200); persist(); act('signalement', c.name + ' a signalé ' + sname);
    send(c, { t: 'toast', msg: 'Merci, le signalement a été transmis.' });
  }

  function handle(c, msg) {
    if (msg.t === 'report') { report(c, msg); return true; }
    if (!/^dv_/.test(msg.t)) return false;
    const need = NEED[msg.t];
    if (!need) return false; // laissé à devsrv (refusé là-bas sans droits)
    if (!can(c, need)) { err(c, 'forbidden', need === 'admin' ? 'Réservé aux administrateurs.' : need === 'observe' ? 'Réservé au compte développeur.' : 'Réservé au compte développeur.'); return true; }
    const f = Hd[msg.t]; if (!f) return false; // dv_state, dv_cfg, dv_sim : devsrv (droits déjà vérifiés)
    try { f(c, msg); } catch (e) { error('outil ' + msg.t, e); err(c, 'dev', 'Erreur : ' + e.message); }
    return true;
  }
  return { handle, onStart, onSnap, onEnd, onTick, onMatchError, onHello, onAuth, onClose, aim, rolesOf, can, act, stopSpec, error };
};
