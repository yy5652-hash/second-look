import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { analyze, MAX_INPUT, type Analysis } from './engine/analyze';
import { examples } from './data/examples';
import { Icon } from './ui/icons';
import { Privacy } from './ui/Privacy';
import { Recovery } from './ui/Recovery';
import { How } from './ui/How';
import { Result, outcomeNames } from './ui/Result';
import './style.css';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type View = 'check' | 'result' | 'how' | 'recovery';
const stored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
function App() {
  const [text, setText] = useState(''),
    [result, setResult] = useState<Analysis | null>(null),
    [view, setView] = useState<View>('check');
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [imageNote, setImageNote] = useState('');
  const [ready, setReady] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [update, setUpdate] = useState(false),
    [install, setInstall] = useState<InstallEvent | null>(null);
  const [dark, setDark] = useState(() => {
    const theme = stored('second-look-theme');
    if (theme) return theme === 'dark';
    try {
      return matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  const [large, setLarge] = useState(() => stored('second-look-text') === 'large');
  const fileInput = useRef<HTMLInputElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null),
    controller = useRef<AbortController | null>(null),
    job = useRef(0),
    updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const shown: View = view === 'result' && !result ? 'check' : view;
  const clear = () => {
    job.current++;
    controller.current?.abort();
    controller.current = null;
    setText('');
    setResult(null);
    setNotice('');
    setImageNote('');
    setBusy(false);
    setProgress('');
    if (fileInput.current) fileInput.current.value = '';
  };
  // Moves to a view with the page at the top. History holds only the view's name, never the message.
  const go = (next: View, focus = next === 'result' ? 'outcome-title' : 'main') => {
    setView(next);
    history.pushState({ view: next }, '');
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById(focus)?.focus({ preventScroll: true });
    });
  };
  const run = (message: string) => {
    setResult(analyze(message));
    go('result');
  };
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    store('second-look-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    document.documentElement.dataset.text = large ? 'large' : 'normal';
    store('second-look-text', large ? 'large' : 'normal');
  }, [large]);
  const change = (value: string) => {
    setText(value.slice(0, MAX_INPUT));
    setResult(null);
    setNotice(
      value.length > MAX_INPUT
        ? 'Only the first 10,000 characters fit. Split longer messages into smaller parts.'
        : '',
    );
  };
  const image = async (file?: File) => {
    if (!file || busy) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const current = ++job.current;
    setBusy(true);
    setNotice('');
    setResult(null);
    setImageNote('');
    setProgress('Opening the local image reader…');
    const timeout = setTimeout(() => abort.abort(), 100000);
    try {
      const { readImage } = await import('./ui/image');
      const data = await readImage(
        file,
        (p) => {
          if (current === job.current) setProgress(p);
        },
        abort.signal,
      );
      if (current !== job.current) return;
      change(data.text);
      setImageNote(
        data.text
          ? data.note
          : 'No text or URL could be read. Try a clearer crop, or type the message below.',
      );
      textarea.current?.focus();
    } catch (error) {
      if (current === job.current)
        setNotice(
          abort.signal.aborted
            ? 'Image reading stopped. You can type the message or try another image.'
            : error instanceof Error
              ? error.message
              : 'We could not read that image. Please type the message instead.',
        );
    } finally {
      clearTimeout(timeout);
      if (current === job.current) {
        setBusy(false);
        setProgress('');
      }
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const pasteAndCheck = async () => {
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted.trim()) {
        change(pasted);
        run(pasted.slice(0, MAX_INPUT));
        return;
      }
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          await image(new File([blob], 'clipboard-image', { type }));
          return;
        }
      }
      setNotice('Your clipboard is empty. Copy the message first, or type it in the box.');
    } catch {
      setNotice('Your browser did not allow that. Tap the box, then choose Paste.');
    }
    textarea.current?.focus();
  };
  const takeShared = async () => {
    history.replaceState(null, '', location.pathname);
    const worker = (await navigator.serviceWorker.ready).active;
    navigator.serviceWorker.addEventListener(
      'message',
      (event) => {
        if (event.data?.type !== 'SHARED') return;
        const shared = event.data.shared as { text: string; image?: File } | null;
        if (shared?.image) void image(shared.image);
        else if (shared?.text.trim()) {
          change(shared.text);
          run(shared.text.slice(0, MAX_INPUT));
        } else setNotice('The shared message did not arrive. Please paste it here instead.');
      },
      { once: true },
    );
    worker?.postMessage({ type: 'TAKE_SHARED' });
  };
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine),
      hide = () => clear(),
      back = (event: PopStateEvent) => setView(event.state?.view ?? 'check');
    const installing = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('pagehide', hide);
    window.addEventListener('popstate', back);
    window.addEventListener('beforeinstallprompt', installing);
    updateSW.current = registerSW({
      immediate: true,
      onOfflineReady: () => setReady(true),
      onNeedRefresh: () => setUpdate(true),
      onRegisterError: () =>
        setNotice(
          'Offline setup did not finish. Text checks still work while this page is open. Reload when connected to try again.',
        ),
    });
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.ready.then(() => {
        setReady(true);
        // The worker is now there to answer shares, so an install may offer them.
        document.querySelector('link[rel="manifest"]')?.setAttribute('href', 'share.webmanifest');
      });
    if (new URLSearchParams(location.search).has('shared')) void takeShared();
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('popstate', back);
      window.removeEventListener('beforeinstallprompt', installing);
    };
  }, []);
  return (
    <>
      <a class="skip" href="#main">
        Skip to content
      </a>
      <header class="site-header">
        <button class="wordmark" onClick={() => go('check')} aria-label="Second Look home">
          <span class="brand-symbol">
            <Icon name="eye" />
          </span>
          <span class="wordmark-name">Second Look</span>
        </button>
        <nav aria-label="Main">
          <button class="nav-button" onClick={() => go(shown === 'how' ? 'check' : 'how')}>
            {shown === 'how' ? 'Back to check' : 'How this works'}
          </button>
          <button
            class="round-button text-size"
            aria-label="Larger text"
            aria-pressed={large}
            onClick={() => setLarge(!large)}
          >
            A<span>A</span>
          </button>
          <button
            class="round-button"
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            onClick={() => setDark(!dark)}
          >
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
        </nav>
      </header>
      <main id="main" tabIndex={-1} class={`view-${shown}`}>
        <p class="sr-only" role="status" aria-live="polite">
          {shown === 'result' && result ? `${outcomeNames[result.level]}. ${result.summary}` : ''}
        </p>
        {shown === 'how' && <How />}
        {shown === 'recovery' && <Recovery message={text} />}
        {shown === 'result' && result && (
          <Result
            key={text}
            result={result}
            text={text}
            onAnother={() => {
              clear();
              go('check', 'message');
            }}
            onEdit={() => go('check', 'message')}
            onRecovery={() => go('recovery', 'recovery-title')}
          />
        )}
        {shown === 'check' && (
          <>
            <section class="intro">
              <h1>Is this message a scam?</h1>
              <p>
                Paste it or add a screenshot. See the warning signs and what to do next. It all
                happens on this device.
              </p>
            </section>
            <section
              class="input-card card"
              aria-label="Check a message"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void image(e.dataTransfer?.files[0]);
              }}
            >
              <label for="message">Paste the message here</label>
              <textarea
                id="message"
                ref={textarea}
                placeholder="The text, email or DM that made you pause…"
                value={text}
                disabled={busy}
                maxLength={MAX_INPUT}
                rows={4}
                spellcheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                aria-describedby="input-help input-notice"
                onInput={(e) => change(e.currentTarget.value)}
                onPaste={(e) => {
                  const f = e.clipboardData?.files[0];
                  if (f) {
                    e.preventDefault();
                    void image(f);
                    return;
                  }
                  const pasted = e.clipboardData?.getData('text/plain');
                  if (pasted !== undefined) {
                    e.preventDefault();
                    const el = e.currentTarget;
                    change(text.slice(0, el.selectionStart) + pasted + text.slice(el.selectionEnd));
                  }
                }}
              />
              <p id="input-notice" role="status" class={notice ? 'notice' : ''}>
                {notice}
              </p>
              {imageNote && (
                <p class="image-note" role="status">
                  {imageNote}
                </p>
              )}
              {busy && (
                <div class="ocr-progress" role="status">
                  <p>{progress}</p>
                  <progress aria-label="Reading image" />
                  <button
                    class="text-button"
                    onClick={() => {
                      job.current++;
                      controller.current?.abort();
                      setBusy(false);
                      setProgress('');
                      setNotice('Image reading cancelled. Type or paste the message instead.');
                    }}
                  >
                    Cancel image reading
                  </button>
                </div>
              )}
              {text.trim() ? (
                <button class="primary check-button" disabled={busy} onClick={() => run(text)}>
                  Check this message
                  <Icon name="arrow" />
                </button>
              ) : (
                <button
                  class="primary check-button"
                  disabled={busy}
                  onClick={() => void pasteAndCheck()}
                >
                  Paste and check
                  <Icon name="paste" />
                </button>
              )}
              <div class="input-tools">
                <button
                  class="text-button"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <Icon name="image" />
                  Use a screenshot
                </button>
                {text ? (
                  <button class="text-button" onClick={clear}>
                    Clear message
                  </button>
                ) : (
                  <span class="small muted">Or drop an image here</span>
                )}
              </div>
              <input
                class="sr-only"
                type="file"
                ref={fileInput}
                accept="image/png,image/jpeg,image/webp,image/bmp"
                aria-label="Choose an image"
                tabIndex={-1}
                onChange={(e) => void image(e.currentTarget.files?.[0])}
              />
              <p id="input-help" class="small muted">
                No account. Nothing uploaded. Wording checks are in English; links in any language.
              </p>
            </section>
            <section class="examples" aria-labelledby="examples-title">
              <h2 id="examples-title">Try an example</h2>
              <div class="example-buttons">
                {examples.map((example, i) => (
                  <button
                    class="chip"
                    disabled={busy}
                    onClick={() => {
                      change(example.text);
                      setImageNote('');
                      run(example.text);
                    }}
                  >
                    {example.name}
                    <span class="small">{i < 5 ? 'Suspicious' : 'Genuine'}</span>
                  </button>
                ))}
              </div>
              <p class="small muted">Made-up messages. All sample links use reserved domains.</p>
            </section>
            <button class="recovery-entry card" onClick={() => go('recovery', 'recovery-title')}>
              <span>
                <strong>Already clicked or paid?</strong>
                <span>Get a checklist, most urgent first, and a summary for your bank.</span>
              </span>
              <Icon name="arrow" />
            </button>
            <div class="principles">
              <div>
                <Icon name="shield" />
                <h3>Stays on your device</h3>
                <p>The message is checked right here. It isn’t sent anywhere.</p>
              </div>
              <div>
                <Icon name="words" />
                <h3>Shows you the words</h3>
                <p>Every warning sign points to the exact words behind it.</p>
              </div>
              <div>
                <Icon name="step" />
                <h3>Tells you what to do</h3>
                <p>You always get a safe next step, even when nothing stands out.</p>
              </div>
            </div>
            <Privacy />
          </>
        )}
      </main>
      <footer>
        <span class="footer-brand">Second Look</span>
        <span class="offline-state">
          <span class={ready ? 'status-dot ready' : 'status-dot'} />
          {offline
            ? ready
              ? 'Offline · ready to help'
              : 'Offline · page is available'
            : ready
              ? 'Text checks ready offline'
              : 'Preparing offline access…'}
        </span>
        <details class="install-help">
          <summary>Keep it handy</summary>
          <p>
            Install this app from your browser’s menu. On iPhone or iPad: Share → Add to Home
            Screen. Once it’s installed on Android, you can share a message to it straight from your
            messages app. Text checks work offline once ready; read an image online once to cache
            its reader.
          </p>
          {install && (
            <button
              class="secondary"
              onClick={async () => {
                await install.prompt();
                await install.userChoice;
                setInstall(null);
              }}
            >
              <Icon name="download" />
              Install Second Look
            </button>
          )}
        </details>
        <p class="small">
          A helpful pause, never a guarantee. If you are in immediate danger, call your local
          emergency number.
        </p>
      </footer>
      {update && (
        <aside class="update-notice">
          <p>A new version is ready. Updating clears the current message.</p>
          <button
            class="secondary"
            onClick={() => {
              clear();
              void updateSW.current?.(true);
            }}
          >
            Clear and update
          </button>
          <button class="text-button" onClick={() => setUpdate(false)}>
            Later
          </button>
        </aside>
      )}
    </>
  );
}
render(<App />, document.getElementById('app')!);
