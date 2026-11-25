/* Brawl Rush - client réseau : connexion WebSocket, reconnexion automatique, équipes, matchmaking */
(function () {
  const G = window.G;
  const Net = (G.Net = {
    ws: null, status: 'off', pid: null, token: null, party: null, queue: null, lobby: null, ping: 0, lb: null, welcome: null,
    wanted: false, retry: 0, handlers: {}, lastErr: '', inMatch: false, matchId: null, online: 0,
  });

  /* "mon-serveur.com" -> wss://mon-serveur.com ; "192.168.1.5:8080" -> ws://192.168.1.5:8080 */
  Net.normalize = function (s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (/^wss?:\/\//i.test(s)) return s;
    s = s.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(s);
    return (local ? 'ws://' : 'wss://') + s;
  };
  // priorité : ?server= (test) > réglage avancé > adresse intégrée au jeu > serveur qui héberge la page (PWA / navigateur)
  Net.serverUrl = function () {
    const q = (location.search.match(/[?&]server=([^&]+)/) || [])[1];
    const saved = G.Save.data.settings.server || '';
    let u = q ? decodeURIComponent(q) : G.DEFAULT_SERVER || saved || ''; // l'adresse intégrée à l'APK passe avant une ancienne adresse enregistrée
    if (!u && /^https?:$/.test(location.protocol)) u = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    return Net.normalize(u);
  };
  Net.on = (t, fn) => { (Net.handlers[t] = Net.handlers[t] || []).push(fn); };
  Net.off = (t, fn) => { Net.handlers[t] = (Net.handlers[t] || []).filter((f) => f !== fn); };
  const emit = (t, m) => { (Net.handlers[t] || []).slice().forEach((f) => { try { f(m); } catch (e) { console.error(e); } }); };
  Net.send = function (o) { if (Net.ws && Net.ws.readyState === 1) { Net.ws.send(JSON.stringify(o)); return true; } return false; };
  Net.waking = () => (Net.status === 'connecting' || Net.status === 'reconnecting') && Date.now() - (Net.since || Date.now()) > 5000;
  Net.setStatus = function (s) { if (Net.status !== s) { Net.status = s; emit('status', s); } };

  Net.connect = function () {
    Net.wanted = true;
    const url = Net.serverUrl();
    if (!url) { Net.lastErr = 'Aucun serveur configuré (Réglages > Serveur).'; Net.setStatus('off'); emit('neterror', { msg: Net.lastErr }); return; }
    if (Net.ws && (Net.ws.readyState === 0 || Net.ws.readyState === 1)) return;
    if (Net.status !== 'connecting' && Net.status !== 'reconnecting') Net.since = Date.now();
    Net.setStatus(Net.retry ? 'reconnecting' : 'connecting');
    let ws;
    try { ws = new WebSocket(url); } catch (e) { Net.lastErr = 'Adresse de serveur invalide.'; Net.setStatus('off'); emit('neterror', { msg: Net.lastErr }); return; }
    Net.ws = ws;
    const to = setTimeout(() => { if (ws.readyState === 0) { try { ws.close(); } catch (e) { /* ignore */ } } }, 20000); // un serveur gratuit endormi met jusqu'à ~1 min à se réveiller
    ws.onopen = () => {
      clearTimeout(to);
      const n = G.Save.data.net || {};
      ws.send(JSON.stringify({ t: 'hello', pid: n.pid, token: n.token, name: G.Save.data.name, v: 1 }));
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      Net.handle(m);
    };
    ws.onclose = () => {
      clearTimeout(to);
      if (Net.ws !== ws) return;
      Net.ws = null; Net.party = Net.party; // l'équipe est conservée côté serveur
      const was = Net.status;
      Net.setStatus(Net.wanted ? 'reconnecting' : 'off');
      emit('disconnected', { wasOnline: was === 'online' });
      if (Net.wanted) { Net.retry++; setTimeout(Net.connect, Math.min(5000, 800 * Math.pow(1.6, Math.min(Net.retry, 6)))); }
    };
    ws.onerror = () => { Net.lastErr = 'Connexion au serveur impossible.'; };
  };
  Net.disconnect = function () { Net.wanted = false; Net.retry = 0; if (Net.ws) { try { Net.ws.close(); } catch (e) { /* ignore */ } } Net.ws = null; Net.setStatus('off'); Net.party = null; Net.queue = null; Net.lobby = null; };
  Net.ensure = function () { if (!Net.wanted || !Net.ws) Net.connect(); };

  Net.sendProfile = function () {
    const s = G.Save.data, id = s.selected;
    Net.send({ t: 'profile', brawler: id, skin: s.skins[id] || 'classic', level: s.levels[id] || 1, name: s.name });
  };

  Net.handle = function (m) {
    switch (m.t) {
      case 'welcome':
        Net.friendCode = m.friendCode; Net.club = m.club;
        Net.pid = m.pid; Net.token = m.token; Net.welcome = m; Net.retry = 0; Net.online = m.online;
        G.Save.data.net = { pid: m.pid, token: m.token }; G.Save.commit();
        Net.setStatus('online'); Net.sendProfile();
        if (!Net._pingIv) Net._pingIv = setInterval(() => Net.send({ t: 'ping', ts: Date.now() }), 3000);
        break;
      case 'pong': Net.ping = Date.now() - m.ts; break;
      case 'party': Net.party = m.party; break;
      case 'queue': Net.queue = m.state === 'searching' ? { mode: m.mode, since: Date.now() } : null; break;
      case 'lobby': Net.lobby = m; Net.queue = null; break;
      case 'lobby_closed': Net.lobby = null; break;
      case 'match': Net.lobby = null; Net.queue = null; Net.matchId = m.id; break;
      case 'lb': Net.lb = m; break;
      case 'kicked': Net.party = null; break;
      case 'friends': if (!Net.me) Net.friends = m; break; // compte connecté : la liste vient de la base (message « fr »)
      case 'club': Net.club = m.club; break;
      case 'club_list': Net.clubList = m.list; break;
      case 'error': Net.lastErr = m.msg; break;
    }
    emit(m.t, m);
  };

  /* actions */
  Net.createParty = (mode) => Net.send({ t: 'party_create', mode });
  Net.joinParty = (code) => Net.send({ t: 'party_join', code });
  Net.leaveParty = () => Net.send({ t: 'party_leave' });
  Net.setMode = (mode) => Net.send({ t: 'party_set', mode });
  Net.kick = (pid) => Net.send({ t: 'party_kick', pid });
  Net.startQueue = (mode) => Net.send({ t: 'party_start', mode, kind: 'queue' });
  Net.startPrivate = (mode, split) => Net.send({ t: 'party_start', mode, kind: 'private', split: !!split });
  Net.cancelQueue = () => Net.send({ t: 'queue_cancel' });
  Net.getLeaderboard = () => Net.send({ t: 'lb' });
  Net.addFriend = (code) => Net.send({ t: 'friend_add', code });
  Net.removeFriend = (pid) => Net.send({ t: 'friend_remove', pid });
  Net.invite = (pid, mode) => Net.send({ t: 'invite', pid, mode });
  Net.clubCreate = (name, tag) => Net.send({ t: 'club_create', name, tag });
  Net.clubJoin = (id) => Net.send({ t: 'club_join', id });
  Net.clubLeave = () => Net.send({ t: 'club_leave' });
  Net.clubChat = (txt) => Net.send({ t: 'club_chat', txt });
  Net.clubList2 = () => Net.send({ t: 'club_list' });
})();
