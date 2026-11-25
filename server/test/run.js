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
  { let got = null; B.on = (m) => { if (m.t === 'mchat') got = m; }; A.send({ t: 'mchat', text: 'Attaquez <b>!' }); await sleep(300);
    ok(got && got.idx === ma.you && got.text === 'Attaquez b!', 'discussion rapide en partie reçue par le coéquipier (« ' + (got && got.text) + ' »)'); B.on = null; }
  // --- reconnexion ---
  B.ws.close(); await sleep(400);
  const B2 = new Cl(url, 'Bob'); const w = await B2.connect({ pid: B.pid, token: B.token, inMatch: mb.id }); // coupure réseau : encore sur l'écran de combat
  ok(w.resumed && w.pid === B.pid, 'reconnexion avec la même identité');
  const mr = await B2.wait('match', 4000);
  ok(mr.you === mb.you && mr.id === mb.id, 'reprise de la partie en cours');
  await sleep(300); ok(B2.snaps > 2, 'instantanés reçus après reconnexion');
  // --- interdiction de quitter + retour au menu + « Reprendre la partie » ---
  B2.clear(); B2.send({ t: 'match_leave' }); const nq = await B2.wait('error');
  ok(nq.code === 'no_quit' && [...S.matches.values()][0].M.ents[mb.you].isPlayer, 'quitter une partie en cours est refusé par le serveur (hors duel entre amis)');
  B2.ws.close(); await sleep(300);
  const B3 = new Cl(url, 'Bob'); await B3.connect({ pid: B.pid, token: B.token }); // relance du jeu : retour au menu
  const rs = await B3.wait('resumable', 3000).catch(() => null);
  ok(rs && rs.id === mb.id && !B3.msgs.some((x) => x.t === 'match'), 'au retour : partie proposée (« Reprendre la partie ») sans y être renvoyé de force');
  const mm = [...S.matches.values()][0], bb = mm.M.ents[mb.you]; bb.x += 0; const hp0 = bb.hp;
  ok(!bb.isPlayer, 'pendant l\'absence, la partie continue côté serveur (IA)');
  B3.send({ t: 'resume' }); const rr = await B3.wait('match', 3000).catch(() => null);
  await sleep(250); const se = B3.last && B3.last.e[mb.you];
  ok(rr && rr.you === mb.you && bb.isPlayer && se && Math.abs(se[0] - Math.round(bb.x)) < 40 && se[4] > 0, 'reprise : même personnage, position et vie restaurées depuis le serveur (pv ' + hp0 + ')');
  // inactivité (AFK)
  for (let i = 0; i < 40 && !bb.alive; i++) await sleep(150); // (le brawler peut être en train de réapparaître)
  bb.invuln = 8; S.setCfg({ afkSec: 10 }); B3.clear(); bb.lastAct = 1; const afk = await B3.wait('afk', 3000).catch(() => null);
  const n0 = B3.snaps; await sleep(400);
  ok(afk && afk.id === mb.id && !bb.isPlayer && B3.snaps === n0, 'inactivité détectée : joueur sorti de la partie avec un message, la partie continue');
  B3.send({ t: 'input', seq: 1, mx: 1, my: 0 }); await sleep(100); ok(!bb.isPlayer, 'aucune commande acceptée tant que la partie n\'est pas reprise');
  B3.send({ t: 'resume' }); ok(!!(await B3.wait('match', 3000).catch(() => null)) && bb.isPlayer, 'reprise après inactivité');
  S.setCfg({ afkSec: 45 });
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
  { const pp = [...S.parties.values()].find((p) => p.members.includes(A.pid)); ok(pp && pp.state === 'idle' && pp.members.length >= 2 && pp.leader === A.pid, 'après la partie : même équipe, même chef, prête à rejouer (' + (pp && pp.members.length) + ' membres)'); }
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
  ok(inv.fromPid === E.pid && typeof inv.brawler === 'string' && E.lastOf('invite_sent') && E.lastOf('invite_sent').pid === D.pid, 'invitation : carte de l\'expéditeur (brawler, trophées) + confirmation d\'envoi');
  // chat d'équipe en temps réel
  D.clear(); E.clear(); E.send({ t: 'party_chat', text: 'Salut <b>équipe</b> !' }); const cm = await D.wait('party_chat');
  ok(cm.name === 'Eli' && cm.text === 'Salut béquipe/b !' && !/[<>]/.test(cm.text), 'chat d\'équipe reçu en temps réel (texte nettoyé : « ' + cm.text + ' »)');
  E.send({ t: 'party_chat', text: 'spam' }); await sleep(150); ok(!D.msgs.some((m) => m.t === 'party_chat' && m.text === 'spam'), 'anti-spam du chat');
  await sleep(700); E.send({ t: 'party_chat', text: 'GG !', q: 1 }); await D.wait('party_chat'); await sleep(100);
  D.send({ t: 'party_get' }); await sleep(200); const hist = (D.lastOf('party').party.chat || []).map((m) => m.text);
  ok(hist.includes('GG !'), 'historique du chat transmis avec l\'équipe (' + hist.length + ' messages)');
  // refus et annulation d'invitation
  E.clear(); D.send({ t: 'invite_decline', pid: E.pid }); ok((await E.wait('invite_declined')).pid === D.pid, 'refus d\'invitation signalé à l\'expéditeur');
  D.clear(); E.send({ t: 'invite_cancel', pid: D.pid }); ok((await D.wait('invite_cancelled')).from === E.pid, 'annulation d\'invitation signalée à l\'invité');
  D.send({ t: 'party_leave' }); E.send({ t: 'party_leave' });
  D.clear(); E.clear(); D.send({ t: 'club_create', name: 'Les Tests', tag: 'TST' }); const cl = await D.wait('club'); ok(cl.club && cl.club.tag === 'TST', 'création de club');
  E.send({ t: 'club_list' }); const cll = await E.wait('club_list'); ok(cll.list.some((x) => x.name === 'Les Tests'), 'liste des clubs');
  E.send({ t: 'club_join', id: cl.club.id }); await sleep(250); ok(E.lastOf('club').club.count === 2, 'rejoindre un club');
  D.clear(); E.send({ t: 'club_chat', txt: 'Salut <b>tous</b> !' }); const msgc = await D.wait('club_msg'); ok(msgc.msg.txt === 'Salut btous /b !' || !/[<>]/.test(msgc.msg.txt), 'chat de club (HTML nettoyé)');
  E.send({ t: 'club_leave' }); await sleep(200); ok(D.lastOf('club').club.count === 1, 'quitter un club');
  // --- duel entre amis : seul mode où l'on peut quitter (abandon = défaite) ---
  { const F1 = new Cl(url, 'Fred'), G1 = new Cl(url, 'Gina'); await F1.connect(); await G1.connect(); await sleep(150); F1.clear(); G1.clear();
    F1.send({ t: 'party_create', mode: 'duel' }); const pf = await F1.wait('party'); G1.send({ t: 'party_join', code: pf.party.code }); await sleep(200);
    F1.send({ t: 'party_set', ready: true }); G1.send({ t: 'party_set', ready: true });
    await F1.wait('match', 9000); await G1.wait('match', 9000); await sleep(300);
    F1.send({ t: 'match_leave' }); const ef = await F1.wait('end', 4000).catch(() => null), eg = await G1.wait('end', 4000).catch(() => null);
    ok(ef && eg && !ef.win && eg.win, 'duel entre amis : quitter est autorisé et compte comme une défaite');
    await sleep(6300); const pd = [...S.parties.values()].find((p) => p.code === pf.party.code);
    ok(pd && pd.members.length === 2 && pd.state === 'idle', 'après le duel : les deux joueurs restent ensemble pour une revanche'); }
  // --- promotion du chef ---
  { const H1 = new Cl(url, 'Hugo'), I1 = new Cl(url, 'Iris'); await H1.connect(); await I1.connect(); await sleep(150); H1.clear(); I1.clear();
    H1.send({ t: 'party_create', mode: 'gemgrab' }); const ph = await H1.wait('party'); I1.send({ t: 'party_join', code: ph.party.code }); await sleep(200);
    I1.clear(); H1.send({ t: 'party_promote', pid: I1.pid }); await sleep(200); ok(I1.lastOf('party').party.leader === I1.pid, 'le chef peut passer la main (synchronisé en temps réel)');
    H1.clear(); H1.send({ t: 'party_start', kind: 'private' }); ok((await H1.wait('error')).code === 'not_leader', 'seul le chef lance la partie'); }
  // --- format 2 contre 2 (file séparée, bots en complément) ---
  { const J1 = new Cl(url, 'Jade'), K1 = new Cl(url, 'Karl'); await J1.connect(); await K1.connect(); await sleep(150); J1.clear(); K1.clear();
    J1.send({ t: 'party_create', mode: 'gemgrab' }); const pj = await J1.wait('party'); K1.send({ t: 'party_join', code: pj.party.code }); await sleep(200);
    J1.send({ t: 'party_set', fmt: 2 }); await sleep(150); ok(K1.lastOf('party').party.fmt === 2, '2 contre 2 : format choisi par le chef, synchronisé');
    J1.send({ t: 'party_start', kind: 'queue', mode: 'gemgrab', fmt: 2 });
    const m2 = await J1.wait('match', 15000).catch(() => null);
    ok(m2 && m2.roster.length === 4 && m2.roster.filter((r) => r.team === 0).length === 2 && m2.roster.filter((r) => !r.bot).length === 2, '2 contre 2 en ligne : 4 joueurs (2 humains + 2 bots), 2 par équipe'); }
  // --- outils développeur : refusés sans compte développeur ---
  { A.clear(); A.send({ t: 'dv_sim', act: 'join' }); ok((await A.wait('error')).code === 'forbidden', 'outils développeur refusés à un joueur normal (vérifié par le serveur)');
    A.send({ t: 'dv_cfg', cfg: { afkSec: 999 } }); await sleep(150); ok(S.CFG.afkSec === 45, 'paramètres en direct non modifiables par un joueur normal'); }
  console.log(fails ? '\n' + fails + ' ECHEC(S)' : '\nTOUS LES TESTS PASSENT');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e); process.exit(2); });
