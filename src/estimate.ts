import estimate from './model/estimate.json' with { type: 'json' };
import type { Sample } from './simulation.ts';

export const learned = estimate;

export interface Marks {
  alkaline: number;
  acidic: number;
  rainOnSoil: number;
  riseCm: number;
}

export function marksOf(sample: Pick<Sample, 'ph' | 'rainMmH' | 'soilPct' | 'levelDeltaCm'>): Marks {
  const wet = Math.min(1, Math.max(0, (sample.soilPct - 20) / 55));
  return {
    alkaline: Math.max(0, sample.ph - 8.05),
    acidic: Math.max(0, 6.35 - sample.ph),
    rainOnSoil: sample.rainMmH * (0.35 + 0.65 * wet),
    riseCm: Math.max(0, sample.levelDeltaCm),
  };
}

export function learnedRisk(sample: Pick<Sample, 'ph' | 'rainMmH' | 'soilPct' | 'levelDeltaCm'>): number {
  const marks = marksOf(sample);
  const raw =
    estimate.intercept +
    estimate.alkaline * marks.alkaline +
    estimate.acidic * marks.acidic +
    estimate.rainOnSoil * marks.rainOnSoil +
    estimate.riseCm * marks.riseCm;
  return Math.min(100, Math.max(0, raw));
}
