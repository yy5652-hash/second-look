import { expect, test } from '@playwright/test';
import { check, messageImage, ORIGIN, qrImage, watchConsole, watchExternal } from './helpers';

const SCAM =
  'Delivery notice: your parcel is held for an unpaid fee of £1.45. Pay within 2 hours at https://parcel-desk.example/fee to avoid return.';

test.describe('checking a message', () => {
  test('paste flow: outcome, highlights linked both ways, next step', async ({ page, context }) => {
    const problems = watchConsole(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Not sure about');
    await page.evaluate((t) => navigator.clipboard.writeText(t), SCAM);
    await page.getByLabel('Paste the message here').focus();
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.getByLabel('Paste the message here')).toHaveValue(SCAM);
    await page.getByRole('button', { name: /Take a second look/ }).click();

    const result = page.locator('#result');
    await expect(result.getByRole('heading', { level: 2 }).first()).toHaveText(
      'Strong signs of a scam',
    );
    await expect(result).toContainText('open the courier', { ignoreCase: true });
    await expect(result).toContainText('parcel-desk.example');
    const marks = result.locator('mark');
    expect(await marks.count()).toBeGreaterThan(2);
    // The marked words are exact slices of the input.
    for (const t of await marks.allTextContents()) expect(SCAM).toContain(t);
    // Evidence -> finding, and finding -> evidence, both by keyboard-reachable buttons.
    const ref = result.locator('.evidence-ref').first();
    await ref.focus();
    await page.keyboard.press('Enter');
    const target = await ref.getAttribute('aria-controls');
    await expect(page.locator(`#${target}`)).toBeFocused();
    // The live region announces the outcome.
    await expect(page.locator('p[role="status"][aria-live="polite"].sr-only')).toContainText(
      'Strong signs of a scam',
    );
    expect(problems).toEqual([]);
  });

  test('a genuine example is not alarmed, and never called safe', async ({ page }) => {
    await page.goto('/');
    await page.locator('details.examples summary').click();
    await page.getByRole('button', { name: /Dentist reminder/ }).click();
    await page.getByRole('button', { name: /Take a second look/ }).click();
    await expect(page.locator('#outcome-title')).toHaveText('No known signs');
    await expect(page.locator('#result')).toContainText('does not mean the message is safe');
  });

  test('every example gives its labelled outcome', async ({ page }) => {
    await page.goto('/');
    await page.locator('details.examples summary').click();
    const chips = page.locator('.example-buttons .chip');
    const n = await chips.count();
    expect(n).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click();
      await page.getByRole('button', { name: /Take a second look/ }).click();
      const title = await page.locator('#outcome-title').textContent();
      if (i < 5) expect(title, `example ${i}`).toMatch(/Strong signs|Some warning/);
      else expect(title, `example ${i}`).toBe('No known signs');
    }
  });

  test('a non-English message is not given a reassuring or alarming level', async ({ page }) => {
    await page.goto('/');
    await check(page, '明天下午三点在图书馆见面，记得带书。');
    await expect(page.locator('#outcome-title')).toHaveText('We could not judge the wording');
    await expect(page.locator('.outcome.unsupported')).toBeVisible();
  });

  test('HTML in the input is shown as text, never run', async ({ page }) => {
    const problems = watchConsole(page);
    let dialog = false;
    page.on('dialog', async (d) => {
      dialog = true;
      await d.dismiss();
    });
    await page.goto('/');
    const html =
      '<img src=x onerror="alert(1)"><script>alert(2)</script><b>bold</b> Please send your password.';
    await check(page, html);
    const evidence = page.locator('.message-evidence');
    await expect(evidence).toContainText('<img src=x onerror="alert(1)">');
    await expect(evidence).toContainText('<script>alert(2)</script>');
    expect(await evidence.locator('img, script, b').count()).toBe(0);
    expect(await page.locator('main img[src="x"], main script').count()).toBe(0);
    expect(dialog).toBe(false);
    expect(problems.filter((p) => !/404|Failed to load resource/.test(p))).toEqual([]);
  });

  test('links in a message are shown as text and are never anchors', async ({ page }) => {
    await page.goto('/');
    await check(page, SCAM);
    const evidence = page.locator('.message-evidence');
    // Numbered clue badges sit between the pieces of text, so read only the message itself.
    const shown = await evidence.evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll('.evidence-refs').forEach((n) => n.remove());
      return copy.textContent;
    });
    expect(shown).toBe(SCAM);
    expect(await page.locator('a[href*="parcel-desk"]').count()).toBe(0);
    expect(await evidence.locator('a').count()).toBe(0);
    // The link inspector names the real domain.
    await expect(page.locator('#result')).toContainText('parcel-desk.example');
  });

  test('a 1 MB paste is capped, says so, and does not freeze the page', async ({ page }) => {
    await page.goto('/');
    const started = Date.now();
    await page.getByLabel('Paste the message here').evaluate((el) => {
      const big = 'x'.repeat(1024 * 1024);
      (el as HTMLTextAreaElement).value = big;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#input-notice')).toContainText('10,000');
    await page.getByRole('button', { name: /Take a second look/ }).click();
    await expect(page.locator('#result')).toBeVisible();
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  test('clear removes message and results; nothing is kept in storage or the URL', async ({
    page,
  }) => {
    await page.goto('/');
    await check(page, SCAM);
    expect(page.url()).toBe(`${ORIGIN}/`);
    const stored = await page.evaluate(
      () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
    );
    expect(stored).not.toContain('parcel');
    await page.getByRole('button', { name: 'Clear message and results' }).click();
    await expect(page.getByLabel('Paste the message here')).toHaveValue('');
    await expect(page.locator('#result')).toHaveCount(0);
  });

  test('share note redacts personal details and defangs links', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
    await page.goto('/');
    await check(
      page,
      'Hi Sam, call 020 7946 0958 or mail sam@example.com. Pay at https://parcel-desk.example/fee, code 482961.',
    );
    await page.getByRole('button', { name: /Ask someone you trust/ }).click();
    const text = await page.locator('#trust-note').inputValue();
    expect(text).not.toContain('sam@example.com');
    expect(text).not.toContain('7946');
    expect(text).not.toContain('482961');
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).toContain('parcel-desk[.]example');
  });
});

