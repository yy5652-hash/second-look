import { expect, test, type Page } from '@playwright/test';
import { check, messageImage, ORIGIN, qrImage, watchConsole, watchExternal } from './helpers';

const SCAM =
  'Delivery notice: your parcel is held for an unpaid fee of £1.45. Pay within 2 hours at https://parcel-desk.example/fee to avoid return.';

test.describe('checking a message', () => {
  test('paste flow: outcome, highlights linked both ways, next step', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission can only be granted in Chromium');
    const problems = watchConsole(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Is this message a scam');
    await page.evaluate((t) => navigator.clipboard.writeText(t), SCAM);
    await page.getByLabel('Paste the message here').focus();
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.getByLabel('Paste the message here')).toHaveValue(SCAM);
    await page.getByRole('button', { name: /Check this message/ }).click();

    const result = page.locator('#result');
    await expect(page.locator('#outcome-title')).toHaveText('Strong signs of a scam');
    await expect(page.locator('#outcome-title')).toBeFocused();
    // The result replaces the input instead of appearing under it.
    await expect(page.getByLabel('Paste the message here')).toHaveCount(0);
    await expect(result).toContainText('open the courier', { ignoreCase: true });
    await expect(result).toContainText('parcel-desk.example');
    const marks = result.locator('mark');
    expect(await marks.count()).toBeGreaterThan(1);
    // Nearby clues merge into phrases, and each phrase is an exact slice of the input.
    expect(await marks.count()).toBeLessThan(8);
    for (const t of await marks.allTextContents()) expect(SCAM).toContain(t);
    // Words -> finding, and finding -> words, both by keyboard.
    await marks.first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.finding-list li.active').first()).toBeFocused();
    await expect(marks.first()).toHaveAttribute('aria-pressed', 'true');
    await page
      .getByRole('button', { name: /Show these words/ })
      .last()
      .click();
    await expect(result.locator('mark.active').first()).toBeFocused();
    // The live region announces the outcome.
    await expect(page.locator('p[role="status"][aria-live="polite"].sr-only')).toContainText(
      'Strong signs of a scam',
    );
    expect(problems).toEqual([]);
  });

  test('paste and check gives a result in one tap', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission can only be granted in Chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
    await page.goto('/');
    await page.evaluate((t) => navigator.clipboard.writeText(t), SCAM);
    await page.getByRole('button', { name: 'Paste and check' }).click();
    await expect(page.locator('#outcome-title')).toHaveText('Strong signs of a scam');
  });

  test('when pasting is not possible it says so and points to the box', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: () => Promise.reject(new Error('denied')) },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Paste and check' }).click();
    await expect(page.locator('#input-notice')).toContainText('Tap the box');
    await expect(page.getByLabel('Paste the message here')).toBeFocused();
  });

  test('a genuine example is not alarmed, and never called safe', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Dentist reminder/ }).click();
    await expect(page.locator('#outcome-title')).toHaveText('Check before you act');
    await expect(page.locator('.outcome-status')).toHaveText('No known signs found');
    await expect(page.locator('#result')).toContainText('does not mean the message is safe');
    await expect(page.locator('.outcome')).toContainText('synthetic blind test');
  });

  test('three questions turn a no-signs result into specific advice', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Dentist reminder/ }).click();
    const panel = page.locator('.askback');
    const answer = (question: RegExp, choice: string) =>
      panel.getByRole('group', { name: question }).getByText(choice, { exact: true }).click();
    await expect(panel.locator('.askback-advice')).toBeEmpty();
    await answer(/code, a password/, 'No');
    await answer(/pay or send money/, 'No');
    await expect(panel.locator('.askback-advice')).toBeEmpty();
    await answer(/open a link/, 'No');
    await expect(panel.locator('.askback-advice')).toContainText('isn’t asking you');
    await expect(panel).not.toContainText(/\bsafe\b/);
    await answer(/code, a password/, 'Yes');
    // The advice for a question appears right under that question.
    await expect(
      panel.getByRole('group', { name: /code, a password/ }).locator('.askback-inline'),
    ).toContainText('Don’t share them');
    await expect(panel.locator('.askback-advice')).toContainText('suspicious');
    await answer(/pay or send money/, 'Not sure');
    await expect(panel.locator('.askback-inline:not(:empty)')).toHaveCount(2);
  });

  test('every example gives its labelled outcome', async ({ page }) => {
    await page.goto('/');
    const chips = page.locator('.example-buttons .chip');
    const n = await chips.count();
    expect(n).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click();
      const title = await page.locator('#outcome-title').textContent();
      if (i < 5) expect(title, `example ${i}`).toMatch(/Strong signs|Some warning/);
      else expect(title, `example ${i}`).toBe('Check before you act');
      await page.getByRole('button', { name: 'Check another message' }).click();
    }
  });

  test('the browser back button returns to the message, and the URL never holds it', async ({
    page,
  }) => {
    await page.goto('/');
    await check(page, SCAM);
    expect(page.url()).toBe(`${ORIGIN}/`);
    await page.goBack();
    await expect(page.getByLabel('Paste the message here')).toHaveValue(SCAM);
    await page.goForward();
    await expect(page.locator('#outcome-title')).toBeVisible();
    await page.getByRole('button', { name: 'Edit this message' }).click();
    await expect(page.getByLabel('Paste the message here')).toHaveValue(SCAM);
    await expect(page.getByLabel('Paste the message here')).toBeFocused();
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
    const shown = await evidence.textContent();
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
    await page.getByRole('button', { name: /Check this message/ }).click();
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
    await page.getByRole('button', { name: 'Check another message' }).click();
    await expect(page.getByLabel('Paste the message here')).toHaveValue('');
    await expect(page.locator('#result')).toHaveCount(0);
    await page.getByLabel('Paste the message here').fill(SCAM);
    await page.getByRole('button', { name: 'Clear message' }).click();
    await expect(page.getByLabel('Paste the message here')).toHaveValue('');
  });

  test('share note redacts personal details and defangs links', async ({ page }) => {
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
    await page.locator('#trust-note').fill('Can you look at this text for me?');
    await expect(page.locator('#trust-note')).toHaveValue('Can you look at this text for me?');
    await page.getByRole('button', { name: 'Undo my edits' }).click();
    await expect(page.locator('#trust-note')).toHaveValue(text);
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
    await page.getByRole('button', { name: /Check this message/ }).click();
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
    await page.getByRole('button', { name: /Check this message/ }).click();
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
  test('image OCR still works on a browser without SIMD, with the plain core', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'the patch targets this engine');
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
  const open = (page: Page) => page.locator('.recovery-entry').click();
  test('already clicked or paid: steps, region resources, honest warnings', async ({ page }) => {
    await page.goto('/');
    await open(page);
    await expect(page.locator('#recovery-title')).toBeFocused();
    await page.getByRole('checkbox', { name: 'I paid by card' }).check();
    await page.getByLabel('Your region').selectOption('UK');
    const panel = page.locator('.recovery-content');
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
    await open(page);
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

  test('several things happened: one checklist, most urgent first, with progress', async ({
    page,
  }) => {
    await page.goto('/');
    await open(page);
    await page.getByRole('checkbox', { name: 'I clicked a link or opened a page' }).check();
    await page.getByRole('checkbox', { name: 'I sent money by bank transfer' }).check();
    const steps = page.locator('ol.steps li');
    await expect(steps.first()).toContainText('Call your bank now');
    await expect(steps.last()).toContainText('Keep the messages');
    await expect(page.getByRole('heading', { name: 'Do these now' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Then, when you can' })).toBeVisible();
    const total = await steps.count();
    await expect(page.locator('.plan-head [role="status"]')).toHaveText(`0 of ${total} done`);
    await steps.first().getByRole('checkbox').check();
    await expect(page.locator('.plan-head [role="status"]')).toHaveText(`1 of ${total} done`);
    await expect(steps.first()).toHaveClass(/done/);
  });

  test('the summary holds the message and details, and stays out of storage', async ({ page }) => {
    await page.goto('/');
    await check(page, SCAM);
    await page.getByRole('button', { name: 'Already clicked or paid?' }).click();
    await page.getByRole('checkbox', { name: 'I paid by card' }).check();
    await page.locator('ol.steps li').first().getByRole('checkbox').check();
    await page.locator('.report > summary').click();
    await page.getByLabel('Amount').fill('£1.45');
    await page.getByLabel('Their number, account or username').fill('+44 7700 900123');
    const report = page.locator('[data-testid="report"]');
    await expect(report).toContainText('Amount: £1.45');
    await expect(report).toContainText('+44 7700 900123');
    await expect(report).toContainText('I paid by card');
    await expect(report).toContainText('What I have already done');
    await expect(report).toContainText(SCAM);
    const stored = await page.evaluate(
      () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
    );
    expect(stored).not.toContain('7700');
    expect(page.url()).toBe(`${ORIGIN}/`);
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

  test('a shared message is answered by the service worker and never reaches the host', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'share targets exist only in Chromium browsers');
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    // The share target is declared only once the worker is there to answer it.
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'share.webmanifest');
    const declared = await page.evaluate(async () => (await fetch('share.webmanifest')).json());
    expect(declared.share_target.method).toBe('POST');
    expect(declared.share_target.action).toBe('./share');
    const posted = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith('/share'),
    );
    await page.evaluate(async () => {
      const form = new FormData();
      form.set('text', 'Send me your verification code right now.');
      await fetch('share', { method: 'POST', body: form });
    });
    expect((await posted).fromServiceWorker()).toBe(true);
    await page.goto('/?shared=1');
    await expect(page.locator('#outcome-title')).toHaveText('Strong signs of a scam');
    expect(page.url()).toBe(`${ORIGIN}/`);
    // It was handed over once and is gone from the worker.
    await page.goto('/?shared=1');
    await expect(page.locator('#input-notice')).toContainText('did not arrive');
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
      await page.getByRole('button', { name: 'Already clicked or paid?' }).click();
      await page.getByRole('checkbox', { name: 'I paid by card' }).check();
      await page.locator('.report > summary').click();
      await page.getByLabel('Your region').selectOption('UK');
      expect(await wide()).toBe(false);
      await page.getByRole('button', { name: 'How this works' }).click();
      expect(await wide()).toBe(false);
      // Long unbroken text must not push the layout sideways either.
      await page.getByRole('button', { name: 'Back to check' }).click();
      await page.getByRole('button', { name: 'Clear message' }).click();
      const long = 'a'.repeat(300) + ' https://' + 'b'.repeat(120) + '.example/' + 'c'.repeat(150);
      await check(page, long);
      expect(await wide()).toBe(false);
      // Large text must fit too, on every view.
      await page.getByRole('button', { name: 'Larger text' }).click();
      expect(await wide()).toBe(false);
      await page.getByRole('button', { name: 'Check another message' }).click();
      expect(await wide()).toBe(false);
      await page.locator('.recovery-entry').click();
      expect(await wide()).toBe(false);
    });
  }

  test('larger text is remembered after a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Larger text' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
    await expect(page.getByRole('button', { name: 'Larger text' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('on a phone the two next actions stay in view while reading the result', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/');
    await check(page, SCAM);
    const bar = page.locator('.result-bar');
    await expect(bar).toBeInViewport();
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(200);
    await expect(bar).toBeInViewport();
    const box = await bar.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(700);
    await expect(page.locator('#outcome-title')).not.toBeInViewport({ ratio: 1 });
  });

  test('keyboard-only: tab reaches the box, the button, and focus is visible', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    await page.keyboard.press('Tab'); // skip link
    await page.keyboard.press('Tab');
    for (let i = 0; i < 8; i++) {
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      if (tag === 'TEXTAREA') break;
      await page.keyboard.press('Tab');
    }
    await expect(page.getByLabel('Paste the message here')).toBeFocused();
    await page.keyboard.type('Please send your password now.');
    // Safari on a Mac moves between buttons with Option+Tab unless its settings say otherwise.
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(page.getByRole('button', { name: /Check this message/ })).toBeFocused();
    const outline = await page
      .getByRole('button', { name: /Check this message/ })
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.locator('#outcome-title')).toHaveText('Strong signs of a scam');
  });
});
