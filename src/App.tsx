import { useEffect, useState } from 'react';
import { Landing } from './Landing.tsx';
import { Monitor } from './Monitor.tsx';
import { LiveStatus, SessionProvider, useSession } from './session.tsx';

type View = 'home' | 'readings';

function viewFromHash(hash: string): View {
  if (hash === '#readings' || hash === '#guide') return 'readings';
  return 'home';
}

function titleFor(view: View): string {
  if (view === 'readings') return 'Readings — Limen';
  return 'Limen — algae and eutrophication';
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));
  const { resolvedTheme, toggleTheme } = useSession();

  useEffect(() => {
    const sync = () => {
      setHash(window.location.hash);
      setView(viewFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    document.title = titleFor(view);
    if (hash === '#guide') document.getElementById('guide')?.scrollIntoView();
    if (hash === '#score') document.getElementById('score')?.scrollIntoView();
  }, [hash, view]);

  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <LiveStatus />
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="mark" href="#start">
            <span className="mark-stone" aria-hidden="true" />
            Limen
          </a>
          <nav aria-label="Pages">
            <a href="#start" aria-current={view === 'home' ? 'page' : undefined}>
              Start
            </a>
            <a href="#readings" aria-current={view === 'readings' && hash !== '#guide' ? 'page' : undefined}>
              Readings
            </a>
            <a href="#score">Score</a>
            <a href="#guide">Guide</a>
          </nav>
          <button type="button" className="button button-quiet button-small" onClick={toggleTheme} aria-pressed={resolvedTheme === 'dark'}>
            Dark surface
          </button>
        </div>
      </header>
      <main id="content">
        {view === 'home' ? <Landing /> : <Monitor />}
      </main>
      <footer className="footer wrap">
        <p>Limen keeps the pond readings and your questions on this Mac.</p>
      </footer>
    </>
  );
}
