import { useState } from 'preact/hooks';
import evaluation from '../../docs/evaluation.json';
import type { Analysis } from '../engine/analyze';
import { trustNote } from '../engine/redact';
import { AskBack } from './AskBack';
import { cluePieces, mergeFindings } from './clues';
import { Icon } from './icons';
import { Privacy } from './Privacy';
export const outcomeNames = {
  stop: 'Strong signs of a scam',
  caution: 'Some warning signs',
  none: 'Check before you act',
  unsupported: 'We could not judge the wording',
  too_short: 'A little more context, please',
};
// The status line under the title. For "none" the title is the action and this is the finding.
export const outcomeStatus: Partial<Record<keyof typeof outcomeNames, string>> = {
  none: 'No known signs found',
};
export function focusId(id: string) {
  const el = document.getElementById(id);
  el?.focus();
  el?.scrollIntoView({
    block: 'center',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
export function Result({
  result,
  text,
  onAnother,
  onEdit,
  onRecovery,
}: {
  result: Analysis;
  text: string;
  onAnother: () => void;
  onEdit: () => void;
  onRecovery: () => void;
}) {
  const [share, setShare] = useState(false),
    [copyStatus, setCopyStatus] = useState(''),
    [active, setActive] = useState<string[] | null>(null),
    [draft, setDraft] = useState<string | null>(null);
  const { level } = result;
  const findings = mergeFindings(result.findings);
  const pieces = cluePieces(text, findings);
  // The note starts redacted and the person can edit it; copying and sharing use the edited text.
  const note = draft ?? trustNote(text);
  const undecided = level === 'none' || level === 'unsupported' || level === 'too_short';
  const isActive = (ids: string[]) => !!active && ids.some((id) => active.includes(id));
  const showFinding = (ids: string[]) => {
    setActive(ids);
    focusId(`finding-${ids[0]}`);
  };
  const showWords = (id: string) => {
    setActive([id]);
    focusId(`clue-${pieces.find((p) => p.ids.includes(id))?.start}`);
  };
  return (
    <section id="result" class="result" aria-labelledby="outcome-title">
      <h1 class="sr-only">Your result</h1>
      <div class="result-bar">
        <button class="secondary" onClick={onAnother}>
          <Icon name="back" />
          Check another message
        </button>
        <button class="urgent" onClick={onRecovery}>
          Already clicked or paid?
        </button>
      </div>
      <div class={`outcome ${level}`}>
        <span class="outcome-icon">
          <Icon name={level === 'too_short' || level === 'unsupported' ? 'help' : level} />
        </span>
        <div>
          {outcomeStatus[level] && <span class="outcome-status">{outcomeStatus[level]}</span>}
          <h2 id="outcome-title" tabIndex={-1}>
            {outcomeNames[level]}
          </h2>
          {(level === 'none' || level === 'unsupported') && (
            <strong class="outcome-warning">This does not mean the message is safe.</strong>
          )}
          {level === 'none' && evaluation.blind && (
            <p class="outcome-note">
              In our synthetic blind test, {evaluation.blind.scam.none.count} of{' '}
              {evaluation.blind.scam.none.total} scam messages also got this result.
            </p>
          )}
          <p>{result.summary}</p>
        </div>
      </div>
      {undecided && <AskBack />}
      {level !== 'too_short' && (
        <>
          <div class="next-step">
            <span class="step-tag">Do this next</span>
            <h3>{result.scenario.nextStep}</h3>
            <p>{result.scenario.name}</p>
          </div>
          <div class="evidence-grid">
            <div>
              <h3>The message</h3>
              <p class="small muted">
                {findings.length
                  ? 'Select highlighted words to see why they matter. Links in the message can’t be opened here.'
                  : 'Links in the message can’t be opened here.'}
              </p>
              <div class={`message-evidence ${active ? 'has-active' : ''}`} dir="auto">
                {pieces.map((piece) =>
                  piece.ids.length ? (
                    <mark
                      id={`clue-${piece.start}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive(piece.ids)}
                      class={isActive(piece.ids) ? 'active' : ''}
                      onClick={() => showFinding(piece.ids)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          showFinding(piece.ids);
                        }
                      }}
                    >
                      {text.slice(piece.start, piece.end)}
                    </mark>
                  ) : (
                    text.slice(piece.start, piece.end)
                  ),
                )}
              </div>
              <button class="text-button" onClick={onEdit}>
                Edit this message
              </button>
            </div>
            <div>
              <h3>
                {findings.length
                  ? `${findings.length} ${findings.length === 1 ? 'warning sign' : 'warning signs'}`
                  : 'What we found'}
              </h3>
              {findings.length ? (
                <ul class="finding-list">
                  {findings.map((finding) => (
                    <li
                      id={`finding-${finding.id}`}
                      tabIndex={-1}
                      class={active?.includes(finding.id) ? 'active' : ''}
                    >
                      <h4>{finding.title}</h4>
                      <p>{finding.explanation}</p>
                      {finding.spans.length > 0 && (
                        <button class="text-button" onClick={() => showWords(finding.id)}>
                          Show these words <Icon name="arrow" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
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
              <h3>Where the links point</h3>
              <p class="muted">
                Read the main address, not a familiar word at the front. This is the address written
                in the link. We did not open it or follow any redirect.
              </p>
              {result.links.map((link) => (
                <div class="link-card">
                  <span class="small muted">Main address</span>
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
                      None of our address checks flagged this one. That does not prove the sender or
                      website is genuine, and a link can still redirect somewhere else.
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
          {result.notes.length > 0 && (
            <div class="notes">
              {result.notes.map((line) => (
                <p>{line}</p>
              ))}
            </div>
          )}
          <div class="share">
            <button class="secondary" onClick={() => setShare(!share)} aria-expanded={share}>
              <Icon name="send" />
              Ask someone you trust
            </button>
            {share && (
              <div class="share-panel">
                <h3>Read this note before you send it</h3>
                <p>
                  Emails, phone numbers and long digit runs are removed. Links are made unclickable.{' '}
                  <strong>Names and other personal details are not removed.</strong> Edit the note
                  here before you send it.
                </p>
                <label for="trust-note">Note to share</label>
                <textarea
                  id="trust-note"
                  value={note}
                  rows={7}
                  spellcheck={false}
                  onInput={(e) => setDraft(e.currentTarget.value)}
                />
                {draft !== null && draft !== trustNote(text) && (
                  <button class="text-button" onClick={() => setDraft(null)}>
                    Undo my edits
                  </button>
                )}
                <div class="button-row">
                  {'share' in navigator && (
                    <button
                      class="primary"
                      onClick={() => navigator.share({ text: note }).catch(() => {})}
                    >
                      <Icon name="send" />
                      Send it
                    </button>
                  )}
                  <button
                    class="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(note);
                        setCopyStatus('Copied. You choose where to share it.');
                      } catch {
                        (document.getElementById('trust-note') as HTMLTextAreaElement)?.select();
                        setCopyStatus(
                          'Clipboard is unavailable. The note is selected; use your device’s Copy command.',
                        );
                      }
                    }}
                  >
                    <Icon name="copy" />
                    Copy note
                  </button>
                </div>
                <p role="status">{copyStatus}</p>
                <p class="small muted">Second Look sends nothing. You pick who gets it.</p>
              </div>
            )}
          </div>
        </>
      )}
      <Privacy compact />
    </section>
  );
}
