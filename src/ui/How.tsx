import evaluationData from '../../docs/evaluation.json';
import { External } from './Recovery';
interface Metric {
  count: number;
  total: number;
  rate: number;
  wilson95: [number, number];
}
interface Group {
  total: number;
  stop: Metric;
  caution: Metric;
  none: Metric;
  unsupported: Metric;
  too_short: Metric;
  stopOrCaution: Metric;
}
interface Evaluation {
  status: string;
  heldOut: null | { ham: Group; spam: Group };
  extraHeldOut?: null | { ham: Group; smishing: Group; spam: Group };
  synthetic: null | { genuine: Group; scam: Group };
  blind?: { genuine: Group; scam: Group };
  engineHash?: string;
  extraDataset?: string;
}
const evaluation = evaluationData as unknown as Evaluation;
function metric(m: Metric) {
  return `${m.count} / ${m.total} (${(m.rate * 100).toFixed(3)}%; 95% interval ${(m.wilson95[0] * 100).toFixed(3)}–${(m.wilson95[1] * 100).toFixed(3)}%)`;
}
export function How() {
  return (
    <article class="how card">
      <p class="eyebrow">Open about our limits</p>
      <h1>
        A second opinion.
        <br />
        The decision stays yours.
      </h1>
      <p class="lede">
        Second Look checks the words and addresses in a message on your device. It never opens a
        suspicious link and never calls a message “safe”.
      </p>
      <h2>What it checks</h2>
      <p>
        Requests for secrets or unusual payments. Pressure, threats and familiar scam stories.
        Website addresses that hide or imitate a name you know. Every finding takes you back to the
        exact words that triggered it.
      </p>
      <h2>The three outcomes, and one case we cannot judge</h2>
      <ul>
        <li>
          <strong>Strong signs of a scam:</strong> a strong signal, or several signals together.
          Stop and verify.
        </li>
        <li>
          <strong>Some warning signs:</strong> enough reason to take another look.
        </li>
        <li>
          <strong>We could not judge the wording:</strong> most of the message is in a writing
          system our wording checks do not read. We still checked its links. That is not a sign that
          the message is fine.
        </li>
        <li>
          <strong>No known signs:</strong> our rules found no clear warning. That is not proof the
          message is genuine.
        </li>
      </ul>
      <p>
        A short message without a link may have too little information to judge. Wording checks are
        English only; links are still inspected in other languages. English written in unusual
        forms, and other languages using Latin letters, may be missed.
      </p>
      <h2>Simple rules, not a secret score</h2>
      <p>
        Each rule counts once: weak clues get 1 point, supporting clues get 2–4, and strong clues
        get 5. Two points give “some warning signs”; five give “strong signs”. Urgency alone stays
        quiet. A deadline together with a link or payment request adds 2 points. Repeating a link
        does not increase its score.
      </p>
      <p>
        Negated requests such as “never share your code” are excluded. A small list of brand
        addresses helps spot lookalikes; it cannot cover every legitimate domain. Address endings
        and plain HTTP are weak clues only.
      </p>
      <h2>What it cannot do</h2>
      <p>
        It cannot verify a sender, check an account, inspect a website, detect every scam or give a
        guarantee. It does not use a live scam database. New tricks, missing context, spelling
        changes and words inside images can be missed. Images use English OCR; review and correct
        the text first.
      </p>
      <p>
        Only the first 10,000 characters and 40 links are checked. We accept images up to 10 MB and
        20 million pixels, and resize them for local processing. A QR scan looks for one code per
        image; crop and check other codes separately.
      </p>
      <h2>Privacy you can check</h2>
      <p>
        No account, analytics, server analysis or runtime AI service. Messages, images and results
        stay in memory. Checking another message removes them; reopening the page starts empty. Your
        browser may still manage its own clipboard or operating-system snapshots.
      </p>
      <p>
        Only the app files, OCR files and optional theme and text size preferences can be stored.
        App and OCR downloads come from the same site. A host can see requests for those files, but
        the message is never attached. Reporting links only open when you choose them.
      </p>
      <p>
        After the offline-ready notice appears, text checks and recovery steps work without a
        connection. The image reader downloads on first image use. After one successful image read,
        that device’s selected OCR files are cached for offline reuse, unless the browser clears
        them.
      </p>
      <h2>Evaluation, with the caveats included</h2>
      {evaluation.heldOut ? (
        <>
          <p>
            The most useful test is one the rules could not have been written for. A separate AI
            agent, with no access to the rules, wrote 60 scam and 60 genuine messages in modern
            wording. We scored them once and changed nothing afterward.
          </p>
          {evaluation.blind && (
            <dl class="eval-list">
              <dt>Scams flagged strong or caution</dt>
              <dd>{metric(evaluation.blind.scam.stopOrCaution)}</dd>
              <dt>Scams flagged strong</dt>
              <dd>{metric(evaluation.blind.scam.stop)}</dd>
              <dt>Genuine messages flagged strong or caution</dt>
              <dd>{metric(evaluation.blind.genuine.stopOrCaution)}</dd>
            </dl>
          )}
          <p>
            So about half of those scams got “no known signs”. That is why the result never says
            “safe”, and why the next step always tells you to check for yourself.
          </p>
          <p>
            We also scored two public collections of text messages. The UCI SMS Spam Collection
            dates from 2012, and its “spam” includes ordinary marketing, so its catch rate is not a
            clean measure of scam detection.
          </p>
          <p>
            SHA-256 of the message assigns it to development or held-out data (roughly 50/50). Only
            development messages and our own fixtures were used for tuning. The held-out half was
            scored twice: an earlier rule set flagged 52 of 160 smishing messages, which led us to
            broaden the rules on development data, so the numbers below are slightly optimistic.
            Intervals use Wilson 95%.
          </p>
          <p>
            We tried and rejected a small on-device word model. It looked excellent on the old
            corpus, then raised 9 false alarms on 30 modern genuine messages, including a plain card
            receipt. Clear rules that point to exact words serve you better.
          </p>
          <dl class="eval-list">
            <dt>Genuine messages flagged strong</dt>
            <dd>{metric(evaluation.heldOut.ham.stop)}</dd>
            <dt>Genuine messages flagged strong or caution</dt>
            <dd>{metric(evaluation.heldOut.ham.stopOrCaution)}</dd>
            {(['stop', 'caution', 'none', 'unsupported', 'too_short'] as const).map((level) => (
              <>
                <dt>Spam → {level.replace('_', ' ')}</dt>
                <dd>{metric(evaluation.heldOut!.spam[level])}</dd>
              </>
            ))}
          </dl>
          <p>
            Our author-written synthetic set: {evaluation.synthetic?.scam.total} scam messages and{' '}
            {evaluation.synthetic?.genuine.total} genuine messages. It exercises known rules and is
            not an independent real-world benchmark.
          </p>
          {evaluation.synthetic && (
            <p>
              Scams flagged strong or caution: {metric(evaluation.synthetic.scam.stopOrCaution)}.
              Genuine messages flagged strong or caution:{' '}
              {metric(evaluation.synthetic.genuine.stopOrCaution)}.
            </p>
          )}
          <p>{evaluation.extraDataset}</p>
          {evaluation.extraHeldOut && (
            <dl class="eval-list">
              <dt>Second set: genuine messages flagged strong</dt>
              <dd>{metric(evaluation.extraHeldOut.ham.stop)}</dd>
              <dt>Second set: genuine messages flagged strong or caution</dt>
              <dd>{metric(evaluation.extraHeldOut.ham.stopOrCaution)}</dd>
              <dt>Second set: smishing flagged strong</dt>
              <dd>{metric(evaluation.extraHeldOut.smishing.stop)}</dd>
              <dt>Second set: smishing flagged strong or caution</dt>
              <dd>{metric(evaluation.extraHeldOut.smishing.stopOrCaution)}</dd>
            </dl>
          )}
          <p class="small">
            Detailed counts, split rules and reproducibility hashes are included in
            docs/EVALUATION.md and docs/evaluation.json in the source package.
          </p>
        </>
      ) : (
        <p>Evaluation has not yet run. No accuracy claim is made.</p>
      )}
      <h2>Made for SafeSpace Hacks</h2>
      <p>
        Event work: Second Look’s rule engine, evidence interface, privacy counter, recovery guide,
        local image pipeline, PWA integration, tests, evaluation and documentation were created in
        this project during the event, starting on 1 November 2026.
      </p>
      <p>
        Pre-existing components: Vite, TypeScript, Preact, tldts and the Public Suffix List,
        Tesseract.js and its English model, jsQR, Workbox, vite-plugin-pwa, Vitest and Playwright.
        The design uses system fonts and original inline SVG icons; no stock imagery or web font
        service.
      </p>
      <p>
        AI assistance: Claude Code and Codex wrote the code and documentation under Yi Yu’s
        direction. These are transparent rules, not an AI judgement of your message. No AI model is
        called at runtime.
      </p>
      <p>
        Dataset credit: Almeida, T. &amp; Hidalgo, J. (2012),{' '}
        <External href="https://archive.ics.uci.edu/dataset/228/sms+spam+collection">
          SMS Spam Collection, UCI
        </External>
        , CC BY 4.0, DOI 10.24432/C5CC84. The corpus is downloaded only for local evaluation and is
        not shipped with the app.
      </p>
      <p>
        Second dataset credit: Mishra, S. &amp; Soni, D. (2022),{' '}
        <External href="https://data.mendeley.com/datasets/f45bkkt8pr/1">
          SMS Phishing Dataset for Machine Learning and Pattern Recognition, Mendeley Data
        </External>
        , CC BY 4.0, DOI 10.17632/f45bkkt8pr.1. Also used only for local evaluation.
      </p>
      <h2>One safer outcome</h2>
      <p>
        A parcel text asks for a small fee. Second Look highlights the fee and the link, shows the
        actual destination, and suggests opening the courier’s app yourself. You can check the
        delivery without giving the message your card details.
      </p>
      <p class="small">
        App source: MIT licence. Library and model notices are included in THIRD_PARTY_NOTICES.md.
        Reporting and recovery sources are shown alongside the advice.
      </p>
    </article>
  );
}
