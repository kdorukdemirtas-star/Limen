/** Pond score used by the box. Not a laboratory index. */

export type ScenarioId = 'calm' | 'runoff' | 'bloom' | 'acid';

export type DriverId = 'runoff' | 'bloom' | 'acid' | 'inflow';

export interface Breakdown {
  runoff: number;
  bloom: number;
  acid: number;
  inflow: number;
}

export interface Sample {
  t: number;
  waterCm: number;
  ph: number;
  rainMmH: number;
  soilPct: number;
  levelDeltaCm: number;
  risk: number;
  breakdown: Breakdown;
}

export interface Scenario {
  id: ScenarioId;
  name: string;
  detail: string;
}

export const scenarios: readonly Scenario[] = [
  {
    id: 'calm',
    name: 'Calm pond',
    detail: 'Light rain, steady pH, still water.',
  },
  {
    id: 'runoff',
    name: 'After rain',
    detail: 'Saturated soil and heavy rain carry nutrients.',
  },
  {
    id: 'bloom',
    name: 'Bloom onset',
    detail: 'Still water and a rising pH.',
  },
  {
    id: 'acid',
    name: 'Acid inflow',
    detail: 'pH falls and the water is stressed.',
  },
];

const WEIGHT = {
  runoff: 0.78,
  bloom: 0.92,
  acid: 0.86,
  inflow: 0.28,
} as const;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function assess(input: {
  ph: number;
  rainMmH: number;
  soilPct: number;
  levelDeltaCm: number;
}): { risk: number; breakdown: Breakdown } {
  const rainN = clamp(input.rainMmH / 16);
  const wet = clamp((input.soilPct - 20) / 55);
  const runoff = rainN * (0.35 + 0.65 * wet);
  const bloom = clamp((input.ph - 8.05) / 1.2);
  const still = input.rainMmH < 0.8 ? 1 : 0.2;
  const bloomTerm = bloom * (0.55 + 0.45 * still);
  const acid = clamp((6.35 - input.ph) / 0.95);
  const inflow = clamp(Math.max(0, input.levelDeltaCm) / 0.45) * Math.max(rainN, bloom > 0.2 ? 0 : 0);

  const parts = {
    runoff: 100 * WEIGHT.runoff * runoff,
    bloom: 100 * WEIGHT.bloom * bloomTerm,
    acid: 100 * WEIGHT.acid * acid,
    inflow: 100 * WEIGHT.inflow * inflow,
  };
  const raw = parts.runoff + parts.bloom + parts.acid + parts.inflow;
  const risk = Math.min(100, raw);
  const scale = raw > 0 ? risk / raw : 0;

  return {
    risk,
    breakdown: {
      runoff: parts.runoff * scale,
      bloom: parts.bloom * scale,
      acid: parts.acid * scale,
      inflow: parts.inflow * scale,
    },
  };
}

interface Targets {
  waterCm: number;
  ph: number;
  rainMmH: number;
  soilPct: number;
}

function targetsFor(scenario: ScenarioId, t: number): Targets {
  const wave = Math.sin(t / 11);
  const slow = Math.sin(t / 23);
  if (scenario === 'calm') {
    return {
      waterCm: 46 + Math.sin(t / 18) * 1.6,
      ph: 7.4 + Math.sin(t / 15) * 0.16,
      rainMmH: Math.max(0, 1.5 + wave * 1.6),
      soilPct: 48 + slow * 14,
    };
  }
  if (scenario === 'runoff') {
    const burst = 0.5 + 0.5 * Math.sin(t / 8);
    return {
      waterCm: 64 + burst * 6,
      ph: 7.05 - burst * 0.18,
      rainMmH: 8 + burst * 10,
      soilPct: 72 + burst * 14,
    };
  }
  if (scenario === 'bloom') {
    return {
      waterCm: 61 + slow * 0.8,
      ph: 9.36 + wave * 0.14,
      rainMmH: 0,
      soilPct: 49 + slow * 3,
    };
  }
  return {
    waterCm: 43 + wave * 1.2,
    ph: 5.65 + Math.sin(t / 13) * 0.18,
    rainMmH: 1.4 + Math.max(0, wave) * 1.6,
    soilPct: 66 + slow * 4,
  };
}

