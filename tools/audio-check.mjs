// Offline-renders the score at each arrangement level and reports loudness.
// usage: node tools/audio-check.mjs [outDir-for-wav]
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const outDir = process.argv[2];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://localhost:5199/tools/audio-test.html');
await page.waitForFunction(() => window.__ready);

const BAR = (60 / 104) * 4;
const cases = [
  { name: 'L0-explore', levels: [[0, 0]], seconds: BAR * 8 },
  { name: 'L1-cruise', levels: [[0, 1]], seconds: BAR * 8 },
  { name: 'L2-fast', levels: [[0, 2]], seconds: BAR * 8 },
  { name: 'L3-soar', levels: [[0, 3]], seconds: BAR * 8 },
  { name: 'L3-night', levels: [[0, 3]], seconds: BAR * 4, flavor: 'night' },
  { name: 'journey', levels: [[0, 0], [4, 1], [8, 2], [12, 0]], seconds: BAR * 16, events: [{ at: BAR * 10.3, type: 'thrust' }] },
];
for (const c of cases) {
  const r = await page.evaluate((args) => window.render(args), { ...c, wavOut: !!outDir });
  if (outDir && r.wav) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(`${outDir}/${c.name}.wav`, Buffer.from(r.wav));
    delete r.wav;
  }
  console.log(c.name.padEnd(12), 'peak', String(r.peakDb).padStart(6), 'dBFS  rms', String(r.rms).padStart(6), 'dB  per-second', r.windows.join(' '));
}
await browser.close();