test.describe('images', () => {
  test('image OCR: text is read locally into an editable box, then analysed', async ({ page }) => {
    const problems = watchConsole(page);
    const external = watchExternal(page);
    const requested: string[] = [];
    page.on('request', (r) => requested.push(new URL(r.url()).pathname));
    await page.goto('/');
    // OCR assets load only when an image is first used.
    expect(requested.some((p) => p.includes('/ocr/'))).toBe(false);
    const png = await messageImage(['Please send your password', 'and your verification code now']);
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'msg.png', mimeType: 'image/png', buffer: png });
    const box = page.getByLabel('Paste the message here');
    await expect(box).toHaveValue(/password/i, { timeout: 85_000 });
    await expect(page.locator('.image-note')).toContainText('Check the recognised text');
    await page.getByRole('button', { name: /Take a second look/ }).click();
    await expect(page.locator('#outcome-title')).toHaveText('Strong signs of a scam');
    expect(requested.some((p) => p.endsWith('worker.min.js'))).toBe(true);
    expect(requested.some((p) => /tesseract-core.*\.wasm\.js$/.test(p))).toBe(true);
    expect(external).toEqual([]);
    expect(problems.filter((p) => !/404|Failed to load resource/.test(p))).toEqual([]);
  });

  test('a QR code in an image adds its link without opening it', async ({ page }) => {
    const external = watchExternal(page);
    await page.goto('/');
    const png = await qrImage('https://qr-pay.example/invoice');
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByLabel('Paste the message here')).toHaveValue(
      /QR link: https:\/\/qr-pay\.example\/invoice/,
      { timeout: 85_000 },
    );
    await page.getByRole('button', { name: /Take a second look/ }).click();
    await expect(page.locator('#result')).toContainText('qr-pay.example');
    expect(external).toEqual([]);
  });

  test('a non-image file gets a plain message and a way back to typing', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    await expect(page.locator('#input-notice')).toContainText('PNG, JPEG, WebP or BMP');
    await expect(page.getByLabel('Paste the message here')).toBeEnabled();
  });
});

test.describe('images without SIMD', () => {
  // Service workers are blocked so the test can rewrite the worker script on its way in.
  test.use({ serviceWorkers: 'block' });
  test('image OCR still works on a browser without SIMD, with the plain core', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(new URL(r.url()).pathname));
    // Make feature detection say "no SIMD, no relaxed SIMD" for the worker too.
    await page.addInitScript(() => {
      const original = WebAssembly.validate.bind(WebAssembly);
      WebAssembly.validate = (bytes: BufferSource) => {
        const u8 = new Uint8Array(bytes as ArrayBuffer);
        return u8.length < 80 ? false : original(bytes);
      };
    });
    await page.route('**/ocr/v7/worker.min.js', async (route) => {
      const res = await route.fetch();
      const body = await res.text();
      const patch =
        'const __v=WebAssembly.validate.bind(WebAssembly);WebAssembly.validate=(b)=>new Uint8Array(b).length<80?false:__v(b);\n';
      await route.fulfill({ response: res, body: patch + body });
    });
    await page.goto('/');
    const png = await messageImage(['Install AnyDesk and give remote access']);
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'msg.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByLabel('Paste the message here')).toHaveValue(/any\s?desk|remote/i, {
      timeout: 85_000,
    });
    const cores = requested.filter((p) => /tesseract-core.*\.wasm\.js$/.test(p));
    expect(cores).toHaveLength(1);
    expect(cores[0]).toMatch(/tesseract-core-lstm\.wasm\.js$/);
  });
});

