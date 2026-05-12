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

// ── SAST timezone helpers (Africa/Johannesburg = UTC+2) ──────────────────────
const SAST_TZ = "Africa/Johannesburg";

/**
 * Format a UTC timestamp as HH:mm in SAST (South Africa Standard Time, UTC+2).
 * Use this for all chart time labels so they match the server/data timezone.
 */
function fmtSASTTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SAST_TZ,
  });
}

/**
 * Format a UTC timestamp as HH:mm:ss in SAST.
 */
function fmtSASTTimeSec(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: SAST_TZ,
  });
}

/**
 * Format a UTC timestamp as "DD MMM" date in SAST.
 */
function fmtSASTDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: SAST_TZ,
  });
}

/**
 * Format a UTC timestamp as "DD MMM HH:mm" in SAST (for multi-day ranges).
 */
function fmtSASTDateTime(ts) {
  return fmtSASTDate(ts) + " " + fmtSASTTime(ts);
}

module.exports = { buildTimeFilter, getBinSize, fmtSASTTime, fmtSASTTimeSec, fmtSASTDate, fmtSASTDateTime, SAST_TZ };
