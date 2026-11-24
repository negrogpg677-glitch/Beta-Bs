/* Brawl Rush - utilitaires, sauvegarde, audio */
(function () {
  const G = (window.G = window.G || {});
  G.T = 60; // taille d'une tuile en unités monde

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  G.angDiff = (a, b) => {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  G.rr = (a, b) => a + Math.random() * (b - a);
  G.ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  G.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  G.easeOutBack = (t) => { const c = 1.70158; t -= 1; return t * t * ((c + 1) * t + c) + 1; };
  G.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------- couleurs ---------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    const c = (v) => ('0' + Math.round(G.clamp(v, 0, 255)).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  }
  G.shade = (hex, amt) => { // amt -1..1
    const [r, g, b] = hex2rgb(hex);
    if (amt >= 0) return rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return rgb2hex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  };
  G.mix = (a, b, t) => {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  };
  G.hueShift = (hex, deg) => {
    let [r, g, b] = hex2rgb(hex).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    h = (h + deg + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let rr = 0, gg = 0, bb = 0;
    if (h < 60) { rr = c; gg = x; } else if (h < 120) { rr = x; gg = c; } else if (h < 180) { gg = c; bb = x; }
    else if (h < 240) { gg = x; bb = c; } else if (h < 300) { rr = x; bb = c; } else { rr = c; bb = x; }
    return rgb2hex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
  };

  /* ---------- sauvegarde ---------- */
  const KEY = 'brawlrush_save_v1';
  G.Save = {
    data: null,
    defaults() {
      return {
        v: 1, name: 'Joueur' + G.ri(100, 999), coins: 150, gems: 20,
        trophies: { sherry: 0, rex: 0 }, unlocked: ['sherry', 'rex'], levels: { sherry: 1, rex: 1 },
        skins: {}, ownedSkins: {}, selected: 'sherry', mode: 'gemgrab',
        roadClaimed: [], boxes: 1, lastDaily: 0, dailyStreak: 0,
        stats: { wins: 0, losses: 0, kills: 0, matches: 0, damage: 0, gemsGrabbed: 0, goals: 0, showdownWins: 0 },
        quests: null, questDay: '', shopDay: '', shopBought: {},
        settings: { sound: true, music: true, vibrate: true, aimAssist: true, quality: 'high', lefty: false },
        tutorialDone: false,
      };
    },
    load() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
      const def = this.defaults();
      if (!d || typeof d !== 'object') d = def;
      // fusion douce avec les valeurs par défaut
      for (const k in def) if (d[k] === undefined) d[k] = def[k];
      for (const k in def.settings) if (d.settings[k] === undefined) d.settings[k] = def.settings[k];
      for (const k in def.stats) if (d.stats[k] === undefined) d.stats[k] = def.stats[k];
      this.data = d;
      return d;
    },
    commit() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } this.load(); },
    totalTrophies() { let t = 0; for (const k in this.data.trophies) t += this.data.trophies[k] || 0; return t; },
  };

  /* ---------- audio synthétisé (aucun fichier externe) ---------- */
  const A = (G.Audio = {
    ctx: null, master: null, sfxGain: null, musGain: null, noiseBuf: null,
    musicOn: false, musicMode: 'menu', step: 0, nextT: 0, timer: null, ready: false,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        this.ctx = new C();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
        this.musGain = this.ctx.createGain(); this.musGain.connect(this.master);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.ready = true;
        this.applySettings();
        if (this.musicOn) this.startMusic(this.musicMode);
      } catch (e) { /* audio indisponible */ }
    },
    applySettings() {
      if (!this.ready) return;
      const s = G.Save.data.settings;
      this.sfxGain.gain.value = s.sound ? 0.8 : 0;
      this.musGain.gain.value = s.music ? 0.32 : 0;
    },
    tone(freq, dur, type, vol, slide, delay) {
      if (!this.ready || !G.Save.data.settings.sound) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol, freq, delay, type) {
      if (!this.ready || !G.Save.data.settings.sound) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1200;
      const g = c.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.sfxGain);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },
    sfx(name) {
      if (!this.ready) return;
      switch (name) {
        case 'shoot': this.tone(520, 0.1, 'square', 0.12, 180); this.noise(0.06, 0.12, 2500); break;
        case 'shotgun': this.noise(0.16, 0.3, 1800); this.tone(150, 0.14, 'sawtooth', 0.14, 60); break;
        case 'rocket': this.tone(200, 0.25, 'sawtooth', 0.12, 90); this.noise(0.2, 0.15, 900); break;
        case 'magic': this.tone(700, 0.18, 'sine', 0.15, 1100); this.tone(1050, 0.18, 'triangle', 0.08, 1500, 0.04); break;
        case 'zap': this.tone(900, 0.12, 'sawtooth', 0.12, 200); this.noise(0.1, 0.12, 5000, 0, 'highpass'); break;
        case 'hit': this.tone(260, 0.09, 'square', 0.12, 90); break;
        case 'explode': this.noise(0.4, 0.4, 700); this.tone(110, 0.3, 'sawtooth', 0.18, 40); break;
        case 'super': this.tone(300, 0.35, 'sawtooth', 0.18, 900); this.tone(600, 0.35, 'square', 0.1, 1500, 0.05); this.noise(0.25, 0.15, 3000); break;
        case 'superReady': this.tone(660, 0.1, 'triangle', 0.16); this.tone(990, 0.16, 'triangle', 0.16, null, 0.09); break;
        case 'heal': this.tone(520, 0.12, 'sine', 0.14); this.tone(780, 0.2, 'sine', 0.14, null, 0.1); break;
        case 'pickup': this.tone(880, 0.08, 'triangle', 0.14); this.tone(1320, 0.12, 'triangle', 0.14, null, 0.07); break;
        case 'ui': this.tone(500, 0.06, 'triangle', 0.14, 700); break;
        case 'back': this.tone(500, 0.07, 'triangle', 0.12, 300); break;
        case 'coin': this.tone(1200, 0.07, 'square', 0.09); this.tone(1700, 0.14, 'square', 0.09, null, 0.06); break;
        case 'buy': this.tone(700, 0.08, 'square', 0.12); this.tone(1000, 0.08, 'square', 0.12, null, 0.08); this.tone(1400, 0.16, 'square', 0.12, null, 0.16); break;
        case 'error': this.tone(180, 0.2, 'sawtooth', 0.14, 120); break;
        case 'count': this.tone(600, 0.14, 'triangle', 0.2); break;
        case 'go': this.tone(900, 0.4, 'triangle', 0.22, 1300); break;
        case 'goal': this.tone(500, 0.12, 'square', 0.15); this.tone(700, 0.12, 'square', 0.15, null, 0.12); this.tone(1000, 0.4, 'square', 0.15, null, 0.24); break;
        case 'die': this.tone(400, 0.4, 'sawtooth', 0.15, 60); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'square', 0.14, null, i * 0.13)); break;
        case 'lose': [440, 392, 349, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.18, null, i * 0.2)); break;
        case 'box': this.tone(200, 0.3, 'sawtooth', 0.1, 600); this.noise(0.3, 0.15, 2000); break;
        case 'open': [660, 880, 1100, 1320, 1760].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.15, null, i * 0.07)); break;
        case 'dash': this.noise(0.3, 0.25, 1500); this.tone(200, 0.3, 'sawtooth', 0.1, 500); break;
        case 'poison': this.tone(100, 0.15, 'sawtooth', 0.05, 80); break;
        case 'kick': this.tone(160, 0.12, 'sine', 0.3, 60); this.noise(0.08, 0.15, 800); break;
      }
    },
    // musique procédurale simple : basse + arpège + percussions
    startMusic(mode) {
      this.musicMode = mode; this.musicOn = true;
      if (!this.ready) return;
      if (this.timer) clearInterval(this.timer);
      this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 100);
    },
    stopMusic() { this.musicOn = false; if (this.timer) clearInterval(this.timer); this.timer = null; },
    schedule() {
      if (!this.ready || !G.Save.data.settings.music) { if (this.ready) this.nextT = this.ctx.currentTime + 0.1; return; }
      const c = this.ctx, battle = this.musicMode === 'battle';
      const bpm = battle ? 138 : 104, sp = 60 / bpm / 2;
      const chords = battle ? [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] : [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
      while (this.nextT < c.currentTime + 0.35) {
        const s = this.step, ch = chords[Math.floor(s / 16) % 4], t = this.nextT;
        const note = (m, d, ty, v) => {
          const o = c.createOscillator(), g = c.createGain();
          o.type = ty; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(g); g.connect(this.musGain); o.start(t); o.stop(t + d + 0.02);
        };
        if (s % 4 === 0) note(ch[0] - 24, sp * 3.4, 'triangle', 0.5);
        const arp = [0, 1, 2, 1, 2, 1, 0, 2][s % 8];
        note(ch[arp] + (battle ? 12 : 0), sp * 1.6, battle ? 'square' : 'triangle', battle ? 0.12 : 0.2);
        if (battle || s % 8 === 0) {
          if (s % 4 === 0 || (battle && s % 4 === 2)) { // grosse caisse / caisse claire
            const so = c.createBufferSource(); so.buffer = this.noiseBuf;
            const f = c.createBiquadFilter(); f.type = s % 8 === 4 ? 'highpass' : 'lowpass'; f.frequency.value = s % 8 === 4 ? 3000 : 220;
            const g = c.createGain(); g.gain.setValueAtTime(battle ? 0.4 : 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
            so.connect(f); f.connect(g); g.connect(this.musGain); so.start(t, Math.random() * 0.4); so.stop(t + 0.15);
          }
        }
        this.step++; this.nextT += sp;
      }
    },
  });

  G.vibrate = (ms) => {
    if (!G.Save.data || !G.Save.data.settings.vibrate) return;
    try {
      if (window.AndroidBridge && AndroidBridge.vibrate) AndroidBridge.vibrate(ms);
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  };
})();
