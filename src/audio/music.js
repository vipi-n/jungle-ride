import { mtof } from './engine.js';

// Adaptive synthwave score in D minor. The arrangement has four levels that are
// switched on bar lines (with a fill when climbing):
//   0 explore  – pad, sub, soft pulse arp, glass bells
//   1 cruise   – four-on-the-floor, pumping octave bass, 16th arp
//   2 fast     – galloping bass, supersaw lead, 16th hats
//   3 soar     – + choir, toms, crashes, lead harmony (thrust / flight)
export const BPM = 104;
const BEAT = 60 / BPM;
const STEP = BEAT / 4;
const BAR = BEAT * 4;

const CH = {
  Dm: { pad: [50, 57, 64, 65], bass: 38, arp: [62, 69, 65, 74] },
  Bb: { pad: [46, 53, 57, 62], bass: 34, arp: [58, 65, 62, 70] },
  F: { pad: [53, 60, 64, 69], bass: 41, arp: [60, 65, 69, 72] },
  C: { pad: [48, 55, 62, 64], bass: 36, arp: [60, 67, 64, 72] },
  Am: { pad: [45, 52, 57, 60], bass: 33, arp: [60, 64, 69, 72] },
  Gm: { pad: [43, 50, 58, 62], bass: 31, arp: [62, 67, 70, 74] },
};
const FORM = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Am', 'Gm', 'Dm', 'Bb', 'F', 'C'];

// [step, midi, length in steps]
const P1 = [
  [[0, 69, 6], [6, 74, 2], [8, 76, 4], [12, 77, 4]],
  [[0, 77, 6], [6, 76, 2], [8, 74, 8]],
  [[0, 72, 4], [4, 69, 4], [8, 72, 2], [10, 74, 2], [12, 76, 4]],
  [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 67, 4]],
];
const P2 = [
  [[0, 69, 4], [4, 74, 4], [8, 76, 2], [10, 77, 2], [12, 81, 4]],
  [[0, 79, 6], [6, 77, 2], [8, 74, 8]],
  [[0, 77, 4], [4, 76, 4], [8, 72, 4], [12, 69, 4]],
  [[0, 67, 4], [4, 72, 4], [8, 76, 6], [14, 74, 2]],
];
const PB = [
  [[0, 74, 6], [6, 77, 2], [8, 81, 8]],
  [[0, 79, 6], [6, 76, 2], [8, 79, 4], [12, 81, 4]],
  [[0, 76, 8], [8, 72, 4], [12, 76, 4]],
  [[0, 74, 10], [10, 70, 2], [12, 72, 4]],
];
const P1END = [P1[0], P1[1], P1[2], [[0, 76, 6], [6, 74, 2], [8, 74, 8]]];
const MELODY = [...P1, ...P2, ...PB, ...P1END];

const ARP = [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2];
const GALLOP = new Set([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]);
const D_MINOR = new Set([2, 4, 5, 7, 9, 10, 0]);

function diatonicBelow(m, degrees) {
  let x = m;
  let k = 0;
  while (k < degrees) {
    x--;
    if (D_MINOR.has(((x % 12) + 12) % 12)) k++;
  }
  return x;
}

const FLAVORS = {
  studio: { bright: 1, space: 1, feedback: 0.42 },
  salt: { bright: 1.15, space: 0.85, feedback: 0.38 },
  night: { bright: 0.72, space: 1.35, feedback: 0.5 },
};

export class Score {
  constructor(engine) {
    this.e = engine;
    this.level = 0;
    this.target = 0;
    this.boostUntil = -1;
    this.downHold = 0;
    this.bar = 0;
    this.step = 0;
    this.nextTime = 0;
    this.running = false;
    this.flavor = FLAVORS.studio;
    this.fill = false;
    engine.setDelayTime(BEAT * 0.75);
  }

  start(at) {
    this.running = true;
    this.step = 0;
    this.nextTime = Math.max(at ?? 0, this.e.now + 0.06);
  }

  stop() {
    this.running = false;
  }

  setLevel(n) {
    this.target = n;
  }

  // Hold the top arrangement for a few bars (thrust bursts are shorter than a bar).
  surge(bars = 4) {
    this.boostUntil = Math.max(this.boostUntil, this.bar + bars);
    if (this.level < 3) this.fill = true;
  }

  setFlavor(name) {
    this.flavor = FLAVORS[name] || FLAVORS.studio;
    for (const g of this.e.delayFb) g.gain.setTargetAtTime(this.flavor.feedback, this.e.now, 0.5);
  }

