import { useState } from 'preact/hooks';
import { actions, recoverySteps, recoverySources, type RecoveryAction } from '../data/recovery';
import { resources, type Region } from '../data/resources';
export function External({ href, children }: { href: string; children: preact.ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span class="sr-only"> (opens a new tab)</span>
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
export function Recovery() {
  const [action, setAction] = useState<RecoveryAction | ' '>(' '),
    [region, setRegion] = useState<Region>('Elsewhere');
  return (
    <section class="recovery-content">
      <p class="eyebrow">You can still take the next step</p>
      <h2>Let’s focus on what you can do.</h2>
      <p>
        These messages are designed to be convincing. There’s no blame here. If more than one thing
        happened, follow each relevant path.
      </p>
      <div class="recovery-selects">
        <label>
          What happened?
          <select
            value={action}
            onChange={(e) => setAction(e.currentTarget.value as RecoveryAction)}
          >
            <option value=" ">Choose what happened</option>
            {Object.entries(actions).map(([key, label]) => (
              <option value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Your region
          <select value={region} onChange={(e) => setRegion(e.currentTarget.value as Region)}>
            {Object.keys(resources).map((r) => (
              <option value={r}>
                {r === 'Elsewhere'
                  ? 'Anywhere else'
                  : r === 'US'
                    ? 'United States'
                    : r === 'UK'
                      ? 'United Kingdom'
                      : r}
              </option>
            ))}
          </select>
        </label>
      </div>
      {action !== ' ' && (
        <div aria-live="polite">
          <h3>Your next steps</h3>
          <ol class="steps">
            {recoverySteps[action].map((step) => (
              <li>{step}</li>
            ))}
            <li>Keep evidence, then stop contact and report using the trusted routes below.</li>
          </ol>
          <div class="gentle-warning">
            <strong>Be careful with offers to recover money.</strong>
            <p>
              Money may not come back. Anyone charging a fee or promising a guaranteed recovery may
              be running another scam.
            </p>
          </div>
        </div>
      )}
      <h3>Trusted reporting routes</h3>
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
