export const actions = {
  clicked: 'I clicked a link or opened a page',
  password: 'I typed a password',
  code: 'I shared a login or payment code',
  details: 'I gave card or bank details',
  bank: 'I sent money by bank transfer',
  card: 'I paid by card',
  gift: 'I sent gift cards',
  crypto: 'I sent cryptocurrency',
  app: 'I used a payment app',
  remote: 'I installed an app or gave remote access',
} as const;
export type RecoveryAction = keyof typeof actions;
// "now": stops live access or money that may still be recoverable. "next": everything after that.
// Each step is one thing to do, so one tick means one thing done.
export type When = 'now' | 'next';
export interface Step {
  step: string;
  when: When;
}
const now = (step: string): Step => ({ step, when: 'now' }),
  next = (step: string): Step => ({ step, when: 'next' });
const accountSteps = [
  now('Open the service’s real app, or type its address yourself, and change the password.'),
  next('If you can’t get in, use the service’s own account recovery.'),
  next('Change the same password anywhere else you used it.'),
  next('Sign out of other sessions and turn on two-step verification.'),
  next('Look for changes, purchases or messages you didn’t make, and tell the service’s support.'),
];
export const recoverySteps: Record<RecoveryAction, Step[]> = {
  clicked: [
    now('Close the page. Don’t reply, download anything or allow notifications.'),
    next('If a file downloaded, delete it without opening it.'),
    next('Update your browser and run your device’s built-in security scan.'),
    next('Remove any notification permission you gave that site.'),
    next('If you typed details or installed something there, tick that above too.'),
  ],
  password: accountSteps,
  code: [
    now(
      'Contact your bank or the service through its real app or a known number. The code may have approved a payment or a login.',
    ),
    ...accountSteps,
  ],
  details: [
    now('Call your bank or card issuer on the number on your card. Say which details you shared.'),
    now('Ask them to freeze or replace the card.'),
    next('Turn on transaction alerts and look through recent payments.'),
    next('Dispute any payment you don’t recognise through your bank.'),
    next('If you also gave ID documents, ask a reporting service below about identity theft help.'),
  ],
  bank: [
    now(
      'Call your bank now on the number on your card. Say you were tricked into a transfer and ask for a recall.',
    ),
    next('Don’t send another payment, even if someone says it will release a refund.'),
  ],
  card: [
    now(
      'Call the card issuer on the number on your card. Say it was a scam and ask about a chargeback.',
    ),
    now('Ask whether the card should be frozen or replaced.'),
    next('Watch your statements for other charges.'),
  ],
  gift: [
    now(
      'Contact the gift card company through its official website or the packaging. Ask if the balance can be frozen.',
    ),
    next('Keep the card itself and its receipt.'),
    next('Don’t give the card numbers to anyone else who contacts you.'),
  ],
  crypto: [
    now(
      'Contact the exchange or wallet provider through its official support. Give them the transaction reference and the address you paid.',
    ),
    next(
      'Don’t pay anyone who promises to recover it for a fee. Crypto transfers are usually final.',
    ),
  ],
  app: [
    now('Open the payment app yourself and report the payment to its official support.'),
    now('If the app used your bank account or card, call that bank or card issuer too.'),
  ],
  remote: [
    now('Disconnect that device from Wi-Fi, mobile data and cables.'),
    now('From another device you trust, call your bank.'),
    next(
      'Change the passwords of accounts that were open on that device. Sign out other sessions.',
    ),
    next(
      'Have a trusted technician or the device maker remove the remote tool before you reconnect. A full reset may be needed.',
    ),
    next('Don’t contact the “support” person who approached you again.'),
  ],
};
export const recoverySources = [
  'https://consumer.ftc.gov/articles/what-do-if-you-were-scammed',
  'https://www.fbi.gov/how-we-can-help-you/common-frauds-and-scams/tech-support-scams',
];
// Most urgent first: stopping live access and money that may still be recoverable come first.
const urgency: RecoveryAction[] = [
  'remote',
  'bank',
  'card',
  'code',
  'details',
  'app',
  'crypto',
  'gift',
  'password',
  'clicked',
];
const lastStep = next(
  'Keep the messages, receipts and transaction references. Then report it using the routes below.',
);
// "Now" steps come first, then "next" steps, each in urgency order. A step shared by two paths
// appears once.
export function recoveryPlan(selected: RecoveryAction[]): Step[] {
  if (!selected.length) return [];
  const chosen = urgency.filter((action) => selected.includes(action));
  const all = [...chosen.flatMap((action) => recoverySteps[action]), lastStep];
  const seen = new Set<string>();
  return (['now', 'next'] as const).flatMap((when) =>
    all.filter((s) => s.when === when && !seen.has(s.step) && seen.add(s.step)),
  );
}
