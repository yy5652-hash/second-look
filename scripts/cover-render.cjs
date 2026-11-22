// Renders scripts/cover.html. Default: docs/screenshots/cover.png (1200x800 @2x).
// `node scripts/cover-render.cjs --yt out.jpg`: 16:9 1280x720 JPEG for the YouTube thumbnail.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const yt = process.argv[2] === '--yt';
  const out = yt ? process.argv[3] : (process.argv[2] || path.join(__dirname, '..', 'docs/screenshots/cover.png'));
  const b = await chromium.launch();
  const p = await b.newPage(yt
    ? { viewport: { width: 1422, height: 800 }, deviceScaleFactor: 1280 / 1422 }
    : { viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'cover.html') + (yt ? '?wide' : ''), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot(yt ? { path: out, type: 'jpeg', quality: 92 } : { path: out });
  await b.close();
})();
