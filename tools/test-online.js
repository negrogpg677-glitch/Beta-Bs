/* Test de bout en bout d'un serveur multijoueur EN LIGNE (ex. après déploiement sur Render).
   Usage : node tools/test-online.js <adresse>     ex. node tools/test-online.js brawl-rush-server.onrender.com
   Vérifie : /health, réveil, 2 joueurs, équipe avec code, matchmaking, match, déplacement, tir, gadget, ping. */
'use strict';
const WebSocket = require('../server/node_modules/ws');
const host = (process.argv[2] || '').replace(/^(https?|wss?):\/\//, '').replace(/\/+$/, '');
if (!host) { console.log('Usage : node tools/test-online.js <adresse du serveur>'); process.exit(2); }
const local = /^(localhost|127\.|192\.168\.|10\.)/.test(host);
const http = (local ? 'http://' : 'https://') + host, wsu = (local ? 'ws://' : 'wss://') + host;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cl {
  constructor(name) { this.name = name; this.msgs = []; this.snaps = 0; this.last = null; this.waiters = []; this.pings = []; }
  connect() {
    return new Promise((res, rej) => {
      const t0 = Date.now(); this.ws = new WebSocket(wsu); const to = setTimeout(() => rej(new Error('connexion impossible')), 90000);
      this.ws.on('error', (e) => { clearTimeout(to); rej(e); });
      this.ws.on('open', () => this.ws.send(JSON.stringify({ t: 'hello', name: this.name, v: 1 })));
      this.ws.on('message', (raw) => {
        const m = JSON.parse(raw);
        if (m.t === 'snap') { this.snaps++; this.last = m; return; }
        if (m.t === 'pong') { this.pings.push(Date.now() - m.ts); return; }
        this.msgs.push(m); if (m.t === 'welcome') { clearTimeout(to); this.pid = m.pid; this.ms = Date.now() - t0; res(m); }
        this.waiters = this.waiters.filter((w) => { if (w.t === m.t && (!w.f || w.f(m))) { w.r(m); return false; } return true; });
      });
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(t, ms = 15000, f) { const ex = this.msgs.find((m) => m.t === t && !m.seen && (!f || f(m))); if (ex) { ex.seen = true; return Promise.resolve(ex); } return new Promise((r, j) => { const to = setTimeout(() => j(new Error('délai dépassé : ' + t)), ms); this.waiters.push({ t, f, r: (m) => { clearTimeout(to); m.seen = true; r(m); } }); }); }
}

(async () => {
  // 1. santé (réveille aussi un serveur gratuit endormi)
  const t0 = Date.now(); let h = null;
  for (let i = 0; i < 20 && !h; i++) { try { const r = await fetch(http + '/health'); if (r.ok) h = await r.json(); } catch (e) { await sleep(4000); } }
  ok(h && h.ok, '/health répond (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' + (Date.now() - t0 > 8000 ? ', serveur réveillé' : '') + ', protocole ' + (h && h.proto) + ')');
  if (!h) process.exit(1);
  const page = await fetch(http + '/').then((r) => r.text()).catch(() => '');
  ok(page.includes('<title>Brawl Rush</title>'), 'le jeu est aussi jouable dans un navigateur à cette adresse');
  // 2. deux joueurs
  const A = new Cl('TestA'), B = new Cl('TestB');
  await A.connect(); await B.connect();
  ok(A.pid !== B.pid, 'deux joueurs connectés (' + (local ? 'WebSocket' : 'WebSocket sécurisé') + ', ' + A.ms + ' ms)');
  for (let i = 0; i < 5; i++) { A.send({ t: 'ping', ts: Date.now() }); await sleep(200); }
  await sleep(500); const ping = A.pings.length ? Math.round(A.pings.reduce((a, b) => a + b, 0) / A.pings.length) : -1;
  ok(ping >= 0 && ping < 250, 'ping moyen ' + ping + ' ms');
  A.send({ t: 'profile', brawler: 'rex', skin: 'classic', level: 3, name: 'TestA' }); B.send({ t: 'profile', brawler: 'luna', skin: 'classic', level: 3, name: 'TestB' });
  // 3. équipe avec code
  A.send({ t: 'party_create', mode: 'gemgrab' }); const pa = await A.wait('party', 15000, (m) => m.party && m.party.code);
  B.send({ t: 'party_join', code: pa.party.code }); await B.wait('party', 15000, (m) => m.party && m.party.code); await sleep(300);
  ok(pa.party.code && (A.msgs.filter((m) => m.t === 'party' && m.party).pop() || { party: { members: [] } }).party.members.length === 2, 'équipe créée (code ' + pa.party.code + ') et rejointe par un ami');
  // 4. matchmaking + match
  A.send({ t: 'party_start', mode: 'gemgrab', kind: 'queue' });
  const ma = await A.wait('match', 40000); await B.wait('match', 40000);
  ok(ma.roster.length === 6, 'match lancé : ' + ma.roster.filter((r) => !r.bot).length + ' joueurs + ' + ma.roster.filter((r) => r.bot).length + ' bots étiquetés');
  let pos0 = null; const s0 = A.snaps, tm = Date.now(); let seq = 0;
  for (let i = 0; i < 240; i++) {
    seq++; const extra = i === 200 ? { a: [0, 300] } : i === 210 ? { gd: 1 } : {};
    A.send(Object.assign({ t: 'input', seq, mx: 1, my: 0, face: 0 }, extra)); B.send({ t: 'input', seq, mx: 0, my: 1 });
    await sleep(33);
    if (!pos0 && A.last && A.last.s === 1) pos0 = A.last.e[ma.you].slice(0, 2);
  }
  const rate = (A.snaps - s0) / ((Date.now() - tm) / 1000);
  ok(rate > 20, 'instantanés reçus à ' + rate.toFixed(0) + ' par seconde');
  const me = A.last.e[ma.you];
  ok(pos0 && Math.abs(me[0] - pos0[0]) > 30, 'déplacement pris en compte par le serveur');
  ok(me[7] < 30 || me[17] < 3, 'tir / gadget pris en compte (munitions ' + me[7] / 10 + ', gadgets ' + me[17] + ')');
  A.ws.close(); B.ws.close();
  console.log(fails ? '\n' + fails + ' ÉCHEC(S)' : '\nLE SERVEUR EN LIGNE FONCTIONNE');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('ERREUR', e.message); process.exit(2); });
