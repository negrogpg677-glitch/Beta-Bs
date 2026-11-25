/* Brawl Rush - outils développeur côté serveur.
   Chaque action est vérifiée ici : seul un compte développeur authentifié (DEV_EMAILS ou autorisé par le développeur principal)
   peut les utiliser. Les « joueurs de test » n'existent qu'en mémoire : ils ne touchent jamais la base ni les vrais joueurs. */
'use strict';
module.exports = function (ctx) {
  const { clients, parties, matches, send, err, G, Sim, CFG, setCfg, acc, createParty, leaveParty, pushParty, forfeit, rid, wss } = ctx;
  const NAMES = ['Testeur', 'Robo', 'Pixel', 'Bêta', 'Alpha', 'Sonde', 'Ghost', 'Proto'];
  let seq = 0;
  const log = []; // journal des actions développeur (diagnostic)
  const note = (c, what) => { log.push({ at: Date.now(), who: c.name, what }); if (log.length > 60) log.shift(); };

  function fake(owner) {
    const ids = G.BRAWLERS.filter((b) => b.id !== 'robot').map((b) => b.id);
    const pid = 'T' + rid(5), c = { pid, test: true, owner: owner.pid, ws: null, party: null, match: null, ent: null, ready: true, name: NAMES[seq++ % NAMES.length] + ' ' + (seq), brawler: ids[(Math.random() * ids.length) | 0], skin: 'classic', level: 1 + ((Math.random() * 9) | 0), trophies: (Math.random() * 600) | 0, expire: Date.now() + 30 * 60000 };
    clients.set(pid, c); return c;
  }
  const fakesOf = (c) => [...clients.values()].filter((x) => x.test && x.owner === c.pid);
  const myMatch = (c) => { const m = c.match && matches.get(c.match); return m && m.M ? m : null; };

  function state(c) {
    const mu = process.memoryUsage();
    return {
      t: 'dv_state', cfg: CFG, uptime: Math.round(process.uptime()), mem: { rss: Math.round(mu.rss / 1048576), heap: Math.round(mu.heapUsed / 1048576) },
      online: wss.clients.size, players: clients.size, parties: parties.size, superDev: !!c.superDev,
      matches: [...matches.values()].map((m) => ({ id: m.id, mode: m.mode, state: m.state, ranked: !!m.ranked, t: m.M ? Math.round(m.M.t) : 0, humans: m.M ? m.M.ents.filter((b) => b.pid && !(clients.get(b.pid) || {}).test).length : m.slots.length, mine: c.match === m.id })),
      fakes: fakesOf(c).map((f) => ({ pid: f.pid, name: f.name, brawler: f.brawler, inParty: !!f.party })),
      accounts: acc.diag(), log: log.slice(-15),
    };
  }

  const H = {};
  H.dv_state = (c) => send(c, state(c));
  H.dv_cfg = async (c, msg) => {
    setCfg(msg.cfg || {}); note(c, 'paramètres ' + JSON.stringify(CFG));
    try { await acc.cfgSave('live_cfg', CFG); } catch (e) { /* base indisponible : appliqué en mémoire */ }
    send(c, { t: 'toast', msg: 'Paramètres appliqués : inactivité ' + CFG.afkSec + ' s, reconnexion ' + CFG.reconnectSec + ' s' }); send(c, state(c));
  };
  // simulation multijoueur
  H.dv_sim = (c, msg) => {
    const a = String(msg.act || '');
    let p = parties.get(c.party);
    switch (a) {
      case 'join': { // un joueur de test rejoint mon équipe
        if (!p) p = createParty(c, msg.mode || 'gemgrab');
        if (p.members.length >= (p.mode === 'duel' ? 2 : p.max)) return err(c, 'full', 'Équipe complète.');
        const f = fake(c); p.members.push(f.pid); f.party = p.code; pushParty(p); break;
      }
      case 'invite': { // un joueur de test m'invite dans son équipe (il en devient le chef)
        const f = fake(c), fp = createParty(f, msg.mode || 'gemgrab');
        send(c, { t: 'invited', from: f.name, fromPid: f.pid, trophies: f.trophies, brawler: f.brawler, skin: 'classic', code: fp.code, mode: fp.mode, test: true }); break;
      }
      case 'leave': { // le dernier joueur de test quitte mon équipe
        const f = p && p.members.map((x) => clients.get(x)).reverse().find((x) => x && x.test);
        if (!f) return err(c, 'dev', 'Aucun joueur de test dans l\'équipe.');
        leaveParty(f); break;
      }
      case 'leader': { // passe la main au membre suivant
        if (!p || p.members.length < 2) return err(c, 'dev', 'Il faut au moins 2 membres.');
        const i = p.members.indexOf(p.leader); p.leader = p.members[(i + 1) % p.members.length]; pushParty(p); break;
      }
      case 'friend_req': send(c, { t: 'fr_new', from: 'Testeur', handle: 'TESTEUR', test: true }); break;
      case 'disconnect': if (c.ws) setTimeout(() => { try { c.ws.close(4002, 'dev'); } catch (e) { /* ignore */ } }, 300); break;
      case 'afk': { const m = myMatch(c); if (!m) return err(c, 'dev', 'Pas de partie en cours.'); const b = m.M.ents[c.ent]; if (b) b.lastAct = 1; break; }
      case 'win': case 'lose': { const m = myMatch(c); if (!m || m.M.state === 'end') return err(c, 'dev', 'Pas de partie en cours.'); const b = m.M.ents[c.ent]; Sim.finish(m.M, a === 'win' ? b.team : (b.team === 0 ? 1 : 0)); break; }
      case 'forfeit': { const m = myMatch(c); if (!m) return err(c, 'dev', 'Pas de partie en cours.'); forfeit(m, m.M.ents[c.ent].team); break; }
      case 'clear': for (const f of fakesOf(c)) { if (f.party) leaveParty(f); clients.delete(f.pid); } break;
      default: return err(c, 'dev', 'Action inconnue.');
    }
    note(c, 'simulation ' + a); send(c, state(c));
  };

  function handle(c, msg) {
    if (!/^dv_/.test(msg.t)) return false;
    if (!c.dev || !c.uid) { err(c, 'forbidden', 'Réservé au compte développeur.'); return true; }
    const f = H[msg.t]; if (!f) return true;
    Promise.resolve().then(() => f(c, msg)).catch((e) => err(c, 'dev', 'Erreur : ' + e.message));
    return true;
  }
  return { handle, log };
};
