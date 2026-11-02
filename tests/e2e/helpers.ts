import { expect, type Page } from '@playwright/test';
import QRCode from 'qrcode';
import sharp from 'sharp';

export const ORIGIN = 'http://127.0.0.1:4317';

/** Collects console problems, including Content Security Policy violations. */
export function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || /content security policy|refused to/i.test(m.text()))
      problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

/** Every request the page makes that does not go to the app's own origin. */
export function watchExternal(page: Page) {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (/^(?:https?|wss?):/i.test(url) && !url.startsWith(ORIGIN)) external.push(url);
  });
  return external;
}

export async function check(page: Page, text: string) {
  await page.getByLabel('Paste the message here').fill(text);
  await page.getByRole('button', { name: /Check this message/ }).click();
  await expect(page.locator('#result')).toBeVisible();
}

/** A synthetic screenshot of a message, drawn from text so OCR has something to read. */
export async function messageImage(lines: string[]) {
  const rows = lines
    .map(
      (l, i) =>
        `<text x="40" y="${90 + i * 70}" font-size="46" font-family="Helvetica, Arial, sans-serif" fill="#111">${l}</text>`,
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${150 + lines.length * 70}"><rect width="100%" height="100%" fill="#fff"/>${rows}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function qrImage(url: string) {
  const png = await QRCode.toBuffer(url, { width: 520, margin: 4 });
  return sharp(png).flatten({ background: '#fff' }).png().toBuffer();
}
