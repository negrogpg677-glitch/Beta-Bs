/* Tests d'intégration du serveur : équipes, codes, matchmaking, lobby, simulation, reconnexion, classement */
process.env.FILL_WAIT = '2'; process.env.PORT = '0'; process.env.DATA_DIR = require('os').tmpdir() + '/brawl-test-' + Date.now();
const WebSocket = require('ws');
const S = require('../server.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cl {
  constructor(url, name) { this.url = url; this.name = name; this.msgs = []; this.snaps = 0; this.evs = 0; this.last = null; this.waiters = []; }
  connect(creds) {
    return new Promise((res) => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => this.ws.send(JSON.stringify(Object.assign({ t: 'hello', name: this.name }, creds || {}))));
      this.ws.on('message', (raw) => {
        const m = JSON.parse(raw);
        if (this.on) this.on(m);
        if (m.t === 'snap') { this.snaps++; this.last = m; this.evs += m.ev.length; this.lastSnap = m; }
        else { this.msgs.push(m); if (m.t === 'welcome') { this.pid = m.pid; this.token = m.token; res(m); } }
        this.waiters = this.waiters.filter((w) => { if (w.t === m.t) { w.r(m); return false; } return true; });
      });
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(t, ms = 8000) { const ex = this.msgs.find((m) => m.t === t && !m.seen); if (ex) { ex.seen = true; return Promise.resolve(ex); } return new Promise((r, j) => { const to = setTimeout(() => j(new Error('timeout ' + t)), ms); this.waiters.push({ t, r: (m) => { clearTimeout(to); m.seen = true; r(m); } }); }); }
  clear() { this.msgs.forEach((m) => (m.seen = true)); }
  lastOf(t) { return [...this.msgs].reverse().find((m) => m.t === t); }
}

(async () => {
  await new Promise((r) => S.server.listen(0, r));
  const url = 'ws://127.0.0.1:' + S.server.address().port;
  const A = new Cl(url, 'Alice'), B = new Cl(url, 'Bob'), C = new Cl(url, 'Carl');
  await A.connect(); await B.connect(); await C.connect(); await sleep(100); A.clear(); B.clear(); C.clear();
  ok(A.pid && A.token && A.pid !== B.pid, 'connexion + identités uniques');
  A.send({ t: 'profile', brawler: 'rex', skin: 'classic', level: 3, name: 'Alice' }); B.send({ t: 'profile', brawler: 'luna', skin: 'neon', level: 2 }); C.send({ t: 'profile', brawler: 'taurus', level: 1 });
  // --- équipes ---
  A.send({ t: 'party_create', mode: 'brawlball' });
  const pa = await A.wait('party');
  ok(pa.party && /^[A-Z0-9]{5}$/.test(pa.party.code), 'création d\'équipe, code ' + (pa.party && pa.party.code));
  const code = pa.party.code;
  B.send({ t: 'party_join', code: 'ZZZZZ' }); const e1 = await B.wait('error');
  ok(e1.code === 'not_found', 'code invalide refusé');
  B.send({ t: 'party_join', code: code.toLowerCase() }); await B.wait('party');
  await sleep(100);
  ok(A.lastOf('party').party.members.length === 2, 'un ami rejoint avec le code (insensible à la casse)');
  B.send({ t: 'party_start', mode: 'brawlball', kind: 'queue' }); const e2 = await B.wait('error');
  ok(e2.code === 'not_leader', 'seul le chef peut lancer');
  C.send({ t: 'party_join', code }); await C.wait('party'); await sleep(50);
  C.send({ t: 'party_leave' }); await C.wait('party'); await sleep(50);
  ok(A.lastOf('party').party.members.length === 2, 'quitter une équipe');
  // --- matchmaking : 2 joueurs, complétés par des bots étiquetés ---
  A.send({ t: 'party_start', mode: 'brawlball', kind: 'queue' });
  const lob = await A.wait('lobby', 12000);
  ok(lob.slots.length === 2 && lob.need === 6, 'salle d\'attente avec 2 vrais joueurs');
  const ma = await A.wait('match', 12000); const mb = await B.wait('match', 12000);
  ok(ma.roster.length === 6 && ma.roster.filter((r) => r.bot).length === 4, 'bots étiquetés (4 bots / 2 humains)');
  ok(ma.roster.find((r) => r.idx === ma.you).team === mb.roster.find((r) => r.idx === mb.you).team, 'les amis sont dans la même équipe');
  ok(ma.seed === mb.seed && ma.tiles.length > 100, 'même carte pour tous');
  // --- simulation ---
  let pos0 = null;
  for (let i = 0; i < 260; i++) {
    A.send({ t: 'input', mx: 1, my: 0 }); B.send({ t: 'input', mx: 0, my: 1 });
    if (i === 230) { A.send({ t: 'input', mx: 1, my: 0, a: [0, 300] }); }
    await sleep(33);
    if (!pos0 && A.last && A.last.s === 1) pos0 = A.last.e[ma.you].slice(0, 2); // dès que la partie démarre
  }
  ok(A.snaps > 30 && B.snaps > 30, 'instantanés reçus (' + A.snaps + '/' + B.snaps + ')');
  const pos1 = A.last.e[ma.you];
  ok(pos0 && (Math.abs(pos1[0] - pos0[0]) > 30), 'déplacement du joueur A pris en compte par le serveur');
  ok(A.evs > 0, 'évènements (tirs/effets) diffusés (' + A.evs + ')');
  // --- roulade d'esquive + compensation de latence ---
  { let rolled = false, cd = 0; const idx = ma.you;
    for (let i = 0; i < 250 && !rolled; i++) { // réessaie tant que le joueur est mort / en réapparition
      if (i % 5 === 0 && A.last.s === 1) A.send({ t: 'input', seq: 9001 + i, mx: 0, my: 0, d: Math.PI / 2 }); // seulement en jeu (pas pendant un compte à rebours)
      await sleep(30); const e = A.last.e[idx]; if (e[6] & 4096) { rolled = true; cd = e[16]; } }
    ok(rolled && cd > 0, 'roulade d\'esquive synchronisée (drapeau + recharge ' + cd / 10 + ' s)');
    A.send({ t: 'input', seq: 9002, mx: 0, my: 0, d: 0 }); await sleep(120);
    ok(A.last.e[idx][16] > 10, 'pas de seconde roulade pendant la recharge'); }
  // --- gadget (3 par partie) + émote ---
  { const idx = ma.you; let used = false, n = 3, em = false;
    A.on = (m) => { if (m.t === 'snap') for (const e of m.ev) if (e[0] === 'em' && e[1] === idx) em = true; };
    for (let i = 0; i < 250 && !used; i++) {
      if (i % 5 === 0 && A.last.s === 1) A.send({ t: 'input', seq: 9100 + i, mx: 0, my: 0, gd: 1, em: 4 });
      await sleep(30); const e = A.last.e[idx]; if (e[17] < 3) { used = true; n = e[17]; } }
    ok(used && n === 2 && A.last.e[idx][18] > 0, 'gadget utilisé côté serveur (charges ' + n + '/3, recharge ' + A.last.e[idx][18] / 10 + ' s)');
    A.send({ t: 'input', seq: 9300, mx: 0, my: 0, gd: 1 }); await sleep(120);
    ok(A.last.e[idx][17] === 2, 'pas de second gadget pendant la recharge');
    await sleep(100); ok(em, 'émote diffusée aux joueurs'); A.on = null; }
  // --- reconnexion ---
  B.ws.close(); await sleep(400);
  const B2 = new Cl(url, 'Bob'); const w = await B2.connect({ pid: B.pid, token: B.token });
  ok(w.resumed && w.pid === B.pid, 'reconnexion avec la même identité');
  const mr = await B2.wait('match', 4000);
  ok(mr.you === mb.you && mr.id === mb.id, 'reprise de la partie en cours');
  await sleep(300); ok(B2.snaps > 2, 'instantanés reçus après reconnexion');
  // --- fin de partie (forcée) ---
  const m = [...S.matches.values()][0];
  m.M.score[0] = 1; m.M.left = 0.1; m.M.overtime = true; m.M.state = 'play';
  m.M.left = 0.05; m.M.score = [2, 0];
  const end = await A.wait('end', 12000).catch(() => null);
  ok(end && typeof end.delta === 'number', 'résultat de fin de partie envoyé' + (end ? ' (delta ' + end.delta + ')' : ''));
  A.send({ t: 'lb' }); const lb = await A.wait('lb');
  ok(lb.top.length >= 1 && lb.me.matches >= 1, 'classement en ligne');
  // --- partie privée + survie ---
  await sleep(6500);
  A.send({ t: 'party_set', mode: 'showdown' }); await sleep(100);
  A.send({ t: 'party_start', mode: 'showdown', kind: 'private' });
  const ms = await A.wait('match', 12000);
  ok(ms.roster.length === 10 && ms.mode === 'showdown', 'partie privée en Survie (10 places)');
  await sleep(1500); ok(A.last && A.last.e.length === 10 && A.last.z, 'instantané Survie avec zone toxique');
  // --- défis spéciaux : Mégabot (coop) et Zone stratégique ---
  C.clear(); C.send({ t: 'profile', brawler: 'volt', level: 4 }); C.send({ t: 'party_create', mode: 'boss' }); await C.wait('party');
  C.send({ t: 'party_start', mode: 'boss', kind: 'private' });
  const mbo = await C.wait('match', 12000);
  ok(mbo.mode === 'boss' && mbo.roster.some((r) => r.brawler === 'robot') && mbo.roster.filter((r) => r.team === 0).length === 3, 'Assaut du Mégabot : 3 héros contre le boss');
  await sleep(4500); ok(C.last && C.last.e.length === 4, 'boss : instantanés (4 entités)');
  // --- social : amis par code, invitations, clubs et discussion ---
  const D = new Cl(url, 'Dora'), E = new Cl(url, 'Eli'); await D.connect(); await E.connect(); await sleep(150);
  const fcD = D.lastOf('friends').code; ok(/^[A-Z0-9]{6}$/.test(fcD), 'code d\'ami personnel (' + fcD + ')');
  E.clear(); E.send({ t: 'friend_add', code: 'NOPE12' }); ok((await E.wait('error')).code === 'friend_nf', 'code d\'ami invalide refusé');
  E.send({ t: 'friend_add', code: fcD }); await sleep(250);
  ok(E.lastOf('friends').list.some((f) => f.pid === D.pid && f.status === 'menu') && D.lastOf('friends').list.some((f) => f.pid === E.pid), 'amitié mutuelle + statut en ligne');
  D.clear(); E.send({ t: 'invite', pid: D.pid, mode: 'bounty' }); const inv = await D.wait('invited');
  ok(/^[A-Z0-9]{5}$/.test(inv.code) && inv.from === 'Eli', 'invitation reçue avec le code d\'équipe');
  D.send({ t: 'party_join', code: inv.code }); await sleep(250); ok(D.lastOf('party').party.members.length === 2, 'rejoindre via l\'invitation');
  D.send({ t: 'party_leave' }); E.send({ t: 'party_leave' });
  D.clear(); E.clear(); D.send({ t: 'club_create', name: 'Les Tests', tag: 'TST' }); const cl = await D.wait('club'); ok(cl.club && cl.club.tag === 'TST', 'création de club');
  E.send({ t: 'club_list' }); const cll = await E.wait('club_list'); ok(cll.list.some((x) => x.name === 'Les Tests'), 'liste des clubs');
  E.send({ t: 'club_join', id: cl.club.id }); await sleep(250); ok(E.lastOf('club').club.count === 2, 'rejoindre un club');
  D.clear(); E.send({ t: 'club_chat', txt: 'Salut <b>tous</b> !' }); const msgc = await D.wait('club_msg'); ok(msgc.msg.txt === 'Salut btous /b !' || !/[<>]/.test(msgc.msg.txt), 'chat de club (HTML nettoyé)');
  E.send({ t: 'club_leave' }); await sleep(200); ok(D.lastOf('club').club.count === 1, 'quitter un club');
  console.log(fails ? '\n' + fails + ' ECHEC(S)' : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e); process.exit(2); });
