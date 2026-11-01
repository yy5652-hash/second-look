import { blankLinks, inspectLinks, MAX_INPUT, MAX_LINKS } from './links';
import type { Analysis, Finding, Span } from './types';
export { MAX_INPUT } from './links';
export type { Analysis, Finding, Span } from './types';
// Integers are intentionally simple: weak=1, supporting=2–4, strong=5.
// stop >=5; caution >=2; a lone weak cue is kept quiet. Each rule scores once.
const clause = '[^.!?;\\n]{0,65}';
// Third-person talk about scams (a lesson, an article) is not a pitch. This needs a framing word
// before the phrase, a warning word in the same sentence, and no address to the reader ("you", "your"),
// so a real pitch that merely contains such words keeps its score.
function isDiscussion(text: string, start: number): boolean {
  const from = Math.max(0, start - 160);
  const before = text.slice(from, start);
  const sentenceStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf('\n'),
    -1,
  );
  const head = before.slice(sentenceStart + 1);
  const tail = text
    .slice(start)
    .split(/[.!?\n]/)[0]
    .slice(0, 160);
  const sentence = head + tail;
  if (/\b(?:you|your|yours|yourself|my|mine|me|us|we|our)\b/i.test(tail)) return false;
  if (/\b(?:you|your|yours|yourself|my|mine|me)\b/i.test(head)) return false;
  return (
    /\b(?:lesson|article|guide|course|class|report|blog|news|story|study|essay|webinar|talk|warns?|warning|explains?|covers?|discusses?|teaches|describes)\b/i.test(
      head,
    ) &&
    /\b(?:suspicious|scams?|fraud|warns?|warning|red flags?|too good to be true|misleading|spot|avoid|beware|be wary|risky|risks?|dangerous)\b/i.test(
      sentence,
    )
  );
}
function matches(text: string, re: RegExp, negation = true, discussion = false): Span[] {
  const found: Span[] = [];
  for (const m of text.matchAll(
    new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'),
  )) {
    const start = m.index!,
      prefix = text
        .slice(Math.max(0, start - 75), start)
        .split(/[.!?;\n]/)
        .pop()!;
    // Negation is local to a clause and the matched request. It cannot silence a later sentence.
    if (
      negation &&
      /\b(?:never|will not|won['’]t|do not|don['’]t|must not|not to|no need to|avoid)\b[^.!?;\n]{0,65}$/i.test(
        prefix,
      )
    )
      continue;
    if (negation && /\b(?:never|will not|won['’]t|do not|don['’]t|must not)\b/i.test(m[0]))
      continue;
    // Past-tense denial must sit right before the matched verb ("did not send the difference").
    if (
      negation &&
      /\b(?:did not|didn['’]t|has not|hasn['’]t|have not|haven['’]t|had not|hadn['’]t)\s+(?:yet\s+|even\s+)?$/i.test(
        prefix,
      )
    )
      continue;
    if (discussion && isDiscussion(text, start)) continue;
    found.push({ start, end: start + m[0].length });
    if (found.length >= 8) break;
  }
  return found;
}
export function analyze(input: string): Analysis {
  const text = input.slice(0, MAX_INPUT),
    links = inspectLinks(text),
    findings: Finding[] = [],
    notes: string[] = [];
  if (input.length > MAX_INPUT)
    notes.push(
      'Only the first 10,000 characters were checked. Split longer messages into smaller parts.',
    );
  if (links.length === MAX_LINKS)
    notes.push('Only the first 40 links were inspected. Check any remaining links separately.');
  const add = (id: string, title: string, explanation: string, weight: number, spans: Span[]) => {
    if (spans.length) findings.push({ id, title, explanation, weight, spans });
  };
  const rule = (
    id: string,
    title: string,
    explanation: string,
    weight: number,
    re: RegExp,
    discussion = false,
  ) => add(id, title, explanation, weight, matches(text, re, true, discussion));
  // Asking the reader to hand a secret to someone is the scam. Asking them to type a code on a
  // sign-in page is what genuine two-factor texts do, so those verbs only count with a link
  // (a fake sign-in page) or, for a password or PIN, at a lower weight.
  const secret =
    '(?:password|passcode|pin|otp|one[- ]time (?:code|password)|verification code|login code|security code)';
  const handOver = matches(
    text,
    new RegExp(
      `\\b(?:send|share|tell|give|reply with|reply|provide|forward|read out|text back|disclose)${clause}\\b${secret}\\b`,
      'gi',
    ),
  );
  const typeIn = matches(
    text,
    new RegExp(`\\b(?:enter|confirm|verify|type|submit|input)${clause}\\b${secret}\\b`, 'gi'),
  );
  const typeInWeight = links.length
    ? 5
    : typeIn.some((s) => /\b(?:password|passcode|pin)\b/i.test(text.slice(s.start, s.end)))
      ? 2
      : 0;
  const credentialsExplanation =
    'A password or one-time code can let someone into your account. Do not send it to another person.';
  if (handOver.length)
    add(
      'credentials',
      'It asks for a secret',
      credentialsExplanation,
      5,
      links.length ? [...handOver, ...typeIn] : handOver,
    );
  else if (typeIn.length && typeInWeight)
    add('credentials', 'It asks for a secret', credentialsExplanation, typeInWeight, typeIn);
  rule(
    'payment',
    'It asks for a hard-to-reverse payment',
    'Gift cards, transfers, crypto and payment apps can make money hard to recover. Check who is asking through another route.',
    3,
    new RegExp(
      `\\b(?:pay|send|buy|purchase|transfer|wire|deposit)${clause}\\b(?:gift cards?|wire|bank transfer|bitcoin|crypto(?:currency)?|usdt|wallet|zelle|venmo|cash app|western union)\\b|\\b(?:wire|transfer)\\s+(?:me |us )?(?:money|funds|cash|[$£€]\\d+)`,
      'gi',
    ),
  );
  rule(
    'remote',
    'It asks for control of your device',
    'Remote-access software can let someone see your screen and control your accounts. Do not install it at a stranger’s request.',
    5,
    new RegExp(
      `\\b(?:install|download|open|enable|allow|give|grant)${clause}\\b(?:anydesk|teamviewer|ultraviewer|rustdesk|screenconnect|zoho assist|remote (?:access|control)|screen shar(?:e|ing))\\b`,
      'gi',
    ),
  );
  rule(
    'urgency',
    'It puts you under time pressure',
    'A deadline can make it harder to stop and check. Urgency on its own is not proof of a scam.',
    1,
    /\b(?:urgent(?:ly)?|immediately|act now|right now|within \d{1,3} (?:hours?|minutes?)|last chance|final (?:notice|warning)|today only|expires? (?:today|tonight))\b/gi,
  );
  rule(
    'threat',
    'It threatens a serious consequence',
    'Threats of arrest, a fine or losing access can be used to push you into acting before you check.',
    3,
    /\b(?:you (?:will|may) be arrested|arrest warrant|warrant for your arrest|face (?:arrest|a fine)|avoid (?:arrest|a fine|suspension)|account (?:will be|is about to be) (?:suspended|closed|deleted)|legal action (?:against you|will))\b/gi,
  );
  rule(
    'secrecy',
    'It asks you to keep this secret',
    'Being told not to talk to anyone can cut you off from help. A trusted person can give you a second opinion.',
    2,
    /\b(?:don['’]t tell anyone|do not tell anyone|keep (?:this|it) (?:a secret|secret|confidential)|(?:keep (?:this|it|that)|just|strictly) between (?:you and me|us)|tell no one)\b/gi,
  );
  // Secrecy's own negation is the suspicious phrase, not a denial of a request.
  if (!findings.some((f) => f.id === 'secrecy'))
    add(
      'secrecy',
      'It asks you to keep this secret',
      'Being told not to talk to anyone can cut you off from help. Ask someone you trust.',
      2,
      matches(text, /\b(?:don['’]t tell anyone|do not tell anyone)\b/gi, false),
    );
  const family = matches(text, /\b(?:hi|hello|hey)\s+(?:mum|mom|dad|grandma|grandpa)\b/gi);
  const newPhone = matches(
    text,
    /\b(?:new (?:phone )?number|(?:phone|mobile) (?:is |was )?(?:broken|lost|stolen)|lost my phone)\b/gi,
  );
  if (family.length && newPhone.length)
    add(
      'family',
      'A family member appears on a new number',
      'Someone may be pretending to be family. Call their old number or another relative before sending anything.',
      4,
      [...family, ...newPhone],
    );
  const wrong = matches(
    text,
    /\b(?:wrong number|is this (?:anna|sarah|john|david)|sorry to bother you|meant (?:to text|for) someone else)\b/gi,
  );
  const investment = matches(text, /\b(?:invest(?:ing|ment)?|trading|crypto|bitcoin|profits?)\b/gi);
  if (wrong.length && investment.length)
    add(
      'wrong-number',
      'A wrong-number chat turns to investing',
      'A friendly mistake can be the start of a long scam. Do not invest based on a stranger’s messages.',
      5,
      [...wrong, ...investment],
    );
  rule(
    'investment',
    'It promises easy investment returns',
    'No investment can promise high returns without risk. A guarantee is a reason to pause.',
    5,
    /\b(?:guaranteed (?:returns?|profits?|income)|risk[- ]free (?:investments?|returns?|profits?|trading)|double your money|(?:earn|make) \d{1,3}% (?:daily|weekly|per day)|\d{1,3}% (?:guaranteed|daily returns?))\b/gi,
    true,
  );
  rule(
    'job',
    'Easy work comes with a money promise or fee',
    'Task and job scams may ask you to pay before you can earn or withdraw. Verify the employer independently.',
    4,
    /\b(?:earn|make)\s*[$£€]\d{2,6}\s*(?:a|per|each)\s*(?:day|hour)\b|\b(?:pay|deposit)[^.!?;\n]{0,50}\b(?:unlock (?:your )?(?:tasks|earnings|withdrawal)|start (?:the |your )?job|registration fee|task commission)\b|\b(?:like videos|rate products|simple tasks)[^.!?;\n]{0,45}\b(?:earn|paid|commission)\b/gi,
  );
  rule(
    'prize',
    'It offers a prize or unexpected money',
    'An unexpected prize or refund can be bait for a fee or your details. Check using a route you find yourself.',
    3,
    /\b(?:you(?:['’]ve| have)? (?:w[o0]n(?!['’])|been selected(?! for (?:an? |the )?(?:interview|jury|team|role|next round|programme|program)))|(?:randomly )?selected (?:as a winner|to receive|for a[^.!?;\n]{0,20}gift)|chosen to receive|entitled to (?:update|a free|claim)|w[i1]nner of|guaranteed (?:prize|the latest)|[£$€]?\d[\d,.]* (?:prize|award)|lucky (?:day|draw|winner)|customer draw|your number was picked|free [^.!?;\n]{0,20}(?:iphone|ipad|gift card)|only pay (?:for )?(?:shipping|postage|delivery)|claim your (?:prize|winnings|refund)|you are (?:a )?winner|specially selected|(?:was|were|are|been) awarded|(?:mobile|phone) (?:no\.? |number )?(?:has )?won|(?:cash|bonus|caller) (?:prize|award)|to claim (?:your |the |a )?(?:prize|award|cash|holiday|gift)|congrat[a-z]*!?[^.!?;\n]{0,40}\bis yours|unclaimed (?:prize|refund)|unexpected refund|refund[^!?;\n]{0,30}ready to be claimed|congratulations[^.!?;\n]{0,40}(?:winner|selected|prize))\b/gi,
    true,
  );
  if (links.length) {
    const parcel = matches(
      text,
      /\b(?:parcel|package|delivery|courier|toll|usps|royal mail|evri|dhl|fedex)\b/gi,
    );
    const fee = matches(
      text,
      /\b(?:fee|unpaid|outstanding|pay|payment|postage due|customs charge|redelivery charge)\b/gi,
    );
    if (parcel.length && fee.length)
      add(
        'parcel',
        'A delivery or toll message asks for payment',
        'Small fees can be used to collect card details. Open the courier’s app or the toll operator’s official site yourself.',
        4,
        [...parcel, ...fee, links[0].span],
      );
    const locked = matches(
      text,
      /\b(?:account (?:has been |is |was )?(?:locked|suspended|restricted|blocked)|unusual (?:sign[- ]in|activity)|verify your account)\b/gi,
    );
    if (locked.length)
      add(
        'locked',
        'An account warning sends you to a link',
        'An account alert can lead to a fake sign-in page. Open the service’s app yourself to check.',
        4,
        [...locked, links[0].span],
      );
  }
  // An alarm about an account or card. Banks do send these, so alone it is only a caution.
  rule(
    'alarm',
    'It raises an alarm about your account or card',
    'A sudden warning can rush you into acting. Open the app yourself, or call the number on your card, to see whether anything is wrong.',
    links.length ? 5 : 3,
    /\b(?:(?:account|card|atm card|debit card|credit card|a\/c|kyc|online banking|apple id|mailbox|licen[cs]e|subscription)\b[^.!?;\n]{0,25}\b(?:(?:has|have|had|is|was|will be|has just been|is now)\s+(?:been\s+)?(?:just\s+)?(?:de-?activated|frozen|suspended|blocked|locked|restricted|compromised|deleted|closed|expired)|will block)|(?:mailbox|inbox|storage)\b[^.!?;\n]{0,15}\bis full)\b/gi,
    true,
  );
  rule(
    'details',
    'It asks for your personal or card details',
    'A message should not need your card or bank details. If you think something is due, go to the company’s site or app yourself.',
    5,
    /\b(?:enter|provide|confirm|send|reply with|give us)\s+(?:us\s+)?(?:your\s+)(?:full\s+)?(?:card|bank|banking|payment|billing|account|credit card)\s+(?:details|information|info|number)\b/gi,
    true,
  );
  rule(
    'update-details',
    'It asks you to update your details',
    'Fake delivery and account messages often ask for this. Use the company’s own app if you think something needs changing.',
    3,
    /\bupdate (?:your |security )(?:security |billing |payment |delivery |account |personal |card )?(?:details|information|info|payment)\b/gi,
    true,
  );
  rule(
    'safe-account',
    'It tells you to move money to a “safe account”',
    'Your bank will never ask you to move money to keep it safe. Hang up and call the number on your card.',
    5,
    /\b(?:safe|secure|holding) account\b/gi,
    true,
  );
  rule(
    'charge-alarm',
    'It reports a charge and asks you to act if it was not you',
    'This can be a real alert or a way to get you to call a fake helpline. Check the charge in your bank’s app, and use the number on your card.',
    3,
    /\b(?:if (?:this|it) (?:was|is)(?: not|n['’]t)(?: done by)? you|if (?:this|it) (?:is|was) not done by you|was charged on your card)\b/gi,
    true,
  );
  rule(
    'threat-pay',
    'It threatens consequences unless you act',
    'A real debt or fine comes with time to check it. Look up the organisation yourself rather than using this message.',
    3,
    /\b(?:warrant (?:may|will|has) be(?:en)? issued|avoid (?:a |any )?(?:penalty|further action)|further action|unless you (?:settle|pay|update|act|respond|call)|(?:will be|are) deleted (?:tomorrow|today|unless))\b/gi,
    true,
  );
  rule(
    'stranded',
    'Someone stranded is asking you for money',
    'Scammers pretend to be friends or family stuck somewhere. Call them on the number you already have before sending anything.',
    4,
    /\b(?:stuck abroad|stranded|wallet (?:was |has been |got )?stolen|lost my wallet|lend me [£$€]?\d)\b/gi,
    true,
  );
  rule(
    'easy-work',
    'It offers easy paid work out of the blue',
    'Unexpected job offers with high pay and no experience are a common way in. Find the employer’s own careers page yourself.',
    3,
    /\b(?:no experience (?:needed|required)|(?:part[- ]time|remote)\s+(?:role|job|work)\s+(?:paying|earning)|(?:message|contact) me on (?:whatsapp|telegram))\b/gi,
    true,
  );
  rule(
    'money-friend',
    'A stranger talks about making money by trading',
    'A friendly chat that turns to a trading platform is a known route into investment scams. Do not invest through someone you met online.',
    3,
    /\b(?:trading platform|made (?:a lot of|so much|good) money|(?:saw|found) your profile)\b/gi,
    true,
  );
  rule(
    'tech-support',
    'It claims your device has a problem and sends you to a helpline',
    'Companies do not text you about viruses. Close this and use the support page of the company yourself.',
    4,
    /\b(?:(?:computer|device|phone|pc) (?:is|has been|may be) (?:infected|hacked|compromised)|call (?:our|a|the) (?:technician|tech support|support team))\b/gi,
    true,
  );
  rule(
    'tap-link',
    'It pushes you to tap a link',
    'Tapping can take you to a copy of a real site. Go to the site or app yourself instead.',
    links.length ? 2 : 0,
    /\b(?:click|tap|follow|log ?in|sign ?in|login)\s+(?:on\s+)?(?:here|the link|this link|below|at|to (?:restore|unlock|verify|keep))\b/gi,
    true,
  );
  if (
    findings.some((f) => f.id === 'prize') &&
    (links.length || /\bcall\b[^.!?\n]{0,40}\d{7}/i.test(text))
  )
    add(
      'prize-action',
      'The prize comes with a link or number to contact',
      'Real prizes do not need you to call a number or use a link from a surprise message.',
      2,
      findings.find((f) => f.id === 'prize')!.spans,
    );
  // The shape of most scams: a made-up problem or windfall, then a request to act on it. This
  // catches rewordings that fixed phrases miss, so each part alone stays quiet.
  const ownChannel =
    /\b(?:in|through|via|from) (?:the|your) (?:app|online account|account page|online banking|student portal)\b|\b(?:nothing|no action)\b[^.!?;\n]{0,25}\b(?:needed|required|to do)\b|\bno rush\b|\bwhen you (?:can|get a chance)\b/i.test(
      text,
    );
  const problem = matches(
    text,
    /\b(?:suspended|limited|frozen|on hold|disabled|hacked|compromised|expir(?:ed|es|ing)|unpaid|overdue|past due|outstanding|owe|suspicious|unusual|unauthori[sz]ed|fraudulent|infected|viruses|linked to|in custody|in hospital|in jail|accident|out of space|removed|violation|lawsuit|penalty|could not be delivered|was placed on your account|sending out)\b/gi,
    true,
    true,
  );
  const windfall = matches(
    text,
    /\b(?:rebate|due a|owed|owes you|qualif(?:y|ied|ies)|pre-?approved|grant|unused|loyalty points|compensation|inherit(?:ance|ed)|no credit check|recover(?:ed)? funds|get your [^.!?;\n]{0,20}back|great returns|never has to be paid back)\b/gi,
    true,
    true,
  );
  const askToAct = matches(
    text,
    /\b(?:call now|call us|call (?:this|the) number|press \d|speak to an agent|confirm your|verify your|restore your|reactivate|re-activate|unlock your|submit your|claim your|claim now|redeem|upgrade|log ?in with|sign ?in with|stay on the line|do not hang up|don['’]t hang up|read (?:them|me|us)|help me|i need you to|connect to it|respond (?:now|today|immediately)|what do you see)\b/gi,
  );
  const moneyAsk = matches(
    text,
    /\b(?:pay(?: the| a)?\b(?! me back)|(?:small|processing|clearance|upfront|release|admin|handling)\s+(?:\w+\s+)?(?:fee|charge|deposit)|deposit to|bail|in cash|courier can collect|with your card|your card number|gift cards?)\b/gi,
  );
  if (!ownChannel && problem.length && (askToAct.length || moneyAsk.length))
    add(
      'problem-ask',
      'It claims there is a problem, then asks you to act',
      'This is the usual shape of a scam: a worry, then a request. If it might be real, check it through the company’s own app or a number you already have.',
      2,
      [...problem.slice(0, 2), ...askToAct.slice(0, 2)],
    );
  if (!ownChannel && windfall.length && (askToAct.length || moneyAsk.length))
    add(
      'windfall-ask',
      'It offers unexpected money, then asks you to act',
      'Surprise money that needs a step from you first is a common trick. Look up the organisation yourself rather than replying.',
      2,
      [...windfall.slice(0, 2), ...askToAct.slice(0, 2)],
    );
  if (!ownChannel && moneyAsk.length && (problem.length || windfall.length))
    add(
      'money-first',
      'It wants money before anything can happen',
      'Paying to release a parcel, a loan, a prize or a person is a known scam pattern. Do not pay until you have checked with someone you trust.',
      2,
      moneyAsk.slice(0, 2),
    );
  rule(
    'temp-number',
    'A relative seems to be on an unknown number',
    'Scammers pretend to be family on a new phone. Call your relative on the number you already have.',
    3,
    /\b(?:hi|hey|hello)\s+(?:mum|mom|dad|grandma|grandpa|nan)\b[^\n]{0,80}\b(?:temporary|temp|new|different|friend['’]s) (?:number|phone)\b|\b(?:dropped|broke|lost|smashed) my phone\b/gi,
    true,
  );
  rule(
    'high-earnings',
    'It promises high pay for easy work',
    'Big earnings for small tasks are a known hook. Find the employer yourself before going further.',
    3,
    /\b(?:earn|make)\s+(?:up to\s+)?[$£€]\d[\d,]*\s*(?:a|per|each)\s*(?:day|week|hour)\b|\b(?:crypto|trading|forex)\b[^.!?;\n]{0,70}\b(?:returns|profits?|make money)\b/gi,
    true,
  );
  rule(
    'premium',
    'It asks you to text or call a paid number',
    'Short codes and premium-rate numbers can add charges to your bill. Look up the real number from the company yourself.',
    2,
    /\b(?:(?:text|txt|reply|send)\s+(?!stop\b|yes\b|no\b|help\b|cancel\b|end\b|unsubscribe\b)[A-Za-z0-9]{2,12}(?:\s+\w{1,12}){0,2}\s+to\s+\d{5}\b|call\s+(?:from a landline\s+)?(?:on\s+)?09\d[\d -]{7,12}\d)\b/gi,
  );
  rule(
    'overpayment',
    'It asks you to return an overpayment',
    'A payment can be fake or later reversed. Do not send a separate payment to return the difference.',
    5,
    /\b(?:overpaid|overpayment|refund(?:ed)? (?:you )?too much|send (?:me |us )?(?:back )?the difference|return the (?:extra|difference)|refund the (?:difference|excess))\b/gi,
  );
  const riskyAsk = findings.some((f) => !['urgency', 'secrecy'].includes(f.id));
  const authority = matches(
    text,
    /\b(?:bank|paypal|amazon|apple|microsoft|netflix|hsbc|chase|hmrc|irs|police|government|fraud department|tax office)\b/gi,
  );
  if (riskyAsk && authority.length)
    add(
      'authority',
      'It uses a familiar name or authority',
      'A name in a message does not prove who sent it. Contact the organisation using details you already trust.',
      1,
      authority,
    );
  const urgency = findings.find((f) => f.id === 'urgency');
  const payment = findings.find((f) => f.id === 'payment');
  if (urgency && (links.length || payment))
    add(
      'pressure-action',
      'Time pressure comes with an action',
      'The message combines a deadline with a link or payment request. Pause before doing either.',
      2,
      [...urgency.spans, ...(payment?.spans ?? [links[0].span])],
    );
  links.forEach((link, i) =>
    link.flags.forEach((flag) =>
      add(`link-${i}-${flag.id}`, flag.title, flag.explanation, flag.weight, [link.span]),
    ),
  );
  // Letters inside web addresses say nothing about the language of the wording.
  const wording = blankLinks(text, links);
  const letters = wording.match(/\p{L}/gu) ?? [];
  const nonLatin = letters.filter((c) => !/\p{Script=Latin}/u.test(c)).length;
  const unsupported = letters.length > 0 && nonLatin / letters.length > 0.45;
  if (unsupported)
    notes.push(
      'Wording checks are English only. Much of this message uses another writing system, so the wording could not be judged. Link checks still ran.',
    );
  notes.push(
    'These checks cannot confirm the sender, open a website, or catch every scam. No known signs does not mean a message is safe.',
  );
  // Repeated links or equivalent link flags cannot inflate the score.
  const scored = new Map<string, number>();
  for (const f of findings) {
    const key = f.id.replace(/^link-\d+-/, 'link-');
    scored.set(key, Math.max(scored.get(key) ?? 0, f.weight));
  }
  const score = [...scored.values()].reduce((a, b) => a + b, 0);
  let level: Analysis['level'] =
    score >= 5 ? 'stop' : score >= 2 ? 'caution' : unsupported ? 'unsupported' : 'none';
  if (text.trim().length < 18 && !links.length && score < 2 && !unsupported) level = 'too_short';
  const has = (id: string) => findings.some((f) => f.id === id);
  const scenario = has('parcel')
    ? {
        name: /\btoll\b/i.test(text) ? 'Possible toll fee scam' : 'Possible parcel fee scam',
        nextStep:
          'Open the courier’s app or the toll operator’s official site yourself. Check for a real fee there.',
      }
    : has('family')
      ? {
          name: 'Possible family impersonation',
          nextStep:
            'Call your relative on the number you already have. If they do not answer, check with another family member.',
        }
      : has('remote')
        ? {
            name: 'Possible remote-access scam',
            nextStep:
              'Close the conversation. Contact support through the company’s app or a website you already know.',
          }
        : has('overpayment')
          ? {
              name: 'Possible overpayment scam',
              nextStep:
                'Ask your bank or payment provider to check the original payment. Do not send a separate refund.',
            }
          : has('investment') || has('wrong-number')
            ? {
                name: 'Possible investment scam',
                nextStep:
                  'Do not send money or install a trading app from this chat. Get independent advice before investing.',
              }
            : has('job') || has('easy-work')
              ? {
                  name: 'Possible task or job scam',
                  nextStep:
                    'Find the employer’s official careers page yourself. Do not pay to get a job or withdraw earnings.',
                }
              : /\b(?:bank|hsbc|chase|fraud department)\b/i.test(text) && riskyAsk
                ? {
                    name: 'Possible bank impersonation',
                    nextStep:
                      'Open your bank’s app yourself, or call the number on the back of your card.',
                  }
                : has('credentials') ||
                    has('locked') ||
                    has('alarm') ||
                    has('details') ||
                    has('update-details')
                  ? {
                      name: 'Possible account theft',
                      nextStep:
                        'Open the service’s app yourself. Never send a password or login code to someone who contacted you.',
                    }
                  : has('prize')
                    ? {
                        name: 'Possible prize or refund scam',
                        nextStep:
                          'Check with the organisation using contact details you find yourself. Do not pay to claim a prize.',
                      }
                    : level === 'unsupported'
                      ? {
                          name: 'Wording not judged',
                          nextStep:
                            'Ask someone you trust who reads this language, or contact the sender through a number or app you already know. Do not use contact details from this message.',
                        }
                      : {
                          name: level === 'none' ? 'No pattern identified' : 'Pause and verify',
                          nextStep:
                            'Contact the person or organisation using a number or app you already trust. Do not use contact details from this message.',
                        };
  const summary = has('credentials')
    ? 'It asks you to give up a password or code that could unlock an account.'
    : has('remote')
      ? 'It asks you to give someone access to your device.'
      : has('parcel')
        ? 'It asks you to use a link to settle a delivery or toll payment.'
        : has('family')
          ? 'It asks you to trust a family member’s identity on a new number.'
          : has('investment') || has('wrong-number')
            ? 'It tries to draw you into an investment offer.'
            : has('job')
              ? 'It offers easy earnings or asks for money to begin work.'
              : has('overpayment')
                ? 'It asks you to return money that may not really have arrived.'
                : has('payment')
                  ? 'It asks for a payment that could be hard to reverse.'
                  : has('prize')
                    ? 'It tries to get your attention with a prize or refund.'
                    : has('locked')
                      ? 'It uses an account warning to get you to follow a link.'
                      : has('money-first')
                        ? 'It wants money before anything can happen.'
                        : has('problem-ask') || has('alarm')
                          ? 'It raises a worry, then asks you to act on it.'
                          : has('windfall-ask')
                            ? 'It offers unexpected money, then asks you to act.'
                            : has('details') || has('update-details')
                              ? 'It asks you to hand over or change your details.'
                              : level === 'unsupported'
                                ? 'We could not judge the wording, because it is not in a language our checks read. Link checks ran and found no strong signs. That does not make the message safe.'
                                : level === 'none'
                                  ? 'We did not find a known warning pattern. That does not verify the sender.'
                                  : level === 'too_short'
                                    ? 'Add more of the message so there is enough to check.'
                                    : 'There are reasons to pause and check this message through another route.';
  return { level, summary, scenario, findings: score < 2 ? [] : findings, links, notes };
}
