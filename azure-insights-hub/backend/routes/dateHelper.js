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
  // Normalise shorthand: 7d → 7d, 30d → 30d (KQL supports ago(30d) natively)
  return `timestamp > ago(${range || "24h"})`;
}

/**
 * Returns a bin size for charts based on time range.
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

// ── UTC timezone helpers ──────────────────────────────────────────────────────
/**
 * Format a UTC timestamp as HH:mm
 */
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Format a UTC timestamp as "DD MMM HH:mm"
 */
function fmtDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }) + " " + fmtTime(ts);
}

module.exports = { buildTimeFilter, getBinSize, fmtTime, fmtDateTime };
