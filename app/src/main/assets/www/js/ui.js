/* Brawl Rush - menus, boutique, brawlers, route des trophées, coffres, résultats */
(function () {
  const G = window.G;
  const UI = (G.UI = { screen: null, anim: [], modals: [], timers: [], selBrawler: null, shopTab: 'offers', busy: false });
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const S = () => G.Save.data;

  /* ---------- icônes SVG ---------- */
  const O = '#14123a';
  const ICONS = {
    coin: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13.5" fill="#ffc21f" stroke="${O}" stroke-width="3"/><circle cx="16" cy="16" r="9" fill="#ffe45a" stroke="#c98a00" stroke-width="2"/><path d="M12 12.5q4-3 8 0M12 19.5q4 3 8 0" stroke="#c98a00" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
    gem: `<svg viewBox="0 0 32 32"><polygon points="16,3 27,12 16,29 5,12" fill="#d56bff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><polygon points="16,3 27,12 16,15 5,12" fill="#f3c4ff"/><polygon points="16,15 27,12 16,29" fill="#a032e0"/></svg>`,
    trophy: `<svg viewBox="0 0 32 32"><path d="M9 4h14v8a7 7 0 01-14 0z" fill="#ffc21f" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M9 7H4q0 7 6 8M23 7h5q0 7-6 8" fill="none" stroke="${O}" stroke-width="3"/><rect x="13" y="19" width="6" height="5" fill="#e8a000" stroke="${O}" stroke-width="2.4"/><rect x="9" y="24" width="14" height="5" rx="1.5" fill="#ffc21f" stroke="${O}" stroke-width="2.6"/><path d="M12 7v5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    star: `<svg viewBox="0 0 32 32"><polygon points="16,2.5 20,11.5 29.5,12.4 22.3,18.7 24.6,28 16,23 7.4,28 9.7,18.7 2.5,12.4 12,11.5" fill="#ffd21f" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><polygon points="16,6 18.6,12 16,14 13.4,12" fill="#fff6a0"/></svg>`,
    skull: `<svg viewBox="0 0 32 32"><path d="M16 3C9 3 5 8 5 14c0 4 2 6 4 7v5h14v-5c2-1 4-3 4-7 0-6-4-11-11-11z" fill="#f4f4fa" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><circle cx="11.5" cy="14.5" r="3.2" fill="${O}"/><circle cx="20.5" cy="14.5" r="3.2" fill="${O}"/><path d="M16 18l-1.6 3h3.2z" fill="${O}"/><path d="M12 26v-3M16 26v-3M20 26v-3" stroke="${O}" stroke-width="2"/></svg>`,
    ball: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#fff" stroke="${O}" stroke-width="3"/><polygon points="16,9 22,13.5 19.8,20.5 12.2,20.5 10,13.5" fill="${O}"/><path d="M16 9V3M22 13.5l6-2M19.8 20.5l4 5.5M12.2 20.5L8.2 26M10 13.5l-6-2" stroke="${O}" stroke-width="2.4"/></svg>`,
    safe: `<svg viewBox="0 0 32 32"><rect x="3" y="4" width="26" height="23" rx="4" fill="#9aa6b8" stroke="${O}" stroke-width="3"/><rect x="7" y="8" width="18" height="15" rx="2" fill="#c3ccda" stroke="${O}" stroke-width="2"/><circle cx="16" cy="15.5" r="5" fill="#8794a8" stroke="${O}" stroke-width="2.4"/><circle cx="16" cy="15.5" r="1.6" fill="#ffd21f"/><rect x="6" y="27" width="4" height="3" fill="${O}"/><rect x="22" y="27" width="4" height="3" fill="${O}"/></svg>`,
    lock: `<svg viewBox="0 0 32 32"><path d="M9 14V10a7 7 0 0114 0v4" fill="none" stroke="${O}" stroke-width="6"/><path d="M9 14V10a7 7 0 0114 0v4" fill="none" stroke="#c3ccda" stroke-width="2.6"/><rect x="5" y="13" width="22" height="16" rx="3.5" fill="#ffc21f" stroke="${O}" stroke-width="3"/><circle cx="16" cy="21" r="2.6" fill="${O}"/></svg>`,
    home: `<svg viewBox="0 0 32 32"><path d="M3 15L16 4l13 11h-4v12H7V15z" fill="#fff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="18" width="6" height="9" fill="#ff9f1a" stroke="${O}" stroke-width="2.4"/></svg>`,
    bag: `<svg viewBox="0 0 32 32"><path d="M6 10h20l2 18H4z" fill="#ff6a6a" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M11 13V9a5 5 0 0110 0v4" fill="none" stroke="${O}" stroke-width="3"/><path d="M12 17v2M20 17v2" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
    user: `<svg viewBox="0 0 32 32"><circle cx="16" cy="10" r="6.5" fill="#ffe0b8" stroke="${O}" stroke-width="3"/><path d="M4 29c0-8 5-12 12-12s12 4 12 12z" fill="#3a8cff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/></svg>`,
    flag: `<svg viewBox="0 0 32 32"><path d="M7 3v27" stroke="${O}" stroke-width="5" stroke-linecap="round"/><path d="M7 5h20l-5 6 5 6H7z" fill="#ffd21f" stroke="${O}" stroke-width="3" stroke-linejoin="round"/></svg>`,
    gift: `<svg viewBox="0 0 32 32"><rect x="4" y="12" width="24" height="17" rx="2" fill="#ff5a7a" stroke="${O}" stroke-width="3"/><rect x="2.5" y="8" width="27" height="7" rx="2" fill="#ff8aa0" stroke="${O}" stroke-width="3"/><rect x="14" y="8" width="4" height="21" fill="#ffd21f"/><path d="M16 8c-6-8-11-3-6 0M16 8c6-8 11-3 6 0" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/></svg>`,
    scroll: `<svg viewBox="0 0 32 32"><rect x="5" y="3" width="22" height="26" rx="3" fill="#ffe9b0" stroke="${O}" stroke-width="3"/><path d="M10 10h12M10 15h12M10 20h8" stroke="#a8742a" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    chest: `<svg viewBox="0 0 32 32"><path d="M4 14q0-9 12-9t12 9z" fill="#c9742a" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><rect x="4" y="14" width="24" height="14" rx="2" fill="#a85a1c" stroke="${O}" stroke-width="3"/><rect x="13" y="12" width="6" height="8" rx="1.5" fill="#ffd21f" stroke="${O}" stroke-width="2.4"/><path d="M4 14h24" stroke="#ffd21f" stroke-width="2.4"/></svg>`,
    check: `<svg viewBox="0 0 32 32"><path d="M6 17l7 7 13-14" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 17l7 7 13-14" fill="none" stroke="#7dff7a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bolt: `<svg viewBox="0 0 32 32"><polygon points="19,2 7,18 15,18 12,30 25,13 17,13" fill="#ffd21f" stroke="${O}" stroke-width="3" stroke-linejoin="round"/></svg>`,
    friends: `<svg viewBox="0 0 32 32"><circle cx="11" cy="10" r="5.5" fill="#ffe0b8" stroke="${O}" stroke-width="3"/><circle cx="22" cy="12" r="4.5" fill="#ffd0a0" stroke="${O}" stroke-width="3"/><path d="M1.5 28c0-7 4-10 9.5-10s9.5 3 9.5 10z" fill="#3a8cff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M19 20c1-1 2.5-1.5 4-1.5 5 0 7.500 3 7.500 9.500h-8" fill="#ff7a8a" stroke="${O}" stroke-width="3" stroke-linejoin="round"/></svg>`,
    shield: `<svg viewBox="0 0 32 32"><path d="M16 3l11 4v9c0 7-5 11-11 13C10 27 5 23 5 16V7z" fill="#ffc21f" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M16 8l6 2v6c0 4-3 6.500-6 7.500-3-1-6-3.500-6-7.500v-6z" fill="#ff5a3a"/></svg>`,
    chat: `<svg viewBox="0 0 32 32"><path d="M4 6h24v16H15l-6 5v-5H4z" fill="#fff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><path d="M9 12h14M9 17h9" stroke="#3a8cff" stroke-width="2.600" stroke-linecap="round"/></svg>`,
    back: `<svg viewBox="0 0 32 32"><path d="M20 6L9 16l11 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  (function () { // engrenage
    let p = ''; const n = 8;
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? 9.5 : 13.5; p += (i ? 'L' : 'M') + (16 + Math.cos(a) * r).toFixed(1) + ' ' + (16 + Math.sin(a) * r).toFixed(1); }
    ICONS.gear = `<svg viewBox="0 0 32 32"><path d="${p}Z" fill="#c8d0e8" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><circle cx="16" cy="16" r="4.5" fill="#6b7390" stroke="${O}" stroke-width="2.6"/></svg>`;
  })();
  const ic = (n, cls) => (ICONS[n] || '').replace('<svg', '<svg class="ic ' + (cls || '') + '"');
  G.ic = ic;
  const MODE_ICON = { gem: 'gem', ball: 'ball', safe: 'safe', star: 'star', skull: 'skull', zone: 'flag', robot: 'gear' };

  /* ---------- utilitaires ---------- */
  UI.toast = function (msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('show'), ms || 2200);
  };
  const addTimer = (fn, ms) => { const id = setTimeout(fn, ms); UI.timers.push(id); return id; };
  const clearTimers = () => { UI.timers.forEach(clearTimeout); UI.timers = []; };
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };

  function portraitCanvas(id, skin, size, cls, opts) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; if (cls) cv.className = cls;
    G.Render.portrait(cv, id, skin || 'classic', 0, opts || { aim: 0.4 });
    return cv;
  }
  function animate(cv, id, skin, opts) { UI.anim.push({ cv, id, skin, opts: opts || {} }); }
  function skinOf(id) { return S().skins[id] || 'classic'; }

  UI.refreshCur = function () {
    $$('.cur-coins').forEach((e) => (e.textContent = fmt(S().coins)));
    $$('.cur-gems').forEach((e) => (e.textContent = fmt(S().gems)));
  };
  const bump = (cls) => $$('.' + cls).forEach((e) => { const p = e.closest('.pill'); if (p) { p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } });

  /* ---------- initialisation ---------- */
  UI.init = function () {
    const root = $('#ui');
    root.innerHTML = '<section id="splash" class="screen"></section><section id="home" class="screen"></section><section id="shop" class="screen slide"></section><section id="brawlers" class="screen slide"></section><section id="road" class="screen slide"></section><section id="social" class="screen slide"></section>';
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a || a.disabled) return;
      const fn = ACT[a.dataset.act];
      if (fn) { G.Audio.unlock(); fn(a, e); }
    });
    $('#pauseBtn').addEventListener('click', () => G.App.togglePause());
    UI.onResize();
    G.Quests.ensure();
    UI.splash();
  };
  UI.onResize = function () {
    const u = Math.min(window.innerWidth / 177.8, window.innerHeight / 100);
    document.documentElement.style.setProperty('--u', u.toFixed(3) + 'px');
    const bg = $('#bg'); if (bg) { bg.width = Math.ceil(window.innerWidth / 3); bg.height = Math.ceil(window.innerHeight / 3); }
  };

  UI.hideAll = function () {
    $$('#ui .screen').forEach((s) => s.classList.remove('active'));
    $$('#ui .overlay, #ui .fullscreen').forEach((o) => o.remove());
    UI.modals = []; UI.anim = []; clearTimers(); UI.screen = null;
  };
  UI.show = function (name) {
    $$('#ui .screen').forEach((s) => s.classList.toggle('active', s.id === name));
    UI.screen = name; UI.anim = [];
    const b = UI.build[name]; if (b) b();
    UI.refreshCur();
  };

  UI.tick = function (dt, t) {
    const bg = $('#bg');
    if (bg && !document.body.classList.contains('in-match')) {
      const c = bg.getContext('2d'); G.Render.drawMenuBg(c, bg.width, bg.height, t);
    }
    for (const a of UI.anim) {
      if (!a.cv.isConnected) continue;
      G.Render.portrait(a.cv, a.id, a.skin, t, a.opts);
    }
  };

  /* ---------- écran titre ---------- */
  UI.splash = function () {
    const s = $('#splash');
    s.innerHTML = `<div class="splash-chars"></div>
      <div class="logo">BRAWL<small>RUSH</small></div>
      <div class="loadbar"><i></i></div>
      <div class="splash-sub" style="display:none">Touchez pour jouer</div>`;
    const chars = $('.splash-chars', s);
    const ids = ['sherry', 'rex', 'taurus', 'boomer', 'luna', 'spiky', 'corbeau', 'frost', 'pyro', 'volt'];
    const pick = G.shuffle(ids.slice()).slice(0, 2);
    pick.forEach((id, i) => { const cv = portraitCanvas(id, 'classic', 420, '', { aim: i ? 2.6 : 0.5 }); cv.style.left = i ? 'auto' : '4rem'; cv.style.right = i ? '4rem' : 'auto'; chars.appendChild(cv); animate(cv, id, 'classic', { aim: i ? 2.6 : 0.5 }); });
    s.classList.add('active'); UI.screen = 'splash';
    let p = 0; const bar = $('.loadbar i', s);
    const iv = setInterval(() => {
      p += 0.18 + Math.random() * 0.15; bar.style.width = Math.min(100, p * 100) + '%';
      if (p >= 1) { clearInterval(iv); $('.loadbar', s).style.display = 'none'; $('.splash-sub', s).style.display = 'block'; s.dataset.ready = '1'; }
    }, 180);
    s.onclick = () => {
      if (!s.dataset.ready) return;
      G.Audio.unlock(); G.Audio.sfx('ui'); G.Audio.startMusic('menu');
      s.dataset.ready = ''; UI.show('home');
      addTimer(() => { if (!S().tutorialDone) UI.toast('Bienvenue ! Choisissez un mode et appuyez sur JOUER.', 3500); UI.checkDaily(); }, 600);
    };
  };

  /* ---------- accueil ---------- */
  UI.build = {};
  UI.build.home = function () {
    const sv = S(), id = sv.selected, def = G.BRAWLER[id], tot = G.Save.totalTrophies(), mode = G.MODES[sv.mode];
    const home = $('#home');
    const canDaily = !UI.dailyDone();
    home.innerHTML = `
      <div class="topbar">
        <div class="profile" data-act="profile"><canvas width="160" height="160"></canvas><div><div class="nm">${esc(sv.name)}</div><div class="tr">${ic('trophy')} ${fmt(tot)} <span class="netdot hd" title="Connexion"></span></div></div></div>
        <div class="spacer"></div>
        <div class="pill">${ic('gem')}<span class="cur-gems">0</span><span class="plus" data-act="goShop">+</span></div>
        <div class="pill">${ic('coin')}<span class="cur-coins">0</span><span class="plus" data-act="goShop">+</span></div>
        <button class="icon-btn" data-act="leaderboard">${ic('trophy')}</button><button class="icon-btn" data-act="settings">${ic('gear')}</button>
      </div>
      <div class="side-left">
        <button class="side-btn" data-act="goSocial">${ic('friends')}${UI.pendingInvites ? '<span class="badge">' + UI.pendingInvites + '</span>' : ''}<span class="lbl">Amis</span></button>
        <button class="side-btn" data-act="quests">${ic('scroll')}${G.Quests.claimable() ? '<span class="badge">' + G.Quests.claimable() + '</span>' : ''}<span class="lbl">Quêtes</span></button>
        <button class="side-btn" data-act="daily">${ic('gift')}${canDaily ? '<span class="badge">!</span>' : ''}<span class="lbl">Cadeau</span></button>
        <button class="side-btn" data-act="boxes">${ic('chest')}${sv.boxes ? '<span class="badge">' + sv.boxes + '</span>' : ''}<span class="lbl">Coffres</span></button>
      </div>
      <div class="stage">
        <canvas width="620" height="620"></canvas>
        <div class="nm">${def.name}</div>
        <div class="sub"><span class="lvl">Niv. ${sv.levels[id] || 1}</span><span>${ic('trophy')} ${fmt(sv.trophies[id] || 0)}</span></div>
        <button class="btn small change" data-act="goBrawlers">Changer de Brawler</button>
      </div>
      <div class="play-panel">
        ${UI.eventBanner()}
        <div class="mode-card" data-act="modes" style="--mc:${mode.color}">
          <div class="mi">${ic(MODE_ICON[mode.icon])}</div>
          <div><div class="mn">${mode.name}</div><div class="mm">${mode.id === 'showdown' ? 'Solo · 10 joueurs' : mode.id === 'boss' ? 'Coopératif' : '3 contre 3'} · ${mode.time >= 60 ? Math.round(mode.time / 60) + ' min' : mode.time + 's'}</div></div>
          <div class="chev">›</div>
        </div>
        <div class="row2"><button class="btn blue small" data-act="onlinePlay">${ic('bolt')} En ligne</button><button class="btn small" style="background:linear-gradient(#e0a0ff,#a032e0);box-shadow:0 .7rem 0 #5a1a8a,0 .9rem 0 .2rem var(--navy),inset 0 .35rem 0 rgba(255,255,255,.55)" data-act="team">${ic('user')} Équipe</button></div>
        <button class="btn big green pulse" data-act="play">JOUER <small style="font-size:2rem">vs bots</small></button>
      </div>
      ${nav('home')}`;
    G.Render.portrait($('.profile canvas', home), id, skinOf(id), 0, { aim: 0.4, zoom: 1.5, y: 0.95, shadow: false });
    if (UI.updateNetDot) UI.updateNetDot();
    const cv = $('.stage canvas', home); animate(cv, id, skinOf(id), { zoom: 0.9, y: 0.7, aim: -0.35 });
  };
  function nav(active) {
    const items = [['shop', 'bag', 'Boutique'], ['brawlers', 'user', 'Brawlers'], ['home', 'home', 'Accueil'], ['road', 'flag', 'Trophées'], ['social', 'friends', 'Social']];
    return '<nav class="nav">' + items.map(([k, i, l]) => `<button class="${k === active ? 'act' : ''}" data-act="nav" data-to="${k}">${ic(i)}<span>${l}</span></button>`).join('') + '</nav>';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function head(title, back) { return `<div class="head"><button class="icon-btn backbtn" data-act="nav" data-to="home">${ic('back')}</button><h1>${title}</h1><div class="spacer"></div><div class="pill">${ic('gem')}<span class="cur-gems">0</span></div><div class="pill">${ic('coin')}<span class="cur-coins">0</span></div></div>`; }

  /* ---------- actions ---------- */
  const ACT = {};
  ACT.nav = (a) => { G.Audio.sfx('ui'); UI.show(a.dataset.to); };
  ACT.goShop = () => { G.Audio.sfx('ui'); UI.show('shop'); };
  ACT.goBrawlers = () => { G.Audio.sfx('ui'); UI.show('brawlers'); };
  ACT.play = () => {
    G.Audio.sfx('ui');
    if (UI.busy) return; UI.busy = true;
    const M = G.App.prepare(S().mode);
    UI.matchmaking(M, () => UI.versus(M, () => { UI.busy = false; G.App.begin(M); }));
  };
  ACT.close = () => UI.closeModal();

  /* ----- modales ----- */
  UI.modal = function (html, opts) {
    opts = opts || {};
    const o = el(`<div class="overlay"><div class="modal" ${opts.style ? 'style="' + opts.style + '"' : ''}>${opts.noClose ? '' : '<button class="x" data-act="close">✕</button>'}${html}</div></div>`);
    $('#ui').appendChild(o); UI.modals.push(o);
    return o;
  };
  UI.closeModal = function () {
    const o = UI.modals.pop(); if (o) { o.remove(); G.Audio.sfx('back'); return true; } return false;
  };
  UI.back = function () {
    if (UI.busy && UI.cancelFlow) { UI.cancelFlow(); return true; }
    if (UI.modals.length) { if (UI.modals[UI.modals.length - 1].dataset.lock) return true; UI.closeModal(); return true; }
    if ($('#ui .fullscreen')) return true;
    if (UI.screen && UI.screen !== 'home' && UI.screen !== 'splash') { G.Audio.sfx('back'); UI.show('home'); return true; }
    return false;
  };

  /* ----- sélection du mode ----- */
  ACT.modes = () => {
    G.Audio.sfx('ui');
    const sv = S();
    const html = `<h2>Choisissez un mode</h2><div class="modes">` + G.MODE_ORDER.map((id) => {
      const m = G.MODES[id];
      return `<div class="modecard ${sv.mode === id ? 'sel' : ''}" data-act="pickMode" data-id="${id}" style="--mc:${m.color}"><div class="hd">${ic(MODE_ICON[m.icon])}<div class="mn">${m.name}</div></div><div class="bd">${m.desc}<br><span style="color:#ffd21f">${id === 'showdown' ? 'Solo · 10 joueurs' : id === 'boss' ? 'Coopératif · 1 à 3 joueurs' : '3 contre 3'}</span></div></div>`;
    }).join('') + '</div>';
    UI.modal(html);
  };
  ACT.pickMode = (a) => { S().mode = a.dataset.id; G.Save.commit(); G.Audio.sfx('buy'); UI.closeModal(); UI.build.home(); };

  /* ----- cadeau quotidien ----- */
  const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  UI.dailyDone = () => S().lastDaily === dayNum();
  UI.checkDaily = function () { if (UI.screen === 'home' && !UI.dailyDone()) ACT.daily(); };
  ACT.daily = () => {
    const sv = S();
    if (UI.dailyDone()) { UI.toast('Cadeau déjà récupéré. Revenez demain !'); return; }
    G.Audio.sfx('ui');
    const streak = sv.lastDaily === dayNum() - 1 ? sv.dailyStreak + 1 : 1;
    const coins = 60 + 20 * Math.min(streak, 7), gems = streak % 3 === 0 ? 5 : 0, box = streak % 7 === 0 ? 1 : 0;
    const o = UI.modal(`<h2>Cadeau quotidien</h2><div class="row" style="font-size:3.6rem;margin-bottom:2rem">Série : jour ${streak}</div>
      <div class="row">
        <div class="reward">${ic('coin')}+${coins}</div>
        ${gems ? `<div class="reward" style="animation-delay:.15s">${ic('gem')}+${gems}</div>` : ''}
        ${box ? `<div class="reward" style="animation-delay:.3s">${ic('chest')}+1</div>` : ''}
      </div><div class="row" style="margin-top:3rem"><button class="btn green" data-act="claimDaily">Récupérer !</button></div>`);
    o.dataset.pending = JSON.stringify({ coins, gems, box, streak });
  };
  ACT.claimDaily = () => {
    const o = UI.modals[UI.modals.length - 1]; const d = JSON.parse(o.dataset.pending);
    const sv = S(); sv.lastDaily = dayNum(); sv.dailyStreak = d.streak; sv.coins += d.coins; sv.gems += d.gems; sv.boxes += d.box; G.Save.commit();
    G.Audio.sfx('coin'); UI.closeModal(); UI.refreshCur(); UI.build.home(); UI.refreshCur();
  };

  /* ----- quêtes ----- */
  ACT.quests = () => {
    G.Audio.sfx('ui');
    const list = G.Quests.ensure();
    const o = UI.modal(`<h2>Quêtes du jour</h2><div id="qlist">${list.map(questRow).join('')}</div>`);
  };
  function questRow(q, i) {
    const d = G.QUEST_POOL.find((x) => x.id === q.id), done = q.progress >= d.goal;
    const rw = d.reward[0] === 'gems' ? ic('gem') : ic('coin');
    return `<div class="quest"><div>${d.text}<div class="bar o"><i style="width:${(q.progress / d.goal) * 100}%"></i><span>${fmt(q.progress)} / ${fmt(d.goal)}</span></div></div>
      ${q.claimed ? `<div style="text-align:center;color:#7dff7a">Récupérée ✔</div>` : `<button class="btn small ${done ? 'green' : 'gray'}" data-act="claimQuest" data-i="${i}">${rw} ${d.reward[1]}</button>`}</div>`;
  }
  ACT.claimQuest = (a) => {
    const q = S().quests[+a.dataset.i], d = G.QUEST_POOL.find((x) => x.id === q.id);
    if (q.claimed || q.progress < d.goal) { G.Audio.sfx('error'); UI.toast('Quête non terminée'); return; }
    q.claimed = true; S()[d.reward[0]] += d.reward[1]; G.Save.commit(); G.Audio.sfx('coin');
    $('#qlist').innerHTML = S().quests.map(questRow).join(''); UI.refreshCur(); UI.build.home();
  };

  /* ----- réglages ----- */
  ACT.settings = () => {
    G.Audio.sfx('ui');
    const render = () => {
      const s = S().settings;
      const tg = (k, label) => `<div class="setrow"><span>${label}</span><div class="toggle ${s[k] ? 'on' : ''}" data-act="toggle" data-k="${k}"></div></div>`;
      return `<h2>Réglages</h2>${tg('sound', 'Effets sonores')}${tg('music', 'Musique')}${tg('vibrate', 'Vibrations')}${tg('aimAssist', 'Aide à la visée')}${tg('lefty', 'Mode gaucher')}
        <div class="setrow"><span>Qualité graphique</span><button class="btn small ${s.quality === 'high' ? 'green' : s.quality === 'medium' ? 'blue' : 'gray'}" data-act="quality">${s.quality === 'high' ? 'Haute' : s.quality === 'medium' ? 'Moyenne' : 'Économie'}</button></div>
        ${window.AndroidBridge ? '' : '<div class="setrow"><span>Installer le jeu (PWA)</span><button class="btn small blue" data-act="installApp">Installer</button></div>'}
        <div class="setrow"><span>Serveur en ligne</span><button class="btn small ${S().settings.server ? 'green' : 'gray'}" data-act="serverCfg">${S().settings.server ? 'Configuré' : 'À configurer'}</button></div>
        <div class="setrow"><span>Pseudo : ${esc(S().name)}</span><button class="btn small blue" data-act="rename">Modifier</button></div>
        <div class="row" style="margin-top:2rem"><button class="btn small red" data-act="reset">Réinitialiser la progression</button></div>
        <div class="row" style="margin-top:1.6rem;font-size:2rem;color:#9aa7c8">Brawl Rush v1.0 — Jeu indépendant</div>`;
    };
    const o = UI.modal(render()); o.querySelector('.modal').dataset.render = '1'; UI._settingsRender = render;
  };
  ACT.toggle = (a) => {
    const s = S().settings; s[a.dataset.k] = !s[a.dataset.k]; G.Save.commit(); G.Audio.applySettings(); G.Audio.sfx('ui');
    refreshSettings();
  };
  function refreshSettings() {
    const o = UI.modals[UI.modals.length - 1]; if (!o || !UI._settingsRender) return;
    const m = o.querySelector('.modal'); const x = m.querySelector('.x'); m.innerHTML = ''; m.appendChild(x); m.insertAdjacentHTML('beforeend', UI._settingsRender());
  }
  ACT.quality = () => { const s = S().settings; s.quality = s.quality === 'high' ? 'medium' : s.quality === 'medium' ? 'low' : 'high'; G.Save.commit(); G.App.resize(); refreshSettings(); };
  ACT.rename = () => {
    const o = UI.modal(`<h2>Votre pseudo</h2><div class="row"><input class="txt" id="nameIn" maxlength="14" value="${esc(S().name)}"></div><div class="row" style="margin-top:2.4rem"><button class="btn green" data-act="saveName">OK</button></div>`);
    setTimeout(() => { const i = $('#nameIn'); if (i) i.focus(); }, 200);
  };
  ACT.saveName = () => {
    const v = ($('#nameIn').value || '').trim().slice(0, 14);
    if (v.length < 2) { UI.toast('Pseudo trop court'); return; }
    S().name = v; G.Save.commit(); UI.closeModal(); refreshSettings(); if (UI.screen === 'home') UI.build.home();
  };
  ACT.reset = () => {
    UI.modal(`<h2>Tout effacer ?</h2><div class="row" style="font-size:3rem;margin-bottom:2rem">Votre progression sera perdue.</div><div class="row"><button class="btn gray" data-act="close">Annuler</button><button class="btn red" data-act="doReset">Effacer</button></div>`);
  };
  ACT.doReset = () => { G.Save.reset(); G.Save.commit(); UI.hideAll(); G.Quests.ensure(); UI.show('home'); };

  /* ---------- boutique ---------- */
  UI.build.shop = function () {
    const root = $('#shop'), sv = S();
    const tabs = [['offers', 'Offres du jour'], ['brawlers', 'Brawlers'], ['skins', 'Skins']];
    root.innerHTML = head('Boutique') + `<div class="body"><div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${UI.shopTab === k ? 'act' : ''}" data-act="shopTab" data-k="${k}">${l}</button>`).join('')}</div><div id="shopBody"></div></div>` + nav('shop');
    UI.anim = [];
    const body = $('#shopBody', root);
    if (UI.shopTab === 'offers') {
      const offers = dailyOffers();
      body.className = 'offers';
      body.innerHTML = '';
      offers.forEach((o) => {
        const sold = sv.shopBought[o.key];
        const card = el(`<div class="offer ${o.rc ? 'rar' : ''} ${sold ? 'sold' : ''}" style="${o.rc ? '--rc:' + o.rc : ''}">${o.tag ? '<div class="tagline">' + o.tag + '</div>' : ''}<div class="ot">${o.title}</div><div class="art"></div>
          ${sold ? '<div class="price">Acheté ✔</div>' : o.price.free ? `<button class="btn small green" data-act="buyOffer" data-key="${o.key}">GRATUIT</button>` : `<button class="btn small ${o.price.gems ? 'blue' : ''}" data-act="buyOffer" data-key="${o.key}"><span class="price ${(o.price.gems && sv.gems < o.price.gems) || (o.price.coins && sv.coins < o.price.coins) ? 'cost-bad' : ''}">${ic(o.price.gems ? 'gem' : 'coin')}${fmt(o.price.gems || o.price.coins)}</span></button>`}</div>`);
        const art = $('.art', card);
        if (o.type === 'brawler') { const cv = portraitCanvas(o.id, 'classic', 300); art.appendChild(cv); animate(cv, o.id, 'classic', { zoom: 0.78 }); }
        else if (o.type === 'skin') { const cv = portraitCanvas(o.id, o.skin, 300); art.appendChild(cv); animate(cv, o.id, o.skin, {}); }
        else art.innerHTML = o.icon;
        body.appendChild(card);
      });
    } else if (UI.shopTab === 'skins') {
      body.className = 'offers'; body.innerHTML = '';
      const bid = sv.selected;
      G.SKINS.filter((k) => k.id !== 'classic').forEach((k) => {
        const have = (sv.ownedSkins[bid] || []).includes(k.id);
        const col = k.tier === 'Légendaire' ? '#ffd21f' : k.tier === 'Épique' ? '#b455ff' : '#3aa0ff';
        const card = el(`<div class="offer rar ${have ? 'sold' : ''}" style="--rc:${col}"><div class="ot">${G.BRAWLER[bid].name}<br><span class="rarity" style="background:${col}">${k.tier} · ${k.name}</span></div><div class="art"></div>${have ? '<div class="price">Possédé ✔</div>' : `<button class="btn small blue" data-act="buySkin" data-s="${k.id}"><span class="price ${sv.gems < k.price ? 'cost-bad' : ''}">${ic('gem')}${k.price}</span></button>`}</div>`);
        const cv = portraitCanvas(bid, k.id, 300); $('.art', card).appendChild(cv); animate(cv, bid, k.id, {});
        body.appendChild(card);
      });
    } else {
      body.className = 'offers';
      body.innerHTML = '';
      G.BRAWLERS.forEach((b) => {
        const owned = sv.unlocked.includes(b.id), r = G.RARITY[b.rarity];
        const card = el(`<div class="offer rar ${owned ? 'sold' : ''}" style="--rc:${r.color}"><div class="ot">${b.name}<br><span class="rarity" style="background:${r.color}">${r.name}</span></div><div class="art"></div>
          ${owned ? '<div class="price">Débloqué ✔</div>' : `<button class="btn small blue" data-act="buyBrawler" data-id="${b.id}"><span class="price ${sv.gems < b.price ? 'cost-bad' : ''}">${ic('gem')}${fmt(b.price)}</span></button>`}</div>`);
        const cv = portraitCanvas(b.id, 'classic', 300); $('.art', card).appendChild(cv); if (!owned) cv.style.filter = 'brightness(.55)'; else animate(cv, b.id, 'classic', {});
        body.appendChild(card);
      });
    }
  };
  ACT.shopTab = (a) => { UI.shopTab = a.dataset.k; G.Audio.sfx('ui'); UI.build.shop(); UI.refreshCur(); };
  function dailyOffers() {
    const sv = S(), day = G.dayKey(), seed = day.split('-').reduce((a, b) => a * 31 + (+b), 7);
    const rng = G.mulberry32(seed);
    const list = [];
    list.push({ key: day + 'free', type: 'box', amount: 1, title: 'Coffre gratuit', price: { free: true }, icon: ic('chest'), tag: 'GRATUIT' });
    const coinsPacks = [[150, 12], [600, 45], [1600, 100]];
    const cp = coinsPacks[Math.floor(rng() * 3)];
    list.push({ key: day + 'coins', type: 'coins', amount: cp[0], title: cp[0] + ' pièces', price: { gems: cp[1] }, icon: ic('coin') });
    list.push({ key: day + 'box', type: 'box', amount: 1, title: 'Coffre brillant', price: { gems: 20 }, icon: ic('chest') });
    list.push({ key: day + 'box3', type: 'box', amount: 3, title: '3 coffres', price: { gems: 50 }, icon: ic('chest'), tag: '-17%' });
    const locked = G.BRAWLERS.filter((b) => !sv.unlocked.includes(b.id));
    if (locked.length) { const b = locked[Math.floor(rng() * locked.length)]; list.push({ key: day + 'bw' + b.id, type: 'brawler', id: b.id, title: b.name + ' · -20%', price: { gems: Math.round(b.price * 0.8) }, rc: G.RARITY[b.rarity].color, tag: '-20%' }); }
    const owned = sv.unlocked.slice();
    const bid = owned[Math.floor(rng() * owned.length)], sk = G.SKINS[1 + Math.floor(rng() * 3)];
    const have = (sv.ownedSkins[bid] || []).includes(sk.id);
    if (!have) list.push({ key: day + 'sk' + bid + sk.id, type: 'skin', id: bid, skin: sk.id, title: G.BRAWLER[bid].name + ' ' + sk.name, price: { gems: Math.round(sk.price * 0.7) }, rc: '#ff8a1f', tag: '-30%' });
    const lvl = owned.filter((id) => (sv.levels[id] || 1) < 6);
    list.push({ key: day + 'pack', type: 'coins', amount: 300, title: '300 pièces', price: { gems: 25 }, icon: ic('coin') });
    return list.slice(0, 8);
  }
  ACT.buyOffer = (a) => {
    const o = dailyOffers().find((x) => x.key === a.dataset.key), sv = S();
    if (!o || sv.shopBought[o.key]) return;
    if (o.price.gems && sv.gems < o.price.gems) { G.Audio.sfx('error'); UI.toast('Pas assez de gemmes !'); return; }
    if (o.price.coins && sv.coins < o.price.coins) { G.Audio.sfx('error'); UI.toast('Pas assez de pièces !'); return; }
    if (o.price.gems) sv.gems -= o.price.gems;
    if (o.price.coins) sv.coins -= o.price.coins;
    sv.shopBought[o.key] = true;
    if (o.type === 'coins') sv.coins += o.amount;
    else if (o.type === 'box') sv.boxes += o.amount;
    else if (o.type === 'brawler') unlockBrawler(o.id);
    else if (o.type === 'skin') { (sv.ownedSkins[o.id] = sv.ownedSkins[o.id] || []).push(o.skin); sv.skins[o.id] = o.skin; }
    G.Save.commit(); G.Audio.sfx('buy');
    UI.toast(o.type === 'box' ? 'Coffre ajouté ! Ouvrez-le depuis l\'accueil.' : 'Achat réussi !');
    UI.build.shop(); UI.refreshCur(); bump('cur-gems'); bump('cur-coins');
  };
  ACT.buySkin = (a) => {
    const sv = S(), id = sv.selected, k = G.SKIN[a.dataset.s];
    if ((sv.ownedSkins[id] || []).includes(k.id)) return;
    if (sv.gems < k.price) { G.Audio.sfx('error'); UI.toast('Pas assez de gemmes !'); return; }
    sv.gems -= k.price; (sv.ownedSkins[id] = sv.ownedSkins[id] || []).push(k.id); sv.skins[id] = k.id; G.Save.commit(); G.Audio.sfx('open');
    UI.toast('Skin ' + k.name + ' débloqué et équipé !'); UI.build.shop(); UI.refreshCur();
  };
  ACT.buyBrawler = (a) => {
    const b = G.BRAWLER[a.dataset.id], sv = S();
    if (sv.unlocked.includes(b.id)) return;
    if (sv.gems < b.price) { G.Audio.sfx('error'); UI.toast('Pas assez de gemmes !'); return; }
    sv.gems -= b.price; unlockBrawler(b.id); G.Save.commit(); G.Audio.sfx('buy');
    showNewBrawler(b.id);
    UI.build.shop(); UI.refreshCur();
  };
  function unlockBrawler(id) {
    const sv = S(); if (sv.unlocked.includes(id)) return false;
    sv.unlocked.push(id); sv.trophies[id] = 0; sv.levels[id] = 1; return true;
  }
  function showNewBrawler(id) {
    const b = G.BRAWLER[id], r = G.RARITY[b.rarity];
    const o = UI.modal(`<div class="glow"></div><h2 style="position:relative">NOUVEAU BRAWLER !</h2><div class="reward" style="position:relative"><canvas width="500" height="500"></canvas><div style="color:${r.color}">${b.name}</div><div style="font-size:2.6rem">${r.name} · ${b.role}</div></div><div class="row" style="margin-top:2rem;position:relative"><button class="btn green" data-act="close">Génial !</button></div>`);
    animate($('canvas', o), id, 'classic', { happy: true }); G.Audio.sfx('open');
  }

  /* ---------- écran Brawlers ---------- */
  UI.build.brawlers = function () {
    const root = $('#brawlers'), sv = S();
    if (!UI.selBrawler) UI.selBrawler = sv.selected;
    root.innerHTML = head('Brawlers') + `<div class="body"><div class="bw-wrap"><div class="bw-grid" id="bwGrid"></div><div class="bw-detail" id="bwDetail"></div></div></div>` + nav('brawlers');
    UI.anim = [];
    const grid = $('#bwGrid', root);
    G.BRAWLERS.forEach((b) => {
      const owned = sv.unlocked.includes(b.id), r = G.RARITY[b.rarity];
      const card = el(`<div class="bw-card ${owned ? '' : 'lock'} ${UI.selBrawler === b.id ? 'sel' : ''}" data-act="selBrawler" data-id="${b.id}" style="--rc:${r.color};--rc2:${G.shade(r.color, -0.5)}"><div class="tp">${ic('trophy')}${owned ? fmt(sv.trophies[b.id] || 0) : '—'}</div>${owned ? `<div class="lv">${sv.levels[b.id] || 1}</div>` : ''}<div class="tt">${b.name}</div>${owned ? '' : '<div class="lk">' + ic('lock') + '</div>'}</div>`);
      card.insertBefore(portraitCanvas(b.id, skinOf(b.id), 300, '', { aim: 0.4, y: 0.7 }), card.firstChild);
      grid.appendChild(card);
    });
    renderDetail();
  };
  ACT.selBrawler = (a) => { UI.selBrawler = a.dataset.id; G.Audio.sfx('ui'); $$('#bwGrid .bw-card').forEach((c) => c.classList.toggle('sel', c.dataset.id === UI.selBrawler)); renderDetail(); };
  function renderDetail() {
    const sv = S(), id = UI.selBrawler, b = G.BRAWLER[id], r = G.RARITY[b.rarity], owned = sv.unlocked.includes(id), lvl = sv.levels[id] || 1, mul = G.levelMul(lvl);
    const d = $('#bwDetail'); if (!d) return;
    $$('.anim-detail').forEach((c) => { UI.anim = UI.anim.filter((a) => a.cv !== c); });
    const hp = b.hp * mul, atkDmg = b.atk.dmg * (b.atk.n || 1) * (b.atk.burst || 1) * mul;
    const next = G.UPGRADE_COST[lvl + 1];
    const skins = G.SKINS.map((s) => {
      const have = s.id === 'classic' || (sv.ownedSkins[id] || []).includes(s.id), on = skinOf(id) === s.id;
      return `<div class="skin ${on ? 'on' : ''}" data-act="skin" data-s="${s.id}"><canvas width="160" height="160" data-s="${s.id}"></canvas>${s.name}<div class="tier">${s.tier || ''}</div><div class="pr">${have ? (on ? 'Équipé' : 'Choisir') : ic('gem') + s.price}</div></div>`;
    }).join('');
    d.innerHTML = `<div class="top"><canvas class="big anim-detail" width="400" height="400" style="background:radial-gradient(${r.color},${G.shade(r.color, -0.6)})"></canvas><div><div class="nm">${b.name}</div><div class="role">${b.role}</div><span class="rarity" style="background:${r.color}">${r.name}</span>
      ${owned ? `<div style="margin-top:1rem;font-size:2.6rem"><span class="lvl">Niv. ${lvl}</span> &nbsp; ${ic('trophy')} ${fmt(sv.trophies[id] || 0)}</div>` : ''}</div></div>
      <div class="desc">${b.desc}</div>
      <div class="stat"><span>Santé</span><div class="bar"><i style="width:${Math.min(100, (hp / 11000) * 100)}%"></i></div><span>${fmt(hp)}</span></div>
      <div class="stat"><span>Dégâts</span><div class="bar r"><i style="width:${Math.min(100, (atkDmg / 3000) * 100)}%"></i></div><span>${fmt(atkDmg)}</span></div>
      <div class="stat"><span>Vitesse</span><div class="bar b"><i style="width:${Math.min(100, ((b.speed - 3.2) / 1.8) * 100)}%"></i></div><span>${b.speed.toFixed(1)}</span></div>
      <div class="stat"><span>Portée</span><div class="bar o"><i style="width:${Math.min(100, (b.atk.range / 10) * 100)}%"></i></div><span>${b.atk.range.toFixed(1)}</span></div>
      <div class="skill"><div class="si" style="background:#ff9f1a">💥</div><div><b>${b.atk.name}</b>Attaque principale · ${b.atk.n > 1 ? b.atk.n + ' projectiles' : b.atk.burst ? b.atk.burst + ' tirs' : 'projectile'}${b.atk.heal ? ' · soigne les alliés' : ''}</div></div>
      <div class="skill"><div class="si" style="background:#ffd21f">⚡</div><div><b>${b.sup.name}</b>Super · ${superDesc(b)}</div></div>
      ${owned ? `<div style="font-size:2.4rem">Apparences</div><div class="skins">${skins}</div>` : ''}
      <div class="row" style="margin-top:.6rem">${owned
        ? `${sv.selected === id ? '<button class="btn green disabled">Sélectionné ✔</button>' : '<button class="btn green" data-act="equip">Sélectionner</button>'}
           ${lvl < G.MAX_LEVEL ? `<button class="btn blue ${sv.coins < next ? 'disabled' : ''}" data-act="upgrade">Améliorer ${ic('coin')} ${fmt(next)}</button>` : '<span style="font-size:3rem;color:#ffd21f">Niveau max !</span>'}`
        : `<button class="btn blue" data-act="buyBrawler" data-id="${id}">Acheter ${ic('gem')} ${b.price}</button><div style="font-size:2.2rem;width:100%;text-align:center">ou débloquez-le via la Route des trophées / les coffres</div>`}</div>`;
    const cv = $('.anim-detail', d); animate(cv, id, skinOf(id), { zoom: 0.95, y: 0.76 });
    $$('.skin canvas', d).forEach((c) => G.Render.portrait(c, id, c.dataset.s, 0, { aim: 0.4, zoom: 0.62, y: 0.72 }));
  }
  function superDesc(b) {
    const s = b.sup;
    return { proj: 'rafale puissante', dash: 'charge dévastatrice', jump: 'bond mortel', barrage: 'pluie de roquettes', lobArea: s.freeze ? 'gèle les ennemis en zone' : 'explosion en zone', aura: s.heal ? 'soigne et accélère les alliés' : 'foudroie les ennemis proches' }[s.type];
  }
  ACT.equip = () => { S().selected = UI.selBrawler; G.Save.commit(); G.Audio.sfx('buy'); UI.build.brawlers(); };
  ACT.upgrade = () => {
    const sv = S(), id = UI.selBrawler, lvl = sv.levels[id] || 1, cost = G.UPGRADE_COST[lvl + 1];
    if (lvl >= G.MAX_LEVEL) return;
    if (sv.coins < cost) { G.Audio.sfx('error'); UI.toast('Pas assez de pièces !'); return; }
    sv.coins -= cost; sv.levels[id] = lvl + 1; G.Save.commit(); G.Audio.sfx('open'); UI.toast(G.BRAWLER[id].name + ' passe niveau ' + (lvl + 1) + ' !');
    UI.build.brawlers(); UI.refreshCur(); bump('cur-coins');
  };
  ACT.skin = (a) => {
    const sv = S(), id = UI.selBrawler, sk = G.SKIN[a.dataset.s];
    const have = sk.id === 'classic' || (sv.ownedSkins[id] || []).includes(sk.id);
    if (!have) {
      if (sv.gems < sk.price) { G.Audio.sfx('error'); UI.toast('Pas assez de gemmes !'); return; }
      sv.gems -= sk.price; (sv.ownedSkins[id] = sv.ownedSkins[id] || []).push(sk.id); G.Audio.sfx('buy');
    } else G.Audio.sfx('ui');
    sv.skins[id] = sk.id; G.Save.commit(); UI.build.brawlers(); UI.refreshCur();
  };

  /* ---------- route des trophées ---------- */
  UI.build.road = function () {
    const root = $('#road'), sv = S(), tot = G.Save.totalTrophies();
    root.innerHTML = head('Route des trophées') + `<div style="position:absolute;left:0;right:0;top:11rem;text-align:center;font-size:4.2rem">${ic('trophy', 'x')} ${fmt(tot)} trophées</div><div class="road-scroll" id="roadScroll"><div class="road-track" id="roadTrack"><div class="road-line"><i></i></div></div></div>` + nav('road');
    const track = $('#roadTrack', root);
    let reached = -1;
    G.ROAD.forEach(([need, type, val], i) => {
      const done = tot >= need, claimed = sv.roadClaimed.includes(i);
      if (done) reached = i;
      let art = '';
      if (type === 'coins') art = ic('coin') + `<span class="amt">${val}</span>`;
      else if (type === 'gems') art = ic('gem') + `<span class="amt">${val}</span>`;
      else if (type === 'box') art = ic('chest') + `<span class="amt">x${val}</span>`;
      const n = el(`<div class="rnode ${done ? 'done' : ''} ${done && !claimed ? 'claimable' : ''} ${claimed ? 'claimed' : ''}"><div class="rw" data-act="claimRoad" data-i="${i}">${art}</div><div class="dot">${done ? '★' : ''}</div><div class="tt">${ic('trophy')}${fmt(need)}</div></div>`);
      if (type === 'brawler') { const cv = portraitCanvas(val, 'classic', 260); $('.rw', n).appendChild(cv); if (!sv.unlocked.includes(val)) cv.style.filter = done ? '' : 'brightness(.4)'; }
      track.appendChild(n);
    });
    const line = $('.road-line i', root); line.style.width = Math.max(0, Math.min(100, ((reached + 0.5) / G.ROAD.length) * 100)) + '%';
    const sc = $('#roadScroll', root);
    setTimeout(() => { sc.scrollLeft = Math.max(0, (Math.max(0, reached - 0.5)) * 24 * parseFloat(getComputedStyle(document.documentElement).fontSize) - 100); }, 30);
    sc.addEventListener('wheel', (e) => { sc.scrollLeft += e.deltaY; });
  };
  ACT.claimRoad = (a) => {
    const i = +a.dataset.i, sv = S(), [need, type, val] = G.ROAD[i], tot = G.Save.totalTrophies();
    if (sv.roadClaimed.includes(i)) return;
    if (tot < need) { G.Audio.sfx('error'); UI.toast('Il vous faut ' + need + ' trophées'); return; }
    sv.roadClaimed.push(i);
    if (type === 'coins') sv.coins += val; else if (type === 'gems') sv.gems += val; else if (type === 'box') sv.boxes += val;
    else if (type === 'brawler') { if (unlockBrawler(val)) { G.Save.commit(); UI.build.road(); showNewBrawler(val); return; } else sv.coins += 200; }
    G.Save.commit(); G.Audio.sfx('buy'); UI.toast('Récompense récupérée !'); UI.build.road(); UI.refreshCur();
  };

  /* ---------- coffres ---------- */
  ACT.boxes = () => {
    const sv = S();
    if (sv.boxes <= 0) { G.Audio.sfx('error'); UI.toast('Aucun coffre. Gagnez des matchs pour en obtenir !'); return; }
    G.Audio.sfx('ui');
    sv.boxes--; G.Save.commit();
    const rewards = rollBox();
    const o = UI.modal(`<div class="glow" style="display:none"></div><h2 style="position:relative">Coffre</h2><div id="boxStage" style="position:relative;min-height:46rem;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="chest" data-act="openChest">${ic('chest')}</div><div style="font-size:3rem;margin-top:1rem">Touchez le coffre !</div></div>`, { noClose: true });
    o.dataset.lock = '1'; o._rewards = rewards; o._idx = -1;
  };
  function rollBox() {
    const sv = S(), out = [];
    out.push({ type: 'coins', val: G.ri(60, 240) });
    if (Math.random() < 0.5) out.push({ type: 'gems', val: G.ri(1, 6) });
    if (Math.random() < 0.12) {
      const locked = G.BRAWLERS.filter((b) => !sv.unlocked.includes(b.id));
      if (locked.length) { const w = locked.map((b) => ({ b, w: { rare: 8, superrare: 5, epic: 3, mythic: 1.5, legend: 0.6 }[b.rarity] || 1 })); let t = w.reduce((s, x) => s + x.w, 0) * Math.random(); for (const x of w) { t -= x.w; if (t <= 0) { out.push({ type: 'brawler', val: x.b.id }); break; } } }
    }
    return out;
  }
  ACT.openChest = (a) => {
    const o = UI.modals[UI.modals.length - 1], ch = $('.chest', o);
    if (ch.classList.contains('shake')) return;
    ch.classList.add('shake'); G.Audio.sfx('box');
    addTimer(() => { G.Audio.sfx('open'); showReward(o); }, 900);
  };
  function showReward(o) {
    o._idx++;
    const stage = $('#boxStage', o), rw = o._rewards[o._idx], sv = S();
    $('.glow', o).style.display = 'block';
    if (!rw) { o.remove(); UI.modals = UI.modals.filter((m) => m !== o); UI.refreshCur(); if (UI.screen === 'home') UI.build.home(); return; }
    let inner = '';
    if (rw.type === 'coins') { sv.coins += rw.val; inner = `<div class="reward">${ic('coin')}+${rw.val}</div>`; }
    else if (rw.type === 'gems') { sv.gems += rw.val; inner = `<div class="reward">${ic('gem')}+${rw.val}</div>`; }
    else if (rw.type === 'brawler') { unlockBrawler(rw.val); const b = G.BRAWLER[rw.val]; inner = `<div class="reward"><canvas width="500" height="500"></canvas><div style="color:${G.RARITY[b.rarity].color}">${b.name} !</div><div style="font-size:2.6rem">Nouveau Brawler</div></div>`; }
    G.Save.commit();
    stage.innerHTML = inner + `<div class="row" style="margin-top:1.4rem"><button class="btn green" data-act="nextReward">${o._idx < o._rewards.length - 1 ? 'Suivant' : 'Super !'}</button></div>`;
    const cv = $('canvas', stage); if (cv) animate(cv, rw.val, 'classic', { happy: true });
    UI.refreshCur();
  }
  ACT.nextReward = () => { G.Audio.sfx('ui'); showReward(UI.modals[UI.modals.length - 1]); };

  /* ---------- recherche de match / écran versus ---------- */
  UI.cancelFlow = null;
  UI.matchmaking = function (M, next) {
    G.Audio.startMusic('menu');
    const ents = M.ents, showdown = M.mode === 'showdown', total = ents.length;
    const o = el(`<div class="fullscreen mm"><div class="spinner"></div><h2>Recherche d'adversaires…</h2><div style="font-size:3.4rem">${G.MODES[M.mode].name} · ${M.map.name}</div><div class="slots">${ents.map(() => '<div class="slot">?</div>').join('')}</div></div>`);
    $('#ui').appendChild(o);
    const slots = $$('.slot', o);
    let i = 0; const myTeam = M.player.team;
    const iv = setInterval(() => {
      if (i >= total) { clearInterval(iv); return; }
      const e = ents[i], s = slots[i]; s.classList.add('in'); if (!showdown && e.team !== myTeam) s.classList.add('foe'); s.textContent = e.name; G.Audio.sfx('ui'); i++;
    }, Math.max(120, 1700 / total));
    const t1 = setTimeout(() => { clearInterval(iv); o.remove(); next(); }, 2200);
    UI.cancelFlow = () => { clearInterval(iv); clearTimeout(t1); o.remove(); UI.busy = false; UI.cancelFlow = null; document.querySelectorAll('.vs').forEach((v) => v.remove()); UI.build.home && UI.screen === 'home' && UI.build.home(); };
    UI._flowTimer = t1;
  };
  UI.versus = function (M, next) {
    const showdown = M.mode === 'showdown', mode = G.MODES[M.mode];
    const pl = (e) => `<div class="pl ${e.isPlayer ? 'me' : ''}"><canvas width="220" height="220" data-id="${e.id}" data-s="${e.skin}"></canvas><span>${esc(e.name)}</span></div>`;
    let html;
    if (showdown) html = `<div class="vtitle">${mode.name}<small>${M.map.name}</small></div><div class="grid">${M.ents.map(pl).join('')}</div>`;
    else html = `<div class="vtitle">${mode.name}<small>${M.map.name}</small></div><div class="side l">${M.ents.filter((e) => e.team === 0).map(pl).join('')}</div><div class="side r">${M.ents.filter((e) => e.team === 1).map(pl).join('')}</div><div class="vsbig">VS</div>`;
    const o = el(`<div class="fullscreen vs ${showdown ? 'ffa' : ''}">${html}</div>`);
    $('#ui').appendChild(o);
    $$('canvas', o).forEach((c) => G.Render.portrait(c, c.dataset.id, c.dataset.s, 0, { aim: 0.5, zoom: 0.8, y: 0.74 }));
    G.Audio.sfx('go');
    const t = setTimeout(() => { o.remove(); UI.cancelFlow = null; next(); }, 2700);
    UI.cancelFlow = () => { clearTimeout(t); o.remove(); UI.busy = false; UI.cancelFlow = null; };
  };

  /* ---------- pause ---------- */
  UI.showPause = function () {
    const s = S().settings;
    const o = UI.modal(`<h2>Pause</h2><div class="setrow"><span>Effets sonores</span><div class="toggle ${s.sound ? 'on' : ''}" data-act="ptoggle" data-k="sound"></div></div><div class="setrow"><span>Musique</span><div class="toggle ${s.music ? 'on' : ''}" data-act="ptoggle" data-k="music"></div></div>
      <div class="row" style="margin-top:3rem"><button class="btn red" data-act="quit">Quitter le match</button><button class="btn green" data-act="resume">Reprendre</button></div>`, { noClose: true });
    o.dataset.pause = '1'; o.dataset.lock = '1'; document.body.classList.remove('in-match'); document.body.classList.add('in-match-paused');
    $('#ui').style.pointerEvents = 'auto'; document.body.classList.add('in-match');
  };
  UI.hidePause = function () {
    $$('#ui .overlay').forEach((o) => { if (o.dataset.pause) o.remove(); }); UI.modals = UI.modals.filter((m) => !m.dataset.pause);
    document.body.classList.remove('in-match-paused');
  };
  ACT.resume = () => { G.Audio.sfx('ui'); G.App.togglePause(); };
  ACT.quit = () => { G.Audio.sfx('back'); G.App.quitMatch(); };
  ACT.ptoggle = (a) => { const s = S().settings; s[a.dataset.k] = !s[a.dataset.k]; G.Save.commit(); G.Audio.applySettings(); a.classList.toggle('on', s[a.dataset.k]); };

  /* ---------- tutoriel ---------- */
  UI.showTutorial = function () {
    const L = G.Render.layout(window.innerWidth, window.innerHeight), u = L.u, left = !S().settings.lefty;
    const mk = (txt, x, y) => { const d = el(`<div class="tuto" style="left:${x}px;top:${y}px;transform:translate(-50%,-100%)">${txt}</div>`); $('#ui').appendChild(d); return d; };
    const a = mk('Glissez pour vous déplacer', L.joyX, L.joyY - L.joyR * 1.5);
    const b = mk('Touchez pour tirer<br>Glissez pour viser', L.atkX, L.atkY - L.atkR * 1.6);
    const c = mk('Super : se charge en touchant vos cibles', L.supX + (left ? -1 : 1) * 24 * u, L.supY + L.supR * 0.2);
    const d = mk('Esquive : roulade invulnérable', L.dgX - 8 * u * (left ? 1 : -1), L.dgY - L.dgR * 1.4);
    const rm = () => { [a, b, c, d].forEach((x) => x.remove()); S().tutorialDone = true; G.Save.commit(); };
    setTimeout(rm, 7000);
  };

  /* ---------- résultats ---------- */
  UI.clearTutorial = function () { $$('.tuto').forEach((x) => x.remove()); };
  UI.showResult = function (R) {
    UI.clearTutorial();
    const sv = S(), r = R.r, id = R.brawler, mode = G.MODES[R.mode];
    const cls = r.win ? 'win' : r.draw ? 'draw' : 'lose';
    const title = R.mode === 'showdown' ? (r.win ? 'VICTOIRE !' : '#' + R.place + ' sur 10') : r.draw ? 'ÉGALITÉ' : r.win ? 'VICTOIRE !' : 'DÉFAITE';
    const rows = [];
    rows.push(`<div class="rline" style="animation-delay:.6s">${ic('trophy')}<span>Trophées</span><span class="rv" id="rvTr" style="color:${R.delta >= 0 ? '#7dff7a' : '#ff7a7a'}">${R.delta >= 0 ? '+' : ''}0</span></div>`);
    rows.push(`<div class="rline" style="animation-delay:.8s">${ic('coin')}<span>Pièces</span><span class="rv">+${R.coins}</span></div>`);
    if (R.gems) rows.push(`<div class="rline" style="animation-delay:1s">${ic('gem')}<span>Gemmes</span><span class="rv">+${R.gems}</span></div>`);
    if (R.box) rows.push(`<div class="rline" style="animation-delay:1.1s">${ic('chest')}<span>Coffre obtenu !</span><span class="rv">+${R.box}</span></div>`);
    rows.push(`<div class="rline sm" style="animation-delay:1.2s"><span>Éliminations : ${R.kills}</span><span class="rv">Dégâts : ${fmt(R.damage)}</span></div>`);
    const o = el(`<div class="fullscreen result"><canvas class="confetti"></canvas><div class="rb ${cls}">${title}</div><div class="rrow"><canvas width="360" height="360"></canvas><div class="rlist">${rows.join('')}</div></div>
      <button class="btn big green" data-act="resultOk" style="animation:popIn .4s 1.5s backwards">Continuer</button></div>`);
    $('#ui').appendChild(o);
    const cv = $('.rrow canvas', o); animate(cv, id, skinOf(id), { happy: r.win, zoom: 0.9, y: 0.78 });
    $$('#ui .screen').forEach((s) => s.classList.remove('active'));
    UI.screen = 'result';
    if (r.win) startConfetti($('.confetti', o));
    // compteur de trophées
    const tr = $('#rvTr', o); let k = 0; const steps = Math.abs(R.delta);
    if (steps) addTimer(() => { const iv = setInterval(() => { k++; tr.textContent = (R.delta > 0 ? '+' : '-') + k; G.Audio.sfx('coin'); if (k >= steps) clearInterval(iv); }, 120); }, 900);
    else tr.textContent = '±0';
    G.Audio.sfx(r.win ? 'win' : 'lose');
  };
  ACT.resultOk = () => {
    G.Audio.sfx('ui'); $$('#ui .fullscreen').forEach((o) => o.remove()); UI.anim = [];
    UI.show('home'); UI.refreshCur();
    const sv = S(), tot = G.Save.totalTrophies();
    const claim = G.ROAD.some(([need], i) => tot >= need && !sv.roadClaimed.includes(i));
    if (claim) addTimer(() => UI.toast('Une récompense vous attend sur la Route des trophées !', 3000), 500);
    else if (sv.boxes) addTimer(() => UI.toast('Vous avez ' + sv.boxes + ' coffre' + (sv.boxes > 1 ? 's' : '') + ' à ouvrir !', 2500), 500);
  };
  function startConfetti(cv) {
    const c = cv.getContext('2d'); cv.width = window.innerWidth / 2; cv.height = window.innerHeight / 2;
    const ps = []; for (let i = 0; i < 90; i++) ps.push({ x: Math.random() * cv.width, y: -Math.random() * cv.height, vy: 40 + Math.random() * 90, vx: (Math.random() - 0.5) * 40, r: Math.random() * 6, col: G.pick(['#ffd21f', '#ff4a55', '#3a8cff', '#4cd964', '#b455ff']), w: 4 + Math.random() * 5, a: Math.random() * 6 });
    let last = performance.now();
    (function loop(now) {
      if (!cv.isConnected) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
      c.clearRect(0, 0, cv.width, cv.height);
      for (const p of ps) { p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(p.a += dt * 4) * 0.6; if (p.y > cv.height + 10) { p.y = -10; } c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); c.restore(); }
      requestAnimationFrame(loop);
    })(last);
  }
  UI.ACT = ACT; UI.h = { $, $$, el, esc, portraitCanvas, animate, fmt, S, ic, addTimer, clearTimers, skinOf, head, nav };
})();
