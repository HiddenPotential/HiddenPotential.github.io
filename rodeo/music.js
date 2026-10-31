// Battle music — a small step sequencer on Web Audio, with a different tense theme per animal.
// No audio files: every note is synthesized. Patterns are 16 sixteenth-note steps per bar.
//
// Each theme moves through a 4-bar chord progression and builds in stages over the ride:
//   chute   muffled bass line only
//   stage 0 drums + main melody
//   stage 1 (3s in) extra percussion + a counter-melody
//   stage 2 (last 2s, "fury") climax melody, faster tempo, crashes
// The last bar of every phrase gets a drum fill.

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  diminished: [0, 1, 3, 4, 6, 7, 9, 10],
  pentaMinor: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

// Melodic strings: '.' rest, '-' holds the previous note, '0'-'9' and 'a'-'f' are scale degrees 0–15.
// Drum lanes: [sound, pattern, stage it enters]; 'x' hit, 'o' soft hit.
// prog shifts the bass and melodies by a scale degree each bar, giving a chord progression.
const THEMES = {
  bull: { // driving rodeo rock with cowbell
    bpm: 138, root: 40, scale: 'minor', prog: [0, 0, 5, 6],
    bassInst: 'saw', bass: ['0..0..0.0..0.3.4', '0..0..0.0.0.0-0-'],
    leadInst: 'brass', lead: ['7-..6-..5-..4.3.', '4-....3.4-..7---'], leadB: ['b-a-9-7-9-a-b---', 'b.b.a.9.7-..9---'],
    counterInst: 'pluck', counter: '0.4.7.4.0.4.7.4.',
    drums: [['kick', 'x...x...x...x...', 0], ['snare', '....x.......x...', 0], ['hat', 'x.x.x.x.x.x.x.x.', 1], ['cowbell', '..x...x...x...xx', 1], ['crash', 'x...............', 2]],
  },
  bronco: { // spaghetti-western gallop with a whistled tune
    bpm: 150, root: 45, scale: 'harmonic', prog: [0, 3, 4, 0],
    bassInst: 'pluck', bass: ['0.00.00.0.00.00.'],
    leadInst: 'whistle', lead: ['4-.4.3.2---1.0..', '0-.1.2.4---2.1..'], leadB: ['7-.7.8.9-8-7-4--', '9.8.7.8.9-b-9---'],
    counterInst: 'banjo', counter: '0.2.4.2.0.2.4.2.',
    drums: [['kick', 'x..x..x.x..x..x.', 0], ['woodblock', '.x.x.x.x.x.x.x.x', 0], ['snare', '....x.......x...', 1], ['crash', 'x...............', 2]],
  },
  ram: { // aggressive, head-butting stabs
    bpm: 160, root: 47, scale: 'phrygian', prog: [0, 1, 0, 6],
    bassInst: 'growl', bass: ['0.0.1.0.0.0.1.0.', '0.0.1.0.0.3.1.0.'],
    leadInst: 'square', lead: ['..7-..8-..7.6...', '..7-..8-..a-9-8-'], leadB: ['e.d.c.b.c.d.e---', 'e-d-c-b-a-b-c---'],
    counterInst: 'saw', counter: '0...0...1...0...',
    drums: [['kick', 'x.x...x.x.x...x.', 0], ['snare', '....x.......x..x', 0], ['clap', '....x.......x...', 1], ['hat', 'xxxxxxxxxxxxxxxx', 1], ['crash', 'x.......x.......', 2]],
  },
  camel: { // desert: Phrygian-dominant reed over hand drums, an oud underneath
    bpm: 112, root: 43, scale: 'hijaz', prog: [0, 0, 1, 0],
    bassInst: 'sub', bass: ['0...0..1.0...4..'],
    leadInst: 'reed', lead: ['7.8.9-8.7---8.7.', '9.a.9-8.7.8.7---'], leadB: ['b.c.b.a.9-a-9-8-', 'c-b-a-9-8-7-8---'],
    counterInst: 'oud', counter: '0.7.4.7.0.7.4.7.',
    drums: [['dum', 'x..x..x.x..x....', 0], ['tek', '...x......x..x..', 0], ['shaker', '..o...o...o...o.', 1], ['gong', 'x...............', 2]],
    fill: 'tek',
  },
  whale: { // slow and deep: whale song, bells, drips and sonar
    bpm: 72, root: 33, scale: 'minor', prog: [0, 5, 3, 4], pad: 'strings',
    bassInst: 'sub', bass: ['0-------3-------'],
    leadInst: 'song', lead: ['........9---8---', '........7---4---'], leadB: ['9---a---9---7---', 'b---a---9-------'],
    counterInst: 'bell', counter: '0...4...7...b...',
    drums: [['kick', 'x.......x.......', 0], ['ping', '........x.......', 0], ['drip', '...x.....x....x.', 1], ['gong', 'x...............', 2]],
    fill: false,
  },
  kraken: { // creeping diminished ostinato and a ghost-ship organ
    bpm: 126, root: 38, scale: 'diminished', prog: [0, 0, 1, 0], pad: 'strings',
    bassInst: 'growl', bass: ['0101010101013434', '0101010101015656'],
    leadInst: 'organ', lead: ['....7-------6---', '....7---8---a---'], leadB: ['e-d-c-b-c-d-e-f-', 'f-e-d-c-b-------'],
    counterInst: 'bell', counter: 'c.......b.......',
    drums: [['tom', 'x..x..x...x..x..', 0], ['kick', 'x.......x.......', 0], ['drip', '..x.......x.....', 1], ['snare', '......x.......xx', 1], ['gong', 'x...............', 2]],
  },
  dragon: { // epic: brass, choir and timpani
    bpm: 120, root: 36, scale: 'harmonic', prog: [0, 5, 3, 4], pad: 'choir',
    bassInst: 'saw', bass: ['0...0...0.0.0...', '0...0...4...4...'],
    leadInst: 'brass', lead: ['7--7.8.9--8.7---', '9--9.a.b--a.9---'], leadB: ['e--e.d.c--b.a---', 'b-c-d-e---d-c---'],
    counterInst: 'choir', counter: '0-------4-------',
    drums: [['timpani', 'x.....x.x.......', 0], ['snare', '....x.......x.xx', 1], ['crash', 'x...............', 2]],
  },
  pig: { // bouncy chiptune with fast arpeggios
    bpm: 168, root: 48, scale: 'minor', prog: [0, 3, 4, 0],
    bassInst: 'chip', bass: ['0.4.0.4.3.4.3.2.'],
    leadInst: 'chip', lead: ['7.7.9.7.8.7.6.4.', '4.4.6.4.7---6---'], leadB: ['b.b.a.9.a.b.c---', 'c.b.a.9.8.9.a---'],
    counterInst: 'chipThin', counter: '07b707b707b707b7',
    drums: [['kick', 'x...x...x...x...', 0], ['snare', '....x.......x...', 0], ['hat', 'x.x.x.x.x.x.x.x.', 1], ['crash', 'x...............', 2]],
  },
  cow: { // slow, heavy and plodding, lots of cowbell
    bpm: 110, root: 41, scale: 'dorian', prog: [0, 0, 3, 4],
    bassInst: 'saw', bass: ['0...0...3...4...', '0...0.0.3...4.3.'],
    leadInst: 'strings', lead: ['4-------3---2---', '4---7---6---4---'], leadB: ['7---8---9---7---', '9---8---7-------'],
    counterInst: 'organ', counter: '0.......4.......',
    drums: [['kick', 'x.......x.x.....', 0], ['cowbell', 'x...x...x...x.x.', 0], ['snare', '....x.......x...', 1], ['crash', 'x...............', 2]],
  },
  goat: { // frantic Balkan clarinet and accordion
    bpm: 176, root: 50, scale: 'phrygian', prog: [0, 1, 0, 1],
    bassInst: 'pluck', bass: ['0.0.0.1.0.0.0.1.'],
    leadInst: 'reed', lead: ['8.7.8.7.8.a.8.7.', '8.7.6.5.6.7.8---'], leadB: ['c.b.c.b.c.e.c.b.', 'c.b.a.9.a.b.c---'],
    counterInst: 'organ', counter: '0.0.4.4.0.0.4.4.',
    drums: [['kick', 'x..x..x.x..x..x.', 0], ['clap', '....x.......x...', 1], ['hat', 'xxxxxxxxxxxxxxxx', 1], ['crash', 'x...............', 2]],
  },
  chicken: { // fastest of all, clucky lead and woodblock pecks
    bpm: 184, root: 52, scale: 'pentaMinor', prog: [0, 0, 2, 1],
    bassInst: 'chip', bass: ['0.0..0.0.3.3..4.'],
    leadInst: 'cluck', lead: ['9.9.7.9.a.9.7.5.', '5.7.9.a.9.7.5---'], leadB: ['d.d.c.d.e.d.c.a.', 'a.c.d.e.d.c.a---'],
    counterInst: 'chipThin', counter: '0.5.0.5.0.5.0.5.',
    drums: [['kick', 'x...x...x...x...', 0], ['snare', '..x...x...x...x.', 0], ['woodblock', 'x.x.x..x.x.x..x.', 1], ['hat', 'xxxxxxxxxxxxxxxx', 1], ['crash', 'x...............', 2]],
  },
};

