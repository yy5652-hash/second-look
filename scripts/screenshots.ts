// Produces docs/screenshots/*.png from the built app (run `npm run build` first).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { messageImage } from '../tests/e2e/helpers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs/screenshots');
const PORT = 4319;
const base = `http://127.0.0.1:${PORT}/`;
const SCAM =
  'Delivery notice: your parcel is held for an unpaid fee of £1.45. Pay within 2 hours at https://parcel-desk.example/fee to avoid return.';

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start');
}

async function main() {
  mkdirSync(out, { recursive: true });
  const server = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: root, stdio: 'ignore' },
  );
  try {
    await waitForServer();
    const browser = await chromium.launch();
    const shot = async (
      name: string,
      opts: { width: number; height: number; scheme: 'light' | 'dark' },
      steps: (page: import('@playwright/test').Page) => Promise<void>,
      full = false,
    ) => {
      const ctx = await browser.newContext({
        viewport: { width: opts.width, height: opts.height },
        colorScheme: opts.scheme,
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      await page.goto(base);
      await page.addStyleTag({ content: '*{caret-color:transparent!important}' });
      await steps(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
      await ctx.close();
    };
    const analyse = async (page: import('@playwright/test').Page, text: string) => {
      await page.getByLabel('Paste the message here').fill(text);
      await page.getByRole('button', { name: /Check this message/ }).click();
      await page.locator('#result').waitFor();
    };
    await shot('desktop-light', { width: 1280, height: 900, scheme: 'light' }, async () => {});
    await shot('mobile', { width: 390, height: 844, scheme: 'light' }, async () => {}, true);
    await shot('dark', { width: 1280, height: 900, scheme: 'dark' }, async (page) => {
      await analyse(page, SCAM);
    });
    await shot('result-desktop', { width: 1280, height: 900, scheme: 'light' }, async (page) => {
      await analyse(page, SCAM);
    });
    await shot('result-mobile', { width: 390, height: 844, scheme: 'light' }, async (page) => {
      await analyse(page, SCAM);
    });
    await shot('ask-back', { width: 1280, height: 900, scheme: 'light' }, async (page) => {
      await page.getByRole('button', { name: /Dentist reminder/ }).click();
      await page
        .locator('.askback')
        .getByRole('group', { name: /pay or send money/ })
        .getByText('Yes', { exact: true })
        .click();
    });
    await shot('result-highlights', { width: 1280, height: 900, scheme: 'light' }, async (page) => {
      await analyse(page, SCAM);
      await page.locator('.evidence-grid').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.locator('mark').nth(1).click();
      await page.locator('.evidence-grid').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    });
    await shot('recovery-flow', { width: 1280, height: 900, scheme: 'light' }, async (page) => {
      await page.locator('.recovery-entry').click();
      await page.getByRole('checkbox', { name: 'I paid by card' }).check();
      await page.getByRole('checkbox', { name: 'I clicked a link or opened a page' }).check();
      await page.locator('ol.steps li').first().getByRole('checkbox').check();
      await page
        .locator('.recovery-options')
        .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    });
    await shot('report-summary', { width: 1280, height: 900, scheme: 'light' }, async (page) => {
      await analyse(page, SCAM);
      await page.getByRole('button', { name: 'Already clicked or paid?' }).click();
      await page.getByRole('checkbox', { name: 'I paid by card' }).check();
      await page.locator('.report > summary').click();
      await page.getByLabel('When it happened').fill('Today, 09:40');
      await page.getByLabel('Amount').fill('£1.45');
      await page.getByLabel('How it was paid or shared').fill('Debit card on a payment page');
      await page.getByLabel('Their number, account or username').fill('+44 7700 900123');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.locator('.report').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    });
    await shot('ocr-confirm', { width: 1280, height: 900, scheme: 'light' }, async (page) => {
      const png = await messageImage([
        'Your bank account is locked.',
        'Verify now at secure-login.example',
        'or it will be closed today.',
      ]);
      await page
        .locator('input[type=file]')
        .setInputFiles({ name: 'screenshot.png', mimeType: 'image/png', buffer: png });
      await page.locator('.image-note').waitFor({ timeout: 60_000 });
      await page.locator('.input-card').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    });
    await browser.close();
    console.log(`Screenshots written to ${out}`);
  } finally {
    server.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
