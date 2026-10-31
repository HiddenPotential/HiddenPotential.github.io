// Bull Rider — an 8-second rodeo game. Three.js 3D scene with a 2D canvas HUD on top.
import { createScene, wx, wy, ENVIRONMENTS } from './scene3d.js';
import { createMusic } from './music.js';

(() => {
  const W = 960, H = 540, GROUND = 450;
  const FENCE_L = 46, FENCE_R = 914, FENCE_TOP = 338;
  const RIDE_TIME = 8;
  const UNLOCK_SCORE = 65;
  const TITLE_FONT = '"Rye", Georgia, serif';
  const BODY_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const view3d = createScene(document.getElementById('scene'), W, H);
  let pxScale = 1;

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.width = W * s + 'px';
    stage.style.height = H * s + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    pxScale = s * dpr;
    view3d.setSize(W * s, H * s, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sign = (v) => (v < 0 ? -1 : 1);

  // ---------- Storage ----------
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------- Bulls ----------
  const BULLS = [
    { name: 'Biscuit', rank: 'Rookie', color: '#9a6440', power: 7, tempo: 0.7, tele: 1.1, spin: 0.1, fake: 0, base: 34,
      desc: 'A gentle old timer. Learn the ropes.', env: 'fair' },
    { name: 'Dust Devil', rank: 'Amateur', color: '#6b4128', power: 8.5, tempo: 0.82, tele: 0.92, spin: 0.3, fake: 0, base: 38,
      desc: 'Loves to spin. Keep your seat centered.', env: 'canyon' },
    { name: 'Widowmaker', rank: 'Pro', color: '#2e2a28', power: 10, tempo: 0.95, tele: 0.78, spin: 0.25, fake: 0.05, base: 42,
      desc: 'Huge kicks and short tells.', env: 'stadium' },
    { name: 'Thunderhoof', rank: 'Champion', color: '#77736d', power: 11.5, tempo: 1.05, tele: 0.66, spin: 0.3, fake: 0.1, base: 45,
      desc: 'Relentless. Loves to fake you out.', env: 'storm' },
    { name: 'El Diablo', rank: 'Legend', color: '#7d1f1a', power: 13, tempo: 1.2, tele: 0.56, spin: 0.35, fake: 0.15, base: 48,
      desc: 'Nobody has made the buzzer. Yet.', env: 'inferno' },
  ];

  // ---------- Mounts ----------
  // Each world has its own animals; any pen can be ridden on any of them. Each one scales the pen's bucking stats
  // and the bull score it can earn, and has its own coats and legendary headliners.
  const ANIMALS = [
    { id: 'bull', name: 'Bull', power: 1, tempo: 1, tele: 1, spin: 1, base: 0, preview: null,
      desc: 'The classic. Big kicks, the odd spin.' },
    { id: 'ram', name: 'Ram', power: 0.75, tempo: 1.2, tele: 1.15, spin: 1.2, base: -4, preview: '#efe6d2',
      desc: 'Small, quick and woolly. Easiest ride in the rodeo.',
      coats: ['#efe6d2', '#e2d6bd', '#cfc2a8', '#f6f1e6', '#b9ab92', '#5a4d42'], legendColor: '#ffd98a',
      legends: ['Mr. Fluffles', 'Woolly Bully', 'Battering Ram', 'Thunderfleece', 'Lord Baaaron'] },
    { id: 'bronco', name: 'Bronco', power: 0.95, tempo: 1.1, tele: 1, spin: 0.4, base: 1, preview: '#8b5a2b',
      desc: 'Bucks high and fast, but rarely spins.',
      coats: ['#8b5a2b', '#5c3a1e', '#2b211b', '#c9a26b', '#a0522d', '#d8d2c8'], legendColor: '#f6f4f0',
      legends: ['Sugarfoot', 'Sidewinder', 'Black Widow', 'Stormchaser', 'Ghost Rider'] },
    { id: 'camel', name: 'Camel', power: 1.05, tempo: 0.8, tele: 1.2, spin: 0.6, base: 2, preview: '#c9a26b',
      desc: 'Slow, huge sways from way up high.',
      coats: ['#c9a26b', '#b08850', '#d8b98a', '#9a7444', '#e0cfa8'], legendColor: '#f0d9a0',
      legends: ['Humphrey', 'Sahara', 'Dune Buggy', 'Sandstorm', 'The Mirage'] },
    { id: 'whale', name: 'Whale', power: 0.9, tempo: 0.75, tele: 1.25, spin: 0.5, base: 1, preview: '#3c5a78',
      desc: 'Slow, rolling heaves. Watch for the spout.',
      coats: ['#3c5a78', '#2e4660', '#4a6a88', '#55606e', '#2a3a4e'], legendColor: '#eef6ff',
      legends: ['Big Blue', 'Barnacle Bill', 'Old Moby', 'Leviathan', 'The Abyss'] },
    { id: 'kraken', name: 'Kraken', power: 1, tempo: 1.15, tele: 0.95, spin: 1.6, base: 3, preview: '#8a2b4a',
      desc: 'A giant squid. Ten arms and a taste for spinning.',
      coats: ['#8a2b4a', '#6a2a7a', '#a33a2a', '#4a2a6a', '#b0485a'], legendColor: '#2affc0',
      legends: ['Inky', 'Tentacula', 'Captain Suckers', 'Ink Storm', 'The Kraken'] },
    { id: 'dragon', name: 'Dragon', power: 1.1, tempo: 1.05, tele: 1, spin: 0.8, base: 4, preview: '#2f7a3a',
      desc: 'Flies, flaps and breathes fire on the big kicks.',
      coats: ['#2f7a3a', '#7a1f1f', '#2a4a8a', '#5a2a7a', '#2a2a2a', '#b06a20'], legendColor: '#ffd34d',
      legends: ['Ember', 'Skyscorch', 'Stormwing', 'Cinderfang', 'The Sky Tyrant'] },
    { id: 'pig', name: 'Pig', power: 0.7, tempo: 1.3, tele: 1.15, spin: 1, base: -4, preview: '#f4b6b0',
      desc: 'Short, quick and squealing.',
      coats: ['#f4b6b0', '#e89c94', '#f8cfc8', '#8a5a4a', '#e0a090'], legendColor: '#ffd98a',
      legends: ['Hamlet', 'Sir Oinks', 'Bacon Bandit', 'Hogzilla', 'Porkchop Supreme'] },
    { id: 'cow', name: 'Cow', power: 0.85, tempo: 0.9, tele: 1.15, spin: 0.5, base: -2, preview: '#f4f0e8',
      desc: 'Big, steady and a little grumpy.',
      coats: ['#f4f0e8', '#e8e0d0', '#8a5a3b', '#d8c8b0'], legendColor: '#fff4c8',
      legends: ['Daisy', 'Moolinda', 'Milkshake', 'Big Bertha', 'Cowabunga'] },
    { id: 'goat', name: 'Goat', power: 0.8, tempo: 1.35, tele: 1.05, spin: 1.1, base: -3, preview: '#e8e0d0',
      desc: 'Jumpy, stubborn and full of tricks.',
      coats: ['#e8e0d0', '#8a6a4a', '#3a3028', '#c8b8a0', '#6a5040'], legendColor: '#ffe8a0',
      legends: ['Billy', 'Pepper', 'Headbutt Harry', 'The G.O.A.T.', 'Old Scratch'] },
    { id: 'chicken', name: 'Giant Chicken', power: 0.65, tempo: 1.5, tele: 1.2, spin: 1.3, base: -5, preview: '#f6f1e6',
      desc: 'Flaps, pecks and panics. Mostly harmless.',
      coats: ['#f6f1e6', '#c8642a', '#3a302a', '#e8c070', '#a85a30'], legendColor: '#ffd34d',
      legends: ['Nugget', 'Henrietta', 'Cluckzilla', 'Rooster Cogburn', 'The Colonel'] },
  ];
  const animalById = (id) => ANIMALS.find((a) => a.id === id);

  // ---------- Worlds ----------
  // Rodeo uses each pen's own arena; the other worlds have one environment each.
  const WORLDS = [
    { id: 'rodeo', name: 'Rodeo', env: null, color: '#ffd34d', animals: ['bull', 'bronco', 'camel'],
      desc: 'Five arenas, from the County Fair to the Devil\'s Pit.' },
    { id: 'ocean', name: 'Under the Sea', env: 'ocean', color: '#5cd6ff', animals: ['whale', 'kraken'],
      desc: 'Ride the giants of the deep among the reefs and kelp.' },
    { id: 'sky', name: 'Sky Islands', env: 'sky', color: '#bfe6ff', animals: ['dragon'],
      desc: 'A rodeo on a floating island. Hold on to your dragon.' },
    { id: 'farm', name: 'Sunny Farm', env: 'farm', color: '#9be36b', animals: ['pig', 'cow', 'goat', 'ram', 'bronco', 'chicken'],
      desc: 'Everything on the farm bucks. Even the chickens.' },
  ];

  const save = store.get('bullrider_save', null) || { unlocked: 1, best: [] };
  while (save.best.length < BULLS.length) save.best.push(0);
  save.pity = save.pity || 0;
  save.world = clamp(save.world || 0, 0, WORLDS.length - 1);
  save.mounts = save.mounts || {};
  const curWorld = () => WORLDS[save.world];
  // The animal chosen in the current world (remembered per world).
  const curAnimal = () => animalById(save.mounts[curWorld().id] || curWorld().animals[0]);
  const worldEnv = (tier) => curWorld().env || BULLS[tier].env;
  save.draws = save.draws || { common: 0, rare: 0, epic: 0, legendary: 0 };
  const persist = () => store.set('bullrider_save', save);

  // ---------- Rider outfit ----------
  // Each slot is a list of [name, value]; the save keeps the chosen index per slot.
  const RIDER_SLOTS = [
    { id: 'hatStyle', name: 'Hat', options: [['Cowboy', 'cowboy'], ['Ten-Gallon', 'tall'], ['Gambler', 'flat'], ['Helmet', 'helmet']] },
    { id: 'hat', name: 'Hat Color', options: [['Straw', '#d2ab6e'], ['Black', '#1f1a17'], ['White', '#f1ebdd'], ['Brown', '#6b4423'], ['Slate', '#77736d'], ['Red', '#a33a2a']] },
    { id: 'band', name: 'Hatband', options: [['Rust', '#5a2d10'], ['Red', '#b0281f'], ['Turquoise', '#2a9a9a'], ['Gold', '#e8c35a'], ['Black', '#141210']] },
    { id: 'hairStyle', name: 'Hair', options: [['Short', 'short'], ['Long', 'long'], ['Ponytail', 'ponytail'], ['Braids', 'braids'], ['Mohawk', 'mohawk'], ['Bald', 'bald']] },
    { id: 'hair', name: 'Hair Color', options: [['Brown', '#3a2618'], ['Black', '#141210'], ['Auburn', '#7a3418'], ['Blonde', '#d8b060'], ['Red', '#b0481f'], ['Gray', '#9a968e'], ['White', '#ece8e0'], ['Blue', '#3a6ad0'], ['Pink', '#e07aa8']] },
    { id: 'beard', name: 'Facial Hair', options: [['None', 'none'], ['Mustache', 'mustache'], ['Handlebar', 'handlebar'], ['Goatee', 'goatee'], ['Full Beard', 'beard']] },
    { id: 'shirt', name: 'Shirt', options: [['Blue', '#2f6fb3'], ['Red', '#b8322a'], ['White', '#eee6d6'], ['Black', '#22201e'], ['Green', '#3f7a45'], ['Purple', '#6b3fa0'], ['Pink', '#e07aa8'], ['Yellow', '#e0b23a']] },
    { id: 'pattern', name: 'Pattern', options: [['Solid', 'solid'], ['Plaid', 'plaid'], ['Stripes', 'stripes'], ['Gingham', 'gingham'], ['Pinstripe', 'pinstripe'], ['Stars', 'stars']] },
    { id: 'bandana', name: 'Bandana', options: [['None', null], ['Red', '#b0281f'], ['Blue', '#2a4a9a'], ['Black', '#1a1816'], ['Turquoise', '#2a9a9a'], ['Yellow', '#e0b23a'], ['White', '#eee6d6']] },
    { id: 'vest', name: 'Vest', options: [['Brown', '#6e3519'], ['Black', '#1f1a17'], ['Tan', '#b08850'], ['Red', '#8a2420'], ['Denim', '#3b5a80'], ['None', null]] },
    { id: 'jeans', name: 'Pants', options: [['Denim', '#2b3a55'], ['Black', '#1e1e22'], ['Faded', '#5a7aa8'], ['Tan Chaps', '#9a6a3a'], ['Leather', '#4a2a18'], ['White', '#d8d2c4']] },
    { id: 'boot', name: 'Boots', options: [['Brown', '#3b2412'], ['Black', '#151210'], ['Red', '#7a1f1a'], ['Tan', '#a87a48'], ['White', '#e8e0d0']] },
    { id: 'glove', name: 'Gloves', options: [['Buckskin', '#d8c7a0'], ['Black', '#1f1a17'], ['Brown', '#6b4423'], ['White', '#f1ebdd']] },
    { id: 'skin', name: 'Skin', options: [['Tone 1', '#f2cfae'], ['Tone 2', '#e0b089'], ['Tone 3', '#c68e62'], ['Tone 4', '#a0673f'], ['Tone 5', '#7a4a2a'], ['Tone 6', '#4f2f1c']] },
  ];
  save.rider = save.rider || {};
  for (const sl of RIDER_SLOTS) save.rider[sl.id] = clamp(save.rider[sl.id] | 0, 0, sl.options.length - 1);
  const riderOption = (sl) => sl.options[save.rider[sl.id]];
  function applyRider() {
    const look = {};
    for (const sl of RIDER_SLOTS) look[sl.id] = riderOption(sl)[1];
    view3d.setRiderLook(look);
  }
  applyRider();

  // ---------- Random bulls ----------
  // Each pen (BULLS entry) is a template. Every ride draws a fresh bull from it:
  // a rolled rarity, traits, name and coat. Rarer bulls buck harder but score more,
  // and a Legendary draw is the pen's famous headliner.
  const RARITIES = [
    { id: 'common', name: 'Common', color: '#e2d6bd', weight: 58, power: 1, tempo: 1, tele: 1, base: 0, traits: 1 },
    { id: 'rare', name: 'Rare', color: '#4dabff', weight: 28, power: 1.05, tempo: 1.03, tele: 0.97, base: 2, traits: 1 },
    { id: 'epic', name: 'Epic', color: '#c77dff', weight: 11, power: 1.1, tempo: 1.06, tele: 0.94, base: 4, traits: 2 },
    { id: 'legendary', name: 'Legendary', color: '#ffc93c', weight: 3, power: 1.15, tempo: 1.1, tele: 0.9, base: 6, traits: 2 },
  ];
  const PITY_MAX = 12; // each draw without an Epic or better improves the odds, up to this many
  const TRAITS = [
    { name: 'Spinner', desc: 'spins like a top', apply: (b) => { b.spin = Math.min(0.7, b.spin + 0.2); } },
    { name: 'Trickster', desc: 'fakes you out', apply: (b) => { b.fake = Math.min(0.45, b.fake + 0.12); } },
    { name: 'Powerhouse', desc: 'kicks like a mule', apply: (b) => { b.power *= 1.12; b.base += 1; } },
    { name: 'Quick', desc: 'never stops moving', apply: (b) => { b.tempo *= 1.15; } },
    { name: 'Sneaky', desc: 'barely tips you off', apply: (b) => { b.tele *= 0.85; b.base += 1; } },
    { name: 'Steady', desc: 'bucks honest', apply: (b) => { b.power *= 0.92; b.tele *= 1.1; b.base -= 1; } },
  ];
  const NAME_A = ['Midnight', 'Copper', 'Rusty', 'Big', 'Mean', 'Crazy', 'Old', 'Iron', 'Wild', 'Smokey', 'Lucky', 'Rowdy', 'Black', 'Red', 'Bad', 'Little', 'Blue', 'Dusty'];
  const NAME_B = ['Thunder', 'Joe', 'Bones', 'Tornado', 'Sundance', 'Buckshot', 'Outlaw', 'Rattler', 'Bandit', 'Whiskey', 'Dynamite', 'Tumbleweed', 'Maverick', 'Hurricane', 'Chili', 'Moonshine', 'Jack', 'Ruckus'];
  const COATS = {
    common: ['#9a6440', '#6b4128', '#3a2a20', '#8a5a3b', '#5b3a29', '#a8875e'],
    rare: ['#77736d', '#2e2a28', '#c9b79a', '#4a3a33', '#8c4a2f'],
    epic: ['#1c1a1a', '#6e2b1f', '#3d3d46', '#e8e0d4'],
  };

  // Small seeded RNG so a bull's look is fixed by its seed.
  function mulberry32(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rarityWeights() {
    const p = Math.min(save.pity, PITY_MAX);
    return RARITIES.map((r) => r.weight + (r.id === 'epic' ? p * 2 : r.id === 'legendary' ? p * 0.6 : r.id === 'common' ? -p * 2.6 : 0));
  }
  function rarityOdds() {
    const w = rarityWeights();
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / sum);
  }

  const isDark = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 110;
  };

  function rollBull(tier) {
    const seed = (Math.random() * 4294967296) >>> 0;
    const rng = mulberry32(seed);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const t = BULLS[tier];
    const odds = rarityOdds();
    let roll = rng(), ri = 0;
    while (ri < odds.length - 1 && roll >= odds[ri]) roll -= odds[ri++];
    const rarity = RARITIES[ri];

    const animal = curAnimal();
    const b = { ...t, tier, seed, rarity, template: t.name, kind: animal.id, animal };
    b.env = worldEnv(tier);
    b.power = t.power * animal.power * rarity.power * (0.95 + rng() * 0.1);
    b.tempo = t.tempo * animal.tempo * rarity.tempo * (0.95 + rng() * 0.1);
    b.tele = t.tele * animal.tele * rarity.tele * (0.95 + rng() * 0.1);
    b.spin = Math.min(0.7, t.spin * animal.spin);
    b.base = t.base + animal.base + rarity.base;

    const pool = TRAITS.slice();
    const count = rarity.id === 'common' && rng() < 0.4 ? 0 : rarity.traits;
    b.traits = [];
    for (let i = 0; i < count; i++) {
      const tr = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      // Rarer bulls don't roll the easy trait.
      if (tr.name === 'Steady' && rarity.id !== 'common') { i--; continue; }
      tr.apply(b);
      b.traits.push(tr);
    }

    if (rarity.id === 'legendary') {
      b.name = animal.legends ? animal.legends[tier] : t.name;
      b.color = animal.legends ? animal.legendColor : t.color;
      b.desc = animal.legends ? 'The pen\'s famous ' + animal.name.toLowerCase() + '.' : t.desc;
    } else {
      do b.name = pick(NAME_A) + ' ' + pick(NAME_B); while (BULLS.some((x) => x.name === b.name));
      b.color = pick(animal.coats || COATS[rarity.id]);
      b.desc = b.traits.length ? b.traits.map((x) => x.desc).join(' and ') + '.' : 'A plain old bucking ' + animal.name.toLowerCase() + '.';
      b.desc = b.desc[0].toUpperCase() + b.desc.slice(1);
    }
    const dark = isDark(b.color);
    const spotted = rarity.id === 'epic' || rng() < 0.3;
    b.look = {
      seed,
      spots: spotted ? (dark ? '#efe7da' : '#1d1612') : null,
      blaze: rng() < 0.45 ? (dark ? '#f2ece2' : '#2a1d15') : null,
      horn: rarity.id === 'legendary' ? '#ffd34d' : rarity.id === 'epic' ? '#e6dcff' : '#efe6cf',
      hornScale: 0.85 + rng() * 0.3 + (rarity.id === 'legendary' ? 0.2 : 0),
      bulk: 0.94 + rng() * 0.12 + (rarity.id === 'legendary' ? 0.06 : 0),
      aura: rarity.id === 'legendary' ? '#ffc93c' : rarity.id === 'epic' ? '#b07dff' : null,
    };

    save.pity = ri >= 2 ? 0 : save.pity + 1;
    save.draws[rarity.id]++;
    persist();
    return b;
  }

  function announceBull(b) {
    const r = b.rarity;
    popup(r.name.toUpperCase() + '!', 480, 300, r.color, r.id === 'legendary' ? 52 : 40);
    if (r.id === 'legendary') sfx.unlock();
    else if (r.id === 'epic') sfx.spur();
    else sfx.click();
  }

  // ---------- Audio ----------
  let AC = null;
  let muted = store.get('bullrider_muted', false);
  function audio() {
    if (!AC) {
      try {
        AC = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur, type, vol, slideTo) {
    const a = audio();
    if (!a || muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur + 0.02);
  }
  function noise(dur, vol, freq, attack) {
    const a = audio();
    if (!a || muted) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = a.createGain();
    const t0 = a.currentTime, at = attack || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  }
  const sfx = {
    thump: () => noise(0.14, 0.5, 180),
    snort: () => noise(0.25, 0.18, 900, 0.03),
    gate: () => { noise(0.35, 0.35, 500); tone(90, 0.3, 'square', 0.08, 60); },
    perfect: () => { tone(880, 0.06, 'square', 0.1, 1320); setTimeout(() => tone(1320, 0.1, 'square', 0.09, 1760), 50); },
    good: () => tone(660, 0.07, 'triangle', 0.1, 880),
    spur: () => { tone(1500, 0.07, 'triangle', 0.12, 2200); setTimeout(() => tone(1900, 0.09, 'triangle', 0.1, 2600), 60); },
    miss: () => tone(220, 0.12, 'square', 0.06, 160),
    buzzer: () => { tone(140, 0.9, 'sawtooth', 0.16); tone(147, 0.9, 'sawtooth', 0.12); },
    cheer: () => noise(1.8, 0.16, 1400, 0.25),
    gasp: () => noise(0.9, 0.12, 600, 0.15),
    fall: () => noise(0.3, 0.6, 140),
    step: () => tone(170 + Math.random() * 40, 0.04, 'square', 0.05),
    click: () => tone(660, 0.05, 'triangle', 0.08),
    heartbeat: () => { tone(70, 0.09, 'sine', 0.35, 50); setTimeout(() => tone(62, 0.08, 'sine', 0.25, 45), 130); },
    clutch: () => { tone(330, 0.12, 'triangle', 0.14, 660); setTimeout(() => tone(660, 0.2, 'triangle', 0.12, 990), 90); },
    unlock: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.12), i * 110)); },
  };
  const music = createMusic(audio, () => muted);

  // ---------- Input ----------
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'spur', KeyW: 'spur', ArrowDown: 'down', KeyS: 'down', KeyR: 'reroll', Space: 'grip', ShiftLeft: 'grip', ShiftRight: 'grip',
    Enter: 'ok', KeyM: 'mute', Escape: 'back', KeyC: 'rider',
  };
  const keyHeld = {};
  let pressed = {};
  let touchMode = false;
  const pointers = new Map();

  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    audio();
    if (!e.repeat) pressed[a] = true;
    keyHeld[a] = true;
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) keyHeld[a] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keyHeld) keyHeld[k] = false;
    pointers.clear();
  });

  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }
  function hitButton(p) {
    for (const b of currentButtons()) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
    }
    return null;
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio();
    if (e.pointerType !== 'mouse') touchMode = true;
    const p = toLogical(e);
    const b = hitButton(p);
    pointers.set(e.pointerId, b ? b.action : null);
    if (b) pressed[b.action] = true;
    else pressed.tap = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const b = hitButton(toLogical(e));
    const a = b ? b.action : null;
    if (a !== pointers.get(e.pointerId)) {
      pointers.set(e.pointerId, a);
      if (a) pressed[a] = true;
    }
  });
  const release = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function held(a) {
    if (keyHeld[a]) return true;
    for (const v of pointers.values()) if (v === a) return true;
    return false;
  }

  function currentButtons() {
    const list = [{ x: 904, y: 12, w: 44, h: 44, action: 'mute', icon: 'mute' }];
    if (state === 'select') {
      list.push({ x: 40, y: 200, w: 70, h: 110, action: 'left', label: '◀' });
      list.push({ x: 850, y: 200, w: 70, h: 110, action: 'right', label: '▶' });
      list.push({ x: 400, y: 452, w: 160, h: 56, action: 'ok', label: 'RIDE', primary: true });
      if (curWorld().animals.length > 1) list.push({ x: 140, y: 452, w: 240, h: 56, action: 'down', label: curAnimal().name.toUpperCase() + ' ▾' });
    }
    if (state === 'world') {
      list.push({ x: 40, y: 200, w: 70, h: 110, action: 'left', label: '◀' });
      list.push({ x: 850, y: 200, w: 70, h: 110, action: 'right', label: '▶' });
      list.push({ x: 400, y: 452, w: 160, h: 56, action: 'ok', label: 'GO', primary: true });
      list.push({ x: 580, y: 452, w: 200, h: 56, action: 'rider', label: 'YOUR RIDER' });
    }
    if (state === 'rider') {
      RIDER_SLOTS.forEach((sl, i) => {
        const y = RIDER_Y + i * RIDER_ROW;
        list.push({ x: 150, y, w: 34, h: RIDER_ROW - 3, action: 'opt' + i + 'l', label: '◀', size: 16 });
        list.push({ x: 318, y, w: 34, h: RIDER_ROW - 3, action: 'opt' + i + 'r', label: '▶', size: 16 });
      });
      list.push({ x: 36, y: 470, w: 140, h: 50, action: 'reroll', label: 'RANDOM' });
      list.push({ x: 196, y: 470, w: 156, h: 50, action: 'ok', label: 'DONE', primary: true });
    }
    if (state === 'chute' && R && R.rerolls > 0 && !R.gateOpening) {
      list.push({ x: 752, y: 14, w: 140, h: 48, action: 'reroll', label: 'REROLL' });
    }
    if (state === 'result' && stateT > 0.6) {
      list.push({ x: 280, y: 438, w: 190, h: 56, action: 'ok', label: result && result.unlockedNew ? 'NEXT PEN' : 'RIDE AGAIN', primary: true });
      list.push({ x: 490, y: 438, w: 190, h: 56, action: 'back', label: 'PENS' });
    }
    if (touchMode && (state === 'ride' || state === 'escape')) {
      list.push({ x: 16, y: 418, w: 104, h: 104, action: 'left', label: '◀' });
      list.push({ x: 132, y: 418, w: 104, h: 104, action: 'right', label: '▶' });
    }
    if (touchMode && state === 'ride') {
      list.push({ x: 724, y: 418, w: 104, h: 104, action: 'spur', label: 'SPUR' });
      list.push({ x: 840, y: 418, w: 104, h: 104, action: 'grip', label: 'GRIP' });
    }
    return list;
  }

  // ---------- Game state ----------
  const RIDER_Y = 78, RIDER_ROW = 27;
  let riderRow = 0;
  let riderFrom = 'world';
  let state = 'title';
  let stateT = 0;
  let sel = clamp(save.unlocked - 1, 0, BULLS.length - 1);
  let R = null;
  let result = null;
  let excite = 0.15;
  let gameT = 0;
  const particles = [];
  const popups = [];

  function setState(s) {
    state = s;
    stateT = 0;
  }

  function newRide() {
    const bull = rollBull(sel);
    R = {
      bull,
      rerolls: 1,
      combo: 0,
      bestCombo: 0,
      perfects: 0,
      goods: 0,
      pumped: false,
      fury: false,
      t: 0,
      lean: 0,
      leanVel: 0,
      stamina: 1,
      saves: 1,
      slowmo: 0,
      beatT: 0,
      control: 0,
      spurs: 0,
      badSpurs: 0,
      move: null,
      gap: 0.7,
      pitch: 0, hop: 0, yaw: 0, turn: 0, dip: 0, legPhase: 0, tailPhase: 0,
      bx: 480,
      facing: 1,
      shownDir: 0,
      spurWindow: false,
      intensity: 0,
      gate: 0,
      gateOpening: false,
      outcome: null,
      flyer: null,
      hat: null,
      runner: null,
      lastStep: null,
      stomped: false,
    };
    announceBull(bull);
  }

  function makeMove(b) {
    let type;
    if (Math.random() < b.spin) type = 'spin';
    else type = Math.random() < 0.5 ? 'front' : 'rear';
    const dir = type === 'front' ? 1 : type === 'rear' ? -1 : (Math.random() < 0.5 ? -1 : 1);
    return {
      type,
      dir,
      fake: type !== 'spin' && Math.random() < b.fake,
      tele: b.tele * rand(0.85, 1.15),
      dur: type === 'spin' ? rand(1.1, 1.5) : 0.55,
      // Full turns the animal spins with the rider on board; long spins sometimes go twice.
      turns: type === 'spin' && Math.random() < 0.35 ? 2 : 1,
      t: 0,
      stage: 'tele',
      peak: false,
      spurred: false,
    };
  }

  // Kicks hit a little harder than the base stats so bracing (which absorbs them) matters.
  const KICK = 1.1;

  // Advances the bull's bucking pattern. Returns the force on the rider's lean.
  function updateBull(dt, riding) {
    const b = R.bull;
    if (!R.move) {
      R.gap -= dt;
      if (R.gap <= 0) R.move = makeMove(b);
    }
    let F = 0, tPitch = 0, tHop = 0, tYaw = 0, tDip = 0, spinYaw = null;
    const m = R.move;
    R.shownDir = 0;
    R.spurWindow = false;
    if (m) {
      m.t += dt;
      if (m.stage === 'tele') {
        const k = Math.min(1, m.t / m.tele);
        R.shownDir = m.fake && k < 0.55 ? -m.dir : m.dir;
        // Wind-up: a deep crouch that loads the kick (visual only).
        tHop = 12 * k;
        tDip = 0.5 * k;
        tPitch = (m.type === 'front' ? 0.16 : m.type === 'rear' ? -0.16 : 0) * k * (m.fake && k < 0.55 ? -1 : 1);
        if (m.t >= m.tele) {
          m.stage = 'act';
          m.t = 0;
          if (riding) sfx.snort();
        }
      } else {
        const u = m.t / m.dur;
        R.shownDir = m.dir;
        if (m.type === 'spin') {
          const ramp = Math.min(1, u / 0.15);
          const s = (0.65 + 0.35 * Math.sin(u * Math.PI * 6)) * ramp;
          F = m.dir * b.power * KICK * 0.5 * s;
          // Eased full rotation: starts slow, whips around, settles facing forward again.
          const e = (1 - Math.cos(Math.PI * Math.min(1, u))) / 2;
          spinYaw = m.dir * Math.PI * 2 * m.turns * e;
          tHop = -28 * Math.abs(Math.sin(u * Math.PI * 6));
          tPitch = 0.2 * Math.sin(u * Math.PI * 6);
        } else {
          const s = Math.sin(Math.PI * u);
          F = m.dir * b.power * KICK * s;
          m.peak = s > 0.5;
          R.spurWindow = m.peak && !m.spurred;
          // The pose snaps up faster than the force curve and goes much higher.
          // u can overshoot 1 on the kick's last frame, making s slightly negative; pow() of that is NaN.
          // The throw that finishes a ride is a bigger kick than usual.
          const pose = Math.pow(Math.max(0, s), 0.55) * (m.throw ? 1.35 : 1);
          tPitch = (m.type === 'front' ? 0.72 : -0.72) * pose;
          tHop = -62 * pose;
          tYaw = m.dir * 0.28 * pose;
        }
        // Bull score counts the kick the bull threw, before your brace soaks it up.
        R.intensity += Math.abs(F) * dt;
        if (m.brace === 'perfect') F *= m.type === 'spin' ? 0.5 : 0.35;
        else if (m.brace === 'good') F *= m.type === 'spin' ? 0.8 : 0.65;
        if (m.t >= m.dur) {
          if (riding && m.brace !== 'perfect' && m.brace !== 'good') breakCombo();
          sfx.thump();
          dust(R.bx + rand(-60, 60), GROUND, 24, 1.6);
          R.slam = 1;
          if (m.type === 'spin') spinYaw = 0; // a whole number of turns: back where it started
          R.move = null;
          R.gap = rand(0.12, 0.5) / (b.tempo * (R.fury ? 1.3 : 1));
        }
      }
    }
    // Landing slam: the bull drives down hard for a split second after each kick.
    R.slam = Math.max(0, (R.slam || 0) - dt * 5);
    tHop += 14 * R.slam;
    const k = 1 - Math.exp(-dt * 22);
    R.pitch = lerp(R.pitch, tPitch, k);
    R.hop = lerp(R.hop, tHop, k);
    R.yaw = spinYaw !== null ? spinYaw : lerp(R.yaw, tYaw, 1 - Math.exp(-dt * 6));
    R.dip = lerp(R.dip, tDip, k);
    // One bad value would otherwise stick forever through the lerps and hide the bull.
    for (const key of ['pitch', 'hop', 'yaw', 'dip']) if (!Number.isFinite(R[key])) R[key] = 0;
    R.legPhase += dt * (m && m.stage === 'act' ? 20 : 4);
    R.tailPhase += dt * 7;
    return F;
  }

  const seatWorld = () => view3d.seatGame();
  // Game coordinates → HUD coordinates.
  const toScreen = (x, y) => view3d.project(wx(x), wy(y), 0);

  function popup(text, x, y, color, size) {
    popups.push({ text, x, y, color: color || '#fff', size: size || 26, life: 1.1, max: 1.1 });
  }

  function dust(x, y, n, power) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + rand(-10, 10), y: y - rand(0, 6), z: rand(-0.6, 0.6),
        vx: rand(-90, 90) * power, vy: rand(-110, -20) * power,
        r: rand(5, 13), life: rand(0.5, 1.0), max: 1, c: Math.random() < 0.5 ? '#c8a27a' : '#b38b62',
      });
    }
  }

  // ---------- State updates ----------
  function update(dt) {
    gameT += dt;
    stateT += dt;

    if (pressed.mute) {
      muted = !muted;
      store.set('bullrider_muted', muted);
      if (!muted) sfx.click();
    }

    // Battle music: muffled in the chute, full during the ride, trailing off after it.
    const musicMode = state === 'chute' ? 'chute' : state === 'ride' ? 'ride' : (state === 'dismount' || state === 'escape') ? 'fade' : 'off';
    music.update(musicMode, R && R.bull.kind, R && { t: R.t, fury: R.fury, lean: R.lean });

    if (state === 'title') {
      excite = lerp(excite, 0.25, dt);
      if (pressed.ok || pressed.tap || pressed.grip) {
        sfx.click();
        setState('world');
      }
    } else if (state === 'world') {
      if (pressed.left || pressed.right) {
        save.world = (save.world + (pressed.left ? WORLDS.length - 1 : 1)) % WORLDS.length;
        persist();
        sfx.click();
      }
      if (pressed.back) setState('title');
      if (pressed.rider) openRider();
      else if (pressed.ok || pressed.grip) {
        sfx.click();
        setState('select');
      }
    } else if (state === 'rider') {
      updateRider();
    } else if (state === 'select') {
      if (pressed.left) { sel = (sel + BULLS.length - 1) % BULLS.length; sfx.click(); }
      if (pressed.right) { sel = (sel + 1) % BULLS.length; sfx.click(); }
      if (pressed.spur || pressed.down) {
        const list = curWorld().animals;
        const i = list.indexOf(curAnimal().id);
        save.mounts[curWorld().id] = list[(i + (pressed.spur ? list.length - 1 : 1)) % list.length];
        persist();
        sfx.click();
      }
      if (pressed.back) setState('world');
      if (pressed.rider) openRider();
      else if ((pressed.ok || pressed.grip) && sel < save.unlocked) {
        sfx.click();
        newRide();
        setState('chute');
      }
    } else if (state === 'chute') {
      updateChute(dt);
    } else if (state === 'ride') {
      updateRide(dt);
    } else if (state === 'dismount') {
      updateDismount(dt);
    } else if (state === 'escape') {
      updateEscape(dt);
    } else if (state === 'result') {
      if (stateT > 0.6 && (pressed.ok || pressed.grip)) {
        sfx.click();
        newRide();
        setState('chute');
      } else if (stateT > 0.6 && pressed.back) {
        sfx.click();
        setState('select');
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.vx *= 1 - dt * 2;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt;
      p.y -= 40 * dt;
      if (p.life <= 0) popups.splice(i, 1);
    }
    excite = Math.max(0.1, excite - dt * 0.15);
    envFade = Math.max(0, envFade - dt * 3);
  }

  function openRider() {
    sfx.click();
    riderFrom = state;
    setState('rider');
  }

  function updateRider() {
    const n = RIDER_SLOTS.length;
    if (pressed.spur) riderRow = (riderRow + n - 1) % n;
    if (pressed.down) riderRow = (riderRow + 1) % n;
    let changed = pressed.spur || pressed.down;
    const cycle = (i, d) => {
      const sl = RIDER_SLOTS[i];
      save.rider[sl.id] = (save.rider[sl.id] + d + sl.options.length) % sl.options.length;
      riderRow = i;
      changed = true;
    };
    if (pressed.left) cycle(riderRow, -1);
    if (pressed.right) cycle(riderRow, 1);
    for (let i = 0; i < n; i++) {
      if (pressed['opt' + i + 'l']) cycle(i, -1);
      if (pressed['opt' + i + 'r']) cycle(i, 1);
    }
    if (pressed.reroll) {
      for (const sl of RIDER_SLOTS) save.rider[sl.id] = Math.floor(Math.random() * sl.options.length);
      changed = true;
    }
    if (changed) {
      applyRider();
      persist();
      sfx.click();
    }
    if (pressed.ok || pressed.back || pressed.rider) {
      sfx.click();
      setState(riderFrom);
    }
  }

  function updateChute(dt) {
    R.legPhase += dt * 2;
    R.tailPhase += dt * 5;
    R.hop = Math.sin(gameT * 3) * 1.5;
    if (pressed.back) { setState('select'); return; }
    if (pressed.reroll && R.rerolls > 0 && !R.gateOpening) {
      R.bull = rollBull(R.bull.tier);
      R.rerolls--;
      announceBull(R.bull);
      dust(R.bx, GROUND, 14, 1);
    }
    if (!R.gateOpening && (pressed.grip || pressed.ok || pressed.tap)) {
      R.gateOpening = true;
      sfx.gate();
      excite = 0.8;
    }
    if (R.gateOpening) {
      R.gate = Math.min(1, R.gate + dt * 2.2);
      if (R.gate >= 1) setState('ride');
    }
  }

  function updateRide(dt) {
    if (pressed.back) { setState('select'); return; }
    const b = R.bull;
    const STEP = 1 / 120;
    // Slow motion just after a clutch save.
    if (R.slowmo > 0) {
      R.slowmo = Math.max(0, R.slowmo - dt);
      dt *= 0.35;
    }
    if (pressed.left) tryBrace(-1);
    if (pressed.right) tryBrace(1);
    if (!R.fury && R.t >= RIDE_TIME - 2) {
      R.fury = true;
      excite = 1;
      popup('FINAL STRETCH!', 480, 170, '#ff9b3d', 30);
    }
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(STEP, remaining);
      remaining -= h;
      const F = updateBull(h, true);
      const input = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      // Grip drains while held; empty it and your arm pumps out until it refills to 40%.
      // It refills fastest while you're balanced.
      const grip = held('grip') && !R.pumped && R.stamina > 0;
      const balanced = Math.abs(R.lean) < 0.35;
      R.stamina = clamp(R.stamina + (grip ? -0.22 : balanced ? 0.36 : 0.15) * h, 0, 1);
      if (grip && R.stamina <= 0) {
        R.pumped = true;
        sfx.miss();
        popup('ARM PUMP!', 480, 200, '#ff6b4a', 26);
      }
      if (R.pumped && R.stamina >= 0.4) R.pumped = false;
      const force = F * (grip ? 0.45 : 1);
      const jitter = (Math.random() - 0.5) * b.power * 0.3;
      R.leanVel += (force + 1.2 * R.lean + input * 11 - 3.6 * R.leanVel + jitter) * h;
      R.lean += R.leanVel * h;
      if (Math.abs(R.lean) < 0.35) R.control += h;
      R.t += h;
      if (Math.abs(R.lean) >= 1) {
        if (R.saves > 0) { clutchSave(); continue; }
        buckedOff();
        return;
      }
      if (R.t >= RIDE_TIME) { qualified(); return; }
    }

    if (Math.abs(R.lean) > 0.7) {
      R.beatT -= dt;
      if (R.beatT <= 0) { sfx.heartbeat(); R.beatT = 0.42; }
    } else {
      R.beatT = 0;
    }

    if (pressed.spur) {
      const m = R.move;
      const s = view3d.seatScreen();
      if (m && m.stage === 'act' && m.type !== 'spin' && m.peak && !m.spurred) {
        m.spurred = true;
        R.spurs++;
        sfx.spur();
        excite = Math.min(1, excite + 0.25);
        popup('SPUR! +' + 3, s.x, s.y - 80, '#ffd34d', 30);
      } else {
        R.badSpurs++;
        R.leanVel += (Math.random() < 0.5 ? -1 : 1) * 0.6;
        sfx.miss();
        popup('off-beat', s.x, s.y - 80, '#ff9b8a', 20);
      }
    }
    excite = Math.max(excite, 0.35 + 0.4 * (R.t / RIDE_TIME));
  }

  // Bracing: tap the arrow's direction as the ring closes (the kick landing).
  const BRACE_PERFECT = [-0.12, 0.08], BRACE_GOOD = [-0.25, 0.15];
  function tryBrace(dir) {
    const m = R.move;
    if (!m || m.brace) return;
    // Seconds from the kick landing: negative means early.
    const delta = m.stage === 'tele' ? -(m.tele - m.t) : m.t;
    if (delta < BRACE_GOOD[0] || delta > BRACE_GOOD[1]) return;
    const s = view3d.seatScreen();
    if (dir === m.dir) {
      // Leaning into the kick (often a fake-out) before it lands.
      if (delta < 0) {
        m.brace = 'wrong';
        breakCombo();
        popup('WRONG WAY!', s.x, s.y - 100, '#ff6b4a', 24);
        sfx.miss();
      }
      return;
    }
    const perfect = delta >= BRACE_PERFECT[0] && delta <= BRACE_PERFECT[1];
    m.brace = perfect ? 'perfect' : 'good';
    R.combo++;
    R.bestCombo = Math.max(R.bestCombo, R.combo);
    const tag = R.combo >= 2 ? '  x' + R.combo : '';
    if (perfect) {
      R.perfects++;
      R.stamina = Math.min(1, R.stamina + 0.15);
      excite = Math.min(1, excite + 0.15);
      sfx.perfect();
      popup('PERFECT!' + tag, s.x, s.y - 100, '#ffd34d', 28);
    } else {
      R.goods++;
      sfx.good();
      popup('GOOD' + tag, s.x, s.y - 100, '#7dff9b', 22);
    }
  }
  function breakCombo() {
    if (R.combo >= 3) {
      const s = view3d.seatScreen();
      popup('combo lost', s.x, s.y - 70, '#ff9b8a', 18);
    }
    R.combo = 0;
  }

  // Once per ride the rider claws back into the saddle instead of falling.
  function clutchSave() {
    R.saves--;
    const d = sign(R.lean);
    R.lean = d * 0.55;
    R.leanVel = -d * 1.2;
    R.stamina = 1;
    R.move = null;
    R.gap = 0.9;
    R.slowmo = 0.9;
    sfx.clutch();
    excite = 1;
    popup('CLUTCH SAVE!', 480, 150, '#7dff9b', 40);
  }

  function buckedOff() {
    R.outcome = 'bucked';
    const d = sign(R.lean);
    // The animal finishes you off with one big kick toward the side you're falling;
    // updateThrow flings the rider off the seat as it snaps up.
    R.move = { type: d > 0 ? 'front' : 'rear', dir: d, fake: false, tele: 0, dur: 0.5, turns: 1, t: 0, stage: 'act', peak: false, spurred: true, throw: true };
    R.gap = 99;
    R.lastSeat = seatWorld();
    R.seatVel = { x: 0, y: 0 };
    sfx.gasp();
    excite = 1;
    popup('BUCKED OFF!', 480, 140, '#ff6b4a', 44);
    setState('dismount');
  }

  function qualified() {
    R.outcome = 'qualified';
    R.t = RIDE_TIME;
    const s = seatWorld();
    const d = R.bx > 480 ? 1 : -1;
    // A controlled leap: push off upward and out toward the camera, landing on your feet.
    R.flyer = { x: s.x, y: s.y, vx: -d * rand(90, 120), vy: -430, rot: 0, vr: 0, feet: true, jump: true, z: 0 };
    // The animal stops bucking so the dismount is the rider's own jump.
    R.move = null;
    R.gap = 99;
    sfx.buzzer();
    sfx.cheer();
    excite = 1;
    popup('8 SECONDS!', 480, 140, '#ffd34d', 48);
    setState('dismount');
  }

  function updateDismount(dt) {
    R.shake = Math.max(0, (R.shake || 0) - dt * 1.5);
    if (!R.flyer) { updateThrow(dt); return; }
    updateBull(dt, false);
    const f = R.flyer;
    if (!f.jump) { updateTumble(dt); return; }
    // Qualified: the rider's own leap off the side, landing on their feet.
    f.vy += 1100 * dt;
    f.x = clamp(f.x + f.vx * dt, FENCE_L + 30, FENCE_R - 30);
    f.y += f.vy * dt;
    f.z = Math.min(0.75, f.z + dt * 1.4);
    // Feet touch down when the hips are a crouch's height above the ground.
    if (f.y >= GROUND - 65 && f.vy > 0) {
      sfx.step();
      setTimeout(sfx.step, 70);
      dust(f.x, GROUND, 10, 0.8);
      R.yaw = Math.atan2(Math.sin(R.yaw), Math.cos(R.yaw));
      R.runner = { x: f.x, y: GROUND, down: 0, land: 0.3, z: f.z, phase: 0, safe: false, climb: 0, face: f.x < 480 ? -1 : 1 };
      R.move = null;
      R.chase = 0;
      setState('escape');
      popup('Get to the fence!', 480, 196, '#fff', 24);
    }
  }

  // Rider still on the seat while the throw kick snaps up; launched with the seat's own velocity.
  function updateThrow(dt) {
    updateBull(dt, false);
    const s = seatWorld();
    if (dt > 0) {
      R.seatVel = { x: clamp((s.x - R.lastSeat.x) / dt, -600, 600), y: clamp((s.y - R.lastSeat.y) / dt, -700, 700) };
    }
    R.lastSeat = s;
    const d = sign(R.lean);
    R.lean = lerp(R.lean, d * 1.3, 1 - Math.exp(-dt * 8));
    const m = R.move;
    if (m && m.throw && m.t < m.dur * 0.3) return;
    const v = R.seatVel;
    R.flyer = {
      x: s.x, y: s.y, z: 0, vz: rand(0.3, 0.7),
      vx: v.x * 0.8 + d * rand(260, 360), vy: Math.min(0, v.y * 0.8) - rand(420, 520),
      rot: R.lean * 0.9, vr: d * rand(7, 11), flail: 1, t: 0, rest: 0, grounded: false,
    };
    R.hat = { x: s.x, y: s.y - 60, vx: d * rand(80, 200) + rand(-50, 50), vy: rand(-620, -500), rot: 0, vr: rand(-9, 9), landed: false };
    R.shake = 0.35;
    sfx.thump();
  }

  const TUMBLE_GRAVITY = 1500;
  // Nearest angle to `a` that points the same way as `base`.
  const nearestAngle = (a, base) => base + Math.PI * 2 * Math.round((a - base) / (Math.PI * 2));

  function tumbleImpact(f, speed) {
    if (speed > 500) sfx.fall();
    else sfx.thump();
    dust(f.x, GROUND, Math.round(clamp(speed / 40, 4, 20)), clamp(speed / 500, 0.5, 1.6));
    R.shake = Math.max(R.shake, Math.min(0.5, speed / 1400));
  }

  // A bucked rider: thrown through the air, bouncing off the dirt and the fences,
  // tumbling and sliding until they come to rest on their back.
  function updateTumble(dt) {
    const f = R.flyer;
    f.t += dt;
    f.vy += TUMBLE_GRAVITY * dt;
    f.vx *= 1 - dt * 0.15;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.rot += f.vr * dt;
    f.z = f.grounded ? lerp(f.z, 0.3, 1 - Math.exp(-dt * 3)) : clamp(f.z + f.vz * dt, 0, 0.7);
    updateHat(dt);

    const minX = FENCE_L + 30, maxX = FENCE_R - 30;
    if ((f.x < minX && f.vx < 0) || (f.x > maxX && f.vx > 0)) {
      f.x = clamp(f.x, minX, maxX);
      tumbleImpact(f, Math.abs(f.vx));
      f.vr -= f.vx / 60;
      f.vx *= -0.4;
    }

    // Body as a capsule: hips sit lower lying flat than sitting up.
    const reach = 16 + 32 * Math.abs(Math.cos(f.rot));
    const flat = nearestAngle(f.rot, -Math.PI / 2);
    if (f.y >= GROUND - reach) {
      f.y = GROUND - reach;
      if (f.vy > 220) {
        // Bounce: most of the energy goes into the dirt, and the skid turns into a tumble.
        tumbleImpact(f, f.vy);
        f.vy *= -0.35;
        f.vx *= 0.65;
        f.vr = f.vr * 0.4 + f.vx / 45;
        f.grounded = false;
      } else {
        f.vy = 0;
        f.grounded = true;
        f.vx *= Math.exp(-dt * 4);
        // Roll while sliding fast, then settle flat on the back.
        const k = 1 - Math.exp(-dt * 6);
        f.vr = lerp(f.vr, Math.abs(f.vx) > 120 ? f.vx / 30 : (flat - f.rot) * 8, k);
        if (Math.abs(f.vx) > 60 && Math.random() < dt * 20) dust(f.x, GROUND, 1, 0.5);
      }
    }
    f.flail = f.grounded ? Math.max(0, f.flail - dt * 1.5) : Math.min(1, f.flail + dt * 4);

    const still = f.grounded && Math.abs(f.vx) < 25 && Math.abs(flat - f.rot) < 0.15;
    f.rest = still ? f.rest + dt : 0;
    if (f.rest > 0.3 || f.t > 4) {
      R.yaw = Math.atan2(Math.sin(R.yaw), Math.cos(R.yaw)); // settle by the shortest way round
      R.runner = { x: f.x, y: GROUND, down: 0.5, z: f.z, phase: 0, safe: false, climb: 0, face: f.x < 480 ? -1 : 1 };
      R.move = null;
      R.chase = 0;
      setState('escape');
      popup('RUN for the fence!', 480, 196, '#fff', 24);
    }
  }

  function updateHat(dt) {
    const h = R.hat;
    if (!h || h.landed) return;
    h.vy += 900 * dt;
    h.vx *= 1 - dt * 0.8;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.rot += h.vr * dt;
    if (h.y >= GROUND - 4) {
      h.y = GROUND - 4;
      if (h.vy > 200) {
        h.vy *= -0.3;
        h.vx *= 0.6;
        h.vr *= 0.5;
      } else {
        h.landed = true;
        h.rot = 0;
      }
    }
  }

  const RUN_SPEED = 250; // px/s while holding a direction
  const SPRINT_STEP = 26; // extra px per alternating tap

  function updateEscape(dt) {
    const r = R.runner;
    R.shake = Math.max(0, (R.shake || 0) - dt * 1.5);
    updateHat(dt);
    // Rise out of the landing crouch and drift back to the running line.
    if (r.land > 0) r.land = Math.max(0, r.land - dt);
    if (r.z != null) r.z = lerp(r.z, 0.3, 1 - Math.exp(-dt * 3));

    // Bull settles, then charges the rider.
    const k = 1 - Math.exp(-dt * 10);
    R.pitch = lerp(R.pitch, 0, k);
    R.hop = lerp(R.hop, 0, k);
    R.yaw = lerp(R.yaw, 0, k);
    R.dip = lerp(R.dip, stateT > 0.7 ? 0.35 : 0, k);
    R.tailPhase += dt * 7;

    if (r.down > 0) {
      r.down -= dt;
    } else if (!r.safe && !R.stomped) {
      // Hold ← or → to run toward that fence; alternating taps add a sprint burst.
      const input = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      if (input) {
        r.face = input;
        r.x += input * RUN_SPEED * dt;
        r.phase += dt * 9;
        r.stepT = (r.stepT || 0) + dt;
        if (r.stepT > 0.16) {
          r.stepT = 0;
          sfx.step();
          dust(r.x, GROUND, 2, 0.4);
        }
      }
      const tap = pressed.left ? 'left' : pressed.right ? 'right' : null;
      if (tap && tap !== R.lastStep) {
        R.lastStep = tap;
        r.face = tap === 'left' ? -1 : 1;
        r.x += r.face * SPRINT_STEP;
        r.phase += 1;
      }
      if (r.x <= FENCE_L + 18 || r.x >= FENCE_R - 18) {
        const side = r.x < 480 ? -1 : 1;
        r.x = side < 0 ? FENCE_L + 18 : FENCE_R - 18;
        r.face = side;
        r.safe = true;
        sfx.cheer();
        const sp = toScreen(r.x, FENCE_TOP - 120);
        popup('SAFE!', sp.x - side * 70, sp.y, '#7dff9b', 30);
      }
    }
    const dir = r.x < 480 ? -1 : 1;

    const bullSpeed = 150 + R.bull.tier * 14;
    if (r.safe) {
      r.climb = Math.min(1, r.climb + dt * 3);
      R.facing = -dir;
      R.bx += R.facing * 60 * dt;
      R.legPhase += dt * 5;
    } else if (stateT > 1.0 && !R.stomped) {
      R.facing = sign(r.x - R.bx);
      R.bx += R.facing * bullSpeed * dt;
      R.chase += bullSpeed * dt;
      R.legPhase += dt * 16;
      const head = R.bx + R.facing * 120;
      // The bull needs a short run-up before it can hit you, so landing next to it isn't an instant stomp.
      if (R.chase > 70 && r.down <= 0 && Math.abs(head - r.x) < 24) {
        R.stomped = true;
        sfx.fall();
        dust(r.x, GROUND, 20, 1.6);
        const sp = toScreen(r.x, GROUND - 180);
        popup('STOMPED! -5', sp.x, sp.y, '#ff6b4a', 30);
        r.down = 99;
        r.x += R.facing * 70;
        R.stompT = stateT;
      }
    }
    R.bx = clamp(R.bx, FENCE_L + 110, FENCE_R - 110);
    R.turn = lerp(R.turn, R.facing < 0 ? Math.PI : 0, 1 - Math.exp(-dt * 5));

    const done = (r.safe && r.climb >= 1 && stateT > 1.2) || (R.stomped && stateT - R.stompT > 1.4) || stateT > 9;
    if (done) finishRide();
  }

  function finishRide() {
    const idx = R.bull.tier;
    const res = {
      bull: R.bull,
      idx,
      outcome: R.outcome,
      time: R.t,
      stomped: R.stomped,
      spurs: R.spurs,
      perfects: R.perfects,
      bestCombo: R.bestCombo,
      unlockedNew: null,
      newBest: false,
    };
    if (R.outcome === 'qualified') {
      const controlFrac = R.control / RIDE_TIME;
      let rider = 20 + 14 * controlFrac + Math.min(9, R.spurs * 3) + Math.min(8, R.perfects * 1.5 + R.goods * 0.5)
        + Math.min(6, R.bestCombo) - Math.min(6, R.badSpurs) - (R.stomped ? 5 : 0);
      rider = clamp(rider, 10, 50);
      const bull = clamp(R.bull.base + (R.intensity / RIDE_TIME / (R.bull.power * KICK) - 0.2) * 8 + rand(-1, 1), 20, 50);
      res.rider = Math.round(rider * 2) / 2;
      res.bullPts = Math.round(bull * 2) / 2;
      res.total = res.rider + res.bullPts;
      res.control = controlFrac;
      if (res.total > save.best[idx]) {
        save.best[idx] = res.total;
        res.newBest = true;
      }
      if (res.total >= UNLOCK_SCORE && idx + 1 === save.unlocked && save.unlocked < BULLS.length) {
        save.unlocked++;
        res.unlockedNew = BULLS[idx + 1];
        sel = idx + 1;
        setTimeout(sfx.unlock, 400);
      }
      persist();
    }
    result = res;
    setState('result');
  }

  // ---------- Drawing helpers ----------
  function ellipse(x, y, rx, ry, color, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function text(str, x, y, size, color, align, font, stroke) {
    const title = font === TITLE_FONT;
    // Body text never drops below 15px so it stays legible.
    ctx.font = `${title ? '' : '700 '}${title ? size : Math.max(15, size)}px ${font || BODY_FONT}`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    // Every label gets a dark outline and a soft drop shadow so it reads over the arena.
    ctx.fillStyle = 'rgba(30,14,4,0.7)';
    ctx.fillText(str, x + 1.5, y + 2);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(stroke || 0, 4);
    ctx.strokeStyle = '#1e0e04';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color || '#fff';
    ctx.fillText(str, x, y);
  }
  function limb(points, color, width) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawCue() {
    if (!R.shownDir) return;
    const m = R.move;
    const s = view3d.seatScreen();
    const leanDir = -R.shownDir;
    const x = s.x + leanDir * 90, y = s.y - 130;
    const tele = m && m.stage === 'tele';
    const pulse = 1 + Math.sin(gameT * 18) * 0.08;
    ellipse(x, y + 8, 46, 46, 'rgba(20,10,4,0.55)');
    if (tele) {
      // Ring closes in on the arrow as the kick approaches.
      const k = clamp(m.t / m.tele, 0, 1);
      ctx.beginPath();
      ctx.arc(x, y + 8, 46 + 44 * (1 - k), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.6 * k})`;
      ctx.lineWidth = 3 + 3 * k;
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(leanDir * pulse, pulse);
    ctx.globalAlpha = tele ? 0.95 : 0.55;
    ctx.beginPath();
    ctx.moveTo(-26, -12);
    ctx.lineTo(6, -12);
    ctx.lineTo(6, -24);
    ctx.lineTo(30, 0);
    ctx.lineTo(6, 24);
    ctx.lineTo(6, 12);
    ctx.lineTo(-26, 12);
    ctx.closePath();
    ctx.fillStyle = m && m.brace === 'perfect' ? '#ffd34d' : m && m.brace === 'good' ? '#7dff9b' : m && m.type === 'spin' ? '#4dd2ff' : '#ff5a3c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    text(m && m.type === 'spin' ? 'SPIN!' : 'LEAN', x, y + 36, 14, '#fff', 'center', BODY_FONT, 4);
  }

  function drawBar(x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(20,10,4,0.7)';
    roundRect(x - 3, y - 3, w + 6, h + 6, 6);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(x, y, Math.max(0.001, w * frac), h, 4);
    ctx.fill();
    if (label) text(label, x + w / 2, y + h / 2 + 1, 12, '#fff', 'center', BODY_FONT, 3);
  }

  function drawRideHud() {
    // Timer
    const t = Math.min(R.t, RIDE_TIME);
    text(t.toFixed(2), 480, 40, 46, t >= RIDE_TIME ? '#ffd34d' : '#fff', 'center', TITLE_FONT, 6);
    drawBar(330, 72, 300, 10, t / RIDE_TIME, t > 6 ? '#ffd34d' : '#e8d3a8');
    for (let i = 1; i < RIDE_TIME; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(330 + (300 * i) / RIDE_TIME - 1, 72, 2, 10);
    }

    // Bull name
    text(R.bull.name, 24, 30, 24, '#fff', 'left', TITLE_FONT, 5);
    text(R.bull.rarity.name, 24, 58, 14, R.bull.rarity.color, 'left', BODY_FONT, 3);
    ctx.font = `14px ${BODY_FONT}`;
    text('  •  ' + R.bull.rank + '  •  Spurs: ' + R.spurs, 24 + ctx.measureText(R.bull.rarity.name).width, 58, 14, '#f1d9a8', 'left', BODY_FONT, 3);

    // Balance meter
    const bx = 300, by = 476, bw = 360, bh = 18;
    ctx.fillStyle = 'rgba(20,10,4,0.75)';
    roundRect(bx - 4, by - 4, bw + 8, bh + 8, 8);
    ctx.fill();
    const zone = (from, to, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(bx + bw / 2 + (from * bw) / 2, by, ((to - from) * bw) / 2, bh);
    };
    zone(-1, -0.7, '#c0392b'); zone(0.7, 1, '#c0392b');
    zone(-0.7, -0.35, '#e6a23c'); zone(0.35, 0.7, '#e6a23c');
    zone(-0.35, 0.35, '#3fae5a');
    const mx = bx + bw / 2 + (clamp(R.lean, -1, 1) * bw) / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(mx, by - 2);
    ctx.lineTo(mx - 9, by - 14);
    ctx.lineTo(mx + 9, by - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(mx - 2, by - 2, 4, bh + 4);
    text('BALANCE', 480, by + bh + 16, 12, '#f1d9a8', 'center', BODY_FONT, 3);

    // Grip stamina
    const gripping = held('grip') && !R.pumped && R.stamina > 0;
    drawBar(330, 102, 300, 12, R.stamina, R.pumped ? '#8a3a2a' : gripping ? '#4dd2ff' : R.stamina < 0.2 ? '#c0392b' : '#5aa0d8',
      R.pumped ? 'ARM PUMP — let go!' : gripping ? 'GRIPPING' : 'GRIP');

    if (R.combo >= 2) {
      text('COMBO x' + R.combo, 676, by + bh / 2, 18, R.combo >= 5 ? '#ffd34d' : '#7dff9b', 'left', BODY_FONT, 4);
    }

    text(R.saves > 0 ? 'CLUTCH SAVE READY' : 'NO SAVES LEFT', 480, 132, 12, R.saves > 0 ? '#7dff9b' : '#8a7a66', 'center', BODY_FONT, 3);

    if (R.bull.tier === 0 && R.t < 3.5) {
      text('Lean the way the arrow points. Tap it right as the ring closes to brace.', 480, 444, 15, '#fff', 'center', BODY_FONT, 4);
    }
  }

  function drawButtons() {
    for (const b of currentButtons()) {
      const down = held(b.action);
      if (b.icon === 'mute') {
        ctx.fillStyle = 'rgba(20,10,4,0.55)';
        roundRect(b.x, b.y, b.w, b.h, 10);
        ctx.fill();
        // Speaker glyph
        const cx = b.x + 14, cy = b.y + b.h / 2;
        ctx.fillStyle = '#f1d9a8';
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 5); ctx.lineTo(cx, cy - 5); ctx.lineTo(cx + 8, cy - 12);
        ctx.lineTo(cx + 8, cy + 12); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 6, cy + 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#f1d9a8';
        ctx.lineWidth = 2.5;
        if (muted) {
          limb([[cx + 13, cy - 6], [cx + 23, cy + 6]], '#ff8b7a', 3);
          limb([[cx + 23, cy - 6], [cx + 13, cy + 6]], '#ff8b7a', 3);
        } else {
          ctx.beginPath(); ctx.arc(cx + 9, cy, 7, -0.9, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx + 9, cy, 13, -0.9, 0.9); ctx.stroke();
        }
        continue;
      }
      ctx.fillStyle = b.primary ? (down ? '#d99a2b' : '#f2b33d') : down ? 'rgba(255,230,180,0.45)' : 'rgba(20,10,4,0.5)';
      roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = b.primary ? '#7a4a10' : 'rgba(241,217,168,0.6)';
      ctx.stroke();
      const sz = b.size || (b.label.length > 2 ? 20 : 34);
      text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2, sz, b.primary ? '#fff' : '#f1d9a8', 'center', b.primary ? TITLE_FONT : BODY_FONT);
    }
  }

  function drawPopups() {
    for (const p of popups) {
      ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
      text(p.text, p.x, p.y, p.size, p.color, 'center', TITLE_FONT, 6);
    }
    ctx.globalAlpha = 1;
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(28,14,6,0.86)';
    roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c99a4b';
    ctx.stroke();
  }

  function controlsHelp(y) {
    const rows = [
      ['← →  or  A D', 'Lean; tap as the ring closes to brace'],
      ['SPACE', 'Grip harder (uses stamina)'],
      ['↑  or  W', 'Spur at a kick\'s peak for style'],
      ['hold ← or →', 'Run to a fence after the ride'],
    ];
    rows.forEach((r, i) => {
      text(r[0], 470, y + i * 26, 16, '#ffd34d', 'right', BODY_FONT);
      text(r[1], 490, y + i * 26, 16, '#f1e4c8', 'left', BODY_FONT);
    });
  }

  // ---------- Screens ----------
  // The title screen tours the worlds; otherwise the current world's arena is shown.
  const TITLE_ENV_TIME = 7;
  const TITLE_TOUR = [
    { env: 'stadium', kind: 'bull' }, { env: 'ocean', kind: 'whale' }, { env: 'sky', kind: 'dragon' },
    { env: 'farm', kind: 'cow' }, { env: 'canyon', kind: 'bronco' }, { env: 'ocean', kind: 'kraken' },
    { env: 'inferno', kind: 'bull' }, { env: 'farm', kind: 'chicken' },
  ];
  const TITLE_LOOK = { seed: 7, spots: null, blaze: null, horn: '#ffd34d', hornScale: 1.2, bulk: 1.06, aura: '#ffc93c' };
  let lastEnv = null;
  let envFade = 1;

  function sceneView() {
    const tour = TITLE_TOUR[Math.floor(gameT / TITLE_ENV_TIME) % TITLE_TOUR.length];
    const env = state === 'title' ? tour.env
      : state === 'world' || (state === 'rider' && riderFrom === 'world') ? curWorld().env || 'stadium'
      : R && state !== 'select' && state !== 'rider' ? R.bull.env : worldEnv(sel);
    const v = {
      env, mode: state, t: gameT, excite, particles,
      bull: null, riderMode: 'none', lean: 0, hasHat: true, spurGlow: false,
      flyer: null, runner: null, hat: null, gate: null, shake: 0,
    };
    if (state === 'title') {
      const t = gameT * 2.2;
      const s = Math.max(0, Math.sin(t));
      const front = Math.sin(t * 0.5) > 0;
      v.bull = { x: 480, hop: -30 * s, pitch: (front ? 0.38 : -0.38) * s, yaw: Math.sin(gameT * 0.7) * 0.4, legPhase: gameT * 8, tailPhase: gameT * 7, color: tour.kind === 'bull' ? BULLS[4].color : animalById(tour.kind).legendColor, dip: 0.2, look: TITLE_LOOK, kind: tour.kind };
    } else if (state === 'select' || state === 'world' || state === 'rider') {
      const locked = state === 'select' && sel >= save.unlocked;
      if (state === 'rider') v.riderMode = 'ride';
      v.bull = { x: 480, hop: Math.sin(gameT * 3) * 2, pitch: 0, yaw: Math.sin(gameT * 0.6) * 0.35 - 0.25, legPhase: gameT * 2, tailPhase: gameT * 5, color: locked ? '#151010' : curAnimal().preview || BULLS[sel].color, dip: 0.15, look: null, kind: curAnimal().id };
    } else if (R) {
      v.bull = { x: R.bx, hop: R.hop, pitch: R.pitch, yaw: R.yaw + R.turn, legPhase: R.legPhase, tailPhase: R.tailPhase, color: R.bull.color, dip: R.dip, look: R.bull.look, kind: R.bull.kind };
      v.lean = R.lean;
      v.spurGlow = R.spurWindow;
      v.hasHat = !R.hat;
      if (state === 'chute') v.gate = R.gate;
      if (state === 'chute' || state === 'ride') v.riderMode = 'ride';
      else if (state === 'dismount') {
        // Still on the seat while the throw kick winds up.
        v.riderMode = R.flyer ? 'fly' : 'ride';
        v.flyer = R.flyer;
      }
      else if (R.runner) { v.riderMode = 'run'; v.runner = R.runner; }
      if (R.hat && state !== 'ride') v.hat = R.hat;
      if (state === 'ride') v.shake = Math.max(0, -R.hop) / 62 * 0.06 + (R.slam || 0) * 0.14;
      else v.shake = R.shake || 0;
    }
    return v;
  }

  function render() {
    const v = sceneView();
    if (v.env !== lastEnv) {
      lastEnv = v.env;
      envFade = 1;
    }
    view3d.render(v);
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // Dip to black around arena changes.
    let fade = envFade;
    if (state === 'title') fade = Math.max(fade, ((gameT % TITLE_ENV_TIME) - (TITLE_ENV_TIME - 0.35)) / 0.35);
    if (fade > 0) {
      ctx.fillStyle = `rgba(10,5,2,${clamp(fade, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (state === 'ride' && R && Math.abs(R.lean) > 0.6) {
      const a = clamp((Math.abs(R.lean) - 0.6) / 0.4, 0, 1) * (0.55 + 0.15 * Math.sin(gameT * 15));
      const g = ctx.createRadialGradient(480, 270, 220, 480, 270, 600);
      g.addColorStop(0, 'rgba(200,20,10,0)');
      g.addColorStop(1, `rgba(200,20,10,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (state === 'title') {
      text('BULL RIDER', 480, 110, 84, '#ffd34d', 'center', TITLE_FONT, 10);
      text('Eight seconds. One hand. No mercy.', 480, 168, 20, '#fff', 'center', BODY_FONT, 5);
      panel(250, 470, 460, 48);
      const blink = Math.sin(gameT * 4) > -0.3;
      if (blink) text(touchMode ? 'Tap to start' : 'Press ENTER to start', 480, 495, 22, '#ffd34d', 'center', TITLE_FONT);
    } else if (state === 'world') {
      renderWorld();
    } else if (state === 'select') {
      renderSelect();
    } else if (state === 'rider') {
      renderRider();
    } else if (R) {
      if (state === 'ride') drawCue();
      if (state === 'chute') {
        const b = R.bull;
        panel(220, 14, 520, 250);
        text(b.name, 480, 46, 32, b.rarity.color, 'center', TITLE_FONT);
        const tags = [b.rarity.name.toUpperCase()].concat(b.traits.map((x) => x.name)).join('  •  ');
        text(tags, 480, 78, 15, b.rarity.color, 'center', BODY_FONT);
        const bonus = b.base - BULLS[b.tier].base;
        text(b.desc + '  (' + b.animal.name.toLowerCase() + ' score ' + (bonus < 0 ? '' : '+') + bonus + ')', 480, 100, 14, '#f1e4c8', 'center', BODY_FONT);
        text(touchMode ? 'Tap to nod — open the gate!' : 'Press SPACE to nod — open the gate!', 480, 128, 18, '#fff', 'center', BODY_FONT);
        controlsHelp(162);
        if (R.rerolls > 0 && !R.gateOpening && !touchMode) text('R: reroll', 822, 72, 12, '#c99a4b', 'center', BODY_FONT, 3);
      }
      if (state === 'ride' || state === 'dismount') drawRideHud();
      if (state === 'escape' && R.runner && !R.runner.safe && !R.stomped && R.runner.down <= 0) {
        const blink = Math.sin(gameT * 10) > 0;
        if (blink) text('Hold ← or → to RUN to a fence!', 480, 100, 26, '#fff', 'center', TITLE_FONT, 6);
      }
      if (state === 'result') renderResult();
    }
    drawPopups();
    drawButtons();
  }

  function renderWorld() {
    const w = curWorld();
    panel(170, 24, 620, 190);
    text('CHOOSE YOUR WORLD', 480, 52, 18, '#c99a4b', 'center', TITLE_FONT);
    text(w.name, 480, 94, 44, w.color, 'center', TITLE_FONT);
    text(w.desc, 480, 136, 16, '#fff', 'center', BODY_FONT);
    text('Ride: ' + w.animals.map((id) => animalById(id).name).join(', '), 480, 168, 16, '#f1d9a8', 'center', BODY_FONT);
    text((save.world + 1) + ' / ' + WORLDS.length, 480, 196, 14, '#c99a4b', 'center', BODY_FONT);
    if (!touchMode) text('← → to browse   •   ENTER to pick   •   C: your rider', 480, 424, 15, '#fff', 'center', BODY_FONT, 4);
    for (let i = 0; i < WORLDS.length; i++) {
      ellipse(450 + i * 20, 528, 5, 5, i === save.world ? '#ffd34d' : '#f1d9a8');
    }
  }

  function renderRider() {
    panel(20, 16, 348, 448);
    text('YOUR RIDER', 194, 46, 24, '#ffd34d', 'center', TITLE_FONT);
    RIDER_SLOTS.forEach((sl, i) => {
      const y = RIDER_Y + i * RIDER_ROW;
      const cy = y + (RIDER_ROW - 3) / 2;
      if (i === riderRow) {
        ctx.fillStyle = 'rgba(255,211,77,0.16)';
        roundRect(30, y - 1, 328, RIDER_ROW - 2, 8);
        ctx.fill();
      }
      text(sl.name, 40, cy + 1, 14, i === riderRow ? '#ffd34d' : '#f1d9a8', 'left', BODY_FONT);
      const [name, val] = riderOption(sl);
      if (val && val[0] === '#') {
        ellipse(203, cy, 8, 8, val);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1a0d06';
        ctx.stroke();
      }
      text(name, val && val[0] === '#' ? 260 : 251, cy + 1, 13, '#fff', 'center', BODY_FONT);
    });
    if (!touchMode) text('↑ ↓ pick   ← → change   R random   ENTER done', 480, 528, 14, '#fff', 'center', BODY_FONT, 4);
  }

  function renderSelect() {
    const b = BULLS[sel];
    const locked = sel >= save.unlocked;

    panel(170, 24, 620, 168);
    text('CHOOSE YOUR RIDE', 480, 52, 18, '#c99a4b', 'center', TITLE_FONT);
    text(locked ? '???' : b.rank + ' Pen', 480, 92, 42, locked ? '#8a7a66' : '#ffd34d', 'center', TITLE_FONT);
    text(b.rank + '  •  ' + (sel + 1) + ' / ' + BULLS.length + '  •  ' + ENVIRONMENTS[worldEnv(sel)].name, 480, 128, 16, '#f1d9a8', 'center', BODY_FONT);
    // Difficulty stars
    for (let i = 0; i < BULLS.length; i++) {
      drawStar(420 + i * 30, 156, 10, i <= sel ? '#ffd34d' : 'rgba(255,255,255,0.18)');
    }
    text(
      locked ? `Score ${UNLOCK_SCORE}+ in the ${BULLS[sel - 1].rank} pen to unlock` : 'Random draw. Legendary headliner: ' + (curAnimal().legends ? curAnimal().legends[sel] : b.name),
      480, 180, 15, locked ? '#ff9b8a' : '#fff', 'center', BODY_FONT,
    );
    const best = save.best[sel];
    text(best ? 'Best: ' + best.toFixed(1) + ' pts' : 'Best: —', 480, 222, 18, '#fff', 'center', BODY_FONT, 4);
    const an = curAnimal();
    text((touchMode || curWorld().animals.length < 2 ? '' : '↑ ↓  ') + 'Riding: ' + an.name + '  —  ' + an.desc, 480, 366, 15, '#fff', 'center', BODY_FONT, 4);
    // Draw odds (improve with pity).
    const odds = rarityOdds();
    let ox = 480 - 300;
    ctx.fillStyle = 'rgba(20,10,4,0.6)';
    roundRect(170, 384, 620, 36, 10);
    ctx.fill();
    RARITIES.forEach((r, i) => {
      text(r.name + ' ' + (odds[i] * 100).toFixed(odds[i] < 0.1 ? 1 : 0) + '%', ox + 75 + i * 150, 402, 15, r.color, 'center', BODY_FONT, 3);
    });
    if (save.pity > 0) text('Luck building: +' + Math.min(save.pity, PITY_MAX) + ' (resets on Epic or better)', 480, 432, 13, '#c99a4b', 'center', BODY_FONT, 3);

    for (let i = 0; i < BULLS.length; i++) {
      ellipse(440 + i * 20, 528, 5, 5, i === sel ? '#ffd34d' : i < save.unlocked ? '#f1d9a8' : '#5a4636');
    }
  }

  function drawStar(x, y, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function renderResult() {
    const r = result;
    const a = clamp(stateT * 3, 0, 1);
    ctx.globalAlpha = a;
    panel(250, 90, 460, 330);
    if (r.outcome === 'qualified') {
      text('QUALIFIED RIDE', 480, 126, 30, '#ffd34d', 'center', TITLE_FONT);
      text(r.bull.rarity.name + ' ' + r.bull.name + ' — ' + RIDE_TIME.toFixed(2) + 's', 480, 160, 17, r.bull.rarity.color, 'center', BODY_FONT);
      const row = (label, val, y, big) => {
        text(label, 300, y, big ? 22 : 18, '#f1e4c8', 'left', big ? TITLE_FONT : BODY_FONT);
        text(val, 660, y, big ? 26 : 18, big ? '#ffd34d' : '#fff', 'right', big ? TITLE_FONT : BODY_FONT);
      };
      row('Control', Math.round(r.control * 100) + '%', 200);
      row('Spurs • Perfects • Combo', r.spurs + ' • ' + r.perfects + ' • x' + r.bestCombo, 226);
      row('Rider score', r.rider.toFixed(1), 252);
      row(r.bull.animal.name + ' score', r.bullPts.toFixed(1), 278);
      ctx.fillStyle = '#c99a4b';
      ctx.fillRect(300, 298, 360, 2);
      row('TOTAL', r.total.toFixed(1), 324, true);
      let note = r.newBest ? 'New personal best!' : 'Best: ' + save.best[r.idx].toFixed(1);
      if (r.unlockedNew) note = 'Unlocked: ' + r.unlockedNew.name + '!';
      else if (r.total < UNLOCK_SCORE && r.idx + 1 === save.unlocked && r.idx + 1 < BULLS.length) note = `Score ${UNLOCK_SCORE}+ to unlock the next bull`;
      text(note, 480, 362, 17, r.unlockedNew ? '#7dff9b' : '#fff', 'center', BODY_FONT);
    } else {
      text('NO SCORE', 480, 140, 40, '#ff6b4a', 'center', TITLE_FONT);
      text('Bucked off by ' + r.bull.rarity.name + ' ' + r.bull.name + ' at ' + r.time.toFixed(2) + 's', 480, 190, 18, '#fff', 'center', BODY_FONT);
      const tips = [
        'Lean the way the arrow points — before the kick lands.',
        'Hold SPACE through big kicks, but watch your grip.',
        'Blue arrows mean a spin: hold the lean until it ends.',
        'Tougher bulls fake you out — the arrow can flip!',
      ];
      text('Tip: ' + tips[Math.floor(r.time * 7) % tips.length], 480, 240, 15, '#f1d9a8', 'center', BODY_FONT);
      if (r.stomped) text('…and you got stomped on the way out.', 480, 270, 15, '#ff9b8a', 'center', BODY_FONT);
      // Progress bar of how close they got
      drawBar(330, 304, 300, 14, r.time / RIDE_TIME, '#e6a23c');
      text(Math.round((r.time / RIDE_TIME) * 100) + '% of the way to the buzzer', 480, 336, 14, '#fff', 'center', BODY_FONT);
    }
    if (stateT > 0.6 && !touchMode) {
      const again = r.unlockedNew ? 'ride ' + r.unlockedNew.name : 'ride again';
      text('ENTER: ' + again + '   •   ESC: choose ride', 480, 398, 16, '#c99a4b', 'center', BODY_FONT);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    // rAF timestamps can predate the performance.now() taken at load, so never step backwards.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    update(dt);
    render();
    pressed = {};
    requestAnimationFrame(frame);
  }
  if (document.fonts && document.fonts.load) document.fonts.load('40px "Rye"').catch(() => {});
  requestAnimationFrame(frame);
})();
