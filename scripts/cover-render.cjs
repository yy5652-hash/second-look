// Renders scripts/cover.html to docs/screenshots/cover.png (1200x800 @2x).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'cover.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: process.argv[2] || path.join(__dirname, '..', 'docs/screenshots/cover.png') });
  await b.close();
})();
