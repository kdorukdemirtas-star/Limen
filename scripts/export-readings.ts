import { mkdirSync, writeFileSync } from 'node:fs';
import { seedHistory } from '../src/simulation.ts';
import type { ScenarioId } from '../src/simulation.ts';

const scenarios: ScenarioId[] = ['calm', 'runoff', 'bloom', 'acid'];
const rows = scenarios.flatMap((id) =>
  seedHistory(id, 120).map((sample) => ({
    scenario: id,
    ph: sample.ph,
    rainMmH: sample.rainMmH,
    soilPct: sample.soilPct,
    waterCm: sample.waterCm,
    levelDeltaCm: sample.levelDeltaCm,
    score: sample.risk,
  })),
);

const dir = new URL('../server/data/', import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL('readings.json', dir), `${JSON.stringify(rows)}\n`);
console.log(`wrote ${rows.length} readings`);
