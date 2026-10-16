// Drives the live app (start gate, intro, UI clicks, environment switches, Free
// Drive) and records screenshots plus console errors.  usage: node tools/interact.mjs outDir
import { chromium } from 'playwright';

const outDir = process.argv[2] || '.';
const base = process.env.SHOT_URL || 'http://localhost:5199/';
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const shot = async (name) => {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log('saved', name);
};
const click = (sel) => page.click(sel);
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await wait(ms);
  await page.keyboard.up(key);
};

await page.goto(base);
await page.waitForSelector('#loader.loaded .start', { state: 'visible' });
await shot('i00-start');
await click('#loader .start');
await wait(1800);
await shot('i01-intro');
await wait(4200);
await shot('i02-landed');

await click('[data-aero="downforce"]');
await wait(2600);
await shot('i03-downforce');

// Thrust and Fly work on every trim now
await click('[data-trim="performance"]');
await click('[data-cam="rear34"]');
await wait(2200);
await click('[data-act="thrust"]');
await wait(700);
await shot('i04-thrust-performance');
await wait(2500);

await click('[data-aero="road"]');
await click('[data-env="salt"]');
await wait(2000);
await click('[data-cam="34"]');
await wait(2000);
await click('[data-act="hover"]');
await wait(3600);
await shot('i05-hover-performance');
await wait(6500);

// underside: blocked by default, then allowed by the switch
await page.mouse.move(720, 300);
await page.mouse.down();
await page.mouse.move(720, 40, { steps: 25 });
await page.mouse.up();
await wait(1500);
await shot('i06-under-blocked');
console.log('camera y (switch off):', await page.evaluate(() => window.__debug?.camY()));

await click('.gear-btn');
await wait(400);
await shot('i07-settings');
await click('.gear-btn');
await click('[data-act="underside"]');
await wait(300);
await page.mouse.move(720, 300);
await page.mouse.down();
await page.mouse.move(720, 40, { steps: 25 });
await page.mouse.up();
await wait(1500);
console.log('camera y (switch on):', await page.evaluate(() => window.__debug?.camY()));
await shot('i08-under-allowed');
await click('[data-act="underside"]');
await wait(2200);

// free drive
await click('[data-act="freedrive"]');
await wait(2200);
await hold('KeyW', 3500);
await shot('i09-drive-fast');
await page.keyboard.down('KeyW');
await page.keyboard.down('KeyA');
await wait(1600);
await shot('i10-drive-turn');
await page.keyboard.up('KeyA');
await page.keyboard.down('Space');
await wait(900);
await shot('i11-drive-boost');
await page.keyboard.up('Space');
await page.keyboard.up('KeyW');
console.log('drive state:', JSON.stringify(await page.evaluate(() => window.__debug?.drive())));
await hold('KeyS', 2500);
await page.keyboard.press('KeyF');
await wait(3200);
await hold('KeyD', 1200);
await shot('i12-free-fly');
await page.keyboard.press('KeyF');
await wait(3400);

await click('[data-env="night"]');
await wait(2000);
await hold('KeyW', 3000);
await shot('i13-night-drive');
await hold('KeyS', 3000);

await click('[data-env="studio"]');
await wait(2000);
await shot('i14-back-studio');
console.log('free drive after studio:', await page.evaluate(() => window.__debug?.drive()));

const hs = await page.$$('.hs:not(.off)');
console.log('visible hotspots:', hs.length);
if (hs.length) {
  await hs[0].click();
  await wait(2200);
  await shot('i15-hotspot');
}

await page.keyboard.press('?');
await wait(500);
await shot('i16-help');
console.log('audio:', await page.evaluate(() => window.__debug?.audio()));

console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