export function nextSample(prev: Sample | null, scenario: ScenarioId, t: number): Sample {
  const target = targetsFor(scenario, t);
  const waterCm = prev ? prev.waterCm + (target.waterCm - prev.waterCm) * 0.28 : target.waterCm;
  const ph = prev ? prev.ph + (target.ph - prev.ph) * 0.35 : target.ph;
  const rainMmH = prev ? prev.rainMmH + (target.rainMmH - prev.rainMmH) * 0.4 : target.rainMmH;
  const soilPct = prev ? prev.soilPct + (target.soilPct - prev.soilPct) * 0.3 : target.soilPct;
  const levelDeltaCm = prev ? waterCm - prev.waterCm : 0;
  const { risk, breakdown } = assess({ ph, rainMmH, soilPct, levelDeltaCm });
  return { t, waterCm, ph, rainMmH, soilPct, levelDeltaCm, risk, breakdown };
}

export function seedHistory(scenario: ScenarioId, count = 48): Sample[] {
  const history: Sample[] = [];
  for (let index = 0; index < count; index += 1) {
    const prev = history.length > 0 ? history[history.length - 1] : null;
    history.push(nextSample(prev, scenario, index * 2.5));
  }
  return history;
}

export interface Band {
  id: 'calm' | 'watch' | 'nutrient' | 'bloom' | 'acid';
  label: string;
  hint: string;
}

export function bandFor(sample: Sample): Band {
  const { breakdown, risk } = sample;
  const calm: Band = {
    id: 'calm',
    label: 'Calm',
    hint: 'The four readings sit in balance. The score stays low.',
  };
  const watch: Band = {
    id: 'watch',
    label: 'Watch',
    hint: 'A small shift. The next reading will show whether rain or pH is moving.',
  };
  const nutrient: Band = {
    id: 'nutrient',
    label: 'Nutrient load',
    hint: 'Rain on saturated soil may be carrying nutrients into the water.',
  };
  const bloom: Band = {
    id: 'bloom',
    label: 'Bloom risk',
    hint: 'The water is still and the pH is high. Algae photosynthesis makes this pattern.',
  };
  const acid: Band = {
    id: 'acid',
    label: 'Acid stress',
    hint: 'The pH is low. This warning is an acid inflow, not algae.',
  };

  if (breakdown.acid >= breakdown.bloom && breakdown.acid >= breakdown.runoff && breakdown.acid >= 28) {
    return acid;
  }
  if (breakdown.bloom >= breakdown.runoff && breakdown.bloom >= breakdown.acid && breakdown.bloom >= 50) {
    return bloom;
  }
  if (risk < 30) return calm;
  if (risk < 55) return watch;
  return nutrient;
}

export function describeShift(prev: Sample | null, next: Sample): string | null {
  if (!prev) return null;
  const before = bandFor(prev);
  const after = bandFor(next);
  if (before.id !== after.id) {
    return `State changed: ${after.label}. ${after.hint}`;
  }
  if (prev.rainMmH < 8 && next.rainMmH >= 8) {
    return `Rain ${formatNumber(next.rainMmH)} mm/h. On saturated soil this is nutrient flow.`;
  }
  if (prev.ph < 8.6 && next.ph >= 8.6) {
    return `pH ${formatNumber(next.ph, 2)}. In still water this rise points to photosynthesis.`;
  }
  if (prev.ph > 6.2 && next.ph <= 6.2) {
    return `pH ${formatNumber(next.ph, 2)}. Acid is entering.`;
  }
  return null;
}

export function phWord(ph: number): string {
  if (ph < 6.5) return 'acidic';
  if (ph <= 8.2) return 'balanced';
  if (ph <= 8.8) return 'alkaline';
  return 'very alkaline';
}

export function rainWord(mm: number): string {
  if (mm < 0.3) return 'dry';
  if (mm < 2) return 'drizzle';
  if (mm < 8) return 'rain';
  return 'downpour';
}

export function soilWord(pct: number): string {
  if (pct < 30) return 'dry';
  if (pct < 60) return 'moist';
  if (pct < 80) return 'wet';
  return 'saturated';
}

export function ultrasonicDistance(
  waterCm: number,
  basinCm: number,
): { distanceCm: number; overflow: boolean } {
  const gap = basinCm - waterCm;
  return { distanceCm: Math.max(0, gap), overflow: gap < 0 };
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function meanOf(samples: readonly Sample[], pick: (sample: Sample) => number): number {
  if (samples.length === 0) return 0;
  const total = samples.reduce((sum, sample) => sum + pick(sample), 0);
  return total / samples.length;
}
