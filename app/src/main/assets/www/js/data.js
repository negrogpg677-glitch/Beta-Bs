/* Brawl Rush - données : brawlers, modes, arènes, boutique, route des trophées */
(function () {
  const G = window.G;

  G.RARITY = {
    depart: { name: 'Départ', color: '#9aa7b8' },
    rare: { name: 'Rare', color: '#4cd964' },
    superrare: { name: 'Super rare', color: '#3aa0ff' },
    epic: { name: 'Épique', color: '#b455ff' },
    mythic: { name: 'Mythique', color: '#ff4a55' },
    legend: { name: 'Légendaire', color: '#ffd21f' },
  };

  /* Distances en tuiles, vitesses en tuiles/s, dégâts de base niveau 1.
     atk.shape : pellet bigpellet bullet rocket note spike dagger ice bomb bolt */
  G.BRAWLERS = [
    {
      id: 'sherry', name: 'Sherry', role: 'Combattante', rarity: 'depart', price: 0, hp: 5000, speed: 4.1, superCost: 3600,
      desc: 'Une tireuse redoutable de près. Son fusil à pompe arrose large !', aiRange: 3.6,
      look: { skin: '#f5c9a4', body: '#8e44c9', body2: '#5a2a8a', hair: '#2a1b3d', accent: '#ffd54a', hat: 'ponytail', weapon: 'shotgun' },
      atk: { name: 'Fusil à pompe', n: 5, spread: 30, range: 6.2, speed: 17, dmg: 390, r: 7, reload: 1.35, shape: 'pellet', color: '#ffe066', sfx: 'shotgun' },
      sup: { name: 'Souffle puissant', type: 'proj', n: 9, spread: 56, range: 7.4, speed: 19, dmg: 520, r: 11, knock: 140, shape: 'bigpellet', color: '#ff9f43', breakCrates: true, pierce: true, sfx: 'shotgun' },
    },
    {
      id: 'rex', name: 'Rex', role: 'Tireur', rarity: 'depart', price: 0, hp: 3900, speed: 4.0, superCost: 3400,
      desc: 'Un pistolero rapide. Ses balles filent droit et font mal à distance.', aiRange: 6.2,
      look: { skin: '#e8b48a', body: '#2f6fd6', body2: '#1d4596', hair: '#5a3a1e', accent: '#e84855', hat: 'cowboy', weapon: 'revolver' },
      atk: { name: 'Rafale de revolver', n: 1, burst: 3, burstDelay: 0.09, spread: 0, range: 8.6, speed: 25, dmg: 540, r: 6, reload: 1.45, shape: 'bullet', color: '#ffd166', sfx: 'shoot' },
      sup: { name: 'Pluie de plomb', type: 'proj', n: 1, burst: 14, burstDelay: 0.05, spread: 0, range: 10.5, speed: 30, dmg: 620, r: 8, shape: 'bullet', color: '#ff5d5d', pierce: true, sfx: 'shoot' },
    },
    {
      id: 'taurus', name: 'Taurus', role: 'Tank', rarity: 'rare', price: 40, hp: 9000, speed: 3.85, superCost: 3800,
      desc: 'Un colosse à cornes. Fonce sur les ennemis pour les assommer !', aiRange: 3.0,
      look: { skin: '#d9a273', body: '#c9372c', body2: '#8c1f18', hair: '#3b2412', accent: '#f1e3c4', hat: 'horns', weapon: 'bigshotgun' },
      atk: { name: 'Canon à main', n: 5, spread: 38, range: 4.3, speed: 15, dmg: 440, r: 8, reload: 1.1, shape: 'pellet', color: '#ff8a5c', sfx: 'shotgun' },
      sup: { name: 'Charge du taureau', type: 'dash', dist: 7.2, speed: 17, dmg: 900, stun: 0.9, r: 1.0 },
    },
    {
      id: 'boomer', name: 'Boomer', role: 'Artilleur', rarity: 'rare', price: 40, hp: 3700, speed: 3.7, superCost: 3600,
      desc: 'Lance-roquettes longue portée. Explosions dévastatrices en zone.', aiRange: 7.8,
      look: { skin: '#f2c19a', body: '#3d9970', body2: '#256b4a', hair: '#7a4b1d', accent: '#ffb300', hat: 'aviator', weapon: 'rocketlauncher' },
      atk: { name: 'Roquette', n: 1, range: 9.6, speed: 15, dmg: 1300, r: 10, splash: 1.25, reload: 2.1, shape: 'rocket', color: '#ff7a3d', sfx: 'rocket' },
      sup: { name: 'Pilonnage', type: 'barrage', range: 9.5, count: 7, area: 2.3, dmg: 1050, splash: 1.3, duration: 1.4, shape: 'rocket', color: '#ff4a2b' },
    },
    {
      id: 'luna', name: 'Luna', role: 'Soutien', rarity: 'superrare', price: 80, hp: 5600, speed: 4.0, superCost: 3500,
      desc: 'Ses ondes sonores blessent les ennemis et soignent les alliés.', aiRange: 5.5,
      look: { skin: '#f7d3b5', body: '#ff6fb0', body2: '#c43d80', hair: '#ffffff', accent: '#46e0ff', hat: 'headphones', weapon: 'mic' },
      atk: { name: 'Onde sonore', n: 1, range: 7.4, speed: 14, dmg: 520, r: 15, reload: 1.25, shape: 'note', color: '#ff9ce0', pierce: true, heal: 420, sfx: 'magic' },
      sup: { name: 'Concert enchanté', type: 'aura', radius: 4.2, heal: 2600, boost: 1.35, boostT: 3.2, color: '#ff9ce0', sfx: 'heal' },
    },
    {
      id: 'spiky', name: 'Spiky', role: 'Contrôleur', rarity: 'superrare', price: 80, hp: 4100, speed: 4.0, superCost: 3500,
      desc: 'Un cactus bavard. Ses épines transpercent, sa balle ralentit tout.', aiRange: 6.0,
      look: { skin: '#6fd16a', body: '#2f9e44', body2: '#1b6e2c', hair: '#ff5a8a', accent: '#ff5a8a', hat: 'cactus', weapon: 'cactusgun' },
      atk: { name: 'Pluie d\'épines', n: 7, spread: 38, range: 7.6, speed: 19, dmg: 310, r: 6, reload: 1.4, shape: 'spike', color: '#d9ff7a', sfx: 'shoot' },
      sup: { name: 'Cactus géant', type: 'lobArea', range: 8.4, speed: 12, dmg: 1300, splash: 2.0, zone: { t: 3.8, slow: 0.5, dps: 260, color: '#6fd16a' }, shape: 'bomb', color: '#4cc364', breakCrates: true },
    },
    {
      id: 'corbeau', name: 'Corbeau', role: 'Assassin', rarity: 'epic', price: 170, hp: 3400, speed: 4.75, superCost: 3000,
      desc: 'Rapide et mortel. Ses dagues empoisonnent et il bondit sur sa proie.', aiRange: 5.2,
      look: { skin: '#e3c3a6', body: '#2a2a3d', body2: '#14141f', hair: '#14141f', accent: '#a64dff', hat: 'hood', weapon: 'daggers' },
      atk: { name: 'Dagues empoisonnées', n: 3, spread: 14, range: 7.0, speed: 23, dmg: 390, r: 5, reload: 1.15, shape: 'dagger', color: '#c58bff', poison: { dps: 260, t: 3 }, sfx: 'shoot' },
      sup: { name: 'Bond fatal', type: 'jump', dist: 6.6, dmg: 950, splash: 1.7, poison: { dps: 300, t: 3.5 }, color: '#a64dff' },
    },
    {
      id: 'frost', name: 'Frost', role: 'Mage', rarity: 'epic', price: 170, hp: 4300, speed: 3.9, superCost: 3600,
      desc: 'Le sorcier du givre. Ralentit ses cibles, puis les gèle sur place.', aiRange: 6.6,
      look: { skin: '#cfe9f7', body: '#3b82c4', body2: '#245a91', hair: '#f4f9ff', accent: '#aef0ff', hat: 'wizard', weapon: 'staff' },
      atk: { name: 'Orbe de glace', n: 1, range: 8.2, speed: 16, dmg: 720, r: 11, reload: 1.5, shape: 'ice', color: '#a8e8ff', slow: { f: 0.5, t: 1.6 }, sfx: 'magic' },
      sup: { name: 'Zéro absolu', type: 'lobArea', range: 7.6, speed: 13, dmg: 800, splash: 2.4, freeze: 2.0, shape: 'ice', color: '#d8f6ff' },
    },
    {
      id: 'pyro', name: 'Pyro', role: 'Lanceur', rarity: 'mythic', price: 350, hp: 3900, speed: 4.0, superCost: 3500,
      desc: 'Passionné d\'explosifs. Ses bombes passent par-dessus les murs !', aiRange: 6.0,
      look: { skin: '#f0b98e', body: '#ff7b1c', body2: '#c24a00', hair: '#ff3b1f', accent: '#ffd21f', hat: 'mohawk', weapon: 'bomb' },
      atk: { name: 'Dynamite', n: 1, lob: true, range: 7.4, speed: 12, dmg: 900, splash: 1.4, reload: 1.8, shape: 'bomb', color: '#ff6b2b', sfx: 'rocket' },
      sup: { name: 'Méga bombe', type: 'lobArea', range: 9.2, speed: 11, dmg: 2200, splash: 2.6, shape: 'bomb', color: '#ff2b2b', breakCrates: true, big: true },
    },
    {
      id: 'volt', name: 'Volt', role: 'Électro', rarity: 'legend', price: 700, hp: 4500, speed: 4.2, superCost: 3300,
      desc: 'Un éclair vivant. Ses décharges traversent tout, sa tempête paralyse.', aiRange: 5.8,
      look: { skin: '#f1cfb0', body: '#ffd21f', body2: '#d49a00', hair: '#fff48a', accent: '#42f5ff', hat: 'spiky', weapon: 'tesla' },
      atk: { name: 'Éclair', n: 1, range: 7.4, speed: 42, dmg: 1150, r: 11, reload: 1.25, shape: 'bolt', color: '#7df9ff', pierce: true, sfx: 'zap' },
      sup: { name: 'Tempête électrique', type: 'aura', radius: 3.4, dmg: 1250, stun: 1.3, color: '#7df9ff', sfx: 'zap' },
    },

    {
      id: 'maree', name: 'Marée', role: 'Contrôleuse', rarity: 'superrare', price: 80, hp: 4200, speed: 4.0, superCost: 3500, voice: 1.15,
      desc: 'Elle domine les flots : ses vagues repoussent les ennemis, son tsunami les balaie.', aiRange: 5.5,
      look: { skin: '#e8c9a8', body: '#1f9ad6', body2: '#0d5f94', hair: '#37e0d0', accent: '#b8f4ff', hat: 'tide', weapon: 'staff', win: 'dance' },
      atk: { name: 'Vague', n: 1, range: 6.5, speed: 13, dmg: 600, r: 20, reload: 1.5, shape: 'wave', color: '#5fe0ff', pierce: true, knock: 90, sfx: 'magic' },
      sup: { name: 'Tsunami', type: 'lobArea', range: 8.4, speed: 12, dmg: 1500, splash: 3.2, knock: 220, shape: 'wave', color: '#2aa8ff' },
    },
    {
      id: 'nimbus', name: 'Nimbus', role: 'Artilleur', rarity: 'epic', price: 170, hp: 3800, speed: 3.9, superCost: 3600, voice: 0.9,
      desc: 'Un petit nuage grognon qui bombarde le terrain de pluie explosive.', aiRange: 6.2,
      look: { skin: '#f2f4ff', body: '#8a96c8', body2: '#4f5a8c', hair: '#d8e0ff', accent: '#ffe14a', hat: 'cloud', weapon: 'bomb', win: 'spin' },
      atk: { name: 'Gouttes explosives', n: 3, lob: true, spread: 44, range: 6.8, speed: 12, dmg: 520, splash: 0.95, reload: 1.9, shape: 'bomb', color: '#8ab8ff', sfx: 'rocket' },
      sup: { name: 'Orage', type: 'lobArea', range: 8.6, speed: 12, dmg: 700, splash: 2.7, zone: { t: 5, slow: 0.6, dps: 430, color: '#8aa6ff' }, shape: 'ice', color: '#9fb8ff' },
    },
    {
      id: 'grimm', name: 'Grimm', role: 'Faucheur', rarity: 'epic', price: 170, hp: 4600, speed: 4.3, superCost: 3200, voice: 0.7,
      desc: 'Son coup de faux fauche tout ce qui s\'approche, et il se soigne en frappant.', aiRange: 3.0,
      look: { skin: '#dcd6e8', body: '#3b2e5a', body2: '#1d1530', hair: '#7a5cff', accent: '#9dffb4', hat: 'reaper', weapon: 'scythe', win: 'bow' },
      atk: { name: 'Coup de faux', n: 9, spread: 100, range: 3.5, speed: 16, dmg: 330, r: 8, reload: 1.15, shape: 'scythe', color: '#b8a4ff', sfx: 'shotgun' },
      sup: { name: 'Moisson', type: 'jump', dist: 6.2, dmg: 1100, splash: 1.9, heal: 2600, color: '#9dffb4' },
    },
    {
      id: 'tictac', name: 'Tic-Tac', role: 'Horloger', rarity: 'mythic', price: 350, hp: 3600, speed: 4.1, superCost: 3500, voice: 1.4,
      desc: 'Un automate à rouages. Sa rafale est précise, et son super arrête le temps !', aiRange: 6.4,
      look: { skin: '#e0c27a', body: '#b0742a', body2: '#6a4012', hair: '#ffd24a', accent: '#7af0ff', hat: 'clock', weapon: 'tesla', win: 'flex' },
      atk: { name: 'Rafale d\'engrenages', n: 1, burst: 5, burstDelay: 0.06, range: 7.2, speed: 26, dmg: 300, r: 6, reload: 1.3, shape: 'gear', color: '#ffd24a', sfx: 'shoot' },
      sup: { name: 'Arrêt du temps', type: 'aura', radius: 4.8, stun: 1.7, color: '#7af0ff', sfx: 'zap' },
    },
    {
      id: 'zen', name: 'Zen', role: 'Gardien', rarity: 'superrare', price: 80, hp: 5200, speed: 3.9, superCost: 3400, voice: 0.85,
      desc: 'Un moine serein. Ses sphères soignent, sa méditation protège toute l\'équipe.', aiRange: 5.8,
      look: { skin: '#e8b890', body: '#e8791f', body2: '#a04a0a', hair: '#3a2410', accent: '#ffe9a8', hat: 'monk', weapon: 'staff', win: 'bow' },
      atk: { name: 'Sphère de lumière', n: 1, range: 7.2, speed: 14, dmg: 560, r: 14, reload: 1.3, shape: 'orb', color: '#ffe9a8', pierce: true, heal: 380, sfx: 'magic' },
      sup: { name: 'Méditation', type: 'aura', radius: 4.2, shield: 2.4, heal: 900, color: '#ffe9a8', sfx: 'heal' },
    },
    {
      id: 'scarab', name: 'Scarabée', role: 'Tireur d\'élite', rarity: 'epic', price: 170, hp: 3000, speed: 3.8, superCost: 3600, voice: 1.1,
      desc: 'Un chasseur de l\'ombre. Un seul tir à très longue portée, redoutable.', aiRange: 9.6,
      look: { skin: '#d9a05a', body: '#1c6a5a', body2: '#0c3a30', hair: '#ffd21f', accent: '#ffd21f', hat: 'scarab', weapon: 'sniper', win: 'flex' },
      atk: { name: 'Tir de précision', n: 1, range: 11.6, speed: 32, dmg: 1900, r: 8, reload: 2.5, shape: 'bullet', color: '#ffd21f', sfx: 'zap' },
      sup: { name: 'Frappes ciblées', type: 'barrage', range: 11, count: 4, area: 1.3, dmg: 1150, splash: 1.0, duration: 0.8, shape: 'rocket', color: '#ffd21f' },
    },
    {
      id: 'bumper', name: 'Bumper', role: 'Bagarreur', rarity: 'rare', price: 40, hp: 6500, speed: 4.0, superCost: 3500, voice: 0.95,
      desc: 'Une boule de flipper vivante. Ses tirs repoussent, sa charge assomme.', aiRange: 3.6,
      look: { skin: '#f0c090', body: '#e8334a', body2: '#9a1226', hair: '#ffffff', accent: '#ffe14a', hat: 'bumper', weapon: 'bigshotgun', win: 'spin' },
      atk: { name: 'Choc', n: 3, spread: 22, range: 5.2, speed: 18, dmg: 420, r: 9, reload: 1.2, shape: 'pellet', color: '#ff9a9a', knock: 170, sfx: 'shotgun' },
      sup: { name: 'Super bumper', type: 'dash', dist: 6.4, speed: 18, dmg: 800, stun: 1.2, knock: 260 },
    },
    {
      id: 'jongleur', name: 'Jongleur', role: 'Trublion', rarity: 'rare', price: 40, hp: 4000, speed: 4.2, superCost: 3000, voice: 1.3,
      desc: 'Il lance des bombes en rafale, puis entre en transe : dégâts et vitesse boostés !', aiRange: 5.8,
      look: { skin: '#f6cfa4', body: '#a436d6', body2: '#5f1488', hair: '#ff4a8a', accent: '#ffd21f', hat: 'jester', weapon: 'bomb', win: 'flip' },
      atk: { name: 'Jonglage', n: 3, lob: true, spread: 26, range: 6.6, speed: 12, dmg: 470, splash: 0.85, reload: 1.7, shape: 'bomb', color: '#ff7ad8', sfx: 'rocket' },
      sup: { name: 'Transe du cirque', type: 'aura', radius: 0.01, rage: { t: 5.5, dmg: 1.6, speed: 1.25 }, color: '#ffd21f', sfx: 'super' },
    },
    {
      id: 'yeti', name: 'Yéti', role: 'Colosse', rarity: 'mythic', price: 350, hp: 8200, speed: 3.8, superCost: 3800, voice: 0.6,
      desc: 'Le roi des glaces. Ses griffes ralentissent, son saut gèle toute la zone.', aiRange: 3.2,
      look: { skin: '#cfe6f5', body: '#6aa8d8', body2: '#34608c', hair: '#ffffff', accent: '#e8fbff', hat: 'yeti', weapon: 'bigshotgun', win: 'flex' },
      atk: { name: 'Griffes de givre', n: 5, spread: 50, range: 3.8, speed: 15, dmg: 520, r: 9, reload: 1.15, shape: 'ice', color: '#c8f0ff', slow: { f: 0.55, t: 1.4 }, sfx: 'shotgun' },
      sup: { name: 'Avalanche', type: 'jump', dist: 5.2, dmg: 1200, splash: 2.3, freeze: 1.3, knock: 120, color: '#c8f0ff' },
    },
  ];
  G.BRAWLER = {};
  // le boss n'est pas jouable : il n'apparaît pas dans la liste des brawlers
  G.BOSS = { id: 'robot', name: 'Mégabot', role: 'Boss', rarity: 'legend', price: 0, hp: 115000, speed: 2.9, superCost: 5000, desc: 'Un robot géant.', aiRange: 5.2, noHpScale: true,
    look: { skin: '#9fb0c8', body: '#59657e', body2: '#303a52', hair: '#ff4a55', accent: '#ff4a55', hat: 'robot', weapon: 'bigshotgun' },
    atk: { name: 'Salve', n: 7, spread: 64, range: 6.4, speed: 12, dmg: 240, r: 9, reload: 1.7, shape: 'bolt', color: '#ff6a6a', sfx: 'shotgun' },
    sup: { name: 'Onde de choc', type: 'aura', radius: 3.8, dmg: 900, stun: 0.7, color: '#ff6a6a', sfx: 'zap' } };
  G.HP_SCALE = 2.1; // équilibrage : combats plus longs et plus lisibles
  G.BRAWLERS.forEach((b) => { if (!b.voice) b.voice = 1; b.hp = Math.round(b.hp * G.HP_SCALE / 50) * 50; G.BRAWLER[b.id] = b; });
  G.BRAWLER.robot = G.BOSS;
  /* comptes joueurs (Supabase) : URL du projet + clé publique « anon ». Voir COMPTES.md */
  G.SUPABASE = { url: '', key: '' };
  G.DEFAULT_SERVER = ''; // adresse du serveur par défaut (ex. 'mon-jeu.onrender.com') ; modifiable dans Réglages

  /* skins : décalage de teinte global + doré */
  G.SKINS = [
    { id: 'classic', name: 'Classique', price: 0, hue: 0, tier: 'Commun' },
    { id: 'neon', name: 'Néon', price: 30, hue: 80, tier: 'Rare' },
    { id: 'toxic', name: 'Toxique', price: 30, hue: 170, tier: 'Rare' },
    { id: 'gold', name: 'Doré', price: 90, hue: 0, gold: true, tier: 'Épique' },
    { id: 'rainbow', name: 'Arc-en-ciel', price: 220, hue: 0, rainbow: true, fx: 'rainbow', tier: 'Légendaire' },
    { id: 'ghost', name: 'Spectre', price: 200, hue: 200, fx: 'ghost', tier: 'Légendaire' },
    { id: 'crystal', name: 'Cristal', price: 240, hue: 160, fx: 'crystal', tier: 'Légendaire' },
    { id: 'inferno', name: 'Inferno', price: 260, hue: 330, fx: 'inferno', tier: 'Légendaire' },
  ];
  G.SKIN = {};
  G.SKINS.forEach((s) => (G.SKIN[s.id] = s));

  const _lookCache = {};
  G.getLook = function (id, skinId, hueStep) {
    const key = id + '|' + (skinId || 'classic') + (hueStep !== undefined ? '|' + hueStep : '');
    if (_lookCache[key]) return _lookCache[key];
    const base = G.BRAWLER[id].look, sk = G.SKIN[skinId || 'classic'] || G.SKINS[0];
    const out = Object.assign({}, base);
    if (sk.rainbow) { const h = (hueStep || 0) * 30; ['body', 'body2', 'hair', 'accent'].forEach((k) => (out[k] = G.hueShift(base[k], h))); _lookCache[key] = null; return out; }
    if (sk.hue) ['body', 'body2', 'hair', 'accent'].forEach((k) => (out[k] = G.hueShift(base[k], sk.hue)));
    if (sk.gold) { out.body = '#f5c518'; out.body2 = '#b8860b'; out.accent = '#fff3b0'; out.hair = G.mix(base.hair, '#ffd21f', 0.5); }
    _lookCache[key] = out;
    return out;
  };

  /* niveau de puissance : +6% pv et dégâts par niveau */
  G.levelMul = (lvl) => 1 + 0.06 * ((lvl || 1) - 1);
  G.UPGRADE_COST = [0, 0, 20, 35, 75, 140, 290, 480, 800, 1250, 1900]; // coût pour atteindre le niveau i
  G.MAX_LEVEL = 10;

  /* ---------- modes de jeu ---------- */
  G.MODES = {
    gemgrab: { id: 'gemgrab', name: 'Razzia de cristaux', short: 'Cristaux', color: '#b455ff', icon: 'gem', teams: 2, per: 3, time: 180,
      desc: 'Récoltez 10 cristaux et gardez-les 15 secondes pour gagner !', maps: ['mine', 'glacier', 'caverne'] },
    brawlball: { id: 'brawlball', name: 'Foot brawl', short: 'Football', color: '#4cd964', icon: 'ball', teams: 2, per: 3, time: 120,
      desc: 'Marquez 2 buts avant l\'équipe adverse. Tirez pour passer le ballon !', maps: ['stade', 'glace', 'volcan'] },
    heist: { id: 'heist', name: 'Braquage', short: 'Braquage', color: '#ff4a55', icon: 'safe', teams: 2, per: 3, time: 150,
      desc: 'Détruisez le coffre ennemi et protégez le vôtre !', maps: ['banque', 'fort', 'oasis'] },
    bounty: { id: 'bounty', name: 'Chasse aux primes', short: 'Primes', color: '#ffd21f', icon: 'star', teams: 2, per: 3, time: 120,
      desc: 'Éliminez les ennemis pour gagner des étoiles. Plus ils en ont, plus ils valent !', maps: ['canyon', 'foret', 'polaire'] },
    showdown: { id: 'showdown', name: 'Survie', short: 'Survie', color: '#ff8a1f', icon: 'skull', teams: 10, per: 1, time: 240,
      desc: 'Seul contre 9 ! Ramassez des cubes de puissance et survivez au gaz toxique.', maps: ['jungle', 'desert', 'sommet', 'crater'] },
  };
  G.MODES.hotzone = { id: 'hotzone', name: 'Zone stratégique', short: 'Zones', color: '#1fc8b8', icon: 'zone', teams: 2, per: 3, time: 150,
    desc: 'Contrôlez les zones sans ennemi à l\'intérieur : première équipe à 100 points !', maps: ['plateau', 'ruines', 'givre'] };
  G.MODES.boss = { id: 'boss', name: 'Assaut du Mégabot', short: 'Mégabot', color: '#6a7bff', icon: 'robot', teams: 2, per: 3, time: 150,
    desc: 'Défi coopératif ! Unissez vos forces pour détruire le robot géant avant d\'être éliminés.', maps: ['usine', 'arene_boss'] };
  G.MODES.knockout = { id: 'knockout', name: 'Duel d\'élite', short: 'Duel', color: '#e8334a', icon: 'skull', teams: 2, per: 3, time: 150,
    desc: 'Sans réapparition ! Éliminez toute l\'équipe adverse. Premier à 2 manches.', maps: ['duel1', 'duel2'] };
  G.MODE_ORDER = ['gemgrab', 'brawlball', 'heist', 'bounty', 'hotzone', 'knockout', 'boss', 'showdown'];
  /* événements du jour : de vraies règles modifiées, identiques hors-ligne et en ligne */
  G.EVENTS = [
    { id: 'turbo', name: 'Journée Turbo', icon: '⚡', desc: 'Tout le monde court 20 % plus vite !' },
    { id: 'vampire', name: 'Nuit des Vampires', icon: '🦇', desc: 'Chaque dégât soigne l\'attaquant de 15 %.' },
    { id: 'supercharge', name: 'Supers express', icon: '💥', desc: 'Les supers se chargent presque 2 fois plus vite.' },
    { id: 'giants', name: 'Festival des Géants', icon: '🗿', desc: 'Brawlers plus grands et plus costauds.' },
    { id: 'none', name: 'Jour classique', icon: '⭐', desc: 'Les règles habituelles.' },
  ];
  G.todayEvent = function (d) { d = d || new Date(); const n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); return G.EVENTS[n % G.EVENTS.length]; };

  /* thèmes visuels des arènes */
  G.THEMES = {
    meadow: { name: 'Prairie', g1: '#79c243', g2: '#6db83a', wall: '#8d9aa6', crate: '#c98b4a', bush: '#2e9e45', water: '#38a3e8', deco: 'flower', border: '#3f7a27', fog: '#2f5d1c' },
    desert: { name: 'Désert', g1: '#ebc983', g2: '#e2bd72', wall: '#c27c45', crate: '#b9793c', bush: '#6aa84f', water: '#4cc2d1', deco: 'pebble', border: '#a8693a', fog: '#8a5a2c' },
    snow: { name: 'Toundra', g1: '#e9f3fb', g2: '#dcebf7', wall: '#9ec7e6', crate: '#9a7a5c', bush: '#3f9d7a', water: '#5fb6f0', deco: 'snow', border: '#7fa9c9', fog: '#4f7fa3' },
    volcano: { name: 'Volcan', g1: '#5a4a52', g2: '#51424a', wall: '#2c2428', crate: '#8f4a2a', bush: '#7a8a2a', water: '#ff6a1a', deco: 'ember', border: '#2a1c20', fog: '#1b0f12' },
    night: { name: 'Nuit', g1: '#46538a', g2: '#3f4b7f', wall: '#6a5aa8', crate: '#8a6a9a', bush: '#2a8a8a', water: '#2a5ad0', deco: 'star', border: '#2a3060', fog: '#161a3a' },
  };

  /* définitions d'arènes (la génération est procédurale et déterministe via la graine) */
  G.MAPS = {
    mine: { name: 'Mine abandonnée', mode: 'gemgrab', theme: 'desert', seed: 11, w: 33, h: 21, density: 1.0, vmirror: true },
    glacier: { name: 'Cristaux gelés', mode: 'gemgrab', theme: 'snow', seed: 23, w: 33, h: 21, density: 1.1, vmirror: true },
    caverne: { name: 'Caverne lumineuse', mode: 'gemgrab', theme: 'night', seed: 35, w: 33, h: 21, density: 0.9, vmirror: false },
    stade: { name: 'Stade étoilé', mode: 'brawlball', theme: 'meadow', seed: 41, w: 35, h: 21, density: 0.6, vmirror: true },
    glace: { name: 'Patinoire', mode: 'brawlball', theme: 'snow', seed: 52, w: 35, h: 21, density: 0.7, vmirror: true },
    volcan: { name: 'Terrain volcanique', mode: 'brawlball', theme: 'volcano', seed: 63, w: 35, h: 21, density: 0.7, vmirror: false },
    banque: { name: 'Grande banque', mode: 'heist', theme: 'desert', seed: 74, w: 33, h: 21, density: 0.9, vmirror: true },
    fort: { name: 'Forteresse', mode: 'heist', theme: 'night', seed: 85, w: 33, h: 21, density: 1.0, vmirror: true },
    oasis: { name: 'Oasis dorée', mode: 'heist', theme: 'meadow', seed: 96, w: 33, h: 21, density: 0.9, vmirror: false },
    canyon: { name: 'Grand canyon', mode: 'bounty', theme: 'desert', seed: 107, w: 31, h: 21, density: 1.0, vmirror: true },
    foret: { name: 'Forêt mystique', mode: 'bounty', theme: 'meadow', seed: 118, w: 31, h: 21, density: 1.2, vmirror: false },
    polaire: { name: 'Station polaire', mode: 'bounty', theme: 'snow', seed: 129, w: 31, h: 21, density: 1.0, vmirror: true },
    plateau: { name: 'Plateau des zones', mode: 'hotzone', theme: 'meadow', seed: 141, w: 33, h: 21, density: 0.9, vmirror: true },
    ruines: { name: 'Ruines du désert', mode: 'hotzone', theme: 'desert', seed: 152, w: 33, h: 21, density: 1.0, vmirror: true },
    givre: { name: 'Plateau du givre', mode: 'hotzone', theme: 'snow', seed: 163, w: 33, h: 21, density: 0.9, vmirror: true },
    usine: { name: 'Usine abandonnée', mode: 'boss', theme: 'night', seed: 174, w: 31, h: 21, density: 0.8, vmirror: true },
    arene_boss: { name: 'Arène du Mégabot', mode: 'boss', theme: 'volcano', seed: 185, w: 31, h: 21, density: 0.7, vmirror: true },
    duel1: { name: 'Arène des champions', mode: 'knockout', theme: 'desert', seed: 196, w: 29, h: 19, density: 0.9, vmirror: true },
    duel2: { name: 'Temple glacé', mode: 'knockout', theme: 'snow', seed: 207, w: 29, h: 19, density: 1.0, vmirror: true },
    jungle: { name: 'Jungle dangereuse', mode: 'showdown', theme: 'meadow', seed: 0, w: 38, h: 38, density: 1.0 },
    desert: { name: 'Désert brûlant', mode: 'showdown', theme: 'desert', seed: 0, w: 38, h: 38, density: 0.9 },
    sommet: { name: 'Sommet gelé', mode: 'showdown', theme: 'snow', seed: 0, w: 38, h: 38, density: 1.0 },
    crater: { name: 'Cratère maudit', mode: 'showdown', theme: 'volcano', seed: 0, w: 38, h: 38, density: 1.0 },
  };

  /* ---------- boutique / progression ---------- */
  G.GEM_RATE = 1;
  // route des trophées : [trophées requis, type, valeur]
  G.ROAD = [
    [10, 'coins', 50], [25, 'gems', 5], [50, 'box', 1], [80, 'coins', 120], [120, 'brawler', 'taurus'], [160, 'gems', 10],
    [210, 'box', 1], [270, 'coins', 200], [340, 'brawler', 'boomer'], [420, 'gems', 15], [510, 'box', 2], [610, 'coins', 350],
    [720, 'brawler', 'luna'], [840, 'gems', 20], [970, 'box', 2], [1110, 'coins', 500], [1260, 'brawler', 'spiky'],
    [1420, 'gems', 30], [1600, 'box', 3], [1790, 'coins', 800], [2000, 'brawler', 'corbeau'], [2250, 'gems', 40], [2500, 'box', 3],
    [2800, 'brawler', 'frost'], [3100, 'coins', 1500], [3500, 'brawler', 'pyro'], [4000, 'gems', 100], [4600, 'brawler', 'volt'],
  ];

  G.QUEST_POOL = [
    { id: 'win3', text: 'Gagner 3 parties', goal: 3, stat: 'win', reward: ['coins', 100] },
    { id: 'play5', text: 'Jouer 5 parties', goal: 5, stat: 'play', reward: ['coins', 80] },
    { id: 'kills10', text: 'Éliminer 10 ennemis', goal: 10, stat: 'kill', reward: ['gems', 5] },
    { id: 'dmg30k', text: 'Infliger 30 000 dégâts', goal: 30000, stat: 'damage', reward: ['coins', 120] },
    { id: 'super5', text: 'Utiliser 5 supers', goal: 5, stat: 'super', reward: ['coins', 90] },
    { id: 'win1gg', text: 'Gagner en Razzia de cristaux', goal: 1, stat: 'win_gemgrab', reward: ['gems', 4] },
    { id: 'win1bb', text: 'Gagner au Foot brawl', goal: 1, stat: 'win_brawlball', reward: ['gems', 4] },
    { id: 'win1sd', text: 'Finir dans le top 3 en Survie', goal: 1, stat: 'top3_showdown', reward: ['gems', 5] },
    { id: 'heal', text: 'Soigner 5 000 PV avec Luna ou Super', goal: 5000, stat: 'heal', reward: ['coins', 100] },
    { id: 'gems20', text: 'Ramasser 20 cristaux', goal: 20, stat: 'gems', reward: ['coins', 110] },
  ];

  G.rankOf = (trophies) => Math.max(1, Math.min(35, 1 + Math.floor(Math.sqrt(trophies / 3.5))));
  G.rankColor = (rank) => (rank < 8 ? '#9aa7b8' : rank < 14 ? '#4cd964' : rank < 20 ? '#3aa0ff' : rank < 26 ? '#b455ff' : rank < 31 ? '#ff8a1f' : '#ffd21f');

  G.dayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
})();
