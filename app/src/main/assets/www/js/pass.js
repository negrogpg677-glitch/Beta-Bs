/* Brawl Rush - Pass Rush : pass de saison mensuel gratuit, 30 paliers, XP gagnée à chaque partie */
(function () {
  const G = window.G, UI = G.UI, ACT = UI.ACT;
  const { $, el, ic, S, fmt, portraitCanvas } = UI.h;
  const TIERS = 30, PER = 100;
  const LEGEND = ['inferno', 'crystal', 'ghost', 'rainbow'];

  const P = G.Pass = {
    TIERS, PER,
    season() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); },
    seasonName() { const d = new Date(); const m = d.toLocaleDateString('fr-FR', { month: 'long' }); return 'Saison ' + m.charAt(0).toUpperCase() + m.slice(1); },
    daysLeft() { const d = new Date(), e = new Date(d.getFullYear(), d.getMonth() + 1, 1); return Math.max(1, Math.ceil((e - d) / 86400000)); },
    get() { // nouvelle saison chaque mois : progression remise à zéro
      const sv = S(); if (!sv.pass || sv.pass.season !== P.season()) sv.pass = { season: P.season(), xp: 0, claimed: [] };
      return sv.pass;
    },
    tier() { return Math.min(TIERS, Math.floor(P.get().xp / PER)); },
    reward(i) {
      if (i === TIERS - 1) return { type: 'skin' };
      if (i === 14) return { type: 'brawler' };
      if (i % 5 === 4) return { type: 'box', val: i >= 20 ? 2 : 1 };
      if (i % 3 === 2) return { type: 'gems', val: 10 + 5 * Math.floor(i / 10) };
      return { type: 'coins', val: 100 + 10 * i };
    },
    xpFor(r, kills) { return r.quit ? 0 : (r.win ? 60 : r.draw ? 35 : 25) + Math.min(30, (kills || 0) * 5); },
    add(xp) { const p = P.get(), t0 = P.tier(); p.xp = Math.min(TIERS * PER, p.xp + xp); return { xp, t0, t1: P.tier() }; },
    claimable() { const p = P.get(), t = P.tier(); let n = 0; for (let i = 0; i < t; i++) if (!p.claimed.includes(i)) n++; return n; },
    nextBrawler() { const sv = S(); const b = G.BRAWLERS.find((x) => !sv.unlocked.includes(x.id)); return b && b.id; },
    legendSkin() { const sv = S(), own = sv.ownedSkins[sv.selected] || []; return LEGEND.find((k) => G.SKIN[k] && !own.includes(k)); },
  };

  function art(r) {
    if (r.type === 'coins') return ic('coin') + `<span class="amt">${r.val}</span>`;
    if (r.type === 'gems') return ic('gem') + `<span class="amt">${r.val}</span>`;
    if (r.type === 'box') return ic('chest') + `<span class="amt">x${r.val}</span>`;
    if (r.type === 'brawler') { const id = P.nextBrawler(); return id ? '<i class="pv" data-b="' + id + '"></i><span class="amt">Brawler</span>' : ic('coin') + '<span class="amt">1000</span>'; }
    const k = P.legendSkin(); return k ? '<i class="pv" data-b="' + S().selected + '" data-s="' + k + '"></i><span class="amt">Skin</span>' : ic('gem') + '<span class="amt">100</span>';
  }

  UI.passModal = function () {
    const p = P.get(), t = P.tier(), inTier = p.xp - t * PER, full = t >= TIERS;
    const o = UI.modal(`<div class="pass">
      <div class="pass-hd"><div><h2>${ic('star')} Pass Rush</h2><div class="sub">${P.seasonName()} · encore ${P.daysLeft()} j</div></div>
        <div class="pass-lv"><b>${t}</b><span>/ ${TIERS}</span></div></div>
      <div class="pass-xp"><i style="width:${full ? 100 : (inTier / PER) * 100}%"></i><span>${full ? 'Pass terminé !' : inTier + ' / ' + PER + ' XP'}</span></div>
      <div class="pass-help">Gagnez de l'XP à chaque partie : victoire +60, nul +35, défaite +25, +5 par K.O. (max +30).</div>
      <div class="pass-track" id="passTrack"></div>
    </div>`, { style: 'width:min(150rem,96vw)' });
    const tr = $('#passTrack', o);
    for (let i = 0; i < TIERS; i++) {
      const r = P.reward(i), done = i < t, got = p.claimed.includes(i);
      const n = el(`<div class="pnode ${done ? 'done' : ''} ${done && !got ? 'claimable' : ''} ${got ? 'claimed' : ''} ${r.type === 'skin' || r.type === 'brawler' ? 'big' : ''}" data-act="claimPass" data-i="${i}">
        <div class="pw">${art(r)}${got ? '<em>✔</em>' : ''}</div><div class="pn">${i + 1}</div></div>`);
      tr.appendChild(n);
    }
    tr.querySelectorAll('.pv').forEach((v) => { const cv = portraitCanvas(v.dataset.b, v.dataset.s || 'classic', 200); v.replaceWith(cv); });
    setTimeout(() => { const first = tr.querySelector('.claimable') || tr.children[Math.min(t, TIERS - 1)]; if (first) tr.scrollLeft = Math.max(0, first.offsetLeft - tr.clientWidth / 2 + first.clientWidth / 2); }, 30);
    tr.addEventListener('wheel', (e) => { tr.scrollLeft += e.deltaY; });
    return o;
  };

  ACT.pass = () => { G.Audio.sfx('ui'); UI.passModal(); };
  ACT.claimPass = (a) => {
    const i = +a.dataset.i, p = P.get(), sv = S();
    if (p.claimed.includes(i)) return;
    if (i >= P.tier()) { G.Audio.sfx('error'); UI.toast('Atteignez le palier ' + (i + 1) + ' pour débloquer cette récompense'); return; }
    const r = P.reward(i); p.claimed.push(i);
    let msg = 'Récompense récupérée !', newB = null;
    if (r.type === 'coins') sv.coins += r.val;
    else if (r.type === 'gems') sv.gems += r.val;
    else if (r.type === 'box') sv.boxes += r.val;
    else if (r.type === 'brawler') { const id = P.nextBrawler(); if (id && UI.h.unlockBrawler(id)) newB = id; else { sv.coins += 1000; msg = '+1000 pièces'; } }
    else if (r.type === 'skin') {
      const k = P.legendSkin(), b = sv.selected;
      if (k) { (sv.ownedSkins[b] = sv.ownedSkins[b] || []).push(k); sv.skins[b] = k; msg = 'Skin légendaire « ' + G.SKIN[k].name + ' » obtenu pour ' + G.BRAWLER[b].name + ' !'; }
      else { sv.gems += 100; msg = '+100 gemmes'; }
    }
    G.Save.commit(); G.Audio.sfx('buy'); G.vibrate(30);
    UI.closeModal(); if (UI.screen === 'home') UI.build.home(); UI.refreshCur(); UI.passModal();
    if (newB) UI.h.showNewBrawler(newB); else UI.toast(msg, 2600);
  };
})();
