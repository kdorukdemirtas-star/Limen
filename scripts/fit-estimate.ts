import { mkdirSync, writeFileSync } from 'node:fs';
import { marksOf } from '../src/estimate.ts';
import { seedHistory } from '../src/simulation.ts';
import type { Sample, ScenarioId } from '../src/simulation.ts';

const scenarios: ScenarioId[] = ['calm', 'runoff', 'bloom', 'acid'];

function row(sample: Sample): number[] {
  const marks = marksOf(sample);
  return [1, marks.alkaline, marks.acidic, marks.rainOnSoil, marks.riseCm];
}

function solve(matrix: number[][], target: number[]): number[] {
  const n = target.length;
  const a = matrix.map((line, index) => [...line, target[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let rowIndex = col + 1; rowIndex < n; rowIndex += 1) {
      if (Math.abs(a[rowIndex][col]) > Math.abs(a[pivot][col])) pivot = rowIndex;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const scale = a[col][col];
    if (Math.abs(scale) < 1e-10) throw new Error('The fit is singular.');
    for (let column = col; column <= n; column += 1) a[col][column] /= scale;
    for (let rowIndex = 0; rowIndex < n; rowIndex += 1) {
      if (rowIndex === col) continue;
      const factor = a[rowIndex][col];
      for (let column = col; column <= n; column += 1) a[rowIndex][column] -= factor * a[col][column];
    }
  }
  return a.map((line) => line[n]);
}

const samples = scenarios.flatMap((id) => seedHistory(id, 64));
const width = 5;
const normal = Array.from({ length: width }, () => Array(width).fill(0));
const rhs = Array(width).fill(0);
for (const sample of samples) {
  const features = row(sample);
  for (let i = 0; i < width; i += 1) {
    rhs[i] += features[i] * sample.risk;
    for (let j = 0; j < width; j += 1) normal[i][j] += features[i] * features[j];
  }
}
const beta = solve(normal, rhs);
let absolute = 0;
for (const sample of samples) {
  const features = row(sample);
  const predicted = features.reduce((sum, value, index) => sum + value * beta[index], 0);
  absolute += Math.abs(predicted - sample.risk);
}

const fitted = {
  intercept: beta[0],
  alkaline: beta[1],
  acidic: beta[2],
  rainOnSoil: beta[3],
  riseCm: beta[4],
  meanAbsoluteError: absolute / samples.length,
  samples: samples.length,
};

mkdirSync(new URL('../src/model', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/model/estimate.json', import.meta.url), `${JSON.stringify(fitted, null, 2)}\n`);
console.log(fitted);
