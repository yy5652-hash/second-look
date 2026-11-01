import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { analyze, MAX_INPUT, type Analysis } from './engine/analyze';
import { examples } from './data/examples';
import { Icon } from './ui/icons';
import { Privacy } from './ui/Privacy';
import { Recovery } from './ui/Recovery';
import { How } from './ui/How';
import { Result, outcomeNames, focusId } from './ui/Result';
import './style.css';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
function App() {
  const [text, setText] = useState(''),
    [result, setResult] = useState<Analysis | null>(null),
    [page, setPage] = useState<'check' | 'how'>('check');
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [imageNote, setImageNote] = useState('');
  const [ready, setReady] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [update, setUpdate] = useState(false),
    [install, setInstall] = useState<InstallEvent | null>(null);
  const [dark, setDark] = useState(() => {
    try {
      return (
        localStorage.getItem('second-look-theme') === 'dark' ||
        (!localStorage.getItem('second-look-theme') &&
          matchMedia('(prefers-color-scheme: dark)').matches)
      );
    } catch {
      return false;
    }
  });
  const fileInput = useRef<HTMLInputElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null),
    controller = useRef<AbortController | null>(null),
    job = useRef(0),
    updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
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
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('second-look-theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine),
      hide = () => clear();
    const installing = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    window.addEventListener('pagehide', hide);
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
    if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(() => setReady(true));
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('beforeinstallprompt', installing);
    };
  }, []);
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
  const go = (next: 'check' | 'how') => {
    setPage(next);
    requestAnimationFrame(() => focusId('main'));
  };
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
          <span>
            Second Look<span class="wordmark-caption">A moment before you act.</span>
          </span>
        </button>
        <nav aria-label="Main">
          <button class="nav-button" onClick={() => go(page === 'check' ? 'how' : 'check')}>
            {page === 'check' ? 'How this works' : 'Back to check'}
          </button>
          <button
            class="theme-button"
            aria-label={dark ? 'Use light theme' : 'Use dark theme'}
            onClick={() => setDark(!dark)}
          >
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {page === 'how' ? (
          <How />
        ) : (
          <>
            <section class="intro">
              <p class="eyebrow">
                <span class="small-line" /> A little pause. A clearer next step.
              </p>
              <h1>
                Not sure about
                <br class="desktop-break" /> that message?
              </h1>
              <p>Let’s take a second look, together.</p>
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
                rows={6}
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
              <div class="input-tools">
                <button
                  class="text-button"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <Icon name="image" />
                  Use a screenshot
                </button>
                <span class="small muted">{text.length.toLocaleString()} / 10,000</span>
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
                Or drop or paste an image. English text checks. Any language’s links.
              </p>
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
              <button
                class="primary check-button"
                disabled={busy || !text.trim()}
                onClick={() => {
                  const r = analyze(text);
                  setResult(r);
                  requestAnimationFrame(() => focusId('result'));
                }}
              >
                Take a second look
                <Icon name="arrow" />
              </button>
              <div class="input-reassurance">
                <Icon name="lock" />
                <span>No account. No upload. Just this device.</span>
              </div>
            </section>
            <p class="sr-only" role="status" aria-live="polite">
              {result ? `${outcomeNames[result.level]}. ${result.summary}` : ''}
            </p>
            {result && <Result key={text} result={result} text={text} />}
            <details class="examples">
              <summary>Just exploring? Try an example</summary>
              <p class="small muted">Made-up messages. All sample links use reserved domains.</p>
              <div class="example-buttons">
                {examples.map((example, i) => (
                  <button
                    class="chip"
                    disabled={busy}
                    onClick={() => {
                      change(example.text);
                      setImageNote('');
                      textarea.current?.focus();
                    }}
                  >
                    {example.name}
                    <span class="small">{i < 5 ? 'Suspicious' : 'Genuine'}</span>
                  </button>
                ))}
              </div>
            </details>
            <details class="recovery card" id="recovery">
              <summary>
                <span class="recovery-summary">
                  <Icon name="help" />
                  <span>
                    <strong>Already clicked or paid?</strong>
                    <span>There are steps you can take now.</span>
                  </span>
                </span>
                <span aria-hidden="true" class="plus">
                  +
                </span>
              </summary>
              <Recovery />
            </details>
            <div class="principles">
              <div>
                <span>01</span>
                <h3>Your words stay yours.</h3>
                <p>The message never leaves your device.</p>
              </div>
              <div>
                <span>02</span>
                <h3>Clues, not guesses.</h3>
                <p>See the exact words behind every finding.</p>
              </div>
              <div>
                <span>03</span>
                <h3>A next step, always.</h3>
                <p>Know how to check, or what to do next.</p>
              </div>
            </div>
            <Privacy />
            <div class="clear-row">
              <button
                class="text-button"
                onClick={() => {
                  clear();
                  textarea.current?.focus();
                }}
              >
                Clear message and results
              </button>
              <span class="small muted">Nothing to sign in to. Nothing to save.</span>
            </div>
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
            Screen. Text checks work offline once ready; read an image online once to cache its
            reader.
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
