import { parse } from 'tldts';
import { brands } from '../data/brands';
import type { Link } from './types';
export const MAX_INPUT = 10000;
export const MAX_LINKS = 40;
export function refang(s: string) {
  return s
    .replace(/^hxxps?/i, (x) => (x.toLowerCase() === 'hxxps' ? 'https' : 'http'))
    .replace(/\[\.\]|\(\.\)|\{\.\}/g, '.')
    .replace(/\[:\]/g, ':');
}
function distance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
// "verifyapple" or "paypalsupport": the brand with one common scam word glued on, nothing else.
const glued = [
  'verify',
  'secure',
  'login',
  'signin',
  'support',
  'account',
  'update',
  'id',
  'help',
  'service',
  'billing',
  'online',
];
function wrapped(label: string, alias: string) {
  return glued.some((w) => label === w + alias || label === alias + w);
}
/** The text with each link blanked out, keeping every offset the same. */
export function blankLinks(text: string, links: Link[]) {
  let out = text;
  for (const link of [...links].reverse())
    out =
      out.slice(0, link.span.start) +
      ' '.repeat(link.span.end - link.span.start) +
      out.slice(link.span.end);
  return out;
}
export function inspectLinks(input: string): Link[] {
  const text = input.slice(0, MAX_INPUT),
    links: Link[] = [];
  // Tokenisation is linear; candidate and label lengths are bounded before URL parsing.
  for (const match of text.matchAll(/[^\s<>"“”]+/gu)) {
    let raw = match[0],
      start = match.index!;
    const leading = raw.match(/^[('“]+/)?.[0].length ?? 0;
    start += leading;
    raw = raw.slice(leading).replace(/[.,!?:;'”\])]+$/g, '');
    if (raw.length > 2048) continue;
    const normalized = refang(raw);
    const scheme = /^https?:\/\//i.test(normalized);
    if (!scheme && normalized.includes('@')) continue; // An email address is not a link.
    if (
      !scheme &&
      !/^(?:www\.)?(?:[\p{L}\p{N}_-]{1,63}\.)+\p{L}[\p{L}\p{N}-]{1,62}(?::\d{1,5})?(?:[/?#]|$)/u.test(
        normalized,
      ) &&
      !/^\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?(?:[/?#]|$)/.test(normalized)
    )
      continue;
    try {
      const u = new URL(scheme ? normalized : `https://${normalized}`);
      if (!/^https?:$/.test(u.protocol)) continue;
      const parsed = parse(u.hostname, { allowPrivateDomains: true });
      const host = u.hostname.toLowerCase().replace(/\.$/, '');
      // A raw IP address is its own identity; its last octets are not a registrable domain.
      const domain =
        parsed.isIp || host.startsWith('[')
          ? host
          : (parsed.domain ?? host.split('.').slice(-2).join('.'));
      if (!host.includes('.') && !parsed.isIp && !host.startsWith('[')) continue;
      // Without a scheme, "tomorrow.call" or "6.30" is ordinary writing. Count it as a link only when
      // its ending is a real top-level domain (or a reserved example ending), or it is an IP address.
      if (
        !scheme &&
        !parsed.isIp &&
        !parsed.isIcann &&
        !parsed.isPrivate &&
        !/\.(?:example|test|invalid|localhost)$/.test(host)
      )
        continue;
      const flags: Link['flags'] = [];
      const add = (id: string, title: string, explanation: string, weight: number) =>
        flags.push({ id, title, explanation, weight });
      const rawHost = normalized
        .replace(/^https?:\/\//i, '')
        .split(/[/?#]/)[0]
        .split('@')
        .pop()!;
      if (u.username || u.password)
        add(
          'userinfo',
          'The address hides its destination',
          'Words before @ are not the destination. The host after @ receives the visit.',
          4,
        );
      if (parsed.isIp || host.startsWith('['))
        add(
          'ip',
          'A number instead of a website name',
          'This address uses a raw network address. Verify it through a separate, trusted route.',
          3,
        );
      if (host.includes('xn--'))
        add(
          'punycode',
          'An address with encoded letters',
          'This address contains international characters. These can be legitimate, or can resemble other letters.',
          3,
        );
      if (/[a-z]/i.test(rawHost) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(rawHost))
        add(
          'mixed',
          'Different alphabets in one address',
          'Some letters may only look like the letters in a familiar address.',
          5,
        );
      if (
        [
          'bit.ly',
          'tinyurl.com',
          't.co',
          'is.gd',
          'cutt.ly',
          'rb.gy',
          'ow.ly',
          'shorturl.at',
          'tiny.cc',
        ].includes(domain)
      )
        add(
          'shortener',
          'The final destination is hidden',
          'A shortened link does not show where it ends up. Second Look never opens it.',
          2,
        );
      if (u.protocol === 'http:')
        add(
          'http',
          'The link uses plain HTTP',
          'This link does not request an encrypted connection. HTTPS alone would not prove it is genuine either.',
          1,
        );
      if (/\.(?:zip|mov|top|click|work|gq|tk|ml|cf)$/.test(host))
        add(
          'tld',
          'An address ending worth a closer look',
          'This ending appears on our small caution list. The ending alone does not show who runs the site.',
          1,
        );
      if (!parsed.isIp)
        for (const brand of brands) {
          if ((brand.domains as readonly string[]).includes(domain)) continue;
          const domainLabel = domain.split('.')[0];
          const hostLabels = host.split('.');
          const swap = (s: string) =>
            s.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's');
          const resembles = brand.aliases.some(
            (alias) =>
              hostLabels
                .slice(0, -1)
                .some((label) => label === alias || label.split('-').includes(alias)) ||
              hostLabels.slice(0, -1).some((label) => wrapped(label, alias)) ||
              (alias.length >= 4 &&
                (distance(domainLabel, alias) === 1 || swap(domainLabel) === alias)),
          );
          if (resembles) {
            add(
              'lookalike',
              `An address that resembles ${brand.name}`,
              `It uses a name or spelling like ${brand.name}, but its registrable domain is ${domain}. It is not one of that brand's domains in our small comparison list.`,
              5,
            );
            break;
          }
        }
      links.push({ raw, host, domain, span: { start, end: start + raw.length }, flags });
      if (links.length >= MAX_LINKS) break;
    } catch {
      /* Unparseable strings are never visited. */
    }
  }
  return links;
}
