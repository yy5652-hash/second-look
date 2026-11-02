// Follow-up questions for when the wording alone gave no conclusion. The answers stay in memory.
export type Answer = 'yes' | 'no' | 'unsure';
export type QuestionId = 'code' | 'money' | 'act';
export type Answers = Partial<Record<QuestionId, Answer>>;
// Listed most urgent first, which is also the order the advice appears in.
export const questions: { id: QuestionId; text: string; advice: string }[] = [
  {
    id: 'code',
    text: 'Does it ask for a code, a password or card details?',
    advice:
      'Don’t share them. Open the company’s real app, or call the number on your card, and ask whether the request is real.',
  },
  {
    id: 'money',
    text: 'Does it ask you to pay or send money?',
    advice:
      'Don’t pay from this message. Check with the person or company another way, using details you already have.',
  },
  {
    id: 'act',
    text: 'Does it ask you to open a link, call a number or install something?',
    advice:
      'Don’t use what the message gives you. Type the address you know, or use the company’s own app. Install nothing a stranger suggests.',
  },
];
export type AskBackState = 'incomplete' | 'pause' | 'quiet';
export function askBackAdvice(answers: Answers): { state: AskBackState; advice: string[] } {
  const advice = questions
    .filter((q) => answers[q.id] === 'yes' || answers[q.id] === 'unsure')
    .map((q) => q.advice);
  if (advice.length) return { state: 'pause', advice };
  const answered = questions.every((q) => answers[q.id] === 'no');
  return { state: answered ? 'quiet' : 'incomplete', advice: [] };
}
