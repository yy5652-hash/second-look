import type { Finding } from '../engine/types';
export interface Piece {
  start: number;
  end: number;
  ids: string[];
}
// Spans this close together in the same sentence read as one phrase.
const SAME_PHRASE_GAP = 14;
const SENTENCE_END = /[.!?\n]/;
// Splits the message into plain and highlighted pieces, in order, covering all of the text.
export function cluePieces(text: string, findings: Finding[]): Piece[] {
  const spans = findings
    .flatMap((f) => f.spans.map((s) => ({ start: s.start, end: s.end, id: f.id })))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const phrases: Piece[] = [];
  for (const span of spans) {
    const last = phrases[phrases.length - 1];
    const gap = last ? text.slice(last.end, span.start) : '';
    if (last && gap.length <= SAME_PHRASE_GAP && !SENTENCE_END.test(gap)) {
      last.end = Math.max(last.end, span.end);
      if (!last.ids.includes(span.id)) last.ids.push(span.id);
    } else phrases.push({ start: span.start, end: span.end, ids: [span.id] });
  }
  const pieces: Piece[] = [];
  let at = 0;
  for (const phrase of phrases) {
    if (phrase.start > at) pieces.push({ start: at, end: phrase.start, ids: [] });
    pieces.push(phrase);
    at = phrase.end;
  }
  if (at < text.length) pieces.push({ start: at, end: text.length, ids: [] });
  return pieces;
}
