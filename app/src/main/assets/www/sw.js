/* Service worker : le jeu se charge instantanément et fonctionne hors-ligne (hors multijoueur). Passez VERSION pour forcer une mise à jour. */
const VERSION = 'brawlrush-v18';
const FILES = ['./', 'index.html', 'css/style.css', 'fonts/LilitaOne.ttf', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/flavor.js', 'js/util.js', 'js/data.js', 'js/maps.js', 'js/game.js', 'js/ai.js', 'js/render.js', 'js/chars.js', 'js/world.js', 'lib/three.min.js', 'lib/meshopt_decoder.js', 'lib/GLTFLoader.js', 'lib/SkeletonUtils.js', 'js/char3d.js', 'js/input.js', 'js/account.js', 'js/net.js', 'js/netmatch.js', 'js/ui.js', 'js/ui_online.js', 'js/ui_social.js', 'js/ui_account.js', 'js/pass.js', 'js/battlelog.js', 'js/team.js', 'js/matchui.js', 'js/social2.js', 'js/devtools.js', 'js/devpro.js', 'js/devui.js', 'js/modesui.js', 'js/stability.js', 'js/main.js', 'js/dev.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // réseau d'abord (toujours à jour), cache en secours (hors-ligne)
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
