/**
 * ML Anomaly Engine v4 — Multi-Signal Detection
 *
 * Three detection layers:
 *  1. SYSTEM level  — total requests, total avg RT, total error rate
 *  2. API level     — per-API traffic drop, error rate spike, RT spike
 *  3. STATUS CODE   — 5xx surge, 4xx surge, new error codes appearing
 *
 * Algorithms used:
 *  - Z-score with adaptive floor (prevents inflation on stable metrics)
 *  - IQR outlier detection (secondary confirmation)
 *  - Linear regression trend (slope over 24h hourly buckets)
 *  - Relative multiplier (current / trained baseline — catches fast APIs)
 *  - Traffic silence detection (API receiving 0 requests vs historical avg)
 *  - Exponential Weighted Moving Average (EWMA) for smoothing
 *  - Composite confidence score (data quality × signal strength)
 */

const { queryAppInsights } = require("./appInsightsService");

// ─── Statistical helpers ──────────────────────────────────────────────────────

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function mean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
}

function percentile(arr, p) {
  if (!arr || !arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

/**
 * Z-score with minimum std floor.
 * floor prevents inflation: e.g. a 0.1% change on a 0% baseline won't be 10σ
 */
function zScore(value, histMean, histStd, floor = 0) {
  const std = Math.max(histStd, floor);
  if (std === 0) return 0;
  return (value - histMean) / std;
}

/**
 * Linear regression slope over an array.
 * Positive = increasing trend, negative = decreasing.
 */
function linearSlope(arr) {
  if (!arr || arr.length < 3) return 0;
  const n = arr.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(arr);
  let num = 0, den = 0;
  arr.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += Math.pow(x - xMean, 2);
  });
  return den === 0 ? 0 : num / den;
}

/**
 * EWMA — exponential weighted moving average.
 * alpha=0.3 gives more weight to recent values.
 */
function ewma(arr, alpha = 0.3) {
  if (!arr || !arr.length) return 0;
  let result = arr[0];
  for (let i = 1; i < arr.length; i++) {
    result = alpha * arr[i] + (1 - alpha) * result;
  }
  return result;
}

/**
 * IQR outlier: value > Q3 + 1.5*IQR
 */
function isIQROutlier(value, arr) {
  if (!arr || arr.length < 4) return false;
  const q1 = percentile(arr, 25);
  const q3 = percentile(arr, 75);
  const iqr = q3 - q1;
  if (iqr < 0.01) return false; // too stable to have outliers
  return value > q3 + 1.5 * iqr;
}

/**
 * Composite confidence score (0–100).
 * Based on: data quality (days of history) + signal strength (Z-score magnitude).
 */
function confidence(histDays, maxZ) {
  const dataQuality = Math.min(1, histDays / 60);       // 60 days = full quality
  const signal      = Math.min(1, Math.abs(maxZ) / 5);  // 5σ = max signal
  return Math.round(40 + dataQuality * 35 + signal * 25);
}

module.exports = {
  safeNum, mean, stdDev, percentile, zScore, linearSlope, ewma, isIQROutlier, confidence,
};
