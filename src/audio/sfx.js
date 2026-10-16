// Sound design for the car and the world. The Roadster is electric, so there is
// no engine: driving is wind, tyre roar and a faint inverter whine; the drama
// comes from the cold-gas thrusters, actuators and the score.
export class Sfx {
  constructor(engine) {
    this.e = engine;
    const c = engine.ctx;
    this.c = c;

    // ---- driving bed
    this.wind = this.loopNoise('pink', 'bandpass', 500, 0.7);
    this.tyre = this.loopNoise('brown', 'lowpass', 160, 0.9);
    this.whine = this.loopTone(220, 0);
    // ---- thruster bed (shared by thrust bursts, boost and flight)
    this.hiss = this.loopNoise('white', 'lowpass', 2600, 0.6);
    this.hissHp = c.createBiquadFilter();
    this.hissHp.type = 'highpass';
    this.hissHp.frequency.value = 380;
    this.hiss.filter.disconnect();
    this.hiss.filter.connect(this.hissHp).connect(this.hiss.gain);
    this.roomTap(this.hiss.gain, 0.3);
    this.rumble = this.loopNoise('brown', 'lowpass', 140, 1.2);
    // ---- diffuser fans
    this.fanTone = this.loopTone(160, 0, 'sawtooth', 9);
    this.fanAir = this.loopNoise('pink', 'bandpass', 1300, 1.4);
    // ---- ambience
    this.ambWind = this.loopNoise('pink', 'lowpass', 620, 0.5);
    this.ambRoom = this.loopNoise('brown', 'lowpass', 110, 0.7);
    this.ambEnv = 'studio';
    this.cricketClock = 0;
    this.gustPhase = Math.random() * 10;
  }

