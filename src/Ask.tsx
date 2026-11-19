import { useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { learnedRisk } from './estimate.ts';
import { bandFor, ultrasonicDistance } from './simulation.ts';
import { useSession } from './session.tsx';

interface Turn {
  id: number;
  role: 'you' | 'guide';
  text: string;
  notes?: string[];
}

const starters = [
  'How is water height read without touching the water?',
  'What raises bloom risk?',
];

export function Ask() {
  const { sample, basinCm } = useSession();
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const fieldId = useId();
  const nextId = useRef(1);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const distance = ultrasonicDistance(sample.waterCm, basinCm);
    const band = bandFor(sample);
    const youId = nextId.current;
    nextId.current += 2;
    setTurns((current) => [...current, { id: youId, role: 'you', text: trimmed }]);
    setQuestion('');
    setError('');
    setPending(true);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          reading: {
            ph: sample.ph,
            waterCm: sample.waterCm,
            distanceCm: distance.distanceCm,
            basinCm,
            rainMmH: sample.rainMmH,
            soilPct: sample.soilPct,
            score: sample.risk,
            learned: learnedRisk(sample),
            state: band.label,
          },
        }),
      });
      const payload = (await response.json()) as { answer?: string; notes?: string[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'MiniCPM is not answering.');
      const answer = payload.answer?.trim();
      if (!answer) throw new Error('empty');
      setTurns((current) => [
        ...current,
        { id: youId + 1, role: 'guide', text: answer, notes: payload.notes ?? [] },
      ]);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      setError(message || 'MiniCPM is not answering on this dashboard yet. Give it a moment if it is still loading.');
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void ask(question);
    }
  }

  return (
    <section className="guide" id="guide" aria-labelledby="guide-heading">
      <header className="section-head">
        <h2 id="guide-heading">Guide</h2>
        <p className="lede">
          Ask about the box, the four sensors, or the score. Answers come from the pond notes and the reading on screen.
        </p>
      </header>
      <div className="starters">
        {starters.map((item) => (
          <button key={item} type="button" className="pill pill-short" onClick={() => void ask(item)} disabled={pending}>
            {item}
          </button>
        ))}
      </div>
      <div className="thread" aria-live="polite">
        {turns.length === 0 ? <p className="thread-empty">The guide is ready.</p> : null}
        {turns.map((turn) => (
          <article key={turn.id} className={turn.role === 'you' ? 'bubble bubble-you' : 'bubble'}>
            <p className="bubble-who">{turn.role === 'you' ? 'You' : 'Guide'}</p>
            <p>{turn.text}</p>
            {turn.notes && turn.notes.length > 0 ? (
              <p className="bubble-notes">Notes used: {turn.notes.join(', ')}</p>
            ) : null}
          </article>
        ))}
        {pending ? <p className="bubble-status">MiniCPM is reading the pond notes.</p> : null}
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <label htmlFor={fieldId}>Question</label>
        <textarea
          id={fieldId}
          rows={3}
          value={question}
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about level, pH, rain, soil, or the score"
        />
        <button type="submit" className="button" disabled={pending || question.trim().length === 0}>
          {pending ? 'Waiting' : 'Ask'}
        </button>
      </form>
      {error ? (
        <p className="warning" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