  // Time of the next 16th: stingers land on the grid so they sit in the groove.
  get nextGrid() {
    return this.running ? this.nextTime : this.e.now + 0.02;
  }

  scheduleUntil(t) {
    while (this.running && this.nextTime < t) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step++;
      if (this.step === 16) {
        this.step = 0;
        this.bar++;
      }
    }
  }

  wanted() {
    return this.bar < this.boostUntil ? 3 : this.target;
  }

  scheduleStep(step, t) {
    if (step === 0) this.onBar(t);
    if (step === 12 && this.wanted() > this.level) this.fill = true;

    const L = this.level;
    const fl = this.flavor;
    const barIdx = this.bar % 16;
    const chord = CH[FORM[barIdx]];

    // drums
    if (L >= 1) {
      const fillNow = this.fill && step >= 12;
      if (step % 4 === 0 && !(fillNow && step > 12)) this.kick(t, L >= 3 ? 0.6 : 0.52);
      if ((step === 4 || step === 12) && !fillNow) {
        this.snare(t, 0.2, 0.32 * fl.space);
        this.clap(t, 0.12);
      }
      if (L >= 2) {
        if (step % 4 === 2) this.hat(t, true, 0.05);
        else if (step % 2 === 1) this.hat(t, false, 0.035);
      } else if (step % 4 === 2) this.hat(t, false, 0.055);
      if (fillNow) {
        const k = (step - 12) / 4;
        this.snare(t, 0.08 + 0.12 * k, 0.25);
        this.snare(t + STEP / 2, 0.1 + 0.12 * k, 0.25);
        if (L >= 3 || this.wanted() >= 3) this.tom(t, [50, 47, 43, 38][step - 12]);
      }
      if (L >= 3 && barIdx % 4 === 3 && step >= 13 && !fillNow) this.tom(t, [50, 45, 41][step - 13]);
    }

    // bass
    if (L >= 1) {
      const on = L >= 2 ? GALLOP.has(step) : step % 2 === 0;
      if (on) {
        const oct = step === 6 || step === 14 ? 12 : 0;
        this.bass(t, chord.bass + oct, STEP * (L >= 2 ? 0.85 : 1.5), L);
      }
    }

    // arp
    const arpOn = L === 0 ? step % 2 === 0 : true;
    if (arpOn) {
      const cutoff = [1300, 2000, 2600, 3200][L] * fl.bright;
      const gain = [0.03, 0.036, 0.034, 0.032][L];
      this.arp(t, chord.arp[ARP[step]], cutoff, gain, step % 2 ? 0.28 : -0.28);
    }

    // melody
    const bellGroup = (this.bar >> 2) % 2 === 1;
    for (const [s, m, len] of MELODY[barIdx]) {
      if (s !== step) continue;
      const dur = len * STEP;
      if (L >= 2) {
        this.lead(t, m, dur, 0.045);
        if (L >= 3) this.lead(t, diatonicBelow(m, 2), dur, 0.026, 0.35);
      } else if ((L === 0 && bellGroup) || (L === 1 && barIdx >= 8 && barIdx < 12)) {
        this.bell(t, m, dur, 0.05);
      }
    }
  }

  onBar(t) {
    const prev = this.level;
    const want = this.wanted();
    if (want > this.level) {
      this.level = want;
      this.downHold = 0;
    } else if (want < this.level) {
      this.downHold++;
      if (this.downHold >= 2) {
        this.level = want;
        this.downHold = 0;
      }
    } else this.downHold = 0;
    this.fill = false;

    const L = this.level;
    const fl = this.flavor;
    const barIdx = this.bar % 16;
    const chord = CH[FORM[barIdx]];
    const padCut = [950, 1500, 2300, 3000][L] * fl.bright;
    this.pad(t, BAR, chord.pad, padCut, [0.034, 0.03, 0.028, 0.03][L]);
    if (L === 0) this.sub(t, BAR, chord.bass, 0.16);
    if (L >= 3) this.choir(t, BAR, chord.pad);
    if (L > prev && L >= 2) this.crash(t, 0.1);
    else if (L >= 2 && barIdx % 4 === 0) this.crash(t, 0.07);
  }

  // ---------------------------------------------------------------- voices
  sendTo(node, amount, bus) {
    if (amount <= 0) return null;
    const g = this.e.ctx.createGain();
    g.gain.value = amount;
    node.connect(g).connect(bus);
    return g;
  }

  pad(t, dur, notes, cutoff, gain) {
    const c = this.e.ctx;
    const att = 1.1;
    const rel = 1.7;
    const end = t + dur + rel + 0.05;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + att);
    env.gain.setValueAtTime(gain, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + rel);
    env.connect(this.e.pump);
    const send = this.sendTo(env, 0.5 * this.flavor.space, this.e.hallSend);
    const nodes = [env, send];
    const chains = [-1, 1].map((side) => {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(cutoff * 0.45, t);
      f.frequency.exponentialRampToValueAtTime(cutoff, t + att * 1.5);
      f.frequency.exponentialRampToValueAtTime(cutoff * 0.7, t + dur + rel);
      const p = c.createStereoPanner();
      p.pan.value = side * 0.6;
      f.connect(p).connect(env);
      nodes.push(f, p);
      return f;
    });
    let last;
    for (const m of notes) {
      for (let i = 0; i < 2; i++) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = (i ? 7 : -7) + (Math.random() - 0.5) * 5;
        o.connect(chains[i]);
        o.start(t);
        o.stop(end);
        last = o;
      }
    }
    this.e.cleanup(last, ...nodes.filter(Boolean));
  }

  sub(t, dur, m, gain) {
    const c = this.e.ctx;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.5);
    env.gain.setValueAtTime(gain, t + dur - 0.1);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    env.connect(this.e.musicIn);
    const o = c.createOscillator();
    o.frequency.value = mtof(m);
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = mtof(m + 12);
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    o.connect(env);
    o2.connect(g2).connect(env);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.7);
    o2.stop(t + dur + 0.7);
    this.e.cleanup(o, env, g2, o2);
  }

  bass(t, m, len, L) {
    const c = this.e.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4.5;
    const peak = (L >= 2 ? 1500 : 1050) * this.flavor.bright;
    f.frequency.setValueAtTime(170, t);
    f.frequency.exponentialRampToValueAtTime(peak, t + 0.012);
    f.frequency.exponentialRampToValueAtTime(190, t + len * 1.5 + 0.05);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.11, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.075, t + len);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.07);
    f.connect(env).connect(this.e.pump);
    const o1 = c.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = mtof(m);
    const o2 = c.createOscillator();
    o2.type = 'square';
    o2.frequency.value = mtof(m);
    o2.detune.value = -9;
    const g2 = c.createGain();
    g2.gain.value = 0.5;
    const s = c.createOscillator();
    s.frequency.value = mtof(m);
    const sg = c.createGain();
    sg.gain.value = 0.9;
    o1.connect(f);
    o2.connect(g2).connect(f);
    s.connect(sg).connect(env);
    const end = t + len + 0.1;
    for (const o of [o1, o2, s]) {
      o.start(t);
      o.stop(end);
    }
    this.e.cleanup(o1, f, env, g2, sg, o2, s);
  }

  arp(t, m, cutoff, gain, pan) {
    const c = this.e.ctx;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = mtof(m);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 5;
    f.frequency.setValueAtTime(cutoff * 2.2, t);
    f.frequency.exponentialRampToValueAtTime(cutoff * 0.3, t + 0.17);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    o.connect(f).connect(env).connect(p).connect(this.e.pump);
    const d = this.sendTo(p, 0.42, this.e.delaySend);
    const r = this.sendTo(p, 0.22 * this.flavor.space, this.e.hallSend);
    o.start(t);
    o.stop(t + 0.36);
    this.e.cleanup(o, f, env, p, d, r);
  }

  bell(t, m, dur, gain) {
    const c = this.e.ctx;
    const f0 = mtof(m);
    const car = c.createOscillator();
    car.frequency.value = f0;
    const mod = c.createOscillator();
    mod.frequency.value = f0 * 3.5;
    const mg = c.createGain();
    mg.gain.setValueAtTime(f0 * 1.4, t);
    mg.gain.exponentialRampToValueAtTime(f0 * 0.04, t + 1.2);
    mod.connect(mg).connect(car.frequency);
    const env = c.createGain();
    const tail = Math.max(1.6, dur + 1.2);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + tail);
    car.connect(env).connect(this.e.musicIn);
    const r = this.sendTo(env, 0.6 * this.flavor.space, this.e.hallSend);
    const d = this.sendTo(env, 0.35, this.e.delaySend);
    car.start(t);
    mod.start(t);
    car.stop(t + tail + 0.05);
    mod.stop(t + tail + 0.05);
    this.e.cleanup(car, env, mg, mod, r, d);
  }

  lead(t, m, dur, gain, pan = 0) {
    const c = this.e.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.1;
    const top = 3400 * this.flavor.bright;
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(top, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(top * 0.65, t + dur + 0.2);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.015);
    env.gain.linearRampToValueAtTime(gain * 0.82, t + 0.2);
    env.gain.setValueAtTime(gain * 0.82, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.24);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    f.connect(env).connect(p).connect(this.e.musicIn);
    const d = this.sendTo(p, 0.28, this.e.delaySend);
    const r = this.sendTo(p, 0.36 * this.flavor.space, this.e.hallSend);
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.4;
    const lg = c.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(0, t + 0.18);
    lg.gain.linearRampToValueAtTime(8, t + 0.5);
    lfo.connect(lg);
    const end = t + dur + 0.3;
    let last;
    for (const det of [-11, 0, 11]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = det;
      lg.connect(o.detune);
      o.connect(f);
      o.start(t);
      o.stop(end);
      last = o;
    }
    lfo.start(t);
    lfo.stop(end);
    this.e.cleanup(last, f, env, p, d, r, lg, lfo);
  }

  choir(t, dur, notes) {
    const c = this.e.ctx;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.7);
    env.gain.setValueAtTime(1, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 1.4);
    const sum = c.createGain();
    sum.gain.value = 0.022;
    const formants = [
      [650, 6, 1],
      [1080, 7, 0.7],
      [2650, 9, 0.25],
    ].map(([fr, q, g]) => {
      const b = c.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.value = fr;
      b.Q.value = q;
      const bg = c.createGain();
      bg.gain.value = g * 4;
      sum.connect(b).connect(bg).connect(env);
      return [b, bg];
    });
    env.connect(this.e.musicIn);
    const r = this.sendTo(env, 0.75 * this.flavor.space, this.e.hallSend);
    const end = t + dur + 1.5;
    let last;
    for (const m of notes) {
      for (const det of [-9, 9]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m + 12);
        o.detune.value = det;
        o.connect(sum);
        o.start(t);
        o.stop(end);
        last = o;
      }
    }
    this.e.cleanup(last, sum, env, r, ...formants.flat());
  }

  kick(t, gain) {
    const c = this.e.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
    const env = c.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
    o.connect(env).connect(this.e.musicIn);
    const n = this.e.noiseSource('white');
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const ng = c.createGain();
    ng.gain.setValueAtTime(gain * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.014);
    n.connect(hp).connect(ng).connect(this.e.musicIn);
    o.start(t);
    o.stop(t + 0.5);
    n.start(t, Math.random());
    n.stop(t + 0.02);
    this.e.cleanup(o, env);
    this.e.cleanup(n, hp, ng);
    // sidechain pump on the pads / bass / arp
    const g = this.e.pump.gain;
    g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(0.34, t + 0.012);
    g.setTargetAtTime(1, t + 0.02, 0.085);
  }

  snare(t, gain, verb) {
    const c = this.e.ctx;
    const n = this.e.noiseSource('white');
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    n.connect(bp).connect(env).connect(this.e.musicIn);
    const r = this.sendTo(env, verb, this.e.hallSend);
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(195, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const og = c.createGain();
    og.gain.setValueAtTime(gain * 0.9, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(og).connect(this.e.musicIn);
    n.start(t, Math.random() * 2);
    n.stop(t + 0.26);
    o.start(t);
    o.stop(t + 0.12);
    this.e.cleanup(n, bp, env, r);
    this.e.cleanup(o, og);
  }

  clap(t, gain) {
    const c = this.e.ctx;
    const n = this.e.noiseSource('white');
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 1.2;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    for (const k of [0, 0.011, 0.022]) {
      env.gain.setValueAtTime(gain, t + k);
      env.gain.exponentialRampToValueAtTime(gain * 0.25, t + k + 0.009);
    }
    env.gain.setValueAtTime(gain, t + 0.033);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    n.connect(bp).connect(env).connect(this.e.musicIn);
    const r = this.sendTo(env, 0.45 * this.flavor.space, this.e.hallSend);
    n.start(t, Math.random() * 2);
    n.stop(t + 0.24);
    this.e.cleanup(n, bp, env, r);
  }

  hat(t, open, gain) {
    const c = this.e.ctx;
    const n = this.e.noiseSource('white');
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.3 : 0.05));
    const p = c.createStereoPanner();
    p.pan.value = 0.22;
    n.connect(hp).connect(env).connect(p).connect(this.e.musicIn);
    const r = open ? this.sendTo(p, 0.15, this.e.hallSend) : null;
    n.start(t, Math.random() * 2);
    n.stop(t + (open ? 0.32 : 0.06));
    this.e.cleanup(n, hp, env, p, r);
  }

  tom(t, m) {
    const c = this.e.ctx;
    const o = c.createOscillator();
    const f0 = mtof(m - 12);
    o.frequency.setValueAtTime(f0 * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.12);
    const env = c.createGain();
    env.gain.setValueAtTime(0.32, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(env).connect(this.e.musicIn);
    const r = this.sendTo(env, 0.4 * this.flavor.space, this.e.hallSend);
    o.start(t);
    o.stop(t + 0.45);
    this.e.cleanup(o, env, r);
  }

  crash(t, gain) {
    const c = this.e.ctx;
    const n = this.e.noiseSource('white');
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    n.connect(hp).connect(env).connect(this.e.musicIn);
    const r = this.sendTo(env, 0.35, this.e.hallSend);
    n.start(t, Math.random());
    n.stop(t + 2.7);
    this.e.cleanup(n, hp, env, r);
  }

  // ---------------------------------------------------------------- cinematic hits
  // Low brass "braam" with a sub drop. Bypasses the duck so it lands at full weight.
  impact(t = this.e.now + 0.01, gain = 0.24) {
    const c = this.e.ctx;
    const out = this.e.musicVol;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(90, t);
    f.frequency.exponentialRampToValueAtTime(1600 * this.flavor.bright, t + 0.35);
    f.frequency.exponentialRampToValueAtTime(240, t + 3.2);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.05);
    env.gain.linearRampToValueAtTime(gain * 0.55, t + 0.9);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    f.connect(env).connect(out);
    const r = this.sendTo(env, 0.5, this.e.hallSend);
    let last;
    for (const m of [26, 38, 45, 50]) {
      for (const det of [-12, 12]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + 3.7);
        last = o;
      }
    }
    this.e.cleanup(last, f, env, r);
    const s = c.createOscillator();
    s.frequency.setValueAtTime(64, t);
    s.frequency.exponentialRampToValueAtTime(30, t + 1.7);
    const sg = c.createGain();
    sg.gain.setValueAtTime(0.36, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    s.connect(sg).connect(out);
    s.start(t);
    s.stop(t + 2.4);
    this.e.cleanup(s, sg);
    this.crash(t, 0.09);
  }

  riser(t, dur, gain = 0.07) {
    const c = this.e.ctx;
    const out = this.e.musicVol;
    const n = this.e.noiseSource('white', true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(6500, t + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.06);
    n.connect(bp).connect(env).connect(out);
    const r = this.sendTo(env, 0.5, this.e.hallSend);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(50), t);
    o.frequency.exponentialRampToValueAtTime(mtof(74), t + dur);
    const of = c.createBiquadFilter();
    of.type = 'lowpass';
    of.frequency.value = 1800;
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(gain * 0.3, t + dur);
    og.gain.linearRampToValueAtTime(0, t + dur + 0.06);
    o.connect(of).connect(og).connect(out);
    n.start(t);
    n.stop(t + dur + 0.1);
    o.start(t);
    o.stop(t + dur + 0.1);
    this.e.cleanup(n, bp, env, r);
    this.e.cleanup(o, of, og);
  }

  // Short in-key phrases for UI moments.
  stinger(name) {
    const t = this.nextGrid;
    if (name === 'doors') [62, 65, 69, 74].forEach((m, i) => this.arp(t + i * STEP, m, 3400, 0.05, i % 2 ? 0.3 : -0.3));
    else if (name === 'doorsClose') [74, 69, 65, 62].forEach((m, i) => this.arp(t + i * STEP, m, 2600, 0.045, i % 2 ? 0.3 : -0.3));
    else if (name === 'lights') [74, 81, 86].forEach((m, i) => this.bell(t + i * 0.035, m, 1.2, 0.035));
    else if (name === 'aero') [69, 74].forEach((m, i) => this.arp(t + i * STEP * 2, m, 3000, 0.05, 0));
    else if (name === 'chime') this.bell(t, 86, 1, 0.04);
  }
}
