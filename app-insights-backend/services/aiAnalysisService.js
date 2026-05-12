/**
 * AI Analysis Service
 * Uses Azure OpenAI (GPT-4) to generate human-readable root cause analysis
 * for ML-detected anomalies.
 *
 * Only called when severity = "critical" or "warning" to control costs.
 * Falls back gracefully if AI is unavailable.
 *
 * Configure in .env:
 *   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
 *   AZURE_OPENAI_KEY=your-api-key
 *   AZURE_OPENAI_DEPLOYMENT=gpt-4  (or gpt-35-turbo for lower cost)
 *
 * OR use OpenAI directly:
 *   OPENAI_API_KEY=sk-...
 */

const axios = require("axios");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });

// ── Check if AI is configured ─────────────────────────────────────────────────
function isAIConfigured() {
  // AI is DISABLED by default for security.
  // Only enable if AZURE_OPENAI_ENDPOINT is set (keeps data within Azure tenant).
  // OpenAI public API is NOT recommended for enterprise use — data leaves your network.
  if (process.env.AI_DISABLED === "true") return false;

  // Prefer Azure OpenAI (data stays in your Azure tenant)
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) return true;

  // OpenAI public API — only if explicitly opted in
  if (process.env.OPENAI_API_KEY && process.env.ALLOW_OPENAI_PUBLIC === "true") return true;

  return false;
}

// ── Call the LLM ──────────────────────────────────────────────────────────────
async function callLLM(systemPrompt, userPrompt) {
  const maxTokens = 400;

  // Azure OpenAI
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY) {
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4";
    const url = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`;
    const response = await axios.post(url, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }, {
      headers: { "api-key": process.env.AZURE_OPENAI_KEY, "Content-Type": "application/json" },
      httpsAgent: agent,
      timeout: 15000,
    });
    return response.data.choices[0]?.message?.content?.trim();
  }

  // OpenAI fallback
  if (process.env.OPENAI_API_KEY) {
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }, {
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      timeout: 15000,
    });
    return response.data.choices[0]?.message?.content?.trim();
  }

  return null;
}

// ── Anonymize sensitive data before sending to AI ────────────────────────────
// Replaces internal API names with generic identifiers if ANONYMIZE_AI=true
function anonymizeForAI(alert) {
  if (process.env.ANONYMIZE_AI !== "true") return alert;
  return {
    ...alert,
    operation: `API_${Buffer.from(alert.operation || "").toString("base64").substring(0, 8)}`,
  };
}

// ── Generate root cause analysis for a single alert ───────────────────────────
async function generateRootCauseAnalysis(alert) {
  if (!isAIConfigured()) return null;
  const safeAlert = anonymizeForAI(alert);

  const systemPrompt = `You are an expert API monitoring engineer analyzing production incidents.
You receive structured alert data from an ML anomaly detection system and provide:
1. A concise root cause hypothesis (2-3 sentences)
2. The most likely technical cause
3. Immediate action steps (2-3 bullet points)

Be specific, technical, and actionable. Do not repeat the data back — interpret it.
Keep the total response under 200 words. Use plain text, no markdown headers.`;

  const userPrompt = `API Alert Analysis Request:

API: ${safeAlert.operation}
Severity: ${safeAlert.severity?.toUpperCase()}
Anomaly Type: ${safeAlert.anomalyType || "UNKNOWN"}

Current Metrics (last 30 min):
- Requests: ${alert.current?.total?.toLocaleString() || 0}
- Errors: ${alert.current?.errors?.toLocaleString() || 0}
- Error Rate: ${alert.current?.errorRate || 0}%
- Avg Response Time: ${alert.current?.avgRt || 0}ms
- p95 Response Time: ${alert.current?.p95Rt || 0}ms

80-Day Baseline:
- Avg Error Rate: ${alert.baseline?.avgErrorRate || 0}%
- Max Error Rate: ${alert.baseline?.maxErrorRate || 0}%
- Avg Response Time: ${alert.baseline?.avgRt || 0}ms
- Avg Daily Requests: ${alert.baseline?.avgDailyRequests?.toLocaleString() || 0}

ML Scores:
- Error Rate Z-score: ${alert.ml?.errorRateZScore || 0}σ (${Math.abs(alert.ml?.errorRateZScore || 0) > 3 ? "EXTREME" : "ELEVATED"})
- Latency Z-score: ${alert.ml?.rtZScore || 0}σ
- 24h Error Trend: ${alert.ml?.shortTermErrTrend > 0 ? "INCREASING" : "STABLE"} (slope: ${alert.ml?.shortTermErrTrend || 0})
- 80-day Drift: ${alert.ml?.longTermErrDrift || "0%"}
- Confidence: ${alert.ml?.confidence || "N/A"}

Detected Issues:
${(alert.issues || []).map(i => `- ${i.title}: ${i.detail}`).join("\n") || "None"}

Provide root cause analysis and recommended actions.`;

  try {
    const analysis = await callLLM(systemPrompt, userPrompt);
    return analysis;
  } catch (err) {
    console.error("[AI Analysis] Failed:", err.message);
    return null;
  }
}

// ── Generate incident summary for multiple correlated alerts ──────────────────
async function generateIncidentSummary(alerts) {
  if (!isAIConfigured() || !alerts?.length) return null;

  const systemPrompt = `You are an expert SRE (Site Reliability Engineer) writing an incident summary for a war room.
Write a concise, factual incident brief that:
1. States what is happening (1-2 sentences)
2. Identifies if alerts are correlated (same service/dependency)
3. Assesses customer impact
4. Suggests the most likely single root cause
5. Lists 3 immediate investigation steps

Keep it under 250 words. Be direct and technical. No markdown headers.`;

  const alertSummary = alerts.slice(0, 5).map(a => (
    `- ${a.operation}: ${a.current?.errorRate}% errors, ${a.current?.avgRt}ms RT (baseline: ${a.baseline?.avgErrorRate}% errors, ${a.baseline?.avgRt}ms RT) — Z=${a.ml?.errorRateZScore}σ err, Z=${a.ml?.rtZScore}σ RT`
  )).join("\n");

  const userPrompt = `Incident Summary Request — ${new Date().toLocaleString("en-GB")}

${alerts.length} API anomalies detected simultaneously:

${alertSummary}

${alerts.length > 5 ? `...and ${alerts.length - 5} more alerts` : ""}

All alerts are from service: ${[...new Set(alerts.map(a => a.operation.split(";")[0]))].join(", ")}

Write an incident summary for the on-call team.`;

  try {
    const summary = await callLLM(systemPrompt, userPrompt);
    return summary;
  } catch (err) {
    console.error("[AI Incident Summary] Failed:", err.message);
    return null;
  }
}

module.exports = { generateRootCauseAnalysis, generateIncidentSummary, isAIConfigured };
