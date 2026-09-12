/* Headless runner for CI. Opens tests/run.html, waits for the suite to finish,
   prints each result and exits non-zero on any failure. */
const { chromium } = require('playwright');

const URL = process.env.TEST_URL || 'http://localhost:8791/tests/run.html';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

  page.on('pageerror', e => console.error('page error:', e.message));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__DONE === true, null, { timeout: 60000 });

  const out = await page.evaluate(() => window.__RESULTS);
  await browser.close();

  for (const r of out.results) {
    console.log(`${r.pass ? 'ok  ' : 'FAIL'}  ${r.name}${r.pass ? '' : '\n        ' + r.error}`);
  }
  console.log(`\n${out.total - out.failed}/${out.total} passed`);
  process.exit(out.failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
