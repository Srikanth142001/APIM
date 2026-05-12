// Overall system health score panel
import { useTheme } from "../../context/ThemeContext";

export default function HealthScore({ overview, activeConnections, mysqlApiError, nodeCount, readyNodes }) {
  const { T } = useTheme();
  const scores = [];

  // API Health (40%)
  const errRate = overview.errorRate || 0;
  const apiScore = errRate > 10 ? 20 : errRate > 4 ? 60 : errRate > 1 ? 80 : 100;
  scores.push({ label: "API Health", score: apiScore, weight: 0.4 });

  // Response Time (25%)
  const rt = overview.avgResponseTime || 0;
  const rtScore = rt > 500 ? 20 : rt > 400 ? 55 : rt > 300 ? 75 : rt > 200 ? 90 : 100;
  scores.push({ label: "Response Time", score: rtScore, weight: 0.25 });

  // MySQL (20%)
  const mysqlScore = mysqlApiError ? 40 : activeConnections > 5000 ? 20 : activeConnections > 4000 ? 60 : 100;
  scores.push({ label: "MySQL", score: mysqlScore, weight: 0.2 });

  // Infrastructure (15%)
  const infraScore = nodeCount === 0 ? 50 : readyNodes / nodeCount >= 0.9 ? 100 : readyNodes / nodeCount >= 0.7 ? 60 : 30;
  scores.push({ label: "Infrastructure", score: infraScore, weight: 0.15 });

  const total = Math.round(scores.reduce((acc, s) => acc + s.score * s.weight, 0));
  const color = total >= 90 ? T.green : total >= 70 ? T.orange : T.red;
  const label = total >= 90 ? "Healthy" : total >= 70 ? "Degraded" : "Critical";

  // SVG circle
  const r = 36, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const dash = (total / 100) * circ;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: "12px 14px", display: "flex", gap: 16, alignItems: "center" }}>
      {/* Donut */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={88} height={88}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={8} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 9, color: T.muted, fontWeight: 600, letterSpacing: "0.05em" }}>SCORE</span>
        </div>
      </div>

      {/* Details */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>System Health</span>
          <span className={`gf-badge ${total >= 90 ? "gf-badge-green" : total >= 70 ? "gf-badge-yellow" : "gf-badge-red"}`} style={{ fontSize: 10 }}>{label}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {scores.map(({ label: lbl, score }) => {
            const c = score >= 90 ? T.green : score >= 70 ? T.orange : T.red;
            return (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: T.muted, width: 90, flexShrink: 0 }}>{lbl}</span>
                <div style={{ flex: 1, background: T.border, borderRadius: 2, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: c, width: `${score}%`, transition: "width 0.8s ease" }} />
                </div>
                <span style={{ fontSize: 10, color: c, fontWeight: 600, width: 28, textAlign: "right" }}>{score}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
