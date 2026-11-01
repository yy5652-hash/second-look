import { useEffect, useState } from 'preact/hooks';
import { Icon } from './icons';
export function isExternalResource(name: string, origin: string) {
  try {
    const url = new URL(name);
    return /^https?:$/.test(url.protocol) && url.origin !== origin;
  } catch {
    return false;
  }
}
export function Privacy() {
  const [count, setCount] = useState(0),
    [available, setAvailable] = useState(true);
  useEffect(() => {
    const seen = new Set<string>();
    let total = 0;
    const collect = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const key = entry.name + '|' + entry.startTime;
        if (!seen.has(key)) {
          seen.add(key);
          if (isExternalResource(entry.name, location.origin)) total++;
        }
      }
      setCount(total);
    };
    collect(performance.getEntriesByType('resource'));
    if (!('PerformanceObserver' in window)) {
      setAvailable(false);
      return;
    }
    const observer = new PerformanceObserver((list) => collect(list.getEntries()));
    try {
      observer.observe({ type: 'resource', buffered: true });
    } catch {
      setAvailable(false);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <aside class="privacy-panel" aria-label="Live privacy check">
      <Icon name="lock" />
      <div>
        <strong>
          Requests to other sites since this page opened:{' '}
          <span data-testid="external-count">{available ? count : 'unavailable'}</span>
        </strong>
        <p>
          Live browser resource count. Verify it yourself: open the Network tab, or try airplane
          mode once offline-ready.
        </p>
        <details>
          <summary>What this counter can show</summary>
          <p>
            It counts other-site HTTP requests visible to this page’s PerformanceObserver. Browser
            extensions, blocked attempts and worker traffic may not appear here. The Network tab is
            the fuller check. A strict browser policy also blocks external connections.
          </p>
          <p>
            Messages and images stay in memory. Only app files and your theme choice can be saved.
            Opening a reporting link is your choice and leaves this app in a new tab.
          </p>
        </details>
      </div>
    </aside>
  );
}
