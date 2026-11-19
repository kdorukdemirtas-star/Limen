import { Instrument } from './Instrument.tsx';
import { ScenarioSwitch, SensorNote } from './controls.tsx';
import { IconLevel, IconPh, IconRain, IconSoil } from './icons.tsx';
import { formatNumber, phWord, rainWord, soilWord, ultrasonicDistance } from './simulation.ts';
import { useSession } from './session.tsx';
import type { ReactNode } from 'react';

const notes = [
  {
    role: 'Pond care',
    text: 'When the morning pH reached 9, I mixed the water before the green line showed up the next day.',
  },
  {
    role: 'Irrigation ditch',
    text: 'A downpour on saturated soil lifted the score, and the water level rose with it.',
  },
  {
    role: 'Field class',
    text: 'Each sensor looked ordinary alone. Side by side, they showed what the rain was carrying.',
  },
];

export function Landing() {
  const { sample, basinCm } = useSession();
  const distance = ultrasonicDistance(sample.waterCm, basinCm);

  return (
    <>
      <section className="hero wrap" id="start">
        <div className="hero-copy">
          <h1>Algae starts quietly in the water.</h1>
          <p className="lede">
            Limen is a box. It reads contactless level, pH, rain, and soil moisture together, and turns them
            into an eutrophication score.
          </p>
          <div className="actions">
            <a className="button" href="#readings">
              Open the readings
            </a>
            <a className="button button-quiet" href="#score">
              How the score is built
            </a>
          </div>
        </div>
        <Instrument />
      </section>
      <div className="wrap scenario-row">
        <ScenarioSwitch />
      </div>

      <section className="wrap block" aria-labelledby="sensors-heading">
        <div className="section-head">
          <h2 id="sensors-heading">Four readings in the box</h2>
          <p>The numbers follow the pond condition you select.</p>
        </div>
        <div className="sensor-grid">
          <Sensor
            icon={<IconLevel />}
            title="Contactless water level"
            body="The sensor never touches the water. It measures distance from above. Height is basin depth minus that distance."
            value={`${formatNumber(distance.distanceCm, 0)} cm away`}
            detail={`Water height ${formatNumber(sample.waterCm)} cm`}
          />
          <Sensor
            icon={<IconPh />}
            title="pH"
            body="In still water, algae photosynthesis pushes pH up. A low pH is kept as a separate acid warning."
            value={formatNumber(sample.ph, 2)}
            detail={phWord(sample.ph)}
          />
          <Sensor
            icon={<IconRain />}
            title="Rain"
            body="A rain board usually reports wet or dry. Limen shows the intensity in millimetres per hour."
            value={`${formatNumber(sample.rainMmH)} mm/h`}
            detail={rainWord(sample.rainMmH)}
          />
          <Sensor
            icon={<IconSoil />}
            title="Soil moisture"
            body="Saturated soil gives rain to the surface. Dry soil takes the same rain in. The score treats them differently."
            value={`${formatNumber(sample.soilPct, 0)}%`}
            detail={soilWord(sample.soilPct)}
          />
        </div>
      </section>

      <section className="wrap block" id="score" aria-labelledby="formula-heading">
        <div className="section-head">
          <h2 id="formula-heading">How the score is built</h2>
          <p>This is not a laboratory index. It shows whether four contributions rise together.</p>
        </div>
        <ol className="steps">
          <li>
            <strong>Runoff.</strong> Rain carries more nutrients when the soil is saturated. The same rain counts for less on dry soil.
          </li>
          <li>
            <strong>Bloom.</strong> When pH rises above 8 and rain is absent, photosynthesis in still water comes first.
          </li>
          <li>
            <strong>Acid.</strong> Below pH 6.4 the warning is an acid inflow, not algae.
          </li>
          <li>
            <strong>Inflow.</strong> If the level rises from one reading to the next while rain is falling, fresh water is entering.
          </li>
        </ol>
      </section>

      <section className="wrap block" aria-labelledby="notes-heading">
        <div className="section-head">
          <h2 id="notes-heading">Field notes</h2>
          <p>These are the situations the box is meant to catch.</p>
        </div>
        <div className="note-grid">
          {notes.map((note) => (
            <figure className="note" key={note.role}>
              <blockquote>
                <p>{note.text}</p>
              </blockquote>
              <figcaption>{note.role}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="wrap block" aria-labelledby="open-heading">
        <div className="tray">
          <div>
            <h2 id="open-heading">Open the box</h2>
            <p>
              There is no store build and nothing to install. The readings and the guide run on this Mac.
            </p>
          </div>
          <div className="actions">
            <a className="button" href="#readings">
              Open the readings
            </a>
            <a className="button button-quiet" href="#guide">
              Ask the guide
            </a>
            <SensorNote />
          </div>
        </div>
      </section>
    </>
  );
}

function Sensor({
  icon,
  title,
  body,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  value: string;
  detail: string;
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
      <p className="sensor-note">{body}</p>
    </article>
  );
}
