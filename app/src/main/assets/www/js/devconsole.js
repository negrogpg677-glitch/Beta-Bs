/* Brawl Rush - CONSOLE DÉVELOPPEUR connectée au serveur (vues du menu développeur)
   Observer : tableau de bord en direct, joueurs, profils, parties en cours, replays.
   Administrer : avertir, déconnecter une session, sanctionner, arrêter une partie (avec confirmation), signalements,
   sanctions, journal d'activité. Studio : laboratoire de test, triches de test en ligne, tests serveur.
   Toutes les données viennent du serveur ; chaque action est revérifiée par le serveur (droits). */
(function () {
  const G = window.G, Net = G.Net, UI = G.UI;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MODE = (id) => (G.MODES[id] || {}).name || id;
  const ago = (t) => { if (!t) return '—'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h'; };
  const hm = (t) => t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const D = (G.DevConsole = { data: {}, view: {}, roles: () => (Net.me && Net.me.roles) || [] });
  const has = (r) => D.roles().includes(r);
  const btn = (attr, label, cls) => `<button class="btn small ${cls || ''}" ${attr}>${label}</button>`;
  const kpi = (k, v, bad) => `<div class="dp-kpi ${bad ? 'bad' : ''}"><b>${esc(v)}</b><span>${esc(k)}</span></div>`;
  const need = (r) => {
    if (Net.status !== 'online') return '<div class="rg-note">Connexion au serveur…</div>';
    if (!(G.Account && G.Account.loggedIn())) return '<div class="rg-note">🔒 Connectez-vous avec le compte développeur pour utiliser les outils en ligne.</div>';
    if (!has(r)) return `<div class="rg-note">🔒 Droit « ${{ observe: 'observer', admin: 'administrer', dev: 'développer' }[r]} » requis (vérifié par le serveur).</div>`;
    return '';
  };
  // réponses du serveur → données de la vue
  ['dv_dash', 'dv_players', 'dv_player', 'dv_matches', 'dv_replays', 'dv_reports', 'dv_audit', 'dv_bans', 'dv_selftest', 'dv_cheats', 'dv_labstate'].forEach((t) => Net.on(t, (m) => { D.data[t] = m; D.refresh(); }));
  D.refresh = () => { const dp = G.DevPro; if (dp && dp.panel && dp.ui && dp.ui.detail) { const keep = document.activeElement && document.activeElement.id; const sc = dp.panel.querySelector('#rgBody').scrollTop; dp._render(); const b = dp.panel.querySelector('#rgBody'); if (b) b.scrollTop = sc; if (keep) { const i = document.getElementById(keep); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) { /* ignore */ } } } } };
  // demande périodique des vues « en direct »
  let poll = 0;
  setInterval(() => {
    const dp = G.DevPro, d = dp && dp.panel && dp.ui && dp.ui.detail; if (!d || Net.status !== 'online') return;
    poll++;
    if (d === 'dash' && has('observe')) Net.send({ t: 'dv_dash' });
    if (d === 'matches' && has('observe') && poll % 2 === 0) Net.send({ t: 'dv_matches' });
    if (d === 'players' && has('observe') && poll % 3 === 0) { if (D.view.pid) Net.send({ t: 'dv_player', pid: D.view.pid }); else Net.send({ t: 'dv_players', q: D.view.q || '', status: D.view.st || '' }); }
  }, 2000);
  D.open = (id) => { // premier chargement d'une vue
    if (Net.status !== 'online') return;
    const s = (o) => Net.send(o);
    if (id === 'dash' && has('observe')) s({ t: 'dv_dash' });
    if (id === 'players' && has('observe')) s({ t: 'dv_players', q: D.view.q || '' });
    if (id === 'matches' && has('observe')) s({ t: 'dv_matches' });
    if (id === 'replays' && has('observe')) s({ t: 'dv_replays' });
    if (id === 'reports' && has('admin')) s({ t: 'dv_reports' });
    if (id === 'bans' && has('admin')) s({ t: 'dv_bans' });
    if (id === 'audit' && has('admin')) s({ t: 'dv_audit' });
  };

  /* ---------- rendus ---------- */
  const R = {};
  R.dash = () => { const n = need('observe'); if (n) return n; const d = D.data.dv_dash; if (!d) return '<div class="rg-note">Chargement…</div>';
    const p = d.players, sv = d.server, svc = d.services;
    return `<div class="dv-h">Joueurs</div><div class="dp-kpis">${kpi('Connectés', p.online)}${kpi('En partie', p.inMatch)}${kpi('Absents (partie)', p.away, p.away > 0)}${kpi('En groupe', p.inParty)}${kpi('Avec compte', p.accounts)}${kpi('Spectateurs', p.spectators)}${kpi('Joueurs de test', p.tests)}</div>
      <div class="dv-h">Parties et serveur</div><div class="dp-kpis">${kpi('Groupes', d.parties)}${kpi('Parties', d.matches.total)}${kpi('En jeu', d.matches.play)}${kpi('Labo', d.matches.lab)}${kpi('Calcul moyen', sv.tickAvg + ' ms', sv.tickAvg > 12)}${kpi('Pic de calcul', sv.tickMax + ' ms', sv.tickMax > 30)}${kpi('Mémoire', sv.heap + ' Mo')}${kpi('Démarré depuis', Math.round(d.uptime / 60) + ' min')}</div>
      <div class="dv-h">Services et réseau</div><div class="dp-kpis">${kpi('Base de données', svc.db, svc.db !== 'ok')}${kpi('Tables', svc.tables, svc.tables !== 'ok')}${kpi('Sessions', svc.sessions)}${kpi('Classement', svc.lb)}${kpi('Ping moyen', d.net.avgPing + ' ms', d.net.avgPing > 150)}${kpi('Ping max', d.net.maxPing + ' ms', d.net.maxPing > 250)}${kpi('Connexions lentes', d.net.laggy, d.net.laggy > 0)}</div>
      <div class="dv-h">Statistiques depuis le démarrage</div><div class="dp-kpis">${kpi('Connexions', d.stats.conns)}${kpi('Parties lancées', d.stats.started)}${kpi('Terminées', d.stats.ended)}${kpi('Durée moyenne', d.stats.avgDuration + ' s')}${kpi('Replays', d.stats.replays)}${kpi('Signalements ouverts', d.stats.reports, d.stats.reports > 0)}</div>
      <div class="dv-note">Par mode : ${Object.entries(d.stats.byMode).map(([k, v]) => esc(MODE(k)) + ' ' + v).join(' · ') || '—'} · Inactivité ${d.cfg.afkSec} s · Reconnexion ${d.cfg.reconnectSec} s</div>
      <div class="dp-2col"><div><div class="dv-h">⚠ Alertes</div><div class="dp-log">${d.alerts.map((a) => `<div class="${a.level === 'grave' ? 'ko' : ''}"><i>${hm(a.at)}</i> ${esc(a.text)}</div>`).join('') || 'Aucune alerte 👍'}</div>
        <div class="dv-h">Erreurs serveur</div><div class="dp-log">${d.errors.map((e) => `<div class="ko"><i>${hm(e.at)}</i> ${esc(e.where)} : ${esc(e.msg)}</div>`).join('') || 'Aucune erreur 👍'}</div></div>
        <div><div class="dv-h">Activité récente</div><div class="dp-log tall">${d.activity.map((a) => `<div><i>${hm(a.at)}</i> <b>${esc(a.kind)}</b> ${esc(a.text)}</div>`).join('') || '—'}</div></div></div>
      <div class="dv-note">Mis à jour ${ago(d.at)} — actualisation automatique.</div>`; };
  const ST = ['', 'en ligne', 'en groupe', 'en partie', 'absent (partie)', 'spectateur', 'hors ligne'];
  R.players = () => { const n = need('observe'); if (n) return n;
    if (D.view.pid) return R.profile();
    const d = D.data.dv_players;
    return `<div class="dp-row"><input class="txt" id="dvQ" placeholder="Pseudo, identifiant…" value="${esc(D.view.q || '')}"><span class="dp-chips">${btn('data-dv="search"', '🔎 Rechercher', 'blue')}</span></div>
      <div class="dp-chips">${ST.map((s) => `<button class="btn small ${(D.view.st || '') === s ? 'green' : ''}" data-dv="st" data-v="${s}">${s || 'Tous'}</button>`).join('')}</div>
      ${!d ? '<div class="rg-note">Chargement…</div>' : `<div class="dv-note">${d.total} joueur(s)</div><div class="dv-list">${d.list.map((p) => `<button class="dv-pl ${p.online ? '' : 'off'}" data-dv="prof" data-pid="${esc(p.pid)}"><b>${esc(p.name)}${p.test ? ' <em class="tag">TEST</em>' : ''}${p.roles ? ' <em class="tag dev">DEV</em>' : ''}</b><small>${esc(p.handle || (p.account ? 'compte' : 'invité'))} · ${esc(p.status)}${p.online ? ' · ' + (p.ping || '?') + ' ms · ' + esc(p.plat) : ' · vu il y a ' + ago(p.lastSeen)}</small></button>`).join('') || '<div class="rg-note">Aucun joueur.</div>'}</div>`}`; };
  R.profile = () => { const d = D.data.dv_player; if (!d || d.p.pid !== D.view.pid) return btn('data-dv="list"', '‹ Liste') + '<div class="rg-note">Chargement du profil…</div>';
    const p = d.p, adm = has('admin');
    return `<div class="dp-chips">${btn('data-dv="list"', '‹ Liste des joueurs')}</div>
      <div class="dv-prof"><div class="dv-ph"><b>${esc(p.name)}</b>${p.test ? '<em class="tag">TEST</em>' : ''}<small>${esc(p.handle || (p.account ? 'compte' : 'invité'))} · ${esc(p.status)}</small></div>
      <div class="dp-kpis">${kpi('Statut', p.status)}${kpi('Ping', (p.ping || 0) + ' ms', p.ping > 180)}${kpi('Plateforme', p.plat || '?')}${kpi('Session', p.session ? ago(p.session.since) : '—')}${kpi('Reconnexions', p.session ? p.session.reconnects : '—')}${kpi('Signalements', p.reports, p.reports > 0)}</div>
      ${p.banned ? `<div class="dv-warn">⛔ Sanctionné jusqu'au ${new Date(p.banned.until).toLocaleString('fr-FR')} — ${esc(p.banned.reason)}</div>` : ''}
      ${p.party ? `<div class="dv-h">Groupe ${esc(p.party.code)} (chef : ${esc(p.party.leader)})</div><div class="dp-chips">${p.party.members.map((x) => `<button class="btn small" data-dv="prof" data-pid="${esc(x.pid)}">${esc(x.name)}${x.test ? ' · test' : ''}</button>`).join('')}</div>` : ''}
      ${p.match ? `<div class="dv-h">Partie en cours : ${esc(MODE(p.match.mode))} · ${esc(p.match.map)} · ${p.match.t} s</div><div class="dp-chips">${btn(`data-dv="watch" data-pid="${esc(p.pid)}"`, '👁 Observer ce joueur', 'blue')}${adm ? btn(`data-dv="endm" data-id="${esc(p.match.id)}"`, '⛔ Arrêter la partie', 'red') : ''}</div>` : ''}
      <div class="dp-2col"><div><div class="dv-h">Dernières parties</div><div class="dp-log">${p.matches.map((x) => `<div><i>${hm(x.at)}</i> ${esc(MODE(x.mode))} · ${x.draw ? 'égalité' : x.win ? 'victoire' : 'défaite'} · ${x.kills} élim. · ${x.damage} dégâts</div>`).join('') || '—'}</div></div>
        <div><div class="dv-h">Déconnexions</div><div class="dp-log">${p.drops.map((x) => `<div><i>${hm(x.at)}</i> après ${x.dur} s${x.inMatch ? ' · <b>pendant une partie</b>' : ''} (code ${x.code})</div>`).join('') || '—'}</div></div></div>
      <div class="dv-h">Modération ${adm ? '' : '🔒 (droit « administrer » requis)'}</div>
      <div class="dp-chips">${btn(`data-dv="warn" data-pid="${esc(p.pid)}" ${adm && p.online ? '' : 'disabled'}`, '✉ Avertir')}${btn(`data-dv="kick" data-pid="${esc(p.pid)}" ${adm && p.online ? '' : 'disabled'}`, '🔌 Déconnecter la session', 'yellow')}${btn(`data-dv="ban" data-pid="${esc(p.pid)}" ${adm ? '' : 'disabled'}`, '⛔ Sanctionner', 'red')}</div></div>`; };
  R.matches = () => { const n = need('observe'); if (n) return n; const d = D.data.dv_matches; if (!d) return '<div class="rg-note">Chargement…</div>';
    return d.list.length ? d.list.map((m) => `<div class="dv-match"><div class="dv-mh"><b>${esc(MODE(m.mode))}</b> · ${esc(m.map)} · ${esc(m.state)} · ${m.t} s ${m.score ? '· ' + m.score.join(' – ') : ''} ${m.lab ? '<em class="tag">LABO</em>' : m.ranked ? '<em class="tag">CLASSÉ</em>' : m.private ? '<em class="tag">PRIVÉE</em>' : '<em class="tag">PUBLIQUE</em>'} ${m.specs ? '· 👁 ' + m.specs : ''}</div>
      <div class="dv-mp">${m.players.map((p) => `<span class="t${p.team === 0 ? 0 : p.team === 1 ? 1 : 2} ${p.alive === false ? 'dead' : ''}">${esc(p.name)}${p.bot ? ' 🤖' : ''}${p.test ? ' 🧪' : ''} ${p.kills != null ? '· ' + p.kills : ''}</span>`).join('')}</div>
      <div class="dp-chips">${m.state === 'play' ? btn(`data-dv="watchm" data-id="${esc(m.id)}"`, '👁 Observer', 'blue') : ''}${has('admin') ? btn(`data-dv="endm" data-id="${esc(m.id)}"`, '⛔ Arrêter', 'red') : ''}</div></div>`).join('') : '<div class="rg-note">Aucune partie en cours.</div>'; };
  R.replays = () => { const n = need('observe'); if (n) return n; const d = D.data.dv_replays;
    return `<div class="dp-row"><input class="txt" id="dvRq" placeholder="Joueur…" value="${esc(D.view.rq || '')}"><span class="dp-chips"><select id="dvRm" class="txt"><option value="">Tous les modes</option>${G.MODE_ORDER.map((k) => `<option value="${k}" ${D.view.rm === k ? 'selected' : ''}>${esc(MODE(k))}</option>`).join('')}</select><input type="date" id="dvRd" class="txt" value="${esc(D.view.rd || '')}">${btn('data-dv="rsearch"', '🔎', 'blue')}</span></div>
      <div class="dv-note">Le serveur garde les 8 dernières parties depuis son démarrage (15 images/s).</div>
      ${!d ? '<div class="rg-note">Chargement…</div>' : d.list.map((r) => `<div class="dv-match"><div class="dv-mh"><b>${esc(MODE(r.mode))}</b> · ${esc(r.map)} · ${new Date(r.at).toLocaleString('fr-FR')} · ${r.duration} s · ${r.result ? (r.result.draw ? 'égalité' : 'victoire ' + (r.result.winnerTeam === 0 ? 'bleus' : 'rouges')) : ''} ${r.lab ? '<em class="tag">LABO</em>' : ''}</div>
        <div class="dv-mp">${r.players.map((p) => `<span class="t${p.team === 0 ? 0 : p.team === 1 ? 1 : 2}">${esc(p.name)}${p.bot ? ' 🤖' : ''} · ${p.kills} élim. · ${p.damage} dég.</span>`).join('')}</div>
        <div class="dp-chips">${btn(`data-dv="play" data-id="${esc(r.id)}"`, '⏵ Revoir (' + r.n + ' images, ' + r.size + ' ko)', 'green')}</div></div>`).join('') || '<div class="rg-note">Aucun replay pour l\'instant.</div>'}`; };
  R.reports = () => { const n = need('admin'); if (n) return n; const d = D.data.dv_reports; if (!d) return '<div class="rg-note">Chargement…</div>';
    return d.list.map((r) => `<div class="dv-match ${r.closed ? 'done' : ''}"><div class="dv-mh"><b>${esc(r.targetName)}</b> signalé par ${esc(r.from)} · ${esc(r.why)} · ${new Date(r.at).toLocaleString('fr-FR')}</div>${r.text ? `<div class="dv-note">${esc(r.text)}</div>` : ''}
      <div class="dp-chips">${r.target ? btn(`data-dv="prof2" data-pid="${esc(r.target)}"`, 'Voir le joueur') : ''}${r.closed ? `<span class="dv-note">Traité par ${esc(r.closed.by)}${r.closed.note ? ' : ' + esc(r.closed.note) : ''}</span>` : btn(`data-dv="rclose" data-id="${esc(r.id)}"`, '✔ Marquer traité', 'green')}</div></div>`).join('') || '<div class="rg-note">Aucun signalement.</div>'; };
  R.bans = () => { const n = need('admin'); if (n) return n; const d = D.data.dv_bans; if (!d) return '<div class="rg-note">Chargement…</div>';
    return d.list.map((b) => `<div class="dv-match"><div class="dv-mh"><b>${esc(b.name)}</b> jusqu'au ${new Date(b.until).toLocaleString('fr-FR')} · ${esc(b.reason)} · par ${esc(b.by)}</div><div class="dp-chips">${btn(`data-dv="unban" data-k="${esc(b.key)}"`, 'Lever la sanction', 'green')}</div></div>`).join('') || '<div class="rg-note">Aucune sanction active.</div>'; };
  R.audit = () => { const n = need('admin'); if (n) return n; const d = D.data.dv_audit; if (!d) return '<div class="rg-note">Chargement…</div>';
    return `<div class="dp-log tall">${d.list.map((e) => `<div><i>${new Date(e.at).toLocaleString('fr-FR')}</i> <b>${esc(e.by)}</b> (${esc(e.role)}) — ${esc(e.action)}${e.target ? ' → ' + esc(e.target) : ''}${e.detail ? ' · ' + esc(e.detail) : ''}</div>`).join('') || 'Journal vide.'}</div>`; };
  // laboratoire de test
  const L = D.lab = { mode: 'bounty', map: '', per: 3, mates: 0, testPlayers: 0, botLevel: 5, skill: 0.5, passiveBots: false, useMap: false, useChars: false };
  R.lab = () => { const n = need('dev'); if (n) return n;
    const md = G.MODES[L.mode] || G.MODES.bounty, inLab = G.App.state === 'match' && G.App.M && G.App.M.lab, ls = D.data.dv_labstate;
    const custom = (() => { try { return JSON.parse(localStorage.getItem('br_dev_maps2') || '{}'); } catch (e) { return {}; } })(), mk = L.map || md.maps[0];
    return `<div class="dv-note">Parties de test séparées des parties publiques : aucun trophée, triches de test autorisées, joueurs de test clairement identifiés.</div>
      <div class="dv-h">Mode et carte</div><div class="dp-chips">${G.MODE_ORDER.filter((k) => k !== 'showdown').map((k) => `<button class="btn small ${L.mode === k ? 'green' : ''}" data-dv="lmode" data-v="${k}">${esc(G.MODES[k].short || MODE(k))}</button>`).join('')}</div>
      <div class="dp-chips">${md.maps.map((k) => `<button class="btn small ${mk === k ? 'blue' : ''}" data-dv="lmap" data-v="${k}">${esc(G.MAPS[k].name)}${custom[k] ? ' ✎' : ''}</button>`).join('')}</div>
      <div class="dv-h">Équipes et bots</div>
      ${md.per === 3 ? `<div class="rg-row"><span>Joueurs par équipe <b class="dp-v">${L.per}</b></span><input type="range" data-lab="per" min="1" max="3" step="1" value="${L.per}"></div>` : ''}
      <div class="rg-row"><span>Joueurs de test dans le groupe <b class="dp-v">${L.testPlayers}</b></span><input type="range" data-lab="testPlayers" min="0" max="5" step="1" value="${L.testPlayers}"></div>
      <div class="rg-row"><span>Dont alliés <b class="dp-v">${L.mates}</b></span><input type="range" data-lab="mates" min="0" max="2" step="1" value="${L.mates}"></div>
      <div class="rg-row"><span>Niveau des bots <b class="dp-v">${L.botLevel}</b></span><input type="range" data-lab="botLevel" min="1" max="11" step="1" value="${L.botLevel}"></div>
      <div class="rg-row"><span>Habileté de l'IA <b class="dp-v">${L.skill}</b></span><input type="range" data-lab="skill" min="0.05" max="1" step="0.05" value="${L.skill}"></div>
      <div class="rg-row"><span>Bots passifs (ne tirent pas)</span><span class="rg-tg ${L.passiveBots ? 'on' : ''}" data-dv="ltog" data-k="passiveBots"><i></i></span></div>
      <div class="rg-row"><span>Utiliser ma carte modifiée (éditeur)${custom[mk] ? '' : ' — aucune pour cette carte'}</span><span class="rg-tg ${L.useMap && custom[mk] ? 'on' : ''}" data-dv="ltog" data-k="useMap"><i></i></span></div>
      <div class="rg-row"><span>Appliquer l'éditeur de personnages</span><span class="rg-tg ${L.useChars ? 'on' : ''}" data-dv="ltog" data-k="useChars"><i></i></span></div>
      <div class="dp-chips">${btn('data-dv="lstart"', '▶ Lancer la partie de test (en ligne)', 'green')}</div>
      <div class="dv-h">Partie de test en cours ${inLab ? '' : '— lancez-en une pour modifier ses réglages'}</div>
      <div class="dp-chips">${[['lset" data-a="healAll', '❤ Soigner tout le monde'], ['lset" data-a="killBots', '✖ Éliminer les bots'], ['lset" data-a="reset', '↺ Réinitialiser'], ['lset" data-a="end', '■ Terminer']].map(([a, l]) => `<button class="btn small" data-dv="${a}" ${inLab ? '' : 'disabled'}>${l}</button>`).join('')}</div>
      <div class="rg-row"><span>Vitesse de la partie <b class="dp-v">${ls ? ls.cfg.ts : 1}</b></span><input type="range" data-labset="ts" min="0.25" max="3" step="0.25" value="${ls ? ls.cfg.ts : 1}" ${inLab ? '' : 'disabled'}></div>
      <div class="dp-chips">${btn('data-dv="sim" data-a="disconnect"', '🔌 Tester une déconnexion / reconnexion')}${btn('data-dv="sim" data-a="afk"', '⏸ Tester l\'inactivité (AFK)')}${btn('data-dv="sim" data-a="join"', '+ Joueur de test')}</div>`; };
  // triches de test en ligne (appliquées par le serveur)
  const CK = [['god', 'Invincible'], ['ammo', 'Munitions infinies'], ['sup', 'Super toujours prête'], ['ohk', 'Un coup = élimination'], ['aim', 'Aimbot (visée automatique)'], ['dodge', 'Esquive automatique'], ['auto', 'Tir automatique'], ['gad', 'Gadgets infinis']];
  R.cheats = () => { const n = need('dev'); if (n) return n; const cfg = G.Dev.cfg, sv = D.data.dv_cheats;
    return `<div class="dv-warn">🔒 Appliquées par le serveur uniquement dans le <b>labo</b> et vos <b>parties privées</b>. Bloquées côté serveur dans les parties <b>publiques</b> et <b>classées</b> (équité).</div>
      ${CK.map(([k, l]) => `<div class="rg-row"><span>${l}</span><span class="rg-tg ${cfg[k] ? 'on' : ''}" data-dv="ctog" data-k="${k}"><i></i></span></div>`).join('')}
      <div class="rg-row"><span>Dégâts × <b class="dp-v">${cfg.dmg}</b></span><input type="range" data-r="dmg" min="0.25" max="10" step="0.25" value="${cfg.dmg}"></div>
      <div class="rg-row"><span>Vitesse × <b class="dp-v">${cfg.speed}</b></span><input type="range" data-r="speed" min="0.5" max="3" step="0.1" value="${cfg.speed}"></div>
      <div class="dp-chips">${btn('data-dv="capply"', '⤴ Envoyer au serveur', 'green')}</div>
      <div class="dv-note">${sv ? 'Serveur : ' + Object.keys(sv.cheats).filter((k) => sv.cheats[k] === true).join(', ') + ' · dégâts ×' + sv.cheats.dmg + ' · vitesse ×' + sv.cheats.speed : 'Pas encore envoyé au serveur.'} Hors ligne (contre les bots), ces réglages s'appliquent aussi directement.</div>`; };
  R.selftest = () => { const n = need('dev'); if (n) return n; const d = D.data.dv_selftest;
    return `<div class="dp-chips">${btn('data-dv="selftest"', '▶ Lancer les tests serveur (tous les modes)', 'green')}</div>${d ? `<div class="dv-note">${new Date(d.at).toLocaleString('fr-FR')} — ${d.res.filter((r) => r.ok).length}/${d.res.length} réussis en ${d.ms} ms</div><div class="dp-log">${d.res.map((r) => `<div class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✔' : '✘'} ${esc(r.name)} : ${esc(r.d)} (${r.ms} ms)</div>`).join('')}</div>` : ''}`; };
  D.render = (k) => (R[k] ? R[k]() : '');

  /* ---------- confirmation (dans le menu) ---------- */
  function confirmBox(title, html, okLabel, onOk) {
    const host = document.querySelector('.rg') || document.body, o = document.createElement('div'); o.className = 'dv-confirm';
    o.innerHTML = `<div class="dv-cb"><h3>${esc(title)}</h3>${html}<div class="dp-chips"><button class="btn small" data-c="no">Annuler</button><button class="btn small red" data-c="ok">${esc(okLabel)}</button></div><div class="dv-note">Action vérifiée par le serveur et enregistrée dans le journal.</div></div>`;
    host.appendChild(o); o.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; e.stopPropagation(); if (b.dataset.c === 'ok') onOk(o); o.remove(); });
  }
  const val = (o, id) => ((o.querySelector('#' + id) || {}).value || '').trim();

  /* ---------- actions ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-dv]'); if (!t || !t.closest('.rg')) return;
    e.stopPropagation(); const d = t.dataset, a = d.dv; G.Audio && G.Audio.sfx('ui');
    if (a === 'search') { D.view.q = val(document, 'dvQ'); Net.send({ t: 'dv_players', q: D.view.q, status: D.view.st || '' }); return; }
    if (a === 'st') { D.view.st = d.v; Net.send({ t: 'dv_players', q: D.view.q || '', status: d.v }); D.refresh(); return; }
    if (a === 'prof' || a === 'prof2') { D.view.pid = d.pid; if (a === 'prof2' && G.DevPro) { G.DevPro.ui.detail = 'players'; } Net.send({ t: 'dv_player', pid: d.pid }); D.refresh(); return; }
    if (a === 'list') { D.view.pid = null; Net.send({ t: 'dv_players', q: D.view.q || '' }); D.refresh(); return; }
    if (a === 'watch') { G.Spectate.watch({ pid: d.pid }); return; }
    if (a === 'watchm') { G.Spectate.watch({ id: d.id }); return; }
    if (a === 'endm') { confirmBox('Arrêter la partie ?', '<p>Tous les joueurs seront prévenus. Aucun trophée n\'est en jeu.</p><input class="txt" id="cbR" placeholder="Motif (obligatoire)">', 'Arrêter', (o) => { const r = val(o, 'cbR') || 'problème technique'; Net.send({ t: 'dv_endmatch', id: d.id, reason: r }); setTimeout(() => Net.send({ t: 'dv_matches' }), 500); }); return; }
    if (a === 'warn') { confirmBox('Avertir le joueur', '<input class="txt" id="cbR" placeholder="Message de l\'avertissement">', 'Envoyer', (o) => { const r = val(o, 'cbR'); if (r) Net.send({ t: 'dv_warn', pid: d.pid, text: r }); }); return; }
    if (a === 'kick') { confirmBox('Déconnecter la session ?', '<p>Le joueur est déconnecté immédiatement (il peut se reconnecter).</p><input class="txt" id="cbR" placeholder="Motif">', 'Déconnecter', (o) => { Net.send({ t: 'dv_kick', pid: d.pid, reason: val(o, 'cbR') }); setTimeout(() => Net.send({ t: 'dv_player', pid: d.pid }), 600); }); return; }
    if (a === 'ban') { confirmBox('Sanctionner le compte ?', '<p>Le joueur ne pourra plus se connecter pendant la durée choisie.</p><select class="txt" id="cbH"><option value="1">1 heure</option><option value="24" selected>24 heures</option><option value="168">7 jours</option><option value="720">30 jours</option></select><input class="txt" id="cbR" placeholder="Motif (obligatoire)">', 'Sanctionner', (o) => { const r = val(o, 'cbR'); if (!r) { UI.toast('Indiquez un motif.'); return; } Net.send({ t: 'dv_ban', pid: d.pid, hours: +val(o, 'cbH'), reason: r }); setTimeout(() => Net.send({ t: 'dv_player', pid: d.pid }), 600); }); return; }
    if (a === 'unban') { confirmBox('Lever la sanction ?', '', 'Lever', () => Net.send({ t: 'dv_unban', key: d.k })); return; }
    if (a === 'rclose') { confirmBox('Signalement traité', '<input class="txt" id="cbR" placeholder="Note (facultative)">', 'Valider', (o) => Net.send({ t: 'dv_report_close', id: d.id, note: val(o, 'cbR') })); return; }
    if (a === 'rsearch') { D.view.rq = val(document, 'dvRq'); D.view.rm = val(document, 'dvRm'); D.view.rd = val(document, 'dvRd'); Net.send({ t: 'dv_replays', q: D.view.rq, mode: D.view.rm, day: D.view.rd }); return; }
    if (a === 'play') { if (G.DevPro) G.DevPro.close(); Net.send({ t: 'dv_replay', id: d.id }); return; }
    if (a === 'lmode') { L.mode = d.v; L.map = ''; D.refresh(); return; }
    if (a === 'lmap') { L.map = d.v; D.refresh(); return; }
    if (a === 'ltog') { L[d.k] = !L[d.k]; D.refresh(); return; }
    if (a === 'lstart') {
      const md = G.MODES[L.mode], mk = L.map || md.maps[0], o = { t: 'dv_lab', mode: L.mode, map: mk, per: L.per, mates: L.mates, testPlayers: L.testPlayers, botLevel: L.botLevel, skill: L.skill, passiveBots: L.passiveBots };
      if (L.useMap) { try { const cm = JSON.parse(localStorage.getItem('br_dev_maps2') || '{}')[mk]; if (cm) o.tiles = btoa(String.fromCharCode.apply(null, cm)); } catch (er) { /* ignore */ } }
      if (L.useChars && G.Dev.cfg.charEdit) o.charEdit = G.Dev.cfg.charEdit;
      Net.send({ t: 'dv_cheats', cheats: G.Dev.cfg }); Net.send(o); if (G.DevPro) G.DevPro.close(); UI.toast('🧪 Partie de test en préparation…', 2200); return;
    }
    if (a === 'lset') { Net.send({ t: 'dv_labset', act: d.a }); return; }
    if (a === 'sim') { Net.send({ t: 'dv_sim', act: d.a }); return; }
    if (a === 'ctog') { G.Dev.cfg[d.k] = !G.Dev.cfg[d.k]; G.Dev.persist && G.Dev.persist(); Net.send({ t: 'dv_cheats', cheats: G.Dev.cfg }); D.refresh(); return; }
    if (a === 'capply') { Net.send({ t: 'dv_cheats', cheats: G.Dev.cfg }); return; }
    if (a === 'selftest') { UI.toast('Tests serveur en cours…', 1500); Net.send({ t: 'dv_selftest' }); return; }
  }, true);
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.closest || !t.closest('.rg')) return;
    if (t.dataset.lab) { L[t.dataset.lab] = +t.value; const b = t.parentNode.querySelector('.dp-v'); if (b) b.textContent = t.value; }
    if (t.dataset.labset) { const b = t.parentNode.querySelector('.dp-v'); if (b) b.textContent = t.value; clearTimeout(D._ls); D._ls = setTimeout(() => Net.send({ t: 'dv_labset', ts: +t.value }), 250); }
  }, true);
  // les triches de test partent au serveur à la connexion du compte développeur (appliquées seulement en labo / privé)
  Net.on('me', (m) => { if (m.roles && m.roles.includes('dev') && G.Dev && G.Dev.cfg) setTimeout(() => Net.send({ t: 'dv_cheats', cheats: G.Dev.cfg }), 300); });

  /* ---------- côté joueur : signalement, messages de l'administration ---------- */
  Net.on('admin_warn', (m) => { const o = UI.modal(`<h2>⚠ Avertissement</h2><div class="accinfo">${esc(m.text)}</div><div class="row" style="margin-top:2rem"><button class="btn green" data-act="close">J'ai compris</button></div>`); o.dataset.adm = '1'; });
  Net.on('admin_kick', (m) => { UI.toast('Vous avez été déconnecté par un administrateur : ' + (m.reason || ''), 4000); });
  Net.on('banned', (m) => { Net.wanted = false; UI.modal(`<h2>⛔ Accès suspendu</h2><div class="accinfo">Votre compte est suspendu jusqu'au ${esc(new Date(m.until).toLocaleString('fr-FR'))}.<br>Motif : ${esc(m.reason || 'non précisé')}</div>`); });
  const basePC = UI.playerCard;
  if (basePC) UI.playerCard = function (pl) {
    basePC.apply(this, arguments);
    const o = UI.modals[UI.modals.length - 1], acts = o && o.querySelector('#pcActs');
    if (!acts || pl.bot || pl.me || !(pl.pid || pl.c)) return;
    acts.insertAdjacentHTML('afterend', `<div class="pc-acts"><button class="btn small gray" data-act="reportPl" data-pid="${esc(pl.pid || '')}" data-n="${esc(pl.n || '')}">🚩 Signaler</button></div>`);
  };
  UI.ACT.reportPl = (a) => {
    UI.closeModal();
    const o = UI.modal(`<h2>Signaler ${esc(a.dataset.n)}</h2><div class="row" style="gap:1rem;flex-wrap:wrap">${['triche', 'insultes', 'anti-jeu', 'pseudo inapproprié', 'autre'].map((w) => `<button class="btn small" data-act="reportSend" data-pid="${esc(a.dataset.pid)}" data-n="${esc(a.dataset.n)}" data-w="${w}">${w}</button>`).join('')}</div>`);
    o.dataset.rep = '1';
  };
  UI.ACT.reportSend = (a) => { Net.send({ t: 'report', pid: a.dataset.pid, name: a.dataset.n, why: a.dataset.w }); UI.closeModal(); };
})();
