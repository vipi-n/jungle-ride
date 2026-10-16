import { AudioEngine } from './engine.js';
import { Score } from './music.js';
import { Sfx } from './sfx.js';

const KEY = 'roadster.audio';
const DEFAULTS = { music: true, musicVolume: 0.7, sfx: true, sfxVolume: 0.8 };

function loadPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

// Facade used by the app. Everything is a no-op until unlock() runs inside a user
// gesture (browser autoplay policy), so callers never need to check.
export function createAudio() {
  const prefs = loadPrefs();
  let ctx = null;
  let engine = null;
  let score = null;
  let sfx = null;
  let flavor = 'studio';
  let level = 0;

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* private mode */
    }
  };

  const applyVolumes = (tc = 0.15) => {
    if (!engine) return;
    const t = engine.now;
    engine.musicVol.gain.setTargetAtTime(prefs.music ? prefs.musicVolume * 0.9 : 0, t, tc);
    engine.sfxVol.gain.setTargetAtTime(prefs.sfx ? prefs.sfxVolume : 0, t, tc);
    if (prefs.music && !score.running) score.start(engine.now + 0.1);
  };

  const tick = () => {
    if (!ctx || ctx.state !== 'running') return;
    score.scheduleUntil(ctx.currentTime + 0.14);
    if (!prefs.music && score.running && engine.musicVol.gain.value < 0.001) score.stop();
  };

  const api = {
    prefs,
    get started() {
      return !!ctx;
    },
    get status() {
      return ctx && { state: ctx.state, level: score.level, target: score.target, bar: score.bar, music: score.running };
    },

    unlock() {
      if (ctx) {
        if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
        return false;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      // iOS mutes Web Audio with the ring/silent switch unless the page plays as media
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      ctx = new AC({ latencyHint: 'interactive' });
      engine = new AudioEngine(ctx);
      score = new Score(engine);
      sfx = new Sfx(engine);
      score.setFlavor(flavor);
      sfx.setAmbience(flavor);
      score.setLevel(level);
      engine.musicVol.gain.value = 0;
      engine.sfxVol.gain.value = 0;
      applyVolumes(0.4);
      setInterval(tick, 25);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) ctx.suspend();
        else ctx.resume();
      });
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    },

    // Opening: riser into a hit as the light bar powers on, then the score.
    intro(hitIn = 1.4) {
      if (!ctx) return;
      const t = engine.now;
      score.stop();
      if (prefs.music) {
        score.riser(t + 0.05, hitIn - 0.05, 0.06);
        score.impact(t + hitIn, 0.2);
        score.start(t + hitIn);
      }
    },

    setMusic(on) {
      prefs.music = on;
      save();
      applyVolumes();
    },
    setMusicVolume(v) {
      prefs.musicVolume = v;
      save();
      applyVolumes(0.05);
    },
    setSfx(on) {
      prefs.sfx = on;
      save();
      applyVolumes();
    },
    setSfxVolume(v) {
      prefs.sfxVolume = v;
      save();
      applyVolumes(0.05);
    },

    setLevel(n) {
      level = n;
      score?.setLevel(n);
    },
    setEnv(name) {
      flavor = name;
      score?.setFlavor(name);
      sfx?.setAmbience(name);
    },

    // ---- events
    ui() {
      sfx?.ui();
    },
    door(open, dur) {
      if (!ctx) return;
      sfx.door(open, dur);
      score.stinger(open ? 'doors' : 'doorsClose');
    },
    lights(on) {
      if (!ctx) return;
      sfx.lights(on);
      if (on) score.stinger('lights');
    },
    aero(mode) {
      if (!ctx) return;
      sfx.aero(mode);
      score.stinger('aero');
    },
    thrust() {
      if (!ctx) return;
      sfx.thrust();
      engine.duckMusic(0.5, 0.03, 1.4, 1.6);
      if (prefs.music) score.impact(engine.now + 0.01, 0.2);
      score.surge(4);
    },
    boost() {
      if (!ctx) return;
      sfx.thrust();
      score.surge(2);
    },
    liftoff() {
      if (!ctx) return;
      sfx.liftoff();
      if (prefs.music) {
        score.riser(engine.now + 0.02, 1.3, 0.05);
        score.impact(engine.now + 1.35, 0.18);
      }
      score.surge(2);
    },
    touchdown() {
      sfx?.touchdown();
    },
    envSwitch() {
      if (!ctx) return;
      sfx.whoosh(1.1, 0.11);
      sfx.reverseSwell(0.45, 0.04);
    },
    camera(dur) {
      sfx?.whoosh(Math.max(0.6, dur * 0.9), 0.035);
    },
    chime() {
      score?.stinger('chime');
    },

    update(dt, info) {
      if (!ctx || ctx.state !== 'running') return;
      sfx.update(dt, info);
    },
  };
  return api;
}
