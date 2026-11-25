/* Brawl Rush - rouleau des modes (sélection animée) et salon de duel 1 contre 1 entre amis */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net;
  const { $, $$, el, esc, ic, S, fmt } = UI.h;
  const ICON = { gem: 'gem', ball: 'ball', safe: 'safe', star: 'star', skull: 'skull', zone: 'flag', robot: 'gear', bomb: 'bolt', moon: 'star' };
  const FMT = (m) => m.id === 'showdown' ? 'Solo · 10 joueurs' : m.id === 'boss' ? 'Coop · 3 joueurs' : m.per === 1 ? '1 contre 1' : '3 contre 3 · 2 contre 2';
  const FLOOR = { desert: '#e3c48a', snow: '#dce8f4', night: '#3e4472', meadow: '#86c96a', volcano: '#6e4434', jungle: '#5fa64e' };
  const TILE = { 1: '#6b4f36', 2: '#c98a4a', 3: '#2f8f3a', 4: '#3a8ad6', 5: '#3a8ad6', 6: '#d9a24a' };
  const prevCache = {};
  function mapPreview(key) {
    if (prevCache[key]) return prevCache[key];
    const def = G.MAPS[key], cv = document.createElement('canvas'); if (!def) return cv;
    let mp = null; try { mp = G.genMap(def); } catch (e) { return cv; }
    const s = 6; cv.width = mp.w * s; cv.height = mp.h * s; const c = cv.getContext('2d');
    c.fillStyle = FLOOR[def.theme] || '#86c96a'; c.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < mp.h; y++) for (let x = 0; x < mp.w; x++) { const t = mp.tiles[y * mp.w + x], col = TILE[t]; if (col) { c.fillStyle = col; c.fillRect(x * s, y * s, s, s); } }
    const dot = (p, col) => { if (!p || p.x === undefined) return; c.fillStyle = col; c.beginPath(); c.arc(p.x / G.T * s, p.y / G.T * s, s * 0.9, 0, 6.3); c.fill(); };
    if (Array.isArray(mp.spawns[0])) { mp.spawns[0].forEach((p) => dot(p, '#3c9bff')); (mp.spawns[1] || []).forEach((p) => dot(p, '#ff4a55')); }
    else mp.spawns.forEach((p) => dot(p, '#ffd21f')); // survie : points d'apparition individuels
    return (prevCache[key] = cv);
  }

  /* ---------- rouleau des modes ---------- */
  UI.modeWheel = function () {
    const sv = S(), order = G.MODE_ORDER.slice(), cur = Math.max(0, order.indexOf(sv.mode));
    const o = el(`<div class="mw"><div class="mw-hd"><button class="mw-back" data-act="mwClose" aria-label="Retour">‹</button><div class="mw-t">Choisissez un événement</div><div class="mw-hint">Faites défiler ⟷</div></div>
      <div class="mw-track">${order.map((id, i) => { const m = G.MODES[id], mk = UI.currentMap(id); return `<div class="mw-card" data-i="${i}" data-id="${id}" style="--mc:${m.color}">
        ${m.isNew ? '<div class="mw-new">NOUVEAU</div>' : ''}<div class="mw-top"><div class="mw-ic">${ic(ICON[m.icon] || 'star')}</div><div><div class="mw-n">${esc(m.name)}</div><div class="mw-f">${FMT(m)}</div></div></div>
        <div class="mw-art"><i class="mw-map" data-k="${mk}"></i><i class="mw-hero" data-b="${G.BRAWLERS[(i * 5 + 3) % G.BRAWLERS.length].id}"></i></div>
        <div class="mw-mapn">🗺 ${esc(G.MAPS[mk].name)}</div><div class="mw-d">${esc(m.desc)}</div></div>`; }).join('')}</div>
      <div class="mw-foot"><div class="mw-fmt"><button data-f="3">3 contre 3</button><button data-f="2">2 contre 2</button></div><div class="mw-dots">${order.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div><button class="btn play mw-go" data-act="mwPick">CHOISIR</button></div></div>`);
    $('#ui').appendChild(o); G.Audio.sfx('ui');
    const track = $('.mw-track', o), cards = $$('.mw-card', o), dots = $$('.mw-dots i', o);
    $$('.mw-map', o).forEach((v) => { const cv = mapPreview(v.dataset.k), img = document.createElement('canvas'); img.width = cv.width; img.height = cv.height; img.getContext('2d').drawImage(cv, 0, 0); img.className = 'mw-map'; v.replaceWith(img); });
    $$('.mw-hero', o).forEach((v) => { const cv = document.createElement('canvas'); cv.width = cv.height = 260; cv.className = 'mw-hero'; v.replaceWith(cv); try { G.Render.portrait(cv, v.dataset.b, 'classic', 1.2, { zoom: 1.1, y: 0.86, yaw: -0.5 }); } catch (e) { /* rien */ } });
    // rouleau piloté au doigt (sans défilement natif : fiable sur iPhone / Safari, Android et ordinateur)
    const rail = document.createElement('div'); rail.className = 'mw-rail'; cards.forEach((c) => rail.appendChild(c)); track.appendChild(rail);
    let sel = -1, pos = cur, target = cur, raf = 0, drag = null;
    const step = () => (cards[0].offsetWidth || 300) + (parseFloat(getComputedStyle(rail).columnGap) || 20);
    const N = cards.length, clampI = (v) => Math.max(0, Math.min(N - 1, v));
    const fmtBox = $('.mw-fmt', o);
    const syncFmt = () => { const m = G.MODES[order[sel]] || {}; fmtBox.style.visibility = m.per === 3 ? 'visible' : 'hidden'; $$('button', fmtBox).forEach((b) => b.classList.toggle('on', +b.dataset.f === (sv.fmt === 2 ? 2 : 3))); };
    fmtBox.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; sv.fmt = +b.dataset.f; G.Save.commit(); G.Audio.sfx('ui'); syncFmt(); });
    const update = () => { // la carte centrale grandit, les autres reculent (effet de rouleau)
      const st = step(), w0 = cards[0].offsetWidth || 300;
      rail.style.transform = `translate3d(${track.clientWidth / 2 - w0 / 2 - pos * st}px,0,0)`;
      cards.forEach((c, i) => { const d = i - pos, ad = Math.min(1.6, Math.abs(d));
        c.style.transform = `perspective(900px) rotateY(${G.clamp(-d * 22, -35, 35)}deg) scale(${1 - ad * 0.16})`; c.style.opacity = String(1 - ad * 0.35); c.style.zIndex = String(10 - Math.round(ad * 4)); });
      const best = clampI(Math.round(pos));
      if (best !== sel) { sel = best; cards.forEach((c, i) => c.classList.toggle('on', i === sel)); dots.forEach((d, i) => d.classList.toggle('on', i === sel)); if (o._ready) G.Audio.sfx('hitm', 0.7); syncFmt(); }
    };
    const anim = () => { cancelAnimationFrame(raf); const tick = () => { const d = target - pos; if (Math.abs(d) < 0.002) { pos = target; update(); return; } pos += d * 0.22; update(); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); };
    const goTo = (i) => { target = clampI(i); anim(); };
    const px = (e) => (e.touches ? e.touches[0] || e.changedTouches[0] : e).clientX;
    const down = (e) => { if (drag || (e.button !== undefined && e.button > 0)) return; cancelAnimationFrame(raf); drag = { x0: px(e), p0: pos, moved: false, lx: px(e), lt: performance.now(), v: 0, id: e.pointerId }; if (e.pointerId !== undefined && track.setPointerCapture) { try { track.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } } };
    const move = (e) => {
      if (!drag || (e.pointerId !== undefined && drag.id !== undefined && e.pointerId !== drag.id)) return;
      const x = px(e), dx = x - drag.x0; if (Math.abs(dx) > 8) drag.moved = true;
      let p = drag.p0 - dx / step(); if (p < 0) p *= 0.35; if (p > N - 1) p = N - 1 + (p - N + 1) * 0.35; // résistance aux extrémités
      const now = performance.now(), dt = Math.max(1, now - drag.lt); drag.v = 0.8 * drag.v + 0.2 * ((x - drag.lx) / dt); drag.lx = x; drag.lt = now;
      pos = p; update(); if (e.cancelable) e.preventDefault();
    };
    const up = (e) => {
      if (!drag) return; const d = drag; drag = null;
      if (!d.moved) { const pt = e.changedTouches ? e.changedTouches[0] : e, hit = pt && document.elementFromPoint(pt.clientX, pt.clientY), c = hit && hit.closest && hit.closest('.mw-card'); /* capture du doigt : on vise ce qui est sous le doigt */ if (c) { const i = +c.dataset.i; if (i === sel) ACT.mwPick(); else goTo(i); } else goTo(Math.round(pos)); return; }
      goTo(Math.round(pos - (d.v * 260) / step())); // élan du geste
    };
    if (window.PointerEvent) { track.addEventListener('pointerdown', down); track.addEventListener('pointermove', move); track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up); }
    else { track.addEventListener('touchstart', down, { passive: true }); track.addEventListener('touchmove', move, { passive: false }); track.addEventListener('touchend', up); track.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); }
    track.addEventListener('wheel', (e) => { e.preventDefault(); if (Math.abs(e.deltaX) + Math.abs(e.deltaY) < 4) return; const now = performance.now(); if (now - (track._w || 0) < 180) return; track._w = now; goTo(sel + ((e.deltaX || e.deltaY) > 0 ? 1 : -1)); }, { passive: false });
    o.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') goTo(sel + 1); else if (e.key === 'ArrowLeft') goTo(sel - 1); else if (e.key === 'Enter') ACT.mwPick(); });
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
    window.addEventListener('resize', update);
    o._mwGo = goTo;
    requestAnimationFrame(() => { update(); o._ready = true; });
    UI._mw = { o, get sel() { return order[sel]; } };
  };
  ACT.mwClose = () => { const o = $('.mw'); if (o) { o.classList.add('out'); setTimeout(() => o.remove(), 220); } G.Audio.sfx('back'); };
  ACT.mwPick = () => {
    const id = UI._mw && UI._mw.sel; if (!id) return;
    S().mode = id; G.Save.commit(); G.Audio.sfx('buy'); ACT.mwClose();
    if (Net.party && Net.party.leader === Net.pid && Net.party.state === 'idle' && id !== 'duel') Net.send({ t: 'party_set', mode: id, fmt: G.MODES[id].per === 3 && S().fmt === 2 ? 2 : 3 });
    if (UI.screen === 'home') UI.build.home();
  };
  ACT.modes = () => UI.modeWheel();

  /* ---------- duel entre amis ---------- */
  ACT.duelFriend = (a) => { G.Audio.sfx('ui'); Net.sendProfile(); Net.send({ t: 'invite', pid: a.dataset.pid, mode: 'duel' }); UI.toast('⚔ Défi envoyé !', 2000); };
  const baseShow = UI.showInvite;
  UI.showInvite = function (m) {
    baseShow(m);
    if (m.mode !== 'duel') return;
    const o = UI.modals[UI.modals.length - 1]; if (!o || !o.dataset.inv) return;
    const h = $('.invm-h', o); if (h) { h.textContent = '⚔ DÉFI EN DUEL'; h.classList.add('duel'); }
    const t = $('.invm-t', o); if (t) t.innerHTML = '<b>' + esc(m.from) + '</b> vous défie en duel 1 contre 1 !';
  };
  // salon du duel : s'ouvre chez les deux joueurs dès que le défi est accepté
  function duelOpen() { return UI.modals.find((x) => x.dataset.duel); }
  function renderDuel() {
    const p = Net.party; let o = duelOpen();
    if (!p || p.mode !== 'duel' || p.members.length < 2 || p.state === 'match') { if (o) { UI.modals.splice(UI.modals.indexOf(o), 1); o.remove(); } return; }
    if (G.App.state === 'match') return;
    if (!o) { o = UI.modal('<div class="duel" id="duelBody"></div>', { noClose: true, style: 'width:min(150rem,96vw)' }); o.dataset.duel = '1'; o._cv = {}; }
    const me = p.members.find((m) => m.pid === Net.pid) || p.members[0], op = p.members.find((m) => m.pid !== me.pid), lead = p.leader === Net.pid;
    const card = (m, side) => `<div class="du-card ${side}"><canvas width="360" height="360" data-pid="${esc(m.pid)}"></canvas><div class="du-n">${esc(m.name)}</div><div class="du-tr">${ic('trophy')} ${fmt(m.trophies || 0)}</div><div class="du-rd ${m.ready ? 'ok' : ''}">${m.ready ? '✔ PRÊT' : 'Pas prêt'}</div></div>`;
    const maps = G.MODES.duel.maps;
    $('#duelBody', o).innerHTML = `<div class="du-h">⚔ DUEL 1 CONTRE 1</div><div class="du-row">${card(me, 'l')}<div class="du-vs">VS</div>${card(op, 'r')}</div>
      <div class="du-maps">${maps.map((k) => `<button class="du-map ${(p.map || maps[0]) === k ? 'on' : ''}" data-act="duelMap" data-k="${k}" ${lead ? '' : 'disabled'}><i class="du-mp" data-k="${k}"></i><span>${esc(G.MAPS[k].name)}</span></button>`).join('')}</div>
      <div class="du-b"><button class="btn gray" data-act="duelLeave">Quitter</button><button class="btn ${me.ready ? 'red' : 'green'}" data-act="duelReady">${me.ready ? 'Annuler' : 'PRÊT !'}</button></div>
      <div class="du-help">${lead ? 'Choisissez l\'arène.' : 'Votre adversaire choisit l\'arène.'} Le combat commence quand les deux joueurs sont prêts.</div>`;
    $$('.du-mp', o).forEach((v) => { const src = mapPreview(v.dataset.k), c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); v.replaceWith(c); });
    UI.anim = UI.anim.filter((x) => x.cv.isConnected);
    $$('.du-card canvas', o).forEach((cv) => { const m = p.members.find((x) => x.pid === cv.dataset.pid); UI.anim.push({ cv, id: G.BRAWLER[m.brawler] ? m.brawler : 'sherry', skin: m.skin || 'classic', opts: { zoom: 0.95, y: 0.8, yaw: cv.closest('.l') ? 0.4 : -0.4 } }); });
  }
  Net.on('party', () => setTimeout(renderDuel, 30));
  Net.on('match', () => { const o = duelOpen(); if (o) { UI.modals.splice(UI.modals.indexOf(o), 1); o.remove(); } });
  ACT.duelMap = (a) => { if (a.disabled) return; G.Audio.sfx('ui'); Net.send({ t: 'party_set', map: a.dataset.k }); };
  ACT.duelReady = () => { const me = Net.party && Net.party.members.find((m) => m.pid === Net.pid); G.Audio.sfx(me && me.ready ? 'back' : 'go'); Net.sendProfile(); Net.send({ t: 'party_set', ready: !(me && me.ready) }); };
  ACT.duelLeave = () => { const o = duelOpen(); if (o) { UI.modals.splice(UI.modals.indexOf(o), 1); o.remove(); } Net.leaveParty(); G.Audio.sfx('back'); };
})();
