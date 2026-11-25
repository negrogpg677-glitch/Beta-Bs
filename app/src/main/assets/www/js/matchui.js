/* Brawl Rush - interface de combat : discussion rapide « … » (en ligne : coéquipiers), écran VS avant la partie,
   éditeur de commandes (déplacer, taille, transparence, enregistrer, réinitialiser). */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT, Net = G.Net;
  const { $, $$, el, esc, S } = UI.h;
  const QUICK = ['Salut !', 'Bien joué !', 'GG !', 'Attaquez !', 'Défendez !', 'Besoin d\'aide !', 'Oups, pardon !', 'Merci !'];

  /* ---------- discussion rapide en partie ---------- */
  function say(text) {
    const M = G.App.M; if (!M || !M.player) return;
    const me = M.player; me.chatText = text; me.chatUntil = performance.now() + 3200;
    if (M.net) Net.send({ t: 'mchat', text });
    else if (Math.random() < 0.5) { // hors-ligne : un coéquipier bot répond parfois
      const mate = M.ents.find((e) => e !== me && e.alive && e.team === me.team);
      if (mate) setTimeout(() => { mate.chatText = ['OK !', 'On y va !', 'Compris !', '👍'][(Math.random() * 4) | 0]; mate.chatUntil = performance.now() + 2600; }, 700 + Math.random() * 800);
    }
  }
  UI.matchChat = function () {
    const old = $('.mchat'); if (old) { old.remove(); G.Input.chatOpen = false; return; }
    const p = el(`<div class="mchat"><div class="mchat-h">💬 Discussion rapide<button data-act="mchatClose" aria-label="Fermer">✕</button></div>
      <div class="mchat-l">${QUICK.map((q) => `<button class="mchat-q" data-act="mchatSay" data-t="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="mchat-e">${G.EMOTES.map((e, i) => `<button data-act="mchatEmote" data-i="${i}">${e}</button>`).join('')}</div></div>`);
    const L = G.Render.layout(window.innerWidth, window.innerHeight); p.style.right = Math.max(8, window.innerWidth - L.emX + L.emR + 14) + 'px'; p.style.top = Math.max(8, L.emY - L.emR * 2) + 'px';
    p.dataset.t0 = Date.now(); $('#ui').appendChild(p); G.Input.chatOpen = true; G.Audio.sfx('ui');
    clearTimeout(UI._mct); UI._mct = setTimeout(() => { if (p.isConnected) { p.remove(); G.Input.chatOpen = false; } }, 6000);
  };
  const closeChat = () => { const p = $('.mchat'); if (p) p.remove(); G.Input.chatOpen = false; };
  ACT.mchatClose = closeChat;
  const fresh = (a) => { const p = a.closest('.mchat'); return p && Date.now() - +p.dataset.t0 < 350; }; // ignore le toucher qui a ouvert le panneau
  ACT.mchatSay = (a) => { if (fresh(a)) return; say(a.dataset.t); closeChat(); };
  ACT.mchatEmote = (a) => { if (fresh(a)) return; G.Input.pending.push({ kind: 'emote', i: +a.dataset.i }); closeChat(); };
  Net.on('mchat', (m) => { const M = G.App.M; if (!M || !M.net) return; const b = M.ents[m.idx]; if (b) { b.chatText = m.text; b.chatUntil = performance.now() + 3200; } });

  /* ---------- écran VS (pendant le compte à rebours) ---------- */
  const BG = ['#2f7dff', '#7a3cff', '#e0703a', '#1fae8a', '#d63c7a', '#c9a21a'];
  UI.vsScreen = function (M) {
    if (!M || M.mode === 'showdown' || !M.player) return;
    const me = M.player, list = M.ents.filter((e) => e && !e.isBoss || (e && e.isBoss));
    const mine = list.filter((e) => e.team === me.team), them = list.filter((e) => e.team !== me.team);
    if (!them.length) return;
    const card = (e, i) => `<div class="vs-card ${e === me ? 'me' : ''}" style="--bg:${BG[(i + (e.team === me.team ? 0 : 3)) % BG.length]};animation-delay:${i * 0.07}s"><canvas width="240" height="240" data-id="${e.id}" data-skin="${e.skin || 'classic'}"></canvas>
      <div class="vs-n"><b>${esc(e.name || '?')}</b><span>${esc((G.BRAWLER[e.id] || {}).name || '')}${e.isBot && e !== me ? ' · BOT' : ''}</span></div></div>`;
    const o = el(`<div class="vs"><div class="vs-row top">${them.map(card).join('')}</div><div class="vs-mid">VS</div><div class="vs-row bot">${mine.map(card).join('')}</div>
      <div class="vs-cd">Début dans <b>3</b></div><div class="vs-mode">${esc((G.MODES[M.mode] || {}).name || '')}</div></div>`);
    $('#ui').appendChild(o);
    if (G.Char3D && G.Char3D.preload) G.Char3D.preload(list.map((e) => e.id));
    const cvs = $$('canvas', o), t0 = performance.now(); let last = 0;
    const loop = (now) => {
      if (!o.isConnected) return;
      const gone = G.App.M !== M || (M.state !== 'countdown' && now - t0 > 600) || now - t0 > 4200;
      if (gone) { o.classList.add('out'); setTimeout(() => o.remove(), 300); return; }
      const cd = M.state === 'countdown' && M.cd > 0 ? Math.ceil(M.cd) : Math.max(1, 3 - Math.floor((now - t0) / 1000));
      const b = $('.vs-cd b', o); if (b && b.textContent !== String(cd)) { b.textContent = cd; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
      if (now - last > 220) { last = now; cvs.forEach((cv, i) => { try { G.Render.portrait(cv, cv.dataset.id, cv.dataset.skin, now / 1000 + i, { zoom: 1.35, y: 0.95, yaw: -0.35 }); } catch (e) { /* rien */ } }); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  /* ---------- éditeur de commandes ---------- */
  const LABEL = { joy: ['✥', 'Déplacement'], atk: ['◎', 'Tir'], sup: ['⚡', 'Super'], gd: ['✚', 'Gadget'], dg: ['↻', 'Roulade'], em: ['…', 'Chat'] };
  UI.ctrlEditor = function () {
    while (UI.modals.length) UI.closeModal();
    const st = S().settings, Wd = window.innerWidth, Hd = window.innerHeight;
    const L0 = G.Render.layout(Wd, Hd), tmp = {};
    for (const k in G.Render.CTRL_DEF) { const base = G.Render.CTRL_DEF[k][2] * L0.u; tmp[k] = { x: L0[k + 'X'] / Wd, y: L0[k + 'Y'] / Hd, s: L0[k + 'R'] / base }; }
    let alpha = st.ctrlAlpha || 0.8, sel = 'atk';
    const o = el(`<div class="ctrled"><div class="ce-field"></div>
      <div class="ce-bar"><div class="ce-title">Personnaliser les commandes</div>
        <label>Taille <span id="ceSel"></span><input type="range" id="ceSize" min="60" max="160" step="5"></label>
        <label>Transparence<input type="range" id="ceAlpha" min="25" max="100" step="5"></label>
        <div class="ce-btns"><button class="btn small gray" data-act="ceReset">Réinitialiser</button><button class="btn small red" data-act="ceCancel">Annuler</button><button class="btn small green" data-act="ceSave">Enregistrer</button></div></div>
      <div class="ce-help">Faites glisser un bouton pour le déplacer · touchez-le pour régler sa taille</div></div>`);
    document.body.appendChild(o);
    const field = $('.ce-field', o), size = $('#ceSize', o), alp = $('#ceAlpha', o);
    const draw = () => {
      const L = G.Render.layout(Wd, Hd, tmp);
      const ks = Object.keys(LABEL), bad = {};
      ks.forEach((a, i) => ks.slice(i + 1).forEach((b) => { if (Math.hypot(L[a + 'X'] - L[b + 'X'], L[a + 'Y'] - L[b + 'Y']) < L[a + 'R'] + L[b + 'R'] - 2) bad[a] = bad[b] = 1; }));
      UI._ceBad = Object.keys(bad).length > 0;
      field.innerHTML = ks.map((k) => `<div class="ce-b ${k === sel ? 'sel' : ''} ${bad[k] ? 'bad' : ''}" data-k="${k}" style="left:${L[k + 'X']}px;top:${L[k + 'Y']}px;width:${L[k + 'R'] * 2}px;height:${L[k + 'R'] * 2}px;opacity:${alpha}"><i>${LABEL[k][0]}</i><span>${LABEL[k][1]}</span></div>`).join('');
      size.value = Math.round(tmp[sel].s * 100); alp.value = Math.round(alpha * 100); $('#ceSel', o).textContent = '(' + LABEL[sel][1] + ')';
    };
    draw();
    let drag = null;
    field.addEventListener('pointerdown', (e) => { const b = e.target.closest('.ce-b'); if (!b) return; sel = b.dataset.k; drag = { k: sel, id: e.pointerId }; try { field.setPointerCapture(e.pointerId); } catch (er) { /* rien */ } draw(); });
    field.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; tmp[drag.k].x = G.clamp(e.clientX / Wd, 0.03, 0.97); tmp[drag.k].y = G.clamp(e.clientY / Hd, 0.05, 0.97); draw(); });
    const end = () => { drag = null; }; field.addEventListener('pointerup', end); field.addEventListener('pointercancel', end);
    size.addEventListener('input', () => { tmp[sel].s = +size.value / 100; draw(); });
    alp.addEventListener('input', () => { alpha = +alp.value / 100; draw(); });
    UI._ce = { o, tmp, get alpha() { return alpha; }, reset() { for (const k in tmp) { const d = G.Render.CTRL_DEF[k]; tmp[k] = { x: st.lefty ? 1 - d[0] : d[0], y: d[1], s: 1 }; } alpha = 0.8; draw(); } };
  };
  ACT.ctrlEdit = () => { G.Audio.sfx('ui'); UI.ctrlEditor(); };
  ACT.ceReset = () => { G.Audio.sfx('back'); UI._ce.reset(); };
  ACT.ceCancel = () => { G.Audio.sfx('back'); UI._ce.o.remove(); };
  ACT.ceSave = () => { if (UI._ceBad) { G.Audio.sfx('error'); UI.toast('Des boutons se chevauchent : écartez-les avant d\'enregistrer.', 2600); return; } const st = S().settings; st.ctrlPos = JSON.parse(JSON.stringify(UI._ce.tmp)); st.ctrlAlpha = UI._ce.alpha; G.Save.commit(); UI._ce.o.remove(); G.Audio.sfx('buy'); UI.toast('Commandes enregistrées ✔', 1800); };
  // l'éditeur est hors de #ui : ses boutons passent par le même routeur d'actions
  document.addEventListener('click', (e) => { const a = e.target.closest('.ctrled [data-act]'); if (a && ACT[a.dataset.act]) ACT[a.dataset.act](a, e); });
})();
