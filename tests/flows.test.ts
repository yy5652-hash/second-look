import { describe, expect, it } from 'vitest';
import { recoveryPlan } from '../src/data/recovery';
import { guessRegion } from '../src/data/resources';
import type { Finding } from '../src/engine/types';
import { askBackAdvice } from '../src/flows/askback';
import { buildReport } from '../src/flows/report';
import { cluePieces, mergeFindings } from '../src/ui/clues';

describe('three questions', () => {
  it('stays quiet until there is something to say', () => {
    expect(askBackAdvice({})).toEqual({ state: 'incomplete', advice: [] });
    expect(askBackAdvice({ code: 'no', money: 'no' }).state).toBe('incomplete');
  });
  it('never treats "no" to everything as safe', () => {
    const { state, advice } = askBackAdvice({ code: 'no', money: 'no', act: 'no' });
    expect(state).toBe('quiet');
    expect(advice).toEqual([]);
  });
  it('responds to the first yes, and treats not sure like yes', () => {
    expect(askBackAdvice({ money: 'yes' }).state).toBe('pause');
    expect(askBackAdvice({ act: 'unsure' }).advice).toHaveLength(1);
  });
  it('lists the most urgent advice first whatever the answer order', () => {
    const { advice } = askBackAdvice({ act: 'yes', code: 'yes' });
    expect(advice).toHaveLength(2);
    expect(advice[0]).toContain('share');
  });
});

describe('merging clues into phrases', () => {
  const finding = (id: string, ...spans: [number, number][]): Finding => ({
    id,
    title: id,
    explanation: id,
    weight: 1,
    spans: spans.map(([start, end]) => ({ start, end })),
  });
  const shown = (text: string, findings: Finding[]) =>
    cluePieces(text, findings).map((p) => [text.slice(p.start, p.end), p.ids]);
  it('covers all of the text, in order, with no overlaps', () => {
    const text = 'Pay the fee now. Thanks a lot, see you at the shop.';
    const pieces = cluePieces(text, [finding('a', [0, 3], [12, 15]), finding('b', [8, 11])]);
    expect(pieces.map((p) => text.slice(p.start, p.end)).join('')).toBe(text);
    for (let i = 1; i < pieces.length; i++) expect(pieces[i].start).toBe(pieces[i - 1].end);
  });
  it('merges nearby words and combines their findings', () => {
    expect(shown('Pay the fee now', [finding('a', [0, 3]), finding('b', [8, 11])])).toEqual([
      ['Pay the fee', ['a', 'b']],
      [' now', []],
    ]);
  });
  it('does not merge across a sentence end or a line break', () => {
    expect(shown('Pay. Now', [finding('a', [0, 3], [5, 8])]).map((p) => p[0])).toEqual([
      'Pay',
      '. ',
      'Now',
    ]);
    expect(shown('Pay\nNow', [finding('a', [0, 3], [4, 7])]).map((p) => p[0])).toEqual([
      'Pay',
      '\n',
      'Now',
    ]);
  });
  it('keeps distant words apart', () => {
    const text = 'Pay and then some more words go here fee';
    expect(
      cluePieces(text, [finding('a', [0, 3], [37, 40])]).filter((p) => p.ids.length),
    ).toHaveLength(2);
  });
  it('handles overlapping spans and no spans', () => {
    expect(shown('verify now', [finding('a', [0, 6]), finding('b', [3, 10])])).toEqual([
      ['verify now', ['a', 'b']],
    ]);
    expect(shown('hello', [finding('a')])).toEqual([['hello', []]]);
  });
});

describe('recovery plan', () => {
  it('is empty until something is chosen', () => {
    expect(recoveryPlan([])).toEqual([]);
  });
  it('puts the most urgent first and the shared last step at the end', () => {
    const plan = recoveryPlan(['clicked', 'bank']).map((p) => p.step);
    expect(plan[0]).toContain('Call your bank now');
    expect(plan[plan.length - 1]).toContain('Keep the messages');
  });
  it('lists every "now" step before any "next" step', () => {
    const plan = recoveryPlan(['clicked', 'card', 'remote', 'password']);
    const firstNext = plan.findIndex((p) => p.when === 'next');
    expect(firstNext).toBeGreaterThan(0);
    expect(plan.slice(firstNext).every((p) => p.when === 'next')).toBe(true);
  });
  it('stops live remote access before anything else', () => {
    expect(recoveryPlan(['bank', 'remote'])[0].step).toContain('Disconnect');
  });
  it('does not repeat a step shared by two paths', () => {
    const plan = recoveryPlan(['password', 'code']).map((p) => p.step);
    expect(new Set(plan).size).toBe(plan.length);
  });
});

describe('report summary', () => {
  const empty = {
    when: '',
    amount: '',
    paidHow: '',
    contact: '',
    message: '',
    happened: [],
    done: [],
  };
  it('leaves out what was not filled in', () => {
    expect(buildReport(empty)).toBe('Scam report summary');
  });
  it('includes what was given, in the message’s exact words', () => {
    const report = buildReport({
      ...empty,
      amount: ' £1.45 ',
      message: 'Pay now',
      happened: ['I paid by card'],
      done: ['Called my bank'],
    });
    expect(report).toContain('Amount: £1.45');
    expect(report).toContain('- I paid by card');
    expect(report).toContain('- Called my bank');
    expect(report).toContain('The message I received:\nPay now');
  });
});

describe('region guess', () => {
  it('maps known regions and falls back to anywhere else', () => {
    expect(guessRegion('en-GB')).toBe('UK');
    expect(guessRegion('zh-CN')).toBe('China');
    expect(guessRegion('fr-FR')).toBe('Elsewhere');
    expect(guessRegion('en')).toBe('Elsewhere');
    expect(guessRegion('not a language')).toBe('Elsewhere');
  });
});

describe('merged findings', () => {
  const f = (id: string, start: number): Finding => ({
    id,
    title: id,
    explanation: '',
    weight: 1,
    spans: [{ start, end: start + 2 }],
  });
  it('shows the family and temporary-number rules as one finding with both highlights', () => {
    const merged = mergeFindings([f('family', 0), f('urgent', 5), f('temp-number', 10)]);
    expect(merged.map((x) => x.id)).toEqual(['family', 'urgent']);
    expect(merged[0].spans).toHaveLength(2);
  });
  it('leaves a lone rule alone', () => {
    expect(mergeFindings([f('temp-number', 0)]).map((x) => x.id)).toEqual(['temp-number']);
  });
});
