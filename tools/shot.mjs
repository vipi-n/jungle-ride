// Render screenshots of the running dev server for visual checks.
// usage: node tools/shot.mjs outDir name:query [name:query ...]
//   e.g. node tools/shot.mjs /tmp/shots 34:cam=34 side:cam=side
import { chromium } from 'playwright';

const outDir = process.argv[2] || '.';
const jobs = process.argv.slice(3).map((s) => {
  const i = s.indexOf(':');
  return { name: s.slice(0, i), query: s.slice(i + 1) };
});
const width = parseInt(process.env.SHOT_W || '1400', 10);
const height = parseInt(process.env.SHOT_H || '800', 10);
const base = process.env.SHOT_URL || 'http://localhost:5199/';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${base}?shot=1&${job.query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(() => logs.push('timeout waiting for __ready'));
  await page.waitForTimeout(parseInt(process.env.SHOT_WAIT || '500', 10));
  const out = `${outDir}/${job.name}.png`;
  await page.screenshot({ path: out });
  await page.close();
  console.log('saved', out, logs.length ? '\n  ' + logs.join('\n  ') : '');
}
await browser.close();
