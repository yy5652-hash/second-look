import { inspectLinks, MAX_INPUT, refang } from './links';
export function defang(s: string) {
  return s
    .replace(/https?/gi, (m) => (m.toLowerCase() === 'https' ? 'hxxps' : 'hxxp'))
    .replace(/\./g, '[.]');
}
export function redact(text: string): string {
  let result = text
    .slice(0, MAX_INPUT)
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, '[email removed]');
  // Work backwards so replacement lengths never shift earlier spans.
  for (const link of inspectLinks(result).reverse())
    result =
      result.slice(0, link.span.start) + defang(refang(link.raw)) + result.slice(link.span.end);
  result = result.replace(/(?:\+?\d[\d ()\-]{5,}\d)/g, (m) =>
    (m.match(/\d/g)?.length ?? 0) >= 7 ? '[number removed]' : m,
  );
  return result.replace(/\d{5,}/g, '[number removed]');
}
export function trustNote(text: string) {
  return `Could you help me check this message before I act? Please do not open the links.\n\n${redact(text)}\n\nSecond Look is a limited on-device check, not a guarantee. I will verify the sender another way.`;
}
