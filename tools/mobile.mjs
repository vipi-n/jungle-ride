// Phone check: an iPhone-sized touch screen in portrait and landscape. Uses real
// multi-touch (DevTools protocol) to hold the gas while sliding the steering pad.
// usage: node tools/mobile.mjs outDir
import { chromium } from 'playwright';

const out = process.argv[2] || '.';
const base = process.env.SHOT_URL || 'http://localhost:5199/';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

for (const [name, width, height] of [
  ['portrait', 390, 844],
  ['landscape', 844, 390],
]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const at = async (sel, fx = 0.5) => {
    const b = await page.locator(sel).boundingBox();
    return { x: b.x + b.width * fx, y: b.y + b.height / 2 };
  };
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (n) => page.screenshot({ path: `${out}/${name}-${n}.png` });
  const state = () => page.evaluate(() => window.__debug.drive());
  const report = {};

  await page.goto(base);
  await page.waitForSelector('#loader.loaded .start', { state: 'visible' });
  await page.tap('#loader .start');
  await wait(6500);
  await shot('1-explore');

  await page.tap('.cam-toggle');
  await wait(400);
  await shot('2-views-open');
  await page.tap('[data-cam="side"]');
  await wait(400);
  report.viewsClosedAfterPick = !(await page.locator('.cam-rail').evaluate((e) => e.classList.contains('open')));
  report.viewLabel = await page.locator('.cam-toggle span').textContent();

  const bar = await at('.actions', 0.8);
  await touch('touchStart', [{ x: bar.x, y: bar.y, id: 9 }]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: bar.x - i * 25, y: bar.y, id: 9 }]);
  await touch('touchEnd', []);
  await wait(300);
  report.actionBarScrolledBy = await page.locator('.actions').evaluate((e) => Math.round(e.scrollLeft));

  await page.tap('[data-act="freedrive"]');
  await wait(2600);
  await shot('3-freedrive');

  const gas = await at('.touch-drive .gas');
  const left = await at('.touch-drive .steer', 0.25);
  const right = await at('.touch-drive .steer', 0.75);
  await touch('touchStart', [{ ...gas, id: 1 }]);
  await wait(2500);
  const h0 = (await state()).heading;
  await touch('touchStart', [{ ...gas, id: 1 }, { ...left, id: 2 }]);
  await wait(1200);
  const h1 = (await state()).heading;
  await shot('4-gas-steer-left');
  await touch('touchMove', [{ ...gas, id: 1 }, { ...right, id: 2 }]);
  await wait(1500);
  const h2 = (await state()).heading;
  report.turnedLeftThenRight = h1 > h0 && h2 < h1;
  report.kmh = (await state()).kmh;
  await touch('touchEnd', []);
  await wait(200);
  report.steerReleased = await page.evaluate(() => !document.querySelector('.touch-drive .steer').dataset.dir);
  report.pedalReleased = await page.evaluate(() => !document.querySelector('.touch-drive .gas').classList.contains('on'));

  await touch('touchStart', [{ ...gas, id: 1 }]);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  report.cpu4xFrameMs = await page.evaluate(
    () =>
      new Promise((res) => {
        const ts = [];
        let last = performance.now();
        const f = (now) => {
          ts.push(now - last);
          last = now;
          if (ts.length < 120) requestAnimationFrame(f);
          else {
            ts.sort((a, b) => a - b);
            res({ median: +ts[60].toFixed(1), p95: +ts[114].toFixed(1) });
          }
        };
        requestAnimationFrame(f);
      }),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await touch('touchEnd', []);

  await page.tap('[data-drive="exit"]');
  await wait(1500);
  report.exitedFreeDrive = !(await state()).active;
  await shot('5-after-exit');
  report.errors = errors;
  console.log(name, JSON.stringify(report));
  await ctx.close();
}
await browser.close();
