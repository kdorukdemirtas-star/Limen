import { mkdirSync, writeFileSync } from 'node:fs';
import { bandFor, seedHistory } from '../src/simulation.ts';
import type { Sample, ScenarioId } from '../src/simulation.ts';

/** Each generated step stands for ten minutes of pond time. */
const STEP_MINUTES = 10;

const scenarios: ScenarioId[] = ['calm', 'runoff', 'bloom', 'acid'];
const series = Object.fromEntries(scenarios.map((id) => [id, seedHistory(id, 120)])) as Record<
  ScenarioId,
  Sample[]
>;
const all = scenarios.flatMap((id) => series[id]);

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function expect(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function range(values: number[]): { min: number; max: number; mean: number } {
  return { min: Math.min(...values), max: Math.max(...values), mean: mean(values) };
}

function hourly(step: number): number {
  return (Math.abs(step) / STEP_MINUTES) * 60;
}

for (const sample of all) {
  if (sample.ph < 0 || sample.ph > 14 || sample.rainMmH < 0 || sample.soilPct < 0 || sample.soilPct > 100) {
    expect('physical bounds', false, `out of range at t=${sample.t}`);
    break;
  }
}
if (!checks.some((item) => item.name === 'physical bounds')) {
  expect('physical bounds', true, 'pH stays inside 0–14, rain is never negative, soil stays inside 0–100%.');
}

const ph = range(all.map((sample) => sample.ph));
const rain = range(all.map((sample) => sample.rainMmH));
const soil = range(all.map((sample) => sample.soilPct));
const water = range(all.map((sample) => sample.waterCm));
expect('pond pH band', ph.min >= 5.2 && ph.max <= 10, `pH ${ph.min.toFixed(2)}–${ph.max.toFixed(2)}. Fresh blooms can reach about 9–10; acid inflow can fall near 5.5.`);
expect('rain band', rain.min >= 0 && rain.max <= 30, `rain ${rain.min.toFixed(1)}–${rain.max.toFixed(1)} mm/h. Heavy rain is about 8–20 mm/h.`);
expect('soil band', soil.min >= 15 && soil.max <= 95, `soil ${soil.min.toFixed(0)}–${soil.max.toFixed(0)}% on a 0–100 sensor.`);
expect('water band', water.min >= 20 && water.max <= 100, `water height ${water.min.toFixed(1)}–${water.max.toFixed(1)} cm.`);

let fastestLevel = 0;
let fastestPh = 0;
for (const id of scenarios) {
  const rows = series[id];
  for (let index = 1; index < rows.length; index += 1) {
    fastestLevel = Math.max(fastestLevel, hourly(rows[index].levelDeltaCm));
    fastestPh = Math.max(fastestPh, hourly(rows[index].ph - rows[index - 1].ph));
  }
}
expect(
  'level rate',
  fastestLevel <= 8,
  `fastest water rise is ${fastestLevel.toFixed(2)} cm/hour if each step is ${STEP_MINUTES} minutes. A small basin in heavy rain can rise a few centimetres an hour.`,
);
expect(
  'pH rate',
  fastestPh <= 0.4,
  `fastest pH change is ${fastestPh.toFixed(2)} units/hour. A sunny bloom afternoon often moves about 0.1–0.3 units/hour.`,
);

const calmPh = mean(series.calm.map((sample) => sample.ph));
const bloomPh = mean(series.bloom.map((sample) => sample.ph));
const acidPh = mean(series.acid.map((sample) => sample.ph));
const runoffRain = mean(series.runoff.map((sample) => sample.rainMmH));
const runoffSoil = mean(series.runoff.map((sample) => sample.soilPct));
const bloomRain = mean(series.bloom.map((sample) => sample.rainMmH));
expect('calm water', calmPh >= 6.8 && calmPh <= 8.2, `calm mean pH ${calmPh.toFixed(2)}.`);
expect('bloom water', bloomPh >= 8.8 && bloomPh <= 10 && bloomRain < 0.3, `bloom mean pH ${bloomPh.toFixed(2)}, rain ${bloomRain.toFixed(2)} mm/h.`);
expect('acid water', acidPh >= 5.2 && acidPh <= 6.3, `acid mean pH ${acidPh.toFixed(2)}.`);
expect('runoff water', runoffRain >= 8 && runoffRain <= 25 && runoffSoil >= 65, `runoff rain ${runoffRain.toFixed(1)} mm/h, soil ${runoffSoil.toFixed(0)}%.`);

const calmScore = mean(series.calm.map((sample) => sample.risk));
const bloomScore = mean(series.bloom.map((sample) => sample.risk));
const runoffScore = mean(series.runoff.map((sample) => sample.risk));
expect('scores separate', bloomScore > calmScore + 40 && runoffScore > calmScore + 30, `calm ${calmScore.toFixed(0)}, runoff ${runoffScore.toFixed(0)}, bloom ${bloomScore.toFixed(0)}.`);

const clipped = all.filter((sample) => sample.risk >= 99.5).length / all.length;
expect('score not stuck at the ceiling', clipped < 0.08, `${(clipped * 100).toFixed(1)}% of readings sit on 100.`);

const bloomBand = series.bloom.filter((sample) => bandFor(sample).id === 'bloom').length / series.bloom.length;
const acidBand = series.acid.filter((sample) => bandFor(sample).id === 'acid').length / series.acid.length;
expect('labels match the water', bloomBand > 0.9 && acidBand > 0.9, `bloom label ${(bloomBand * 100).toFixed(0)}%, acid label ${(acidBand * 100).toFixed(0)}%.`);

const failed = checks.filter((item) => !item.pass);
const report = {
  stepMinutes: STEP_MINUTES,
  samples: all.length,
  ranges: { ph, rain, soil, water },
  fastest: { levelCmPerHour: fastestLevel, phPerHour: fastestPh },
  checks,
};

mkdirSync(new URL('../server/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../server/data/realism.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

for (const item of checks) {
  console.log(`${item.pass ? 'pass' : 'fail'}  ${item.name}: ${item.detail}`);
}
if (failed.length > 0) process.exit(1);
console.log('realism ok');
