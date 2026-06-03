/**
 * Shared helper: builds a KQL time filter from request query params.
 * Supports:
 *   - ?range=1h  (relative, uses ago())
 *   - ?startDate=2026-03-17T00:00:00Z&endDate=2026-03-17T23:59:59Z  (absolute)
 */
function buildTimeFilter(req) {
  const { range, startDate, endDate } = req.query;
  if (startDate && endDate) {
    return `timestamp between (datetime("${startDate}") .. datetime("${endDate}"))`;
  }
  return `timestamp > ago(${range || "24h"})`;
}

/**
 * Returns a 5-minute bin size for charts.
 * For longer ranges use larger bins to avoid too many data points.
 */
function getBinSize(req) {
  const { range, startDate, endDate } = req.query;
  if (startDate && endDate) {
    const diffMs = new Date(endDate) - new Date(startDate);
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours > 48) return "1h";
    if (diffHours > 12) return "15m";
    return "5m";
  }
  const r = range || "24h";
  if (r.endsWith("d") && parseInt(r) > 2) return "1h";
  if (r === "24h" || r === "12h") return "15m";
  return "5m";
}

// ── Timezone helpers — configurable via DISPLAY_TIMEZONE env var ──────────────
// Set DISPLAY_TIMEZONE in .env or Docker env vars to match your local timezone.
// Examples:
//   DISPLAY_TIMEZONE=Asia/Kolkata          (IST, UTC+5:30)
//   DISPLAY_TIMEZONE=Africa/Johannesburg   (SAST, UTC+2)
//   DISPLAY_TIMEZONE=America/New_York      (EST, UTC-5)
//   DISPLAY_TIMEZONE=Europe/London         (GMT/BST)
//   DISPLAY_TIMEZONE=UTC                   (UTC)
//
// Default: UTC (safe for all regions — matches Azure App Insights storage)
const DISPLAY_TZ = process.env.DISPLAY_TIMEZONE || "UTC";

// Keep SAST_TZ as alias for backward compatibility
const SAST_TZ = DISPLAY_TZ;

/**
 * Format a UTC timestamp as HH:mm in the configured display timezone.
 */
function fmtSASTTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

/**
 * Format a UTC timestamp as HH:mm:ss in the configured display timezone.
 */
function fmtSASTTimeSec(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: DISPLAY_TZ,
  });
}

/**
 * Format a UTC timestamp as "DD MMM" date in the configured display timezone.
 */
function fmtSASTDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: DISPLAY_TZ,
  });
}

/**
 * Format a UTC timestamp as "DD MMM HH:mm" in the configured display timezone.
 */
function fmtSASTDateTime(ts) {
  return fmtSASTDate(ts) + " " + fmtSASTTime(ts);
}

module.exports = { buildTimeFilter, getBinSize, fmtSASTTime, fmtSASTTimeSec, fmtSASTDate, fmtSASTDateTime, SAST_TZ, DISPLAY_TZ };
