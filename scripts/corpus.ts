// Shared corpus helpers for evaluation and training. The split must be identical in both.
import { createHash } from 'node:crypto';

export function normalise(text: string) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
export function side(text: string): 'dev' | 'held' {
  const h = createHash('sha256').update(normalise(text)).digest();
  return h.readUInt32BE(0) % 2 === 0 ? 'dev' : 'held';
}

export function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
