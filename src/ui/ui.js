import './ui.css';
import { TRIMS, AERO_MODES, CAMERAS, HOTSPOTS, ENVIRONMENTS } from './content.js';
import { PAINTS } from '../car/materials.js';

const ICONS = {
  doors: '<path d="M4 17h16M6 17l2-6h7l3 6"/><path d="M8 11l4-6 6 3"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/>',
  lights: '<path d="M10 6c-4 0-6 3-6 6s2 6 6 6c1.5 0 2-1 2-6s-.5-6-2-6z"/><path d="M15 8h5M15 12h6M15 16h5"/>',
  thrust: '<path d="M4 12h6"/><path d="M10 8l10 4-10 4z"/><path d="M2 9l3 3-3 3"/>',
  hover: '<path d="M4 15h16l-2-4H6z"/><path d="M8 19l-1 2M12 19v2M16 19l1 2"/><path d="M12 9V3M9 6l3-3 3 3"/>',
  drive: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M5.5 16.5l5-3M18.5 16.5l-5-3"/>',
  freedrive: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  underside: '<path d="M3 9h18l-2.5-4h-13z"/><circle cx="7" cy="10.5" r="1.5"/><circle cx="17" cy="10.5" r="1.5"/><path d="M12 21v-6.5M9 17l3-3 3 3"/>',
  spin: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  hotspots: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
  hide: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20L20 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  exit: '<path d="M6 6l12 12M18 6L6 18"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  chev: '<path d="M7 10l5 5 5-5"/>',
  left: '<path d="M15 5l-8 7 8 7z"/>',
  right: '<path d="M9 5l8 7-8 7z"/>',
  gas: '<path d="M5 15l7-8 7 8z"/>',
  brake: '<path d="M5 9l7 8 7-8z"/>',
  bolt: '<path d="M13 2L5 13h6l-1 9 8-12h-6z"/>',
};

