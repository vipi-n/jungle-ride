// Measures average frame time of the live app in each environment.
import { chromium } from 'playwright';

const base = process.env.SHOT_URL || 'http://localhost:5199/';
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 });
await page.goto(base);
await page.waitForSelector('#loader.loaded .start', { state: 'visible' });
await page.click('#loader .start');
await page.waitForTimeout(6500);
const measure = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let last = performance.now();
        const tick = (t) => {
          times.push(t - last);
          last = t;
          if (times.length < 180) requestAnimationFrame(tick);
          else {
            times.sort((a, b) => a - b);
            resolve({ median: times[90].toFixed(1), p95: times[171].toFixed(1) });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
for (const env of ['studio', 'salt', 'night']) {
  await page.click(`[data-env="${env}"]`).catch(() => {});
  await page.waitForTimeout(2500);
  console.log(env, 'frame ms', JSON.stringify(await measure()));
}
// night is the heaviest scene; measure it again while free driving at speed
await page.keyboard.press('g');
await page.waitForTimeout(2000);
await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
console.log('night free drive', 'frame ms', JSON.stringify(await measure()));
await page.keyboard.up('KeyW');
await browser.close();
