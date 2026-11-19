import type { CSSProperties } from 'react';
import { bandFor, formatNumber, ultrasonicDistance } from './simulation.ts';
import { useSession } from './session.tsx';

export function Instrument() {
  const { sample, basinCm, updatedAt, paused, hidden } = useSession();
  const band = bandFor(sample);
  const distance = ultrasonicDistance(sample.waterCm, basinCm);
  const fill = Math.min(1, Math.max(0.06, sample.waterCm / basinCm));
  const clock = new Date(updatedAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const state = paused ? 'Reading paused' : hidden ? 'Tab hidden, reading waits' : 'Reading';

  return (
    <section className="instrument" data-band={band.id} aria-labelledby="risk-heading">
      <p className="badge">{state}</p>
      <p id="risk-heading" className="risk-name">
        {band.label}
      </p>
      <p className="risk-number">
        <span className="risk-figure">{Math.round(sample.risk)}</span>
        <span className="risk-unit">risk</span>
      </p>
      <p className="risk-hint">{band.hint}</p>
      <div
        className="trough"
        style={{ '--fill': String(fill) } as CSSProperties}
        role="img"
        aria-label={`Water fills ${Math.round((sample.waterCm / basinCm) * 100)} percent of the basin.`}
      >
        <div className="trough-water">
          <span className="trough-shine" />
        </div>
      </div>
      <p className="instrument-meta">
        Water {formatNumber(sample.waterCm)} cm. Sensor distance {formatNumber(distance.distanceCm, 0)} cm. Last
        reading {clock}.
      </p>
      {distance.overflow ? (
        <p className="warning" role="status">
          Basin depth is below the water height. Distance is held at 0 cm.
        </p>
      ) : null}
    </section>
  );
}
