// Builds a plain-text summary for a bank or the police. It is shown, copied or printed by the
// person; nothing here stores or sends it.
export interface ReportFields {
  when: string;
  amount: string;
  paidHow: string;
  contact: string;
  message: string;
  happened: string[];
  done: string[];
}
export function buildReport(fields: ReportFields) {
  const lines = ['Scam report summary'];
  const add = (label: string, value: string) => {
    const clean = value.trim();
    if (clean) lines.push('', `${label}: ${clean}`);
  };
  add('When it happened', fields.when);
  add('Amount', fields.amount);
  add('How it was paid or shared', fields.paidHow);
  add('Their number, account or username', fields.contact);
  if (fields.happened.length) {
    lines.push('', 'What happened:');
    for (const item of fields.happened) lines.push(`- ${item}`);
  }
  if (fields.done.length) {
    lines.push('', 'What I have already done:');
    for (const item of fields.done) lines.push(`- ${item}`);
  }
  if (fields.message.trim()) lines.push('', 'The message I received:', fields.message.trim());
  return lines.join('\n');
}
