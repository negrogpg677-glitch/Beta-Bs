/* Brawl Rush - boucle principale, déroulement d'un match, récompenses */
(function () {
  const G = window.G;
  const T = G.T;
  const App = (G.App = {
    M: null, state: 'menu', paused: false, last: 0, W: 0, H: 0, dpr: 1, t: 0, canvas: null, ctx: null, resultShown: false,
  });

  App.init = function () {
    G.Save.load();
    if (G.Account) G.Account.init();
    // qualité graphique choisie automatiquement selon la puissance du téléphone (une seule fois ; modifiable dans Réglages)
    if (!G.Save.data.qualityAuto) {
      const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
      G.Save.data.settings.quality = mem <= 2 || cores <= 4 ? 'low' : mem <= 4 || cores <= 6 ? 'medium' : 'high';
      G.Save.data.qualityAuto = true; G.Save.commit();
    }
    App.canvas = document.getElementById('game');
    App.ctx = App.canvas.getContext('2d');
    try { document.fonts.load('24px "Lilita One"'); } catch (e) { /* ignore */ }
    G.Input.attach(App.canvas);
    window.addEventListener('resize', App.resize);
    window.addEventListener('orientationchange', () => setTimeout(App.resize, 150));
    App.resize();
    const unlock = () => { G.Audio.unlock(); };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    G.UI.init();
    requestAnimationFrame(App.loop);
    // connexion automatique au serveur (si une adresse est disponible) : amis, invitations et matchmaking prêts dès l'accueil
    setTimeout(() => { if (G.Net.serverUrl()) G.Net.connect(); }, 600);
  };

  App.resize = function () {
    let q = G.Save.data.settings.quality;
    if (q === 'eco') q = 'low';
    G.Render.q = q === 'high' ? 2 : q === 'medium' ? 1 : 0;
    G.Render.dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    App.dpr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    App.W = window.innerWidth; App.H = window.innerHeight;
    const cv = App.canvas;
    cv.width = Math.round(App.W * App.dpr); cv.height = Math.round(App.H * App.dpr);
    cv.style.width = App.W + 'px'; cv.style.height = App.H + 'px';
    G.Input.W = App.W; G.Input.H = App.H;
    if (G.UI && G.UI.onResize) G.UI.onResize();
  };

  /* ----- lancement d'un match ----- */
  App.prepare = function (modeId) {
    const save = G.Save.data, mode = G.MODES[modeId];
    const mapKey = G.UI.currentMap ? G.UI.currentMap(modeId) : G.pick(mode.maps); // rotation horaire des arènes
    const id = save.selected;
    return G.Sim.create({
      mode: modeId, mapKey, brawlerId: id, skin: save.skins[id] || 'classic', level: save.levels[id] || 1,
      trophies: save.trophies[id] || 0, name: save.name,
    });
  };
  App.begin = function (M) {
    App.M = M; App.state = 'match'; App.paused = false; App.resultShown = false;
    G.Input.reset(); G.Input.enabled = true;
    document.body.classList.add('in-match');
    G.UI.hideAll();
    G.Audio.startMusic('battle');
    App.last = performance.now();
    if (G.Dev) G.Dev.onMatchStart(M);
    if (!G.Save.data.tutorialDone) { G.UI.showTutorial(); }
  };
  App.beginOnline = function (init) {
    G.UI.hideAll();
    const M = G.NetMatch.begin(init);
    App.begin(M);
  };
  App.togglePause = function () {
    if (App.state !== 'match' || !App.M || App.M.state === 'end') return;
    App.paused = !App.paused;
    G.Input.reset();
    if (App.paused) G.UI.showPause(); else G.UI.hidePause();
  };
  App.quitMatch = function () {
    const M = App.M;
    App.paused = false;
    G.UI.hidePause();
    if (M && M.net) { // abandon d'un match en ligne : l'IA reprend le brawler
      G.Net.send({ t: 'match_leave' }); App.state = 'menu'; App.M = null; G.Input.enabled = false; document.body.classList.remove('in-match');
      G.UI.netOverlay(false); G.Audio.startMusic('menu'); G.UI.show('home'); return;
    }
    if (M && M.state !== 'end') { // abandon = défaite
      M.result = { win: false, draw: false, winnerTeam: -1, place: M.mode === 'showdown' ? (M.player.alive ? M.alive : M.player.place || 10) : 0, time: M.t, quit: true };
      M.state = 'end'; M.endT = 99;
      App.finish();
    }
  };

  /* ----- boucle ----- */
  App.loop = function (now) {
    requestAnimationFrame(App.loop);
    let dt = Math.min(0.05, (now - App.last) / 1000 || 0.016);
    if (G.Dev && App.state === 'match' && App.M && !App.M.net) dt *= G.Dev.cfg.ts;
    App.last = now; App.t += dt;
    // qualité adaptative : si la fluidité chute en combat, on réduit les effets (une fois par palier)
    if (App.state === 'match' && !App.paused) {
      App.fpsN = (App.fpsN || 0) + 1; App.fpsT = (App.fpsT || 0) + dt;
      if (App.fpsT > 2.5) {
        const fps = App.fpsN / App.fpsT; App.fpsN = 0; App.fpsT = 0;
        const set = G.Save.data.settings;
        if (fps < 38 && set.quality !== 'low' && set.quality !== 'eco') { set.quality = set.quality === 'high' ? 'medium' : 'low'; G.Save.commit(); App.resize(); G.UI.toast('Qualité réduite pour rester fluide', 2200); }
      }
    }
    const c = App.ctx;
    if (App.state === 'match' && App.M) {
      const M = App.M;
      if (M.net) { // combat en ligne : le serveur fait la simulation
        if (!App.paused) G.Input.update(M, dt);
        G.NetMatch.update(M, dt);
        App.updateCam(M, dt);
        if (!M.ready) { c.setTransform(App.dpr, 0, 0, App.dpr, 0, 0); c.fillStyle = '#12134a'; c.fillRect(0, 0, App.W, App.H); c.fillStyle = '#fff'; c.font = '28px "Lilita One", sans-serif'; c.textAlign = 'center'; c.fillText('Connexion à la partie…', App.W / 2, App.H / 2); return; }
      } else if (!App.paused) {
        G.Input.update(M, dt);
        G.Sim.update(M, dt);
        App.updateCam(M, dt);
      }
      c.setTransform(App.dpr, 0, 0, App.dpr, 0, 0);
      G.Render.drawMatch(c, M, App.W, App.H, App.t);
      const prev = G.Input.aimPreview(M);
      if (prev && !App.paused) {
        const cam = G.Render.lastCam;
        c.save(); c.translate(App.W / 2, App.H / 2); c.scale(cam.sc, cam.sc); c.translate(-cam.cx, -cam.cy);
        G.Render.drawAim(c, M, M.player, prev.ang, prev.dist, prev.sup); c.restore();
      }
      G.Render.drawHUD(c, M, App.W, App.H, G.Input, App.t);
      if (G.Dev) G.Dev.draw(c, M, dt);
      if (M.state === 'end' && M.endT > 2.4 && !App.resultShown && (!M.net || G.NetMatch.endMsg || M.endT > 6)) App.finish();
    } else {
      G.UI.tick(dt, App.t);
    }
  };

  App.updateCam = function (M, dt) {
    const p = M.player, cam = M.cam;
    let tx, ty;
    if (M.state === 'goal' && M.ball) { tx = M.ball.x; ty = M.ball.y; }
    else if (p.alive) {
      tx = p.x + p.input.mx * 46; ty = p.y + p.input.my * 36;
      const prev = G.Input.aimPreview(M);
      if (prev && !prev.sup) { tx += Math.cos(prev.ang) * 50; ty += Math.sin(prev.ang) * 40; }
    } else {
      const mate = M.ents.find((e) => e.alive && e.team === p.team && e !== p) || (p.lastHitBy && p.lastHitBy.alive ? p.lastHitBy : null) || M.ents.find((e) => e.alive);
      tx = mate ? mate.x : p.x; ty = mate ? mate.y : p.y;
    }
    const k = Math.min(1, dt * (M.state === 'goal' ? 3 : 6));
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    cam.kick = Math.max(0, (cam.kick || 0) - dt * 4); cam.zoom = 1 + cam.kick * 0.035; // à-coup de caméra (tirs, K.O.)
  };

  /* ----- fin de match, récompenses ----- */
  const SD_TROPHY = [10, 8, 6, 4, 2, 0, -1, -2, -3, -4];
  const SD_COINS = [95, 75, 60, 48, 38, 30, 24, 18, 14, 10];
  App.finish = function () {
    if (App.resultShown) return;
    App.resultShown = true;
    const M = App.M, r = M.result, p = M.player, save = G.Save.data, id = p.id;
    const online = M.net ? (G.NetMatch.endMsg || { delta: 0, coins: 20 + p.kills * 4, place: r.place }) : null;
    const before = save.trophies[id] || 0;
    let delta = 0, coins = 0, gems = 0, box = 0;
    if (M.mode === 'showdown') {
      const pl = Math.max(1, Math.min(10, r.place || 10));
      delta = SD_TROPHY[pl - 1]; coins = SD_COINS[pl - 1];
      box = pl <= 3 ? 1 : Math.random() < 0.25 ? 1 : 0;
      if (pl === 1) gems = Math.random() < 0.5 ? 2 : 0;
    } else if (r.win) {
      delta = 8 + (before > 400 ? 0 : 1) + (Math.random() < 0.3 ? 1 : 0); coins = 55 + G.ri(0, 20);
      box = Math.random() < 0.75 ? 1 : 0; if (Math.random() < 0.15) gems = 1 + G.ri(0, 1);
    } else if (r.draw) { delta = 0; coins = 28; box = Math.random() < 0.2 ? 1 : 0; }
    else { delta = -Math.min(before, G.clamp(Math.round(2 + before / 70), 2, 8)); coins = 20 + G.ri(0, 8); box = Math.random() < 0.2 ? 1 : 0; }
    if (online) { delta = online.delta; coins = online.coins - 4 * (M.stats.kills || p.kills || 0); box = r.win ? (Math.random() < 0.6 ? 1 : 0) : (Math.random() < 0.2 ? 1 : 0); gems = 0; }
    if (r.quit) { delta = -Math.min(before, 5); coins = 0; box = 0; gems = 0; }
    coins += M.stats.kills * 4;
    const kill = M.stats.kills || 0;
    save.trophies[id] = Math.max(0, before + delta);
    save.coins += coins; save.gems += gems; save.boxes += box;
    const st = save.stats;
    st.matches++; st.kills += kill; st.damage += Math.round(M.stats.damage); st.gemsGrabbed += M.stats.gems; st.goals += M.stats.goals;
    const placeTop3 = M.mode === 'showdown' && (r.place || 10) <= 3;
    if (r.win) { st.wins++; if (M.mode === 'showdown') st.showdownWins++; } else if (!r.draw) st.losses++;
    const bm = (st.byMode = st.byMode || {}); const e = (bm[M.mode] = bm[M.mode] || { played: 0, wins: 0 }); e.played++; if (r.win) e.wins++;
    st.playTime = (st.playTime || 0) + Math.round(M.t);
    st.hist = (st.hist || []); st.hist.unshift({ m: M.mode, w: r.win ? 1 : r.draw ? 0 : -1, b: id, d: delta, t: Date.now(), k: kill }); st.hist.length = Math.min(st.hist.length, 12);
    st.bestTr = Math.max(st.bestTr || 0, G.Save.totalTrophies());
    G.Quests.progress('play', 1);
    if (r.win) { G.Quests.progress('win', 1); G.Quests.progress('win_' + M.mode, 1); }
    if (placeTop3) G.Quests.progress('top3_showdown', 1);
    G.Quests.progress('kill', kill); G.Quests.progress('damage', Math.round(M.stats.damage));
    G.Quests.progress('super', M.stats.supers); G.Quests.progress('heal', Math.round(M.stats.heal)); G.Quests.progress('gems', M.stats.gems);
    const passR = G.Pass ? G.Pass.add(G.Pass.xpFor(r, kill)) : null;
    G.Save.commit();
    App.state = 'menu'; G.Input.enabled = false; App.M = null;
    document.body.classList.remove('in-match');
    G.Audio.startMusic('menu');
    if (online) G.UI.netOverlay(false);
    G.UI.showResult({ online: !!online, M, r, delta, coins, gems, box, brawler: id, before, after: save.trophies[id], kills: kill, damage: Math.round(M.stats.damage), mode: M.mode, place: r.place, time: M.t, passXp: passR ? passR.xp : 0, passTier: passR && passR.t1 > passR.t0 ? passR.t1 : 0 });
  };

  /* ----- évènements réseau ----- */
  G.Net.on('snap', (s) => G.NetMatch.onSnap(s));
  G.Net.on('match', (init) => {
    if (App.state === 'match' && App.M && App.M.net) { App.M = G.NetMatch.begin(init); G.UI.netOverlay(false); return; }
    if (App.state === 'match') return;
    App.beginOnline(init); G.UI.versusRoster(init);
  });
  G.Net.on('end', (e) => {
    const M = App.M;
    if (App.state === 'match' && M && M.net && M.state !== 'end') { // fin manquée pendant une coupure
      M.result = { win: e.win, draw: e.draw, winnerTeam: -1, place: e.place, time: M.t }; M.state = 'end'; M.endT = 3;
      M.stats = Object.assign({ damage: 0, kills: 0, supers: 0, heal: 0, gems: 0, goals: 0 }, e.stats || {});
    }
  });
  G.Net.on('status', (st) => {
    const M = App.M;
    if (App.state === 'match' && M && M.net && M.state !== 'end') {
      G.UI.netOverlay(st !== 'online', st === 'online' ? '' : 'Connexion perdue… reconnexion en cours');
      if (st !== 'online') M.resumeWait = true;
    }
  });
  G.Net.on('welcome', () => {
    const M = App.M;
    if (App.state === 'match' && M && M.net && M.resumeWait) {
      setTimeout(() => { if (App.M === M && M.resumeWait && App.state === 'match' && M.state !== 'end') { G.UI.netOverlay(false); G.UI.toast('La partie est terminée.'); App.quitMatch(); } }, 3500);
    }
  });
  G.Net.on('match', () => { if (App.M) App.M.resumeWait = false; });

  /* ----- appel natif Android ----- */
  G.onBack = function () {
    if (App.state === 'match') { App.togglePause(); return true; }
    return G.UI.back();
  };
  G.onPause = function () { if (App.state === 'match' && !App.paused && App.M && App.M.state !== 'end') App.togglePause(); if (G.Audio.timer) { clearInterval(G.Audio.timer); G.Audio.timer = null; } };
  G.onResume = function () { if (G.Audio.ctx && G.Audio.ctx.state === 'suspended') G.Audio.ctx.resume(); G.Audio.startMusic(App.state === 'match' ? 'battle' : 'menu'); };

  /* ----- quêtes quotidiennes ----- */
  G.Quests = {
    ensure() {
      const s = G.Save.data, day = G.dayKey();
      if (!s.quests || s.questDay !== day) {
        const pool = G.shuffle(G.QUEST_POOL.slice()).slice(0, 3);
        s.quests = pool.map((q) => ({ id: q.id, progress: 0, claimed: false }));
        s.questDay = day; G.Save.commit();
      }
      return s.quests;
    },
    progress(stat, n) {
      if (!n) return;
      const list = this.ensure();
      for (const q of list) { const def = G.QUEST_POOL.find((d) => d.id === q.id); if (def && def.stat === stat && !q.claimed) q.progress = Math.min(def.goal, q.progress + n); }
    },
    claimable() { return this.ensure().filter((q) => { const d = G.QUEST_POOL.find((x) => x.id === q.id); return !q.claimed && q.progress >= d.goal; }).length; },
  };

  window.addEventListener('load', () => { try { App.init(); } catch (e) { console.error(e); document.body.innerHTML = '<pre style="color:#fff;padding:20px">Erreur : ' + e.message + '\n' + e.stack + '</pre>'; } });
})();
