import { describe, it, expect } from 'vitest';
import { analyze, MAX_INPUT } from '../src/engine/analyze';
import { inspectLinks } from '../src/engine/links';
import { redact, trustNote } from '../src/engine/redact';
import fixtures from './fixtures/messages.json';
import modern from './fixtures/modern-messages.json';
import modernUnseen from './fixtures/modern-unseen.json';
describe('author-written message fixtures', () => {
  for (const f of fixtures)
    it(`${f.id}: ${f.text.slice(0, 65)}`, () => {
      const result = analyze(f.text);
      if (f.label === 'genuine') expect(result.level).toBe('none');
      else {
        expect(['stop', 'caution']).toContain(result.level);
        expect(result.findings.map((x) => x.id)).toContain(f.rule);
      }
      for (const finding of result.findings)
        for (const span of finding.spans) {
          expect(span.start).toBeGreaterThanOrEqual(0);
          expect(span.end).toBeLessThanOrEqual(f.text.length);
          expect(span.end).toBeGreaterThan(span.start);
          expect(f.text.slice(span.start, span.end).trim()).not.toBe('');
        }
    });
});
describe('signal combinations and bounded input', () => {
  it('keeps urgency alone quiet', () =>
    expect(analyze('Urgent, call me when you can.').level).toBe('none'));
  it('combines urgency with a link, with exact evidence', () => {
    const text = 'Urgent: visit https://details.example today.';
    const r = analyze(text);
    expect(r.level).toBe('caution');
    expect(
      r.findings
        .find((f) => f.id === 'pressure-action')
        ?.spans.map((s) => text.slice(s.start, s.end)),
    ).toEqual(['Urgent', 'https://details.example']);
  });
  it('combines urgency and payment into stop', () =>
    expect(analyze('Send money by bank transfer urgently.').level).toBe('stop'));
  it('handles tiny input and tiny links', () => {
    expect(analyze('Hi').level).toBe('too_short');
    expect(analyze('a.test').level).toBe('none');
  });
  it('reports unsupported wording as its own level, never none or caution', () => {
    const r = analyze('您的账户已被锁定，请立即点击链接支付费用');
    expect(r.level).toBe('unsupported');
    expect(r.findings).toEqual([]);
    expect(r.summary).toContain('could not judge the wording');
    expect(r.notes.join(' ')).toContain('English only');
  });
  it('a harmless Chinese message does not get a warning level', () =>
    expect(analyze('明天下午三点在图书馆见面，记得带书。').level).toBe('unsupported'));
  it('a strong link flag still beats unsupported wording', () => {
    expect(analyze('请访问 https://paypal.com@evil.example/x').level).toBe('caution');
    expect(analyze('请访问 https://paypa1.example').level).toBe('stop');
    expect(analyze('请访问 https://ordinary.example 看看').level).toBe('unsupported');
    expect(analyze('请访问 https://bit.ly/abc 看看').level).toBe('caution');
  });
  it('runs links even for non-Latin text', () =>
    expect(analyze('请访问 https://paypa1.example').level).toBe('stop'));
  it('caps 1 MB before regex processing', () => {
    const start = performance.now();
    const r = analyze('x'.repeat(1024 * 1024));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(r.notes[0]).toContain('10,000');
    expect(r.level).toBe('none');
  });
  it('handles long malformed links without backtracking', () => {
    const start = performance.now();
    analyze(('a.'.repeat(5000) + '!').repeat(2));
    expect(performance.now() - start).toBeLessThan(1000);
  });
  it('does not let an earlier denial hide a later demand', () =>
    expect(analyze('Never share your password. Send me your verification code now.').level).toBe(
      'stop',
    ));
  it('keeps offsets after emoji and non-ascii punctuation', () => {
    const text = '🙂 Please send your password to me.';
    const r = analyze(text);
    const s = r.findings[0].spans[0];
    expect(text.slice(s.start, s.end)).toBe('send your password');
  });
  it('does not repeat-score the same link flag', () => {
    expect(analyze('https://bit.ly/a https://bit.ly/b https://bit.ly/c').level).toBe('caution');
  });
  it('caps inspected links', () => {
    const r = analyze(Array.from({ length: 50 }, (_, i) => `https://site${i}.example`).join(' '));
    expect(r.links).toHaveLength(40);
    expect(r.notes.join(' ')).toContain('40 links');
  });
  it('keeps HTML as data', () => {
    const text = '<script>alert(1)</script> send your password';
    expect(analyze(text).level).toBe('stop');
    expect(text).toContain('<script>');
  });
  it('ignores text beyond the limit', () =>
    expect(analyze('a'.repeat(MAX_INPUT) + ' send your password').level).toBe('none'));
});
describe('genuine two-factor texts and discussion of scams', () => {
  const genuine = [
    'Your verification code is 482913. Enter it on the sign-in page.',
    'Enter the code we just sent to finish signing in.',
    'Enter your verification code on the sign-in page. It is valid for 10 minutes.',
    'Use this security code to sign in. Enter your security code within 5 minutes.',
  ];
  for (const t of genuine) it(t, () => expect(analyze(t).level).toBe('none'));
  it('still stops when the reader is asked to hand over a code', () => {
    for (const t of [
      'Send me your verification code.',
      'Please tell us the one-time code you received.',
      'Reply with your login code to continue.',
      'Share your security code with the agent.',
    ])
      expect(analyze(t).level, t).toBe('stop');
  });
  it('still stops when "enter" or "confirm" comes with a link', () => {
    const r = analyze('Confirm your verification code at https://secure-check.example/login now.');
    expect(r.level).toBe('stop');
    expect(analyze('Enter your password at https://sign-in.example').level).toBe('stop');
  });
  it('a bare password request without a link is a warning', () =>
    expect(analyze('Please enter your password to continue.').level).toBe('caution'));
  it('discussion is quiet but an actual pitch is not', () => {
    expect(analyze('Our lesson covers why guaranteed returns are suspicious.').level).toBe('none');
    expect(analyze('The article warns readers about risk-free investments.').level).toBe('none');
    expect(analyze('Guaranteed returns of 20% every week. Join my group today.').level).toBe(
      'stop',
    );
    expect(analyze('Our lesson says you get guaranteed returns with us.').level).toBe('stop');
    expect(analyze('Join now: guaranteed returns, risk-free investments, no scam.').level).toBe(
      'stop',
    );
  });
  it('past-tense denial only silences the verb it precedes', () => {
    expect(analyze('The customer did not send the difference.').level).toBe('none');
    expect(analyze('Send me the difference, you overpaid. Do not tell anyone.').level).toBe('stop');
  });
});
describe('address inspection', () => {
  const cases: [string, string, string?][] = [
    ['https://paypal.security.example/login', 'security.example', 'lookalike'],
    ['https://paypa1.example', 'paypa1.example', 'lookalike'],
    ['https://paypal-login.example', 'paypal-login.example', 'lookalike'],
    ['https://paypol.example', 'paypol.example', 'lookalike'],
    ['https://paypal.com@evil.example/path', 'evil.example', 'userinfo'],
    ['http://192.0.2.8/path', '192.0.2.8', 'ip'],
    ['https://xn--pple-43d.example', 'xn--pple-43d.example', 'punycode'],
    ['https://аpple.example', 'xn--pple-43d.example', 'mixed'],
    ['https://bit.ly/abc', 'bit.ly', 'shortener'],
    ['http://ordinary.example', 'ordinary.example', 'http'],
    ['https://ordinary.zip', 'ordinary.zip', 'tld'],
    ['foo-bar.com/x', 'foo-bar.com'],
    ['hxxps://foo-bar[.]com/x', 'foo-bar.com'],
    ['hxxp[:]//foo-bar(.)com/x', 'foo-bar.com', 'http'],
    ['https://sub.project.github.io/x', 'project.github.io'],
    ['https://www.school.co.uk/x', 'school.co.uk'],
    ['https://paypal.com/path', 'paypal.com'],
  ];
  for (const [url, domain, flag] of cases)
    it(url, () => {
      const text = `Please see ${url}.`;
      const [link] = inspectLinks(text);
      expect(link?.domain).toBe(domain);
      expect(text.slice(link.span.start, link.span.end)).toBe(url);
      if (flag) expect(link.flags.map((f) => f.id)).toContain(flag);
      else expect(link.flags).toEqual([]);
    });
  it('email addresses are not treated as website links', () =>
    expect(inspectLinks('Contact hello@desk.example please')).toEqual([]));
  it('ordinary links do not claim safety', () => {
    const r = analyze('https://ordinary.example/path');
    expect(r.level).toBe('none');
    expect(r.notes.join(' ')).toContain('does not mean');
  });
});
describe('share-note privacy', () => {
  it('removes email, phone, account number and one-time code', () => {
    const r = redact('Alice alice@example.com +44 (7700) 900123 code 123456 account 123456789012.');
    expect(r).toContain('Alice');
    for (const s of ['alice@example', '7700', '123456', '123456789012']) expect(r).not.toContain(s);
  });
  it('defangs full, bare and already-defanged links', () => {
    const r = redact('https://a.example/x b.example hxxps://c[.]example');
    expect(r).not.toMatch(/https?:\/\//);
    expect(r).toContain('a[.]example');
    expect(r).toContain('b[.]example');
    expect(r).toContain('c[.]example');
  });
  it('limits the note and does not silently claim safety', () => {
    expect(trustNote('x'.repeat(20000)).length).toBeLessThan(11000);
    expect(trustNote('hello')).toContain('not a guarantee');
  });
});
describe('scheme-less text that is not a link', () => {
  it('ignores times, full stops without a space and unknown endings', () => {
    for (const t of ['See you at 6.30 or 8.30.', 'Ring me tomorrow.thanks for lunch', 'ah.the bus'])
      expect(inspectLinks(t), t).toEqual([]);
  });
  it('still finds bare addresses, private suffixes and IP addresses', () => {
    expect(inspectLinks('go to user.github.io/x now')[0]?.domain).toBe('user.github.io');
    expect(inspectLinks('open 192.0.2.8/login now')[0]?.domain).toBe('192.0.2.8');
    expect(inspectLinks('visit www.school.co.uk/x')[0]?.domain).toBe('school.co.uk');
  });
  it('flags a brand with one scam word glued on, not other words that contain it', () => {
    expect(inspectLinks('https://verifyapple.example')[0].flags.map((f) => f.id)).toContain(
      'lookalike',
    );
    expect(inspectLinks('https://pineapple.example')[0].flags).toEqual([]);
  });
});

// tests/fixtures/independent.json is the blind set. It stays out of the tests on purpose.
describe('modern messages', () => {
  for (const f of [...modern, ...modernUnseen])
    it(`${f.label}: ${f.text.slice(0, 60)}`, () => {
      const { level } = analyze(f.text);
      if (f.label === 'genuine') expect(level).toBe('none');
      else expect(['stop', 'caution']).toContain(level);
    });
});