test.describe('recovery', () => {
  test('already clicked or paid: steps, region resources, honest warnings', async ({ page }) => {
    await page.goto('/');
    await page.locator('#recovery > summary').click();
    await page.getByLabel('What happened?').selectOption({ index: 2 });
    await page.getByLabel('Your region').selectOption('UK');
    const panel = page.locator('#recovery');
    await expect(panel.getByRole('heading', { name: 'Your next steps' })).toBeVisible();
    expect(await panel.locator('ol.steps li').count()).toBeGreaterThanOrEqual(3);
    await expect(panel).toContainText('Money may not come back');
    await expect(panel).toContainText('recover');
    await expect(panel).toContainText('does not replace emergency services');
    await expect(panel).toContainText('report@phishing.gov.uk');
    await expect(panel).toContainText('159');
    const links = panel.locator('.resource-list a');
    expect(await links.count()).toBeGreaterThan(2);
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
      await expect(a).toHaveAttribute('rel', /noreferrer/);
    }
    await expect(panel).toContainText('Last checked 2026-11-01');
  });

  test('every region shows its trusted routes', async ({ page }) => {
    await page.goto('/');
    await page.locator('#recovery > summary').click();
    for (const [region, expected] of [
      ['US', '7726'],
      ['UK', 'report@phishing.gov.uk'],
      ['Canada', '1-888-495-8501'],
      ['China', '96110'],
      ['Elsewhere', 'local police'],
    ] as const) {
      await page.getByLabel('Your region').selectOption(region);
      await expect(page.locator('.resource-list')).toContainText(expected);
    }
  });
});

test.describe('privacy and offline', () => {
  test('zero external requests, live counter reads 0, strict CSP, no console errors', async ({
    page,
  }) => {
    const external = watchExternal(page);
    const problems = watchConsole(page);
    const failed: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('/');
    await check(page, SCAM);
    await page.getByRole('button', { name: 'How this works' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('A second opinion');
    await page.getByRole('button', { name: 'Back to check' }).click();
    await page.getByRole('button', { name: /Use dark theme/ }).click();
    await expect(page.locator('[data-testid="external-count"]')).toHaveText('0');
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(external).toEqual([]);
    expect(failed).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('the counter is a live number even when a blocked request to another site is attempted', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const img = new Image();
      img.src = 'https://not-this-site.example/pixel.png';
    });
    // The CSP blocks the load, so the count may stay 0 in the page. The counter must not claim
    // anything it did not observe, and must still be a number.
    await expect(page.locator('[data-testid="external-count"]')).toHaveText(/^\d+$/);
  });

  test('works offline after the service worker is ready', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByText('Text checks ready offline')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByLabel('Paste the message here')).toBeVisible();
    await expect(page.getByText(/Offline/)).toBeVisible();
    await check(page, 'Send me your verification code right now.');
    await expect(page.locator('#outcome-title')).toHaveText('Strong signs of a scam');
    await context.setOffline(false);
  });

  test('the web app manifest and icons are served and valid', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(new URL(href!, ORIGIN + '/').toString())).json();
    expect(manifest.name).toContain('Second Look');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('layout', () => {
  for (const width of [320, 360]) {
    test(`no horizontal scroll at ${width}px, on every view`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.goto('/');
      const wide = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
      expect(await wide()).toBe(false);
      await check(page, SCAM);
      expect(await wide()).toBe(false);
      await page.locator('details.examples summary').click();
      expect(await wide()).toBe(false);
      await page.locator('#recovery > summary').click();
      await page.getByLabel('What happened?').selectOption({ index: 5 });
      await page.getByLabel('Your region').selectOption('UK');
      expect(await wide()).toBe(false);
      await page.getByRole('button', { name: 'How this works' }).click();
      expect(await wide()).toBe(false);
      // Long unbroken text must not push the layout sideways either.
      await page.getByRole('button', { name: 'Back to check' }).click();
      await check(
        page,
        'a'.repeat(300) + ' https://' + 'b'.repeat(120) + '.example/' + 'c'.repeat(150),
      );
      expect(await wide()).toBe(false);
    });
  }

  test('keyboard-only: tab reaches the box, the button, and focus is visible', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab');
    for (let i = 0; i < 6; i++) {
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      if (tag === 'TEXTAREA') break;
      await page.keyboard.press('Tab');
    }
    await expect(page.getByLabel('Paste the message here')).toBeFocused();
    await page.keyboard.type('Please send your password now.');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Take a second look/ })).toBeFocused();
    const outline = await page
      .getByRole('button', { name: /Take a second look/ })
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.locator('#outcome-title')).toHaveText('Strong signs of a scam');
  });
});
