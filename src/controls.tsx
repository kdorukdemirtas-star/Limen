import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { scenarios } from './simulation.ts';
import { useSession } from './session.tsx';

export function ScenarioSwitch() {
  const { scenario, selectScenario } = useSession();
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group?.contains(document.activeElement)) return;
    group.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [scenario]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = scenarios.findIndex((item) => item.id === scenario);
    const last = scenarios.length - 1;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const next = forward ? (index === last ? 0 : index + 1) : index === 0 ? last : index - 1;
    selectScenario(scenarios[next].id);
  };

  return (
    <div
      ref={groupRef}
      className="pills"
      role="radiogroup"
      aria-label="Pond condition"
      onKeyDown={onKeyDown}
    >
      {scenarios.map((item) => {
        const checked = item.id === scenario;
        return (
          <button
            key={item.id}
            type="button"
            className="pill"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => selectScenario(item.id)}
          >
            <span>{item.name}</span>
            <small>{item.detail}</small>
          </button>
        );
      })}
    </div>
  );
}

export function SensorNote() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="button button-quiet" onClick={() => dialogRef.current?.showModal()}>
        Open the sensor note
      </button>
      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="sensor-note-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <h2 id="sensor-note-title">How the sensors are read</h2>
        <p>The readings stay on this Mac. The page does not open a serial port or a remote address.</p>
        <ul>
          <li>Contactless level is an ultrasonic distance. You enter the basin depth, and height is what remains.</li>
          <li>pH before calibration is only a guide.</li>
          <li>A rain board usually reports wet or dry. Limen shows that intensity in millimetres per hour.</li>
          <li>Soil percent needs a calibration for the board in that ground.</li>
        </ul>
        <form method="dialog">
          <button type="submit" className="button">
            Close
          </button>
        </form>
      </dialog>
    </>
  );
}
