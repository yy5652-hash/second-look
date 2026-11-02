export const actions = {
  clicked: 'I only clicked a link',
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
const accountSteps = [
  'Open the service’s real app or type its known address yourself. Change the password. If you cannot get in, use its account recovery process.',
  'Change that password anywhere else you reused it. Sign out other sessions, check recovery details and turn on two-step verification.',
  'Contact the service’s support through its official app. Check for changes, purchases or messages you did not make.',
];
export const recoverySteps: Record<RecoveryAction, string[]> = {
  clicked: [
    'Close the page. Do not reply, download anything or allow notifications.',
    'If you only opened it, that does not automatically mean your account was taken over. Update your browser and device. Remove any site notification permission you allowed.',
    'If a file downloaded, do not open it. Delete it and run your device’s built-in security scan. If you entered details or installed anything, choose that option here too.',
  ],
  password: accountSteps,
  code: [
    'Contact your bank or the affected service now using its real app or a known number. A code may have approved a payment or a login.',
    ...accountSteps,
  ],
  details: [
    'Call your bank or card issuer using the number on your card. Tell them which details you shared and ask about freezing or replacing your card and protecting your account.',
    'Review recent transactions and turn on alerts. Dispute any payments you do not recognise through your bank.',
    'If you also gave identity documents or personal details, ask the reporting service below about identity theft support.',
  ],
  bank: [
    'Call your bank now using the number on your card. Say you were tricked into a transfer and ask for a recall and fraud investigation.',
    'Keep the transaction reference, recipient details and messages. Do not send another payment, even if someone says it will release a refund.',
  ],
  card: [
    'Call the card issuer using the number on your card. Tell them it was a scam and ask about a dispute or chargeback.',
    'Ask if the card needs freezing or replacing. Save the receipt and messages, and watch for other charges.',
  ],
  gift: [
    'Contact the gift card issuer through its official website or packaging. Say the card was used in a scam and ask if the balance can be frozen or refunded.',
    'Keep the card and purchase receipt. Do not give the numbers to anyone else who contacts you.',
  ],
  crypto: [
    'Contact the exchange or wallet provider through its official support. Give them the transaction reference and recipient address.',
    'Crypto transfers are usually irreversible. Report the payment and save the evidence. Do not pay anyone who promises to recover it for a fee.',
  ],
  app: [
    'Open the payment app yourself and report the payment to its official support. Ask whether it can be reversed.',
    'If the app used your bank account or card, contact that bank or card issuer too. Keep payment records and messages.',
  ],
  remote: [
    'Disconnect that device from Wi-Fi, mobile data and wired internet to stop remote access.',
    'Use another trusted device to call your bank and protect any accounts that were visible. Change their passwords and sign out other sessions.',
    'Get help from a trusted technician or the device maker to remove the remote tool and check the device before reconnecting. A full reset may be needed.',
    'Save messages and payment records from another device if you can. Do not contact the “support” person who approached you.',
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
const lastStep = 'Keep evidence, then stop contact and report using the trusted routes below.';
export function recoveryPlan(selected: RecoveryAction[]) {
  const steps = urgency
    .filter((action) => selected.includes(action))
    .flatMap((action) => recoverySteps[action]);
  return selected.length ? [...new Set([...steps, lastStep])].map((step) => ({ step })) : [];
}
