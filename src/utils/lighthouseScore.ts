/**
 * Google Lighthouse performance scoring model
 *
 * 1. Per-metric scores use Lighthouse's log-normal scoring curve
 *    (lighthouse/core/lib/statistics.js#getLogNormalScore):
 *    a score of 50 maps to the median control point, a score of 90 maps to p10.
 * 2. The overall score uses the official Lighthouse v10 weights:
 *    LCP 25%, TBT 30%, CLS 25%, FCP 10%, Speed Index 10%.
 *    This tool does not collect Speed Index, so weights are re-normalized
 *    across the metrics that are actually collected.
 */

export type ScoreMetricKey = 'fcp' | 'lcp' | 'tbt' | 'cls';

export interface ScoreCurve {
  /** Threshold that maps to a score of 90 */
  p10: number;
  /** Threshold that maps to a score of 50 */
  median: number;
}

// Lighthouse v10 default (mobile) control points, aligned with the Core Web Vitals good/poor thresholds
export const LIGHTHOUSE_CURVES: Record<ScoreMetricKey, ScoreCurve> = {
  fcp: { p10: 1800, median: 3000 },
  lcp: { p10: 2500, median: 4000 },
  tbt: { p10: 200, median: 600 },
  cls: { p10: 0.1, median: 0.25 },
};

export const LIGHTHOUSE_WEIGHTS: Record<ScoreMetricKey, number> = {
  fcp: 0.1,
  lcp: 0.25,
  tbt: 0.3,
  cls: 0.25,
};

const INVERSE_ERFC_ONE_FIFTH = 0.9061938024368232;

// Abramowitz & Stegun 7.1.26 approximation, max absolute error 1.5e-7
const erf = (x: number): number => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
};

/**
 * Convert a single metric value into a 0-100 score using the log-normal curve.
 * Returns null when the metric was not measured, so an unknown value is never scored as perfect.
 * A value of exactly 0 is a measured value (no blocking time, no layout shift) and does score 100.
 */
export function metricScore(value: number | null | undefined, curve: ScoreCurve): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return 100;
  const location = Math.log(curve.median);
  const shape = Math.abs(Math.log(curve.p10) - location) / (Math.SQRT2 * INVERSE_ERFC_ONE_FIFTH);
  const standardized = (Math.log(value) - location) / (Math.SQRT2 * shape);
  const score = ((1 - erf(standardized)) / 2) * 100;
  return Math.min(100, Math.max(0, score));
}

export interface PerformanceScoreResult {
  /** Overall 0-100 performance score */
  score: number;
  /** Individual 0-100 score per measured metric */
  metricScores: Partial<Record<ScoreMetricKey, number>>;
}

/** Compute the overall performance score with the Lighthouse model */
export function performanceScore(metrics: Partial<Record<ScoreMetricKey, number>>): PerformanceScoreResult {
  const keys = Object.keys(LIGHTHOUSE_WEIGHTS) as ScoreMetricKey[];
  const metricScores: Partial<Record<ScoreMetricKey, number>> = {};
  let weighted = 0;
  let totalWeight = 0;

  for (const key of keys) {
    // Metrics that could not be measured drop out of the weighting instead of counting as a pass
    const score = metricScore(metrics[key], LIGHTHOUSE_CURVES[key]);
    if (score === null) continue;
    metricScores[key] = Math.round(score);
    weighted += score * LIGHTHOUSE_WEIGHTS[key];
    totalWeight += LIGHTHOUSE_WEIGHTS[key];
  }

  if (totalWeight === 0) return { score: 0, metricScores };
  return { score: Math.round(weighted / totalWeight), metricScores };
}