const DEGREE = '0123456789abcdef';
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createMusic(getAudio, isMuted) {
  let ac = null, master = null, tone = null, noiseBuf = null, pulse = null;
  let theme = null, themeKey = null;
  let step = 0, nextTime = 0;
  let level = 0; // 0 silent … 1 full

  function init() {
    if (ac) return true;
    ac = getAudio();
    if (!ac) return false;
    master = ac.createGain();
    master.gain.value = 0;
    tone = ac.createBiquadFilter(); // muffles the music while waiting in the chute
    tone.type = 'lowpass';
    tone.frequency.value = 18000;
    master.connect(tone).connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // 12.5% pulse wave for the chiptune voices.
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.125);
    pulse = ac.createPeriodicWave(re, im);
    return true;
  }

  // ---------- Building blocks ----------
  function env(param, t, peak, attack, dur) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
  }
  function osc(wave, freq, t, end, dest, detune) {
    const o = ac.createOscillator();
    if (wave === 'pulse') o.setPeriodicWave(pulse);
    else o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end + 0.05);
    return o;
  }
  function filter(type, freq, q) {
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    return f;
  }
  function amp(t, vol, attack, dur) {
    const g = ac.createGain();
    env(g.gain, t, vol, attack, dur);
    g.connect(master);
    return g;
  }
  function vibrato(o, t, end, rate, depth) {
    const l = ac.createOscillator(), lg = ac.createGain();
    l.frequency.value = rate;
    lg.gain.value = depth;
    l.connect(lg).connect(o.frequency);
    l.start(t);
    l.stop(end + 0.05);
  }
  function noiseHit(t, dur, vol, type, freq, q) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const f = filter(type, freq, q);
    s.connect(f).connect(amp(t, vol, 0.002, dur));
    s.start(t, Math.random() * 0.5, dur + 0.05);
  }

  // ---------- Instruments ----------
  // Each plays one note: (frequency, start time, length in seconds, volume).
  const INST = {
    saw(f, t, d, v) {
      const lp = chain(filter('lowpass', 900), amp(t, v, 0.005, d));
      osc('sawtooth', f, t, t + d, lp);
      osc('sawtooth', f, t, t + d, lp, -7);
    },
    square(f, t, d, v) { osc('square', f, t, t + d, chain(filter('lowpass', 2400), amp(t, v * 0.8, 0.005, d))); },
    sub(f, t, d, v) { osc('sine', f, t, t + d, amp(t, v * 1.4, 0.01, d)); osc('triangle', f * 2, t, t + d, amp(t, v * 0.3, 0.01, d * 0.5)); },
    pluck(f, t, d, v) {
      const g = amp(t, v, 0.002, Math.min(d, 0.35));
      osc('triangle', f, t, t + 0.4, g);
      osc('square', f, t, t + 0.4, chain(filter('lowpass', 1800), amp(t, v * 0.3, 0.002, 0.12)));
    },
    banjo(f, t, d, v) {
      for (const dt of [0, 0.03]) osc('sawtooth', f * (dt ? 2 : 1), t + dt, t + dt + 0.25, chain(filter('bandpass', 2200, 2), amp(t + dt, v * 0.9, 0.001, 0.18)));
    },
    oud(f, t, d, v) {
      const o = osc('sawtooth', f * 1.01, t, t + 0.5, chain(filter('lowpass', 1400), amp(t, v * 0.7, 0.002, 0.4)));
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    },
    brass(f, t, d, v) {
      const lp = filter('lowpass', 300);
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(2800, t + 0.08);
      lp.frequency.exponentialRampToValueAtTime(1200, t + d);
      const g = amp(t, v, 0.04, d);
      lp.connect(g);
      osc('sawtooth', f, t, t + d, lp);
      osc('sawtooth', f, t, t + d, lp, 8);
    },
    whistle(f, t, d, v) {
      const o = osc('sine', f, t, t + d, amp(t, v * 1.2, 0.03, d));
      o.frequency.setValueAtTime(f * 0.94, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      vibrato(o, t, t + d, 6, f * 0.012);
    },
    reed(f, t, d, v) {
      const o = osc('square', f, t, t + d, chain(filter('bandpass', f * 3, 1.5), amp(t, v * 1.1, 0.02, d)));
      vibrato(o, t, t + d, 5.5, f * 0.015);
    },
    organ(f, t, d, v) {
      const g = amp(t, v * 0.6, 0.02, d);
      for (const [mul, vol] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.15]]) {
        const pg = ac.createGain();
        pg.gain.value = vol;
        pg.connect(g);
        osc('sine', f * mul, t, t + d, pg);
      }
    },
    strings(f, t, d, v) {
      const g = chain(filter('lowpass', 1600), amp(t, v * 0.6, Math.min(0.25, d * 0.4), d));
      for (const det of [-9, 0, 9]) osc('sawtooth', f, t, t + d, g, det);
    },
    choir(f, t, d, v) {
      const g = amp(t, v * 0.7, Math.min(0.3, d * 0.4), d);
      for (const [ff, q] of [[700, 6], [1150, 8]]) { // "ah" formants
        const bp = filter('bandpass', ff, q);
        bp.connect(g);
        for (const det of [-6, 6]) osc('sawtooth', f, t, t + d, bp, det);
      }
    },
    bell(f, t, d, v) {
      const g = amp(t, v * 0.9, 0.002, Math.max(d, 1.2));
      const car = osc('sine', f, t, t + 1.3, g);
      const mod = ac.createOscillator(), mg = ac.createGain();
      mod.frequency.value = f * 3.5;
      env(mg.gain, t, f * 2, 0.002, 0.8);
      mod.connect(mg).connect(car.frequency);
      mod.start(t);
      mod.stop(t + 1.35);
    },
    song(f, t, d, v) { // whale call: swoops up into the note and wavers
      const o = osc('sine', f / 1.5, t, t + d, amp(t, v * 1.3, d * 0.3, d));
      o.frequency.exponentialRampToValueAtTime(f, t + d * 0.4);
      vibrato(o, t, t + d, 3, f * 0.02);
    },
    growl(f, t, d, v) {
      const lp = filter('lowpass', 400, 8);
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 7;
      lg.gain.value = 300;
      l.connect(lg).connect(lp.frequency);
      l.start(t);
      l.stop(t + d + 0.05);
      lp.connect(amp(t, v, 0.005, d));
      osc('sawtooth', f, t, t + d, lp);
      osc('square', f * 0.5, t, t + d, lp);
    },
    chip(f, t, d, v) { osc('pulse', f, t, t + d, amp(t, v * 0.7, 0.002, d * 0.9)); },
    chipThin(f, t, d, v) { osc('pulse', f, t, t + 0.07, amp(t, v * 0.45, 0.001, 0.06)); },
    cluck(f, t, d, v) {
      const o = osc('square', f * 2, t, t + 0.1, chain(filter('bandpass', 1800, 3), amp(t, v * 1.2, 0.001, 0.09)));
      o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    },
  };
  // Connects a → b and returns a, so a filter can be the destination for an oscillator.
  function chain(a, b) { a.connect(b); return a; }

  // ---------- Percussion ----------
  const DRUM = {
    kick(t, v) { const o = osc('sine', 130, t, t + 0.3, amp(t, v, 0.003, 0.22)); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); },
    snare(t, v) { noiseHit(t, 0.13, v * 0.6, 'bandpass', 1800, 0.8); osc('triangle', 190, t, t + 0.08, amp(t, v * 0.3, 0.001, 0.07)); },
    hat(t, v) { noiseHit(t, 0.035, v * 0.25, 'highpass', 7000); },
    shaker(t, v) { noiseHit(t, 0.06, v * 0.2, 'highpass', 5000); },
    clap(t, v) { for (const dt of [0, 0.012, 0.024]) noiseHit(t + dt, 0.06, v * 0.4, 'bandpass', 1300, 1.5); },
    tom(t, v, pitch) { const o = osc('sine', (pitch || 1) * 200, t, t + 0.3, amp(t, v * 0.8, 0.002, 0.25)); o.frequency.exponentialRampToValueAtTime((pitch || 1) * 85, t + 0.2); },
    timpani(t, v) { const o = osc('sine', 98, t, t + 0.9, amp(t, v, 0.004, 0.8)); o.frequency.exponentialRampToValueAtTime(82, t + 0.5); noiseHit(t, 0.08, v * 0.2, 'lowpass', 400); },
    cowbell(t, v) { const g = chain(filter('bandpass', 800, 3), amp(t, v * 0.5, 0.001, 0.25)); osc('square', 540, t, t + 0.3, g); osc('square', 800, t, t + 0.3, g); },
    woodblock(t, v) { osc('sine', 1100, t, t + 0.06, amp(t, v * 0.5, 0.001, 0.05)); },
    dum(t, v) { const o = osc('sine', 110, t, t + 0.35, amp(t, v, 0.002, 0.3)); o.frequency.exponentialRampToValueAtTime(70, t + 0.2); },
    tek(t, v) { noiseHit(t, 0.04, v * 0.45, 'highpass', 3000); osc('sine', 700, t, t + 0.04, amp(t, v * 0.2, 0.001, 0.03)); },
    drip(t, v) { const o = osc('sine', 500, t, t + 0.15, amp(t, v * 0.35, 0.001, 0.12)); o.frequency.exponentialRampToValueAtTime(1500, t + 0.08); },
    ping(t, v) { INST.bell(midiHz(theme.root + 48), t, 1.2, v * 0.12); },
    crash(t, v) { noiseHit(t, 1.2, v * 0.3, 'highpass', 4000); },
    gong(t, v) { noiseHit(t, 2, v * 0.25, 'bandpass', 500, 2); osc('sine', 75, t, t + 2, amp(t, v * 0.3, 0.01, 1.8)); },
  };

  // ---------- Sequencing ----------
  const pitchOf = (th, ch, octave, shift) => {
    const d = DEGREE.indexOf(ch) + shift;
    const sc = SCALES[th.scale];
    return th.root + octave * 12 + sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
  };
  const holdOf = (str, s) => { let n = 1; while (str[s + n] === '-') n++; return n; };
  const pick = (arr, bar) => (Array.isArray(arr) ? arr[bar % arr.length] : arr);

  function melodic(str, s, inst, octave, shift, sd, vol) {
    const ch = str[s];
    if (ch === '.' || ch === '-' || ch === undefined) return;
    const len = holdOf(str, s) * sd;
    INST[inst](midiHz(pitchOf(theme, ch, octave, shift)), nextTime, len * 0.95, vol * (0.9 + Math.random() * 0.2));
  }

  function playStep(i, p) {
    const th = theme, s = i % 16, bar = Math.floor(i / 16), sd = p.stepDur, t = nextTime;
    const shift = th.prog[bar % th.prog.length];
    const fillBar = bar % 4 === 3 && th.fill !== false && p.full;

    melodic(pick(th.bass, bar), s, th.bassInst, 0, shift, sd, 0.3);
    if (th.pad && s === 0 && p.full) for (const deg of ['0', '2', '4']) INST[th.pad](midiHz(pitchOf(th, deg, 1, shift)), t, sd * 16, 0.07);
    if (!p.full) return; // in the chute only the bass line plays

    for (const [sound, pat, stage] of th.drums) {
      if (stage > p.stage) continue;
      if (fillBar && s >= 12 && (sound === 'snare' || sound === (th.fill || 'snare'))) continue;
      const c = pat[s];
      if (c === 'x' || c === 'o') DRUM[sound](t, (c === 'x' ? 1 : 0.5) * (0.85 + Math.random() * 0.3));
    }
    // Drum fill: a descending tom roll (or the theme's own fill drum) over the last beat of the phrase.
    if (fillBar && s >= 12) {
      if (th.fill) DRUM[th.fill](t, 0.9);
      else DRUM.tom(t, 0.8, 1.6 - (s - 12) * 0.25);
    }

    const leadStr = p.stage >= 2 ? pick(th.leadB, bar) : pick(th.lead, bar);
    melodic(leadStr, s, th.leadInst, 1, shift, sd, 0.14);
    if (p.stage >= 1 && th.counter) melodic(th.counter, s, th.counterInst, p.stage >= 2 ? 2 : 1, shift, sd, 0.07);

    // Danger: a high, nervous tremolo when the rider is about to come off.
    if (p.danger) INST.strings(midiHz(pitchOf(th, s % 2 ? 'e' : 'd', 1, 0)), t, sd * 0.9, 0.08);
  }

  // Called every frame. mode: 'off' | 'chute' | 'ride' | 'fade'.
  function update(mode, kind, info) {
    if (mode === 'off' && !ac) return;
    if (!init()) return;
    const now = ac.currentTime;

    let target = mode === 'chute' ? 0.6 : mode === 'ride' ? 1 : 0;
    if (isMuted()) target = 0;
    const rate = mode === 'fade' ? 0.012 : 0.05; // 'fade' lets the music trail off after the ride
    level += (target - level) * (target > level ? 0.08 : rate);
    master.gain.setTargetAtTime(level * 0.24, now, 0.03);
    tone.frequency.setTargetAtTime(mode === 'chute' ? 900 : 18000, now, 0.15);

    if (level < 0.003 && target === 0) { themeKey = null; return; }

    const key = THEMES[kind] ? kind : 'bull';
    if (key !== themeKey && mode !== 'fade') {
      themeKey = key;
      theme = THEMES[key];
      step = 0;
      nextTime = now + 0.06;
    }
    if (!theme) return;

    const fury = !!(info && info.fury);
    const t = info ? info.t : 0;
    const p = {
      stepDur: 60 / (theme.bpm * (fury ? 1.12 : 1)) / 4,
      full: mode === 'ride' || mode === 'fade',
      stage: fury ? 2 : t >= 3 ? 1 : 0,
      danger: mode === 'ride' && info && Math.abs(info.lean) > 0.6,
    };
    if (nextTime < now) nextTime = now + 0.02; // tab was asleep: don't burst out missed notes
    while (nextTime < now + 0.12) {
      playStep(step, p);
      nextTime += p.stepDur;
      step++;
    }
  }

  return { update };
}