  // ---------------------------------------------------------------- building blocks
  loopNoise(kind, type, freq, q) {
    const c = this.c;
    const src = this.e.noiseSource(kind, true);
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.e.sfxIn);
    src.start(this.e.now, Math.random() * 2);
    return { src, filter, gain };
  }

  loopTone(freq, level, type = 'sine', q = 0) {
    const c = this.c;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.value = level;
    let head = osc;
    let filter = null;
    if (q) {
      filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = q;
      filter.frequency.value = freq * 2;
      osc.connect(filter);
      head = filter;
    }
    head.connect(gain).connect(this.e.sfxIn);
    osc.start();
    return { osc, gain, filter };
  }

  roomTap(node, amount) {
    const g = this.c.createGain();
    g.gain.value = amount;
    node.connect(g).connect(this.e.roomSend);
    return g;
  }

  set(param, value, tc = 0.08) {
    param.setTargetAtTime(value, this.e.now, tc);
  }

  burst({ t = this.e.now, kind = 'white', type = 'bandpass', freq = 1000, freqEnd = null, q = 1, gain = 0.1, attack = 0.002, dur = 0.1, room = 0, pan = 0 }) {
    const c = this.c;
    const n = this.e.noiseSource(kind);
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner();
    p.pan.value = pan;
    n.connect(f).connect(env).connect(p).connect(this.e.sfxIn);
    const r = room ? this.roomTap(p, room) : null;
    n.start(t, Math.random() * 2);
    n.stop(t + dur + 0.02);
    this.e.cleanup(n, f, env, p, r);
    return { f, env, p };
  }

  tone({ t = this.e.now, type = 'sine', freq = 440, freqEnd = null, gain = 0.05, attack = 0.005, dur = 0.2, room = 0, curve = 'exp' }) {
    const c = this.c;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      else o.frequency.linearRampToValueAtTime(freqEnd, t + dur);
    }
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env).connect(this.e.sfxIn);
    const r = room ? this.roomTap(env, room) : null;
    o.start(t);
    o.stop(t + dur + 0.02);
    this.e.cleanup(o, env, r);
    return { o, env };
  }

  // Electric actuator: a filtered saw whose pitch follows the motion.
  servo(t, dur, f0, f1, gain = 0.03) {
    const c = this.c;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur * 0.8);
    o.frequency.linearRampToValueAtTime(f1 * 0.92, t + dur);
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(f0 * 4.02, t);
    o2.frequency.linearRampToValueAtTime(f1 * 4.02, t + dur * 0.8);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 2.2;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.12);
    env.gain.setValueAtTime(gain, t + dur - 0.2);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const g2 = c.createGain();
    g2.gain.value = 0.22;
    o.connect(bp).connect(env).connect(this.e.sfxIn);
    o2.connect(g2).connect(env);
    const r = this.roomTap(env, 0.2);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    this.e.cleanup(o, bp, env, g2, o2, r);
  }

  click(t, gain = 0.08, freq = 3200) {
    this.burst({ t, freq, q: 3, gain, dur: 0.025 });
    this.tone({ t, freq: 140, freqEnd: 80, gain: gain * 0.8, dur: 0.06 });
  }

  // ---------------------------------------------------------------- one-shots
  ui() {
    const t = this.e.now;
    this.tone({ t, freq: 2100, freqEnd: 1700, gain: 0.025, dur: 0.035 });
    this.burst({ t, type: 'highpass', freq: 6000, gain: 0.012, dur: 0.012 });
  }

  door(open, dur) {
    const t = this.e.now + 0.01;
    if (open) {
      this.click(t, 0.07);
      this.burst({ t: t + 0.03, type: 'highpass', freq: 2400, gain: 0.05, attack: 0.01, dur: 0.7, room: 0.3 });
      this.servo(t + 0.05, dur - 0.1, 120, 205);
    } else {
      this.servo(t, dur - 0.15, 200, 120);
      this.burst({ t: t + dur - 0.22, type: 'highpass', freq: 2000, gain: 0.03, attack: 0.05, dur: 0.3 });
      this.tone({ t: t + dur - 0.1, freq: 96, freqEnd: 58, gain: 0.26, dur: 0.2, room: 0.25 });
      this.burst({ t: t + dur - 0.1, type: 'lowpass', freq: 1300, gain: 0.12, dur: 0.07 });
      this.click(t + dur + 0.04, 0.05, 4200);
    }
  }

  lights(on) {
    const t = this.e.now + 0.01;
    this.click(t, 0.045, 5000);
    if (on) {
      this.tone({ t, freq: 180, freqEnd: 1900, gain: 0.022, attack: 0.25, dur: 1.05, room: 0.4 });
      this.tone({ t: t + 0.02, type: 'triangle', freq: 90, freqEnd: 950, gain: 0.018, attack: 0.3, dur: 1.0 });
      this.burst({ t, freq: 600, freqEnd: 7000, q: 2, gain: 0.02, attack: 0.6, dur: 1.0, room: 0.3 });
    } else {
      this.tone({ t, freq: 900, freqEnd: 110, gain: 0.02, dur: 0.45 });
    }
  }

  aero(mode) {
    const t = this.e.now + 0.01;
    const deploy = mode !== 'road';
    this.click(t, 0.05);
    this.servo(t + 0.04, 1.35, deploy ? 85 : 165, deploy ? 170 : 85, 0.032);
    this.burst({ t: t + 0.1, kind: 'pink', freq: 700, freqEnd: deploy ? 2200 : 500, q: 0.8, gain: 0.025, attack: 0.4, dur: 1.1 });
    this.click(t + 1.42, 0.08, 2600);
  }

  // Cold-gas burst: ignition crack + pressure blast. The sustained roar is the
  // thruster bed, which follows the car's thrust level.
  thrust() {
    const t = this.e.now + 0.005;
    this.tone({ t, freq: 72, freqEnd: 34, gain: 0.5, attack: 0.003, dur: 0.32, room: 0.3 });
    this.burst({ t, type: 'lowpass', freq: 2600, freqEnd: 400, gain: 0.32, attack: 0.002, dur: 0.18, room: 0.4 });
    this.burst({ t: t + 0.01, kind: 'pink', freq: 1800, freqEnd: 300, q: 0.5, gain: 0.2, attack: 0.03, dur: 2.3, room: 0.5 });
  }

  liftoff() {
    const t = this.e.now + 0.01;
    this.click(t, 0.06);
    this.tone({ t, type: 'triangle', freq: 70, freqEnd: 420, gain: 0.05, attack: 0.5, dur: 1.4, room: 0.3 });
    this.burst({ t: t + 0.4, kind: 'pink', type: 'lowpass', freq: 400, freqEnd: 3000, gain: 0.14, attack: 0.6, dur: 1.8, room: 0.5 });
  }

  touchdown() {
    const t = this.e.now + 0.01;
    this.tone({ t, freq: 80, freqEnd: 45, gain: 0.3, dur: 0.3, room: 0.3 });
    this.burst({ t, type: 'lowpass', freq: 900, gain: 0.1, dur: 0.15 });
    this.burst({ t: t + 0.02, kind: 'pink', type: 'highpass', freq: 1500, gain: 0.05, attack: 0.02, dur: 0.6 });
  }

  whoosh(dur = 1.2, gain = 0.1) {
    const t = this.e.now + 0.01;
    const b = this.burst({ t, kind: 'pink', freq: 250, q: 1.2, gain, attack: dur * 0.55, dur, room: 0.25, pan: -0.7 });
    b.f.frequency.cancelScheduledValues(t);
    b.f.frequency.setValueAtTime(250, t);
    b.f.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.55);
    b.f.frequency.exponentialRampToValueAtTime(500, t + dur);
    b.p.pan.setValueAtTime(-0.7, t);
    b.p.pan.linearRampToValueAtTime(0.7, t + dur);
  }

  reverseSwell(dur = 0.6, gain = 0.05) {
    const t = this.e.now + 0.01;
    const c = this.c;
    const n = this.e.noiseSource('white');
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4500;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.03);
    n.connect(hp).connect(env).connect(this.e.sfxIn);
    const r = this.roomTap(env, 0.4);
    n.start(t, Math.random());
    n.stop(t + dur + 0.05);
    this.e.cleanup(n, hp, env, r);
  }

  cricket(t, pan) {
    const c = this.c;
    const o = c.createOscillator();
    o.frequency.value = 4300 + Math.random() * 500;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    const pulses = 2 + Math.floor(Math.random() * 3);
    const g = 0.004 + Math.random() * 0.006;
    for (let i = 0; i < pulses; i++) {
      const s = t + i * 0.045;
      env.gain.setValueAtTime(0, s);
      env.gain.linearRampToValueAtTime(g, s + 0.008);
      env.gain.linearRampToValueAtTime(0, s + 0.03);
    }
    const p = c.createStereoPanner();
    p.pan.value = pan;
    o.connect(env).connect(p).connect(this.e.sfxIn);
    o.start(t);
    o.stop(t + pulses * 0.045 + 0.05);
    this.e.cleanup(o, env, p);
  }

  // ---------------------------------------------------------------- continuous
  setAmbience(name) {
    this.ambEnv = name;
  }

  update(dt, { speed = 0, grounded = true, thrust = 0, fans = 0, surface = 1 }) {
    const v = Math.abs(speed);
    const n = Math.min(1, v / 85);
    // wind grows with the square of speed, tyre roar saturates early
    this.set(this.wind.gain.gain, 0.24 * Math.pow(n, 1.5) + (grounded ? 0 : 0.03 * n));
    this.set(this.wind.filter.frequency, 380 + 1900 * n);
    this.set(this.tyre.gain.gain, grounded ? 0.16 * Math.min(1, v / 14) * surface : 0);
    this.set(this.tyre.filter.frequency, 130 + v * 13);
    this.set(this.whine.gain.gain, 0.0065 * Math.min(1, v / 5) * (1 - 0.6 * n));
    this.set(this.whine.osc.frequency, 160 + v * 36, 0.05);

    const th = Math.min(1, thrust);
    this.set(this.hiss.gain.gain, 0.3 * th, 0.05);
    this.set(this.hiss.filter.frequency, 1800 + 3200 * th, 0.05);
    this.set(this.rumble.gain.gain, 0.55 * th, 0.06);

    this.set(this.fanTone.gain.gain, 0.012 * fans, 0.2);
    this.set(this.fanTone.osc.frequency, 110 + fans * 520, 0.25);
    if (this.fanTone.filter) this.set(this.fanTone.filter.frequency, 220 + fans * 1040, 0.25);
    this.set(this.fanAir.gain.gain, 0.02 * fans, 0.2);

    // ambience: gusting desert wind, crickets at night, a quiet room in the studio
    this.gustPhase += dt;
    const gust = 0.6 + 0.4 * Math.sin(this.gustPhase * 0.31) * Math.sin(this.gustPhase * 0.17 + 1.3);
    const amb = this.ambEnv;
    this.set(this.ambWind.gain.gain, amb === 'salt' ? 0.05 * gust : amb === 'night' ? 0.03 * gust : 0, 0.6);
    this.set(this.ambWind.filter.frequency, 380 + 420 * gust, 0.6);
    this.set(this.ambRoom.gain.gain, amb === 'studio' ? 0.02 : 0, 0.6);
    if (amb === 'night') {
      this.cricketClock -= dt;
      if (this.cricketClock <= 0) {
        this.cricketClock = 0.25 + Math.random() * 1.2;
        this.cricket(this.e.now + 0.02, Math.random() * 1.6 - 0.8);
      }
    }
  }
}
