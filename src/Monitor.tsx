import { Ask } from './Ask.tsx';
import { Models } from './Models.tsx';
import { ScenarioSwitch } from './controls.tsx';
import { IconLevel, IconPh, IconRain, IconSoil } from './icons.tsx';
import { learnedRisk } from './estimate.ts';
import { Instrument } from './Instrument.tsx';
import {
  bandFor,
  formatNumber,
  phWord,
  rainWord,
  soilWord,
  ultrasonicDistance,
} from './simulation.ts';
import type { DriverId, Sample } from './simulation.ts';
import { useSession } from './session.tsx';
import type { ReactNode } from 'react';

const drivers: { id: DriverId; label: string }[] = [
  { id: 'runoff', label: 'Rain and soil' },
  { id: 'bloom', label: 'Rising pH' },
  { id: 'acid', label: 'Falling pH' },
  { id: 'inflow', label: 'Rising level' },
];

export function Monitor() {
  const { sample, history, basinCm, setBasinCm, paused, togglePaused, pace, setPace, notices, stepOnce } =
    useSession();
  const distance = ultrasonicDistance(sample.waterCm, basinCm);
  const band = bandFor(sample);
  const fitted = Math.round(learnedRisk(sample));

  return (
    <div className="wrap monitor">
      <header className="monitor-head">
        <div>
          <h1>Readings</h1>
          <p className="lede">Four readings and their sum. Pause freezes the numbers. Read now takes one step.</p>
        </div>
        <div className="monitor-actions">
          <button type="button" className="button" onClick={togglePaused} aria-pressed={paused}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="button button-quiet" onClick={stepOnce}>
            Read now
          </button>
          <div className="pills" role="group" aria-label="Reading pace">
            <button
              type="button"
              className="pill pill-short"
              aria-pressed={pace === 'slow'}
              onClick={() => setPace('slow')}
            >
              Slow pace
            </button>
            <button
              type="button"
              className="pill pill-short"
              aria-pressed={pace === 'fast'}
              onClick={() => setPace('fast')}
            >
              Fast pace
            </button>
          </div>
        </div>
      </header>

      <ScenarioSwitch />

      <div className="monitor-grid">
        <Instrument />
        <section className="panel" aria-labelledby="drivers-heading">
          <h2 id="drivers-heading">Parts of the score</h2>
          <p>The four parts add up to the score above. The name and the number carry the meaning.</p>
          <div className="drivers">
            {drivers.map((driver) => {
              const value = Math.round(sample.breakdown[driver.id]);
              return (
                <div className="driver" key={driver.id}>
                  <div className="driver-top">
                    <span>{driver.label}</span>
                    <span className="num">{value}</span>
                  </div>
                  <div
                    className="track"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={value}
                    aria-label={driver.label}
                  >
                    <span style={{ transform: `scaleX(${value / 100})` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="panel-foot">
            Total {Math.round(sample.risk)}. State: {band.label}. Learned estimate {fitted}.
          </p>
        </section>
      </div>

      <div className="sensor-grid">
        <Reading
          icon={<IconLevel />}
          title="Contactless level"
          value={`${formatNumber(distance.distanceCm, 0)} cm`}
          detail={
            distance.overflow
              ? `water ${formatNumber(sample.waterCm)} cm, basin is too shallow`
              : `water ${formatNumber(sample.waterCm)} cm`
          }
          series={history.map((item) => item.waterCm)}
          summary={`Water height ${formatNumber(sample.waterCm)} centimetres`}
        />
        <Reading
          icon={<IconPh />}
          title="pH"
          value={formatNumber(sample.ph, 2)}
          detail={phWord(sample.ph)}
          series={history.map((item) => item.ph)}
          summary={`pH ${formatNumber(sample.ph, 2)}, ${phWord(sample.ph)}`}
        />
        <Reading
          icon={<IconRain />}
          title="Rain"
          value={`${formatNumber(sample.rainMmH)}`}
          detail={`${rainWord(sample.rainMmH)} · mm/h`}
          series={history.map((item) => item.rainMmH)}
          summary={`Rain ${formatNumber(sample.rainMmH)} millimetres per hour, ${rainWord(sample.rainMmH)}`}
        />
        <Reading
          icon={<IconSoil />}
          title="Soil moisture"
          value={`${formatNumber(sample.soilPct, 0)}%`}
          detail={soilWord(sample.soilPct)}
          series={history.map((item) => item.soilPct)}
          summary={`Soil moisture ${formatNumber(sample.soilPct, 0)} percent, ${soilWord(sample.soilPct)}`}
        />
      </div>

      <section className="panel field-panel" aria-labelledby="basin-heading">
        <div className="field-copy">
          <h2 id="basin-heading">Basin depth</h2>
          <p>
            The ultrasonic sensor measures distance. Water height is depth minus distance. Changing the depth
            leaves the history alone and only recomputes the distance.
          </p>
        </div>
        <label className="field">
          <span>
            Depth <strong className="num">{basinCm} cm</strong>
          </span>
          <input
            type="range"
            min={30}
            max={200}
            step={1}
            value={basinCm}
            onChange={(event) => setBasinCm(Number(event.target.value))}
          />
        </label>
      </section>

      <Models />

      <RiskChart history={history} />

      <section className="panel" aria-labelledby="log-heading">
        <h2 id="log-heading">Recent readings</h2>
        <div className="table-scroll">
          <table className="log">
            <caption>The last six samples, counted in the series rather than by clock time.</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Water</th>
                <th scope="col">pH</th>
                <th scope="col">Rain</th>
                <th scope="col">Soil</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {history
                .slice(-6)
                .reverse()
                .map((item) => (
                  <tr key={item.t}>
                    <th scope="row">{agoLabel(sample.t, item.t)}</th>
                    <td className="num">{formatNumber(item.waterCm)} cm</td>
                    <td className="num">{formatNumber(item.ph, 2)}</td>
                    <td className="num">{formatNumber(item.rainMmH)}</td>
                    <td className="num">{formatNumber(item.soilPct, 0)}%</td>
                    <td className="num">{Math.round(item.risk)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="notice-heading">
        <h2 id="notice-heading">Shifts</h2>
        {notices.length === 0 ? (
          <p>No threshold has been crossed yet. Changing the pond condition clears this list.</p>
        ) : (
          <ul className="notices">
            {notices.map((notice) => (
              <li key={notice.id}>{notice.text}</li>
            ))}
          </ul>
        )}
      </section>

      <Ask />
    </div>
  );
}

function Reading({
  icon,
  title,
  value,
  detail,
  series,
  summary,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
  series: number[];
  summary: string;
}) {
  return (
    <article className="sensor">
      <div className="sensor-top">
        <span className="icon-well">{icon}</span>
        <h3>{title}</h3>
      </div>
      <p className="sensor-value">
        {value} <span>{detail}</span>
      </p>
      <Spark values={series} summary={summary} />
    </article>
  );
}

function Spark({ values, summary }: { values: number[]; summary: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = max === min ? 20 : 4 + (1 - (value - min) / (max - min)) * 32;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg className="spark" viewBox="0 0 100 40" role="img" aria-label={summary}>
      <path d={d} />
    </svg>
  );
}

function RiskChart({ history }: { history: Sample[] }) {
  const width = 680;
  const height = 240;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const last = history[history.length - 1];
  const xAt = (index: number) => padL + (index / Math.max(1, history.length - 1)) * innerW;
  const yRisk = (value: number) => padT + (1 - value / 100) * innerH;
  const yPh = (value: number) => padT + (1 - (value - 4) / 8) * innerH;
  const riskLine = history
    .map((sample, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)} ${yRisk(sample.risk).toFixed(1)}`)
    .join(' ');
  const area = `${riskLine} L${xAt(history.length - 1).toFixed(1)} ${padT + innerH} L${xAt(0).toFixed(1)} ${padT + innerH} Z`;
  const phLine = history
    .map((sample, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)} ${yPh(sample.ph).toFixed(1)}`)
    .join(' ');

  return (
    <section className="panel" aria-labelledby="chart-heading">
      <div className="section-head">
        <h2 id="chart-heading">Score and pH</h2>
        <p>The filled area is the score, from 0 to 100. The dashed line is pH, drawn from 4 to 12.</p>
      </div>
      <ul className="legend">
        <li>
          <span className="swatch swatch-risk" /> Risk
        </li>
        <li>
          <span className="swatch swatch-ph" /> pH
        </li>
      </ul>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Latest score ${Math.round(last.risk)}, pH ${formatNumber(last.ph, 2)}.`}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={padL} x2={width - padR} y1={yRisk(tick)} y2={yRisk(tick)} />
            <text x={0} y={yRisk(tick) + 4}>
              {tick}
            </text>
          </g>
        ))}
        <path className="chart-area" d={area} />
        <path className="chart-risk" d={riskLine} />
        <path className="chart-ph" d={phLine} />
      </svg>
    </section>
  );
}

function agoLabel(latest: number, t: number): string {
  const delta = Math.max(0, latest - t);
  if (delta < 3) return 'now';
  if (delta < 60) return `${Math.round(delta)} s ago`;
  return `${Math.round(delta / 60)} min ago`;
}
