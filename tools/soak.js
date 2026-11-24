/* Test de charge : N parties simultanées de 6 joueurs réels (ws) pendant D secondes. Usage : node tools/soak.js [matchs] [secondes] */
process.env.FILL_WAIT = '1'; process.env.PORT = '0'; process.env.DATA_DIR = require('os').tmpdir() + '/brawl-soak-' + Date.now();
const WebSocket = require('../server/node_modules/ws');
const S = require('../server/server.js');
const NM = +process.argv[2] || 10, DUR = +process.argv[3] || 30;
(async () => {
  await new Promise((r) => S.server.listen(0, r));
  const url = 'ws://127.0.0.1:' + S.server.address().port;
  const cls = []; let bytes = 0, snaps = 0, errs = 0;
  const modes = ['gemgrab', 'brawlball', 'heist', 'bounty', 'hotzone', 'knockout'];
  for (let m = 0; m < NM; m++) for (let k = 0; k < 6; k++) {
    const ws = new WebSocket(url); const c = { ws, ready: false };
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', name: 'P' + m + '_' + k })));
    ws.on('message', (raw) => { const s = raw.toString(); const msg = JSON.parse(s); if (msg.t === 'snap') { snaps++; bytes += s.length; } else if (msg.t === 'welcome') { c.ready = true; } else if (msg.t === 'error') errs++; });
    ws.on('error', () => errs++); c.m = m; c.k = k; cls.push(c);
  }
  await new Promise((r) => setTimeout(r, 1500));
  // 6 joueurs par partie : création d'équipe + 5 qui rejoignent + file d'attente
  for (let m = 0; m < NM; m++) {
    const g = cls.filter((c) => c.m === m), mode = modes[m % modes.length];
    g[0].ws.send(JSON.stringify({ t: 'profile', brawler: ['sherry', 'rex', 'taurus', 'luna', 'yeti', 'zen'][m % 6], level: 5 }));
    g[0].ws.send(JSON.stringify({ t: 'party_create', mode }));
  }
  await new Promise((r) => setTimeout(r, 800));
  const codes = [...S.parties.keys()];
  for (let m = 0; m < NM; m++) { const g = cls.filter((c) => c.m === m); const code = codes[m]; for (let k = 1; k < 6; k++) g[k].ws.send(JSON.stringify({ t: 'party_join', code })); }
  await new Promise((r) => setTimeout(r, 600));
  for (let m = 0; m < NM; m++) cls.find((c) => c.m === m && c.k === 0).ws.send(JSON.stringify({ t: 'party_start', mode: modes[m % modes.length], kind: 'private', split: true }));
  await new Promise((r) => setTimeout(r, 6000));
  // entrées aléatoires 30 Hz
  const iv = setInterval(() => { for (const c of cls) if (c.ws.readyState === 1 && Math.random() < 0.5) c.ws.send(JSON.stringify({ t: 'input', seq: Date.now() & 0xffff, mx: Math.random() * 2 - 1, my: Math.random() * 2 - 1, a: Math.random() < 0.1 ? [Math.random() * 6.28, 400] : undefined, s: Math.random() < 0.02 ? [Math.random() * 6.28, 400] : undefined })); }, 33);
  // mesure du retard de boucle d'évènements
  let maxLag = 0, sumLag = 0, n = 0, last = process.hrtime.bigint();
  const lag = setInterval(() => { const now = process.hrtime.bigint(); const d = Number(now - last) / 1e6 - 10; last = now; if (d > maxLag) maxLag = d; sumLag += Math.max(0, d); n++; }, 10);
  const mem0 = process.memoryUsage().heapUsed / 1e6, t0 = Date.now(), cpu0 = process.cpuUsage();
  const b0 = bytes, s0 = snaps;
  await new Promise((r) => setTimeout(r, DUR * 1000));
  const cpu = process.cpuUsage(cpu0), el = (Date.now() - t0) / 1000;
  clearInterval(iv); clearInterval(lag);
  const active = [...S.matches.values()].filter((m) => m.state === 'play').length;
  console.log(JSON.stringify({ matchesPlaying: active, clients: cls.length, snapsPerSecPerClient: +((snaps - s0) / el / cls.length).toFixed(1), kbPerSecPerClient: +((bytes - b0) / el / cls.length / 1024).toFixed(1), cpuPercent: +(((cpu.user + cpu.system) / 1000) / (el * 1000) * 100).toFixed(0), eventLoopLagMs: { avg: +(sumLag / n).toFixed(2), max: +maxLag.toFixed(1) }, heapMB: { before: +mem0.toFixed(0), after: +((global.gc && global.gc(), process.memoryUsage().heapUsed) / 1e6).toFixed(0) }, errors: errs }));
  process.exit(0);
})();
