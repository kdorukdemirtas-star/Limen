import { bandFor, meanOf, seedHistory, ultrasonicDistance } from '../src/simulation.ts';

const calm = seedHistory('calm');
const runoff = seedHistory('runoff');
const bloom = seedHistory('bloom');
const acid = seedHistory('acid');

const calmRisk = meanOf(calm, (sample) => sample.risk);
const runoffRisk = meanOf(runoff, (sample) => sample.risk);
const bloomRisk = meanOf(bloom, (sample) => sample.risk);
const acidPh = meanOf(acid, (sample) => sample.ph);
const runoffRain = meanOf(runoff, (sample) => sample.rainMmH);
const bloomPh = meanOf(bloom, (sample) => sample.ph);
const acidBand = bandFor(acid[acid.length - 1]).id;
const bloomBand = bandFor(bloom[bloom.length - 1]).id;
const calmBand = bandFor(calm[calm.length - 1]).id;

const report = {
  calmRisk: calmRisk.toFixed(1),
  calmBand,
  runoffRisk: runoffRisk.toFixed(1),
  runoffRain: runoffRain.toFixed(1),
  bloomRisk: bloomRisk.toFixed(1),
  bloomPh: bloomPh.toFixed(2),
  bloomBand,
  acidPh: acidPh.toFixed(2),
  acidBand,
};

console.log(report);

const failures: string[] = [];
if (calmRisk > 28) failures.push(`calm risk too high: ${calmRisk}`);
if (calmBand !== 'calm') failures.push(`calm band is ${calmBand}`);
if (runoffRisk < calmRisk + 25) failures.push('runoff should clearly exceed calm');
if (runoffRain < 6) failures.push('runoff should be rainy');
if (bloomRisk < 70) failures.push(`bloom risk too low: ${bloomRisk}`);
if (bloomPh < 8.8) failures.push('bloom pH should be alkaline');
if (bloomBand !== 'bloom') failures.push(`bloom band is ${bloomBand}`);
if (bandFor(runoff[runoff.length - 1]).id !== 'nutrient') {
  failures.push(`runoff band is ${bandFor(runoff[runoff.length - 1]).id}`);
}
if (acidPh > 6.2) failures.push('acid scenario should be acidic');
if (acidBand !== 'acid') failures.push(`acid band is ${acidBand}`);

for (const set of [calm, runoff, bloom, acid]) {
  for (const sample of set) {
    if (sample.risk < 0 || sample.risk > 100) failures.push('risk out of range');
    if (sample.ph < 0 || sample.ph > 14) failures.push('pH out of range');
    const parts = sample.breakdown.runoff + sample.breakdown.bloom + sample.breakdown.acid + sample.breakdown.inflow;
    if (Math.abs(parts - sample.risk) > 0.2) failures.push('breakdown does not sum to risk');
  }
}

const fit = ultrasonicDistance(50, 80);
const overflow = ultrasonicDistance(70, 40);
if (fit.distanceCm !== 30 || fit.overflow) failures.push('distance math failed');
if (overflow.distanceCm !== 0 || !overflow.overflow) failures.push('overflow math failed');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('readings ok');