const svg = (name) => `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

export function createUI(app) {
  const root = el('<div id="ui"></div>');
  document.body.appendChild(root);
  const veil = el('<div id="veil"></div>');
  document.body.appendChild(veil);

  root.innerHTML = `
    <div class="brand">
      <div class="wordmark">TESLA</div>
      <h1>Roadster</h1>
      <p>Interactive 3D design explorer</p>
    </div>
    <div class="top-right">
      <div class="seg glass env">${Object.entries(ENVIRONMENTS)
        .map(([k, v]) => `<button data-env="${k}">${v}</button>`)
        .join('')}</div>
      <button class="glass icon-btn sound-btn" title="Music on / off (M)">${svg('note')}</button>
      <button class="glass icon-btn gear-btn" title="Sound settings">${svg('gear')}</button>
      <button class="glass icon-btn help-btn" title="Keyboard shortcuts">?</button>
      <div class="settings glass">
        <div class="set-title">Sound</div>
        <label class="set-row"><span><b>Music</b><small>Adaptive score that follows the action</small></span><input type="checkbox" data-set="music" /><i class="switch"></i></label>
        <input class="set-range" type="range" min="0" max="1" step="0.01" data-set="musicVolume" aria-label="Music volume" />
        <label class="set-row"><span><b>Sound effects</b><small>Doors, aero, thrusters, wind</small></span><input type="checkbox" data-set="sfx" /><i class="switch"></i></label>
        <input class="set-range" type="range" min="0" max="1" step="0.01" data-set="sfxVolume" aria-label="Effects volume" />
      </div>
    </div>
    <div class="trim-panel glass">
      <div class="trim-tabs">${Object.entries(TRIMS)
        .map(([k, v]) => `<button data-trim="${k}">${v.label}</button>`)
        .join('')}</div>
      <div class="fade-swap trim-body"></div>
      <div class="reserve">Reserve: $5,000 today, $45,000 within 10 days.<br/>Production targeted for 2028.</div>
    </div>
    <div class="cam-rail glass">
      <button class="cam-toggle" aria-label="Choose a view"><span></span>${svg('chev')}</button>
      <div class="label">VIEW</div>
      ${['chase', 'front', '34', 'side', 'rear34', 'rear', 'top', 'under', 'cabin']
        .map((k) => `<button data-cam="${k}">${CAMERAS[k].label}</button>`)
        .join('')}
    </div>
    <div class="hotspots"></div>
    <div class="info glass">
      <button class="close" aria-label="Close">×</button>
      <h3></h3>
      <p></p>
      <div class="row"></div>
    </div>
    <div class="bottom">
      <div class="caption"><div class="t"></div><div class="s"></div></div>
      <div class="aero glass">${Object.entries(AERO_MODES)
        .map(([k, v]) => `<button data-aero="${k}">${v.label}</button>`)
        .join('')}</div>
      <div class="actions glass">
        <button data-act="doors">${svg('doors')}Doors</button>
        <button data-act="lights">${svg('lights')}Lights</button>
        <button data-act="thrust">${svg('thrust')}Thrust</button>
        <button data-act="hover">${svg('hover')}Fly</button>
        <button data-act="drive">${svg('drive')}Drive</button>
        <button data-act="freedrive" title="Drive anywhere with W A S D or the arrow keys (G)">${svg('freedrive')}Free Drive</button>
        <span class="sep"></span>
        <button data-act="underside" title="Let the camera go below the car (U)">${svg('underside')}Underside</button>
        <button data-act="spin">${svg('spin')}Turntable</button>
        <button data-act="hotspots">${svg('hotspots')}Features</button>
        <button data-act="hide">${svg('hide')}Clean</button>
      </div>
    </div>
    <div class="paint">
      <div class="name">Paint · <b></b></div>
      <div class="swatches">${Object.entries(PAINTS)
        .map(([k, p]) => `<button data-paint="${k}" title="${k}" style="background:${swatch(p.color, p.metalness)}"></button>`)
        .join('')}</div>
    </div>
    <div class="hint">Drag to orbit 360° · Scroll to zoom · Right-drag to pan<br/>Double-click the car to focus · Press ? for shortcuts</div>
    <div class="drive-hud">
      <div class="speed"><b>0</b><span>km/h</span></div>
      <div class="gear"><i data-g="P">P</i><i data-g="R">R</i><i data-g="D">D</i></div>
      <div class="keys"><kbd>W</kbd><kbd>S</kbd> throttle / brake · <kbd>A</kbd><kbd>D</kbd> steer · <kbd>Space</kbd> boost · <kbd>F</kbd> fly</div>
    </div>
    <div class="drive-bar">
      <button class="glass" data-drive="exit">${svg('exit')}Exit</button>
      <button class="glass" data-drive="cam">${svg('camera')}View</button>
      <button class="glass" data-act="hover">${svg('hover')}Fly</button>
      <button class="glass" data-act="lights">${svg('lights')}Lights</button>
    </div>
    <div class="touch-drive">
      <div class="steer" aria-label="Steer: hold the left or right half"><i class="l">${svg('left')}</i><i class="r">${svg('right')}</i></div>
      <div class="pedals">
        <button class="boost" data-touch="boost" aria-label="Boost">${svg('bolt')}</button>
        <button class="brake" data-touch="down" aria-label="Brake and reverse">${svg('brake')}</button>
        <button class="gas" data-touch="up" aria-label="Accelerate">${svg('gas')}</button>
      </div>
    </div>
    <button class="glass icon-btn unhide keep" title="Show interface (H)">${svg('hotspots')}</button>
    <div class="help">
      <div class="glass">
        <h3>Keyboard shortcuts</h3>
        <dl>
          <dt>1 2 3</dt><dd>Road / High-Downforce / Low-Drag</dd>
          <dt>D</dt><dd>Open or close the doors</dd>
          <dt>L</dt><dd>Lights</dd>
          <dt>T</dt><dd>Fire the cold-gas thrusters</dd>
          <dt>F</dt><dd>Fly (in Free Drive: take off / land)</dd>
          <dt>V</dt><dd>Drive demo</dd>
          <dt>G</dt><dd>Free Drive on / off</dd>
          <dt>W A S D</dt><dd>Free Drive: throttle, brake, steer (arrows too)</dd>
          <dt>Space</dt><dd>Free Drive: thruster boost</dd>
          <dt>O</dt><dd>Doors while in Free Drive</dd>
          <dt>U</dt><dd>Underside view on / off</dd>
          <dt>M</dt><dd>Music on / off</dd>
          <dt>R</dt><dd>Turntable</dd>
          <dt>C</dt><dd>Next camera view</dd>
          <dt>E</dt><dd>Next environment</dd>
          <dt>P</dt><dd>Next paint</dd>
          <dt>H</dt><dd>Hide or show the interface</dd>
          <dt>Esc</dt><dd>Close panels</dd>
        </dl>
      </div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  // ------------------------------------------------------------ wiring
  $$('[data-env]').forEach((b) => b.addEventListener('click', () => app.setEnv(b.dataset.env)));
  $$('[data-trim]').forEach((b) => b.addEventListener('click', () => app.setTrim(b.dataset.trim)));
  // on small screens the view rail collapses into a single toggle
  const camRail = $('.cam-rail');
  $$('[data-cam]').forEach((b) =>
    b.addEventListener('click', () => {
      app.setCam(b.dataset.cam);
      camRail.classList.remove('open');
    }),
  );
  $('.cam-toggle').addEventListener('click', () => camRail.classList.toggle('open'));
  $('[data-drive="exit"]').addEventListener('click', () => app.setSetting('freeDrive', false));
  $('[data-drive="cam"]').addEventListener('click', () => app.nextCam());
  $$('[data-aero]').forEach((b) => b.addEventListener('click', () => app.setAero(b.dataset.aero)));
  $$('[data-paint]').forEach((b) => b.addEventListener('click', () => app.setPaint(b.dataset.paint)));
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => app.action(b.dataset.act)));
  $('.help-btn').addEventListener('click', () => toggleHelp());
  $('.help').addEventListener('click', () => toggleHelp(false));
  $('.info .close').addEventListener('click', () => closeInfo());
  $('.unhide').addEventListener('click', () => setHidden(false));

  // settings popover
  const settingsEl = $('.settings');
  const toggleSettings = (v) => settingsEl.classList.toggle('show', v);
  $('.gear-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings();
  });
  $('.sound-btn').addEventListener('click', () => app.setSetting('music', !$('[data-set="music"]').checked));
  settingsEl.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('pointerdown', (e) => {
    if (!settingsEl.contains(e.target) && !e.target.closest('.gear-btn')) toggleSettings(false);
    if (!camRail.contains(e.target)) camRail.classList.remove('open');
  });
  $$('[data-set]').forEach((inp) => {
    const ev = inp.type === 'range' ? 'input' : 'change';
    inp.addEventListener(ev, () => {
      app.setSetting(inp.dataset.set, inp.type === 'range' ? parseFloat(inp.value) : inp.checked);
      inp.blur();
    });
  });

  // touch Free Drive: one steering pad the thumb can slide across (it keeps the
  // pointer, so crossing the middle switches direction), plus separate pedals
  const steer = $('.touch-drive .steer');
  const steerAt = (e) => {
    const r = steer.getBoundingClientRect();
    const dir = e.clientX < r.left + r.width / 2 ? 'left' : 'right';
    if (steer.dataset.dir === dir) return;
    steer.dataset.dir = dir;
    app.touchDrive('left', dir === 'left');
    app.touchDrive('right', dir === 'right');
  };
  const steerOff = () => {
    delete steer.dataset.dir;
    app.touchDrive('left', false);
    app.touchDrive('right', false);
  };
  steer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    steer.setPointerCapture(e.pointerId);
    steerAt(e);
  });
  steer.addEventListener('pointermove', (e) => {
    if (steer.hasPointerCapture(e.pointerId)) steerAt(e);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) steer.addEventListener(ev, steerOff);
  steer.addEventListener('contextmenu', (e) => e.preventDefault());
  $$('[data-touch]').forEach((b) => {
    const k = b.dataset.touch;
    const set = (v) => (e) => {
      e.preventDefault();
      b.classList.toggle('on', v);
      app.touchDrive(k, v);
    };
    b.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // a focused button would otherwise re-fire on Space while driving
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) b.blur();
  });

  // hotspots
  const hsWrap = $('.hotspots');
  const hsEls = {};
  for (const h of HOTSPOTS) {
    const b = el(`<button class="hs off" aria-label="${h.title}"><span class="tip">${h.title}</span></button>`);
    b.addEventListener('click', () => openInfo(h.id));
    hsWrap.appendChild(b);
    hsEls[h.id] = b;
  }

  function openInfo(id) {
    const h = HOTSPOTS.find((x) => x.id === id);
    if (!h) return;
    const card = $('.info');
    card.querySelector('h3').textContent = h.title;
    card.querySelector('p').textContent = h.text;
    const row = card.querySelector('.row');
    row.innerHTML = '';
    if (h.action) {
      const a = el(`<button>${h.actionLabel}</button>`);
      a.addEventListener('click', () => app.hotspotAction(h.action));
      row.appendChild(a);
    }
    const back = el('<button class="ghost">Back to overview</button>');
    back.addEventListener('click', () => {
      closeInfo();
      app.setCam('34');
    });
    row.appendChild(back);
    card.classList.add('show');
    app.setCam(h.cam);
  }

  function closeInfo() {
    $('.info').classList.remove('show');
  }

  function toggleHelp(v) {
    $('.help').classList.toggle('show', v);
  }

  // ------------------------------------------------------------ caption
  let capTimer = 0;
  function caption(title, sub = '', hold = 3.2) {
    const c = $('.caption');
    c.classList.remove('show');
    clearTimeout(capTimer);
    requestAnimationFrame(() => {
      c.querySelector('.t').textContent = title;
      c.querySelector('.s').textContent = sub;
      c.classList.add('show');
      capTimer = setTimeout(() => c.classList.remove('show'), hold * 1000);
    });
  }

  // ------------------------------------------------------------ state sync
  let lastTrim = null;
  function sync(s) {
    $$('[data-env]').forEach((b) => b.classList.toggle('active', b.dataset.env === s.env));
    $$('[data-cam]').forEach((b) => b.classList.toggle('active', b.dataset.cam === s.cam));
    $$('[data-aero]').forEach((b) => b.classList.toggle('active', b.dataset.aero === s.aero));
    $$('[data-paint]').forEach((b) => b.classList.toggle('active', b.dataset.paint === s.paint));
    $$('[data-trim]').forEach((b) => b.classList.toggle('active', b.dataset.trim === s.trim));
    $('.paint .name b').textContent = s.paint;
    const act = { doors: s.doors, lights: s.lights, thrust: s.thrusting, hover: s.hovering, drive: s.driving, freedrive: s.settings.freeDrive, underside: s.settings.underside, spin: s.spin, hotspots: s.hotspots, hide: false };
    for (const [k, v] of Object.entries(act)) $$(`[data-act="${k}"]`).forEach((b) => b.classList.toggle('active', !!v));
    $('.cam-toggle span').textContent = CAMERAS[s.cam]?.label ?? 'View';
    $('[data-act="thrust"]').title = 'Fire the cold-gas thrusters (T)';
    $('[data-act="hover"]').title = s.settings.freeDrive ? (s.hovering ? 'Land (F)' : 'Take off (F)') : 'Fly (F)';
    const st = s.settings;
    for (const inp of $$('[data-set]')) {
      const v = st[inp.dataset.set];
      if (inp.type === 'range') {
        if (document.activeElement !== inp) inp.value = v;
      } else inp.checked = !!v;
    }
    $('[data-set="musicVolume"]').disabled = !st.music;
    $('[data-set="sfxVolume"]').disabled = !st.sfx;
    $('.sound-btn').innerHTML = svg(st.music ? 'note' : 'mute');
    $('.sound-btn').classList.toggle('muted', !st.music);
    root.classList.toggle('free-drive', !!st.freeDrive);
    root.classList.toggle('underside', !!st.underside);
    if (s.trim !== lastTrim) {
      const body = $('.trim-body');
      const t = TRIMS[s.trim];
      const render = () => {
        body.innerHTML = `
          <div class="trim-tag">${t.tag}</div>
          <div class="trim-name">Roadster ${t.label}</div>
          <div class="specs">${t.specs.map(([v, u, k]) => `<div class="spec"><div class="v">${v}<small>${u}</small></div><div class="k">${k}</div></div>`).join('')}</div>
          <div class="trim-note">${t.note}</div>`;
        body.classList.remove('out');
      };
      if (lastTrim) {
        body.classList.add('out');
        setTimeout(render, 220);
      } else render();
      lastTrim = s.trim;
    }
    hsWrap.style.display = s.hotspots ? '' : 'none';
  }

  function updateHotspots(list) {
    for (const h of list) {
      const e = hsEls[h.id];
      e.style.transform = `translate(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px)`;
      e.classList.toggle('off', !h.visible);
    }
  }

  function setHidden(v) {
    root.classList.toggle('hidden', v);
  }

  const hud = { speed: $('.drive-hud .speed b'), gears: $$('.drive-hud [data-g]'), last: '' };
  function updateHud({ kmh, gear, boost }) {
    const key = `${kmh}|${gear}|${boost}`;
    if (key === hud.last) return;
    hud.last = key;
    hud.speed.textContent = kmh;
    for (const g of hud.gears) g.classList.toggle('on', g.dataset.g === gear);
    $('.drive-hud').classList.toggle('boost', !!boost);
  }

  return {
    root,
    sync,
    caption,
    updateHotspots,
    closeInfo,
    toggleHelp,
    setHidden,
    updateHud,
    toggleSettings,
    get hidden() {
      return root.classList.contains('hidden');
    },
    ready() {
      root.classList.add('ready');
      document.getElementById('loader')?.classList.add('done');
    },
    // Scene is loaded: offer the Start button (a user gesture is needed to unlock audio).
    awaitStart() {
      const loader = document.getElementById('loader');
      const btn = loader?.querySelector('.start');
      if (!btn) return Promise.resolve();
      loader.classList.add('loaded');
      btn.focus({ preventScroll: true });
      return new Promise((resolve) => {
        const go = (e) => {
          if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return;
          e.preventDefault();
          window.removeEventListener('keydown', go, true);
          btn.blur();
          resolve();
        };
        btn.addEventListener('click', go, { once: true });
        window.addEventListener('keydown', go, true);
      });
    },
    async veil(fn) {
      veil.classList.add('on');
      await new Promise((r) => setTimeout(r, 460));
      await fn();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      veil.classList.remove('on');
    },
  };
}

function swatch(hex, metal) {
  const c = `#${hex.toString(16).padStart(6, '0')}`;
  const hi = metal > 0.3 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)';
  return `radial-gradient(circle at 32% 28%, ${hi}, transparent 46%), ${c}`;
}
