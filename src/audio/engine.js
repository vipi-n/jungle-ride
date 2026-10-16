// Web Audio plumbing shared by the score and the sound effects.
//
//   music voices ─┬─────────────► musicIn ─┐
//                 └─► pump (sidechain) ───┤
//                                         ├─► duck ─► musicVol ─┐
//   music sends ──► hall reverb / ping-pong delay ─────┘         ├─► glue comp ─► limiter ─► out
//   sfx voices ───► sfxIn ─► sfxVol ─────────────────────────────┤
//   sfx sends ────► room reverb ─────────────────────────────────┘
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor(ctx) {
    this.ctx = ctx;
    const c = ctx;
    this.out = c.createGain();
    this.out.gain.value = 0.92;

    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.knee.value = 14;
    glue.ratio.value = 2.6;
    glue.attack.value = 0.012;
    glue.release.value = 0.24;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.12;
    this.out.connect(glue).connect(limiter).connect(c.destination);

    this.musicVol = c.createGain();
    this.musicVol.connect(this.out);
    this.duck = c.createGain();
    this.duck.connect(this.musicVol);
    this.musicIn = c.createGain();
    this.musicIn.connect(this.duck);
    this.pump = c.createGain();
    this.pump.connect(this.duck);

    this.sfxVol = c.createGain();
    this.sfxVol.connect(this.out);
    this.sfxIn = c.createGain();
    this.sfxIn.connect(this.sfxVol);

    this.noise = {
      white: this.makeNoise('white', 3),
      pink: this.makeNoise('pink', 6),
      brown: this.makeNoise('brown', 6),
    };

    // music returns
    this.hall = c.createConvolver();
    this.hall.buffer = this.makeImpulse(3.4, 0.025, 0.55);
    this.hallSend = c.createGain();
    const hallRet = c.createGain();
    hallRet.gain.value = 0.85;
    this.hallSend.connect(this.hall).connect(hallRet).connect(this.duck);

    this.delaySend = c.createGain();
    const dl = c.createDelay(2);
    const dr = c.createDelay(2);
    const fb1 = c.createGain();
    const fb2 = c.createGain();
    const damp = c.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3200;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 260;
    fb1.gain.value = 0.42;
    fb2.gain.value = 0.42;
    const pl = c.createStereoPanner();
    const pr = c.createStereoPanner();
    pl.pan.value = -0.75;
    pr.pan.value = 0.75;
    const delayRet = c.createGain();
    delayRet.gain.value = 0.6;
    this.delaySend.connect(hp).connect(dl);
    dl.connect(pl).connect(delayRet);
    dl.connect(fb1).connect(dr);
    dr.connect(pr).connect(delayRet);
    dr.connect(fb2).connect(damp).connect(dl);
    delayRet.connect(this.duck);
    delayRet.connect(this.hallSend);
    this.delayL = dl;
    this.delayR = dr;
    this.delayFb = [fb1, fb2];

    // sfx return
    this.room = c.createConvolver();
    this.room.buffer = this.makeImpulse(1.7, 0.012, 0.35);
    this.roomSend = c.createGain();
    const roomRet = c.createGain();
    roomRet.gain.value = 0.7;
    this.roomSend.connect(this.room).connect(roomRet).connect(this.sfxVol);
  }

  get now() {
    return this.ctx.currentTime;
  }

  setDelayTime(sec) {
    this.delayL.delayTime.value = sec;
    this.delayR.delayTime.value = sec;
  }

  makeNoise(kind, seconds) {
    const c = this.ctx;
    const n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.06;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    }
    // crossfade the ends so looped noise has no click
    const fade = Math.floor(c.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      d[n - fade + i] = d[n - fade + i] * (1 - t) + d[i] * t;
    }
    return buf;
  }

  // Stereo hall: decorrelated noise, exponential decay, darkening over time.
  makeImpulse(seconds, preDelay, brightness) {
    const c = this.ctx;
    const rate = c.sampleRate;
    const n = Math.floor(rate * seconds);
    const buf = c.createBuffer(2, n, rate);
    const pre = Math.floor(rate * preDelay);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const t = (i - pre) / (n - pre);
        const env = Math.pow(1 - t, 2.2) * Math.exp(-t * 3.2);
        const k = brightness * (1 - t * 0.85) + 0.04;
        lp += (Math.random() * 2 - 1 - lp) * k;
        d[i] = lp * env;
      }
      // a few early reflections
      for (let e = 0; e < 7; e++) {
        const at = pre + Math.floor(rate * (0.007 + Math.random() * 0.05));
        if (at < n) d[at] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - e * 0.05);
      }
    }
    return buf;
  }

  noiseSource(kind = 'white', loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise[kind];
    s.loop = loop;
    return s;
  }

  // Disconnect a voice graph once its source ends so long sessions don't leak.
  cleanup(src, ...nodes) {
    src.onended = () => {
      src.disconnect();
      for (const n of nodes) n?.disconnect();
    };
  }

  // Momentarily pull the score down under a big effect.
  duckMusic(depth = 0.45, attack = 0.04, hold = 0.6, release = 1.4) {
    const g = this.duck.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1 - depth, t + attack);
    g.setValueAtTime(1 - depth, t + attack + hold);
    g.linearRampToValueAtTime(1, t + attack + hold + release);
  }
}
