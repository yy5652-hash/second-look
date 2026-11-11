import { useState } from 'preact/hooks';
import { actions, recoveryPlan, recoverySources, type RecoveryAction } from '../data/recovery';
import { guessRegion, resources, type Region } from '../data/resources';
import { buildReport } from '../flows/report';
import { Icon } from './icons';
export function External({ href, children }: { href: string; children: preact.ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span class="sr-only"> (opens a new tab)</span>
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
const regionNames: Record<Region, string> = {
  US: 'United States',
  UK: 'United Kingdom',
  Canada: 'Canada',
  China: 'China',
  Elsewhere: 'Anywhere else',
};
export function Recovery({ message }: { message: string }) {
  const [happened, setHappened] = useState<RecoveryAction[]>([]),
    [done, setDone] = useState<string[]>([]),
    [region, setRegion] = useState<Region>(() => guessRegion(navigator.language)),
    [when, setWhen] = useState(''),
    [amount, setAmount] = useState(''),
    [paidHow, setPaidHow] = useState(''),
    [contact, setContact] = useState(''),
    [reportMessage, setReportMessage] = useState(message),
    [copyStatus, setCopyStatus] = useState('');
  const plan = recoveryPlan(happened);
  const finished = plan.filter((item) => done.includes(item.step));
  const report = buildReport({
    when,
    amount,
    paidHow,
    contact,
    message: reportMessage,
    happened: happened.map((key) => actions[key]),
    done: finished.map((item) => item.step),
  });
  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  return (
    <section class="recovery-content" aria-labelledby="recovery-title">
      <h1 id="recovery-title" tabIndex={-1}>
        Let’s take this one step at a time.
      </h1>
      <p class="lede">
        These messages are built to be convincing. There’s no blame here, and acting quickly can
        help.
      </p>
      <fieldset class="recovery-options">
        <legend>What happened? Choose all that apply.</legend>
        {Object.entries(actions).map(([key, label]) => {
          const action = key as RecoveryAction;
          return (
            <label class={happened.includes(action) ? 'chosen' : ''}>
              <input
                type="checkbox"
                checked={happened.includes(action)}
                onChange={() => setHappened(toggle(happened, action))}
              />
              {label}
            </label>
          );
        })}
      </fieldset>
      {plan.length > 0 && (
        <div class="plan" aria-live="polite">
          <div class="plan-head">
            <h2>Your next steps</h2>
            <span role="status" class="small muted">
              {finished.length} of {plan.length} done
            </span>
          </div>
          <progress
            value={finished.length}
            max={plan.length}
            aria-label="Steps done"
            class="plan-progress"
          />
          <p class="small muted">One thing per tick. Ticks are not saved.</p>
          {(['now', 'next'] as const).map((when) => {
            const group = plan.filter((item) => item.when === when);
            return (
              group.length > 0 && (
                <>
                  <h3 class={`step-group ${when}`}>
                    {when === 'now' ? 'Do these now' : 'Then, when you can'}
                  </h3>
                  <ol class="steps">
                    {group.map((item) => (
                      <li class={done.includes(item.step) ? 'done' : ''}>
                        <label>
                          <input
                            type="checkbox"
                            checked={done.includes(item.step)}
                            onChange={() => setDone(toggle(done, item.step))}
                          />
                          <span>{item.step}</span>
                        </label>
                      </li>
                    ))}
                  </ol>
                </>
              )
            );
          })}
          <div class="gentle-warning">
            <strong>Be careful with offers to recover money.</strong>
            <p>
              Money may not come back. Anyone charging a fee or promising a guaranteed recovery may
              be running another scam.
            </p>
          </div>
        </div>
      )}
      <h2>Where to report it</h2>
      <label class="region-select">
        Your region
        <select value={region} onChange={(e) => setRegion(e.currentTarget.value as Region)}>
          {(Object.keys(resources) as Region[]).map((r) => (
            <option value={r}>{regionNames[r]}</option>
          ))}
        </select>
      </label>
      <p class="small muted">
        These links open a new tab. Nothing from your message is added to them.
      </p>
      <ul class="resource-list">
        {resources[region].map((resource) => (
          <li>
            <strong>
              {resource.url ? (
                <External href={resource.url}>{resource.label}</External>
              ) : (
                resource.label
              )}
            </strong>
            <p>{resource.description}</p>
            <small>
              <External href={resource.sourceUrl}>Source</External> · Last checked{' '}
              {resource.lastChecked}
            </small>
          </li>
        ))}
      </ul>
      <details class="report card">
        <summary>
          <Icon name="print" />
          Make a summary for your bank or the police
        </summary>
        <p class="small muted">
          Fill in only what you know. It stays on this device until you copy or print it.
        </p>
        <div class="report-fields">
          <label>
            When it happened
            <input value={when} onInput={(e) => setWhen(e.currentTarget.value)} />
          </label>
          <label>
            Amount
            <input value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
          </label>
          <label>
            How it was paid or shared
            <input value={paidHow} onInput={(e) => setPaidHow(e.currentTarget.value)} />
          </label>
          <label>
            Their number, account or username
            <input value={contact} onInput={(e) => setContact(e.currentTarget.value)} />
          </label>
          <label class="wide">
            The message you received
            <textarea
              rows={3}
              value={reportMessage}
              onInput={(e) => setReportMessage(e.currentTarget.value)}
            />
          </label>
        </div>
        <h3>Your summary</h3>
        <pre class="report-preview" data-testid="report">
          {report}
        </pre>
        <div class="button-row">
          <button
            class="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setCopyStatus('Copied.');
              } catch {
                setCopyStatus('Clipboard is unavailable. Select the summary and copy it.');
              }
            }}
          >
            <Icon name="copy" />
            Copy summary
          </button>
          <button class="secondary" onClick={() => window.print()}>
            <Icon name="print" />
            Print
          </button>
        </div>
        <p role="status" class="small">
          {copyStatus}
        </p>
      </details>
      <p class="emergency">
        This does not replace emergency services. If you are in immediate danger, call your local
        emergency number.
      </p>
      <details>
        <summary>Sources for these recovery steps</summary>
        {recoverySources.map((s, i) => (
          <p>
            <External href={s}>
              {i === 0 ? 'FTC: What to do if you were scammed' : 'FBI: Tech support scams'}
            </External>
          </p>
        ))}
      </details>
    </section>
  );
}
