// SLA Tracker — shows uptime/availability based on error rate
import { useTheme } from "../../context/ThemeContext";

export default function SLATracker({ overview }) {
  const { T } = useTheme();
  const errorRate = overview.errorRate || 0;
  const availability = parseFloat((100 - errorRate).toFixed(3));

  const SLA_TIERS = [
    { label: "99.9%", value: 99.9, downtime: "8.7h/yr", color: T.green },
    { label: "99.5%", value: 99.5, downtime: "43.8h/yr", color: T.orange },
    { label: "99.0%", value: 99.0, downtime: "87.6h/yr", color: T.red },
  ];

  const slaColor = availability >= 99.9 ? T.green : availability >= 99.5 ? T.orange : T.red;
  const slaLabel = availability >= 99.9 ? "SLA Met" : availability >= 99.5 ? "SLA At Risk" : "SLA Breached";

  // Monthly downtime minutes
  const downtimeMinutes = ((100 - availability) / 100) * 43200;

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: slaColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>SLA Tracker</span>
        </div>
        <span className={`gf-badge ${availability >= 99.9 ? "gf-badge-green" : availability >= 99.5 ? "gf-badge-yellow" : "gf-badge-red"}`} style={{ fontSize: 10 }}>{slaLabel}</span>
      </div>

      {/* Big availability number */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: slaColor, letterSpacing: "-0.02em" }}>{availability.toFixed(2)}</span>
        <span style={{ fontSize: 14, color: T.muted, fontWeight: 600 }}>% availability</span>
      </div>

      {/* SLA tier bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {SLA_TIERS.map(tier => {
          const met = availability >= tier.value;
          return (
            <div key={tier.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, color: met ? tier.color : T.dim, fontWeight: 700, width: 40 }}>{tier.label}</span>
              <div style={{ flex: 1, background: T.border, borderRadius: 2, height: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: met ? tier.color : T.border2, width: met ? "100%" : `${(availability / tier.value) * 100}%`, transition: "width 0.8s ease" }} />
              </div>
              <span style={{ fontSize: 10, color: met ? tier.color : T.dim, width: 60, textAlign: "right" }}>{met ? "✓ Met" : "✗ Missed"}</span>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        {[
          { label: "Error Rate", value: `${errorRate.toFixed(2)}%`, color: errorRate > 4 ? T.red : T.green },
          { label: "Downtime/mo", value: `${downtimeMinutes.toFixed(1)}m`, color: T.muted },
          { label: "Requests", value: (overview.totalRequests || 0).toLocaleString(), color: T.blue },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
