/* Proxy WebSocket qui simule latence + gigue + perte (pour tester la qualité réseau). Usage : node lagproxy.js <portProxy> <portServeur> <latenceMs> <gigueMs> */
const WebSocket = require('ws');
const [lp, sp, lat, jit] = [+process.argv[2] || 9124, +process.argv[3] || 9123, +process.argv[4] || 80, +process.argv[5] || 40];
const wss = new WebSocket.Server({ port: lp });
const delay = () => lat + (Math.random() * 2 - 1) * jit;
wss.on('connection', (c) => {
  const s = new WebSocket('ws://127.0.0.1:' + sp); const q = [];
  // la file garantit l'ordre (TCP) même avec de la gigue
  const pipe = (from, to) => { let last = 0; from.on('message', (m) => { const t = Math.max(last, Date.now() + delay()); last = t; setTimeout(() => { const send = () => { if (to.readyState === 1) to.send(m.toString()); }; if (to.readyState === 1) send(); else if (to.readyState === 0) to.once('open', send); }, t - Date.now()); }); };
  pipe(c, s); pipe(s, c);
  c.on('close', () => s.close()); s.on('close', () => c.close()); c.on('error', () => {}); s.on('error', () => {});
});
console.log('lagproxy ' + lp + ' -> ' + sp + ' (' + lat + '±' + jit + ' ms)');
