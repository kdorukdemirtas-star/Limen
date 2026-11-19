import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { bandFor, describeShift, nextSample, seedHistory } from './simulation.ts';
import type { Sample, ScenarioId } from './simulation.ts';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Pace = 'slow' | 'fast';

export interface Notice {
  id: number;
  text: string;
}

interface SessionValue {
  scenario: ScenarioId;
  selectScenario: (id: ScenarioId) => void;
  paused: boolean;
  togglePaused: () => void;
  pace: Pace;
  setPace: (pace: Pace) => void;
  basinCm: number;
  setBasinCm: (value: number) => void;
  history: Sample[];
  sample: Sample;
  notices: Notice[];
  updatedAt: number;
  hidden: boolean;
  stepOnce: () => void;
  theme: ThemeChoice;
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);
const THEME_KEY = 'limen-theme';
const HISTORY_LIMIT = 72;

function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* private mode or blocked storage */
  }
  return 'system';
}

function systemIsDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ScenarioId>('calm');
  const [history, setHistory] = useState<Sample[]>(() => seedHistory('calm'));
  const [paused, setPaused] = useState(false);
  const [pace, setPace] = useState<Pace>('slow');
  const [basinCm, setBasinState] = useState(80);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [hidden, setHidden] = useState(() => document.hidden);
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [systemDark, setSystemDark] = useState(systemIsDark);
  const historyRef = useRef(history);
  const scenarioRef = useRef(scenario);
  const noticeId = useRef(1);

  useEffect(() => {
    historyRef.current = history;
    scenarioRef.current = scenario;
  });

  const stepOnce = useCallback(() => {
    if (document.hidden) return;
    const base = historyRef.current;
    const last = base.length > 0 ? base[base.length - 1] : null;
    const next = nextSample(last, scenarioRef.current, (last?.t ?? 0) + 2.5);
    const note = describeShift(last, next);
    if (note) {
      noticeId.current += 1;
      const id = noticeId.current;
      setNotices((current) => [{ id, text: note }, ...current].slice(0, 6));
    }
    const trimmed = base.length >= HISTORY_LIMIT ? base.slice(base.length - HISTORY_LIMIT + 1) : base;
    const updated = [...trimmed, next];
    historyRef.current = updated;
    setHistory(updated);
    setUpdatedAt(Date.now());
  }, []);

  useEffect(() => {
    if (paused) return;
    let timer = 0;
    const delay = pace === 'fast' ? 1200 : 2600;
    const arm = () => {
      window.clearInterval(timer);
      if (document.hidden) return;
      timer = window.setInterval(() => stepOnce(), delay);
    };
    const onVis = () => {
      if (document.hidden) {
        window.clearInterval(timer);
        return;
      }
      stepOnce();
      arm();
    };
    arm();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [paused, pace, stepOnce]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore storage failures */
    }
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const sample = history[history.length - 1];

  const value = useMemo<SessionValue>(
    () => ({
      scenario,
      selectScenario: (id: ScenarioId) => {
        scenarioRef.current = id;
        const seeded = seedHistory(id);
        historyRef.current = seeded;
        setScenario(id);
        setHistory(seeded);
        setNotices([]);
        setUpdatedAt(Date.now());
      },
      paused,
      togglePaused: () => setPaused((current) => !current),
      pace,
      setPace,
      basinCm,
      setBasinCm: (next: number) => {
        if (!Number.isFinite(next)) return;
        setBasinState(Math.min(200, Math.max(30, Math.round(next))));
      },
      history,
      sample,
      notices,
      updatedAt,
      hidden,
      stepOnce,
      theme,
      resolvedTheme,
      toggleTheme: () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      },
    }),
    [scenario, paused, pace, basinCm, history, sample, notices, updatedAt, hidden, theme, resolvedTheme, stepOnce],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}

export function LiveStatus() {
  const { sample } = useSession();
  const band = bandFor(sample);
  const [text, setText] = useState('');
  const previous = useRef(band.id);

  useEffect(() => {
    if (previous.current === band.id) return;
    previous.current = band.id;
    setText(`${band.label}. Risk ${Math.round(sample.risk)}. ${band.hint}`);
  }, [band.id, band.hint, band.label, sample.risk]);

  return (
    <p className="live" role="status">
      {text}
    </p>
  );
}
