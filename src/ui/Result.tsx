import { useState } from 'preact/hooks';
import evaluation from '../../docs/evaluation.json';
import type { Analysis } from '../engine/analyze';
import { trustNote } from '../engine/redact';
import { Icon } from './icons';
export const outcomeNames = {
  stop: 'Strong signs of a scam',
  caution: 'Some warning signs',
  none: 'No known signs',
  unsupported: 'We could not judge the wording',
  too_short: 'A little more context, please',
};
export function focusId(id: string) {
  const el = document.getElementById(id);
  el?.focus();
  el?.scrollIntoView({
    block: 'center',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
export function Result({ result, text }: { result: Analysis; text: string }) {
  const [share, setShare] = useState(false),
    [copyStatus, setCopyStatus] = useState('');
  const { findings } = result;
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...findings.flatMap((f) => f.spans.flatMap((s) => [s.start, s.end])),
    ]),
  ].sort((a, b) => a - b);
  const pieces = boundaries.slice(0, -1).map((start, i) => ({
    start,
    end: boundaries[i + 1],
    ids: findings
      .filter((f) => f.spans.some((s) => s.start <= start && s.end >= boundaries[i + 1]))
      .map((f) => f.id),
  }));
  // Neighbouring highlighted pieces read as one phrase, so show one highlight with all its clues.
  const segments: typeof pieces = [];
  for (const piece of pieces) {
    const last = segments[segments.length - 1];
    if (last && last.ids.length && piece.ids.length)
      segments[segments.length - 1] = {
        start: last.start,
        end: piece.end,
        ids: findings
          .map((f) => f.id)
          .filter((id) => last.ids.includes(id) || piece.ids.includes(id)),
      };
    else segments.push(piece);
  }
  const firstEvidence = (id: string) =>
    `evidence-${segments.find((s) => s.ids.includes(id))?.start}`;
  return (
    <section id="result" class="result" tabIndex={-1} aria-labelledby="outcome-title">
      <div class={`outcome ${result.level}`}>
        <Icon
          name={
            result.level === 'too_short' || result.level === 'unsupported' ? 'help' : result.level
          }
        />
        <div>
          <p class="eyebrow">Your second look</p>
          <h2 id="outcome-title">{outcomeNames[result.level]}</h2>
          <p>{result.summary}</p>
          {(result.level === 'none' || result.level === 'unsupported') && (
            <strong>This does not mean the message is safe.</strong>
          )}
          {result.level === 'none' && evaluation.blind && (
            <p class="small">
              In our blind test, {evaluation.blind.scam.none.count} of{' '}
              {evaluation.blind.scam.none.total} scam messages also got this result. If it asks for
              money, a code or a login, check with the sender another way first.
            </p>
          )}
        </div>
      </div>
      {result.level !== 'too_short' && (
        <>
          <div class="next-step">
            <span class="step-tag">Your next step</span>
            <h3>{result.scenario.nextStep}</h3>
            <p>{result.scenario.name}</p>
          </div>
          <div class="evidence-grid">
            <div>
              <h3>The message, with clues</h3>
              <p class="small muted">
                Select a highlighted phrase to see why it matters. Message links cannot be opened
                here.
              </p>
              <div class="message-evidence" dir="auto">
                {segments.map((segment) =>
                  segment.ids.length ? (
                    <span class="evidence-piece">
                      <mark id={`evidence-${segment.start}`} tabIndex={-1}>
                        {text.slice(segment.start, segment.end)}
                      </mark>
                      <span class="evidence-refs">
                        {segment.ids.map((id) => (
                          <button
                            class="evidence-ref"
                            aria-label={`Explain “${text.slice(segment.start, segment.end)}”: ${findings.find((f) => f.id === id)!.title}`}
                            aria-controls={`finding-${id}`}
                            onClick={() => focusId(`finding-${id}`)}
                          >
                            {findings.findIndex((f) => f.id === id) + 1}
                          </button>
                        ))}
                      </span>
                    </span>
                  ) : (
                    text.slice(segment.start, segment.end)
                  ),
                )}
              </div>
            </div>
            <div>
              <h3>{findings.length ? 'What made us pause' : 'What we found'}</h3>
              {findings.length ? (
                <ol class="finding-list">
                  {findings.map((finding, i) => (
                    <li id={`finding-${finding.id}`} tabIndex={-1}>
                      <div class="finding-title">
                        <span class="number">{i + 1}</span>
                        <h4>{finding.title}</h4>
                      </div>
                      <p>{finding.explanation}</p>
                      <button
                        class="text-button"
                        onClick={() => focusId(firstEvidence(finding.id))}
                      >
                        Show these words <Icon name="arrow" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  None of our known warning patterns stood out. If the message asks you to act,
                  verify it through a separate route.
                </p>
              )}
            </div>
          </div>
          {result.links.length > 0 && (
            <section class="link-inspector">
              <h3>Where the links really go</h3>
              <p>
                Read the main address, not just a familiar word at the front. We did not open or
                contact these sites.
              </p>
              {result.links.map((link) => (
                <div class="link-card">
                  <span class="small muted">Main address (registrable domain)</span>
                  <strong class="domain" dir="ltr">
                    {link.domain}
                  </strong>
                  <p class="small">
                    Full host: <bdi>{link.host}</bdi>
                  </p>
                  <code>{link.raw}</code>
                  {link.flags.length ? (
                    <ul>
                      {link.flags.map((flag) => (
                        <li>{flag.title}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      This is who the link really goes to. An ordinary-looking address does not
                      prove the sender or website is genuine.
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
          <div class="notes">
            {result.notes.map((note) => (
              <p>{note}</p>
            ))}
          </div>
          <div class="share">
            <button class="secondary" onClick={() => setShare(!share)} aria-expanded={share}>
              <Icon name="copy" />
              Ask someone you trust
            </button>
            {share && (
              <div class="share-panel">
                <h3>Read this note before you copy it</h3>
                <p>
                  Emails, phone numbers and long digit runs are removed. Links are made unclickable.{' '}
                  <strong>Names and other personal details are not removed.</strong> Edit or remove
                  them after pasting if needed.
                </p>
                <label for="trust-note">Note to share</label>
                <textarea id="trust-note" readOnly value={trustNote(text)} rows={7} />
                <button
                  class="primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(trustNote(text));
                      setCopyStatus(
                        'Copied. You choose where to share it. This app sends nothing.',
                      );
                    } catch {
                      (document.getElementById('trust-note') as HTMLTextAreaElement)?.select();
                      setCopyStatus(
                        'Clipboard is unavailable. The note is selected; use your device’s Copy command.',
                      );
                    }
                  }}
                >
                  Copy note
                </button>
                <p role="status">{copyStatus}</p>
                <p class="small">Clipboard only. Second Look sends nothing.</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
