import { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { API_BASE_URL } from "../../config/apiConfig";
import { useTheme } from "../../context/ThemeContext";

const CODE_COLORS = {
  "4": "#f5a623",  // 4xx client errors
  "5": "#f2495c",  // 5xx server errors
  "2": "#73bf69",  // 2xx success
  "3": "#5794f2",  // 3xx redirects
};

const getColor = (code) => CODE_COLORS[String(code)[0]] || "#8e8e8e";

export default function FailureCodeChart({ range }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/failure-codes?range=${range}`)
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : [];
        setData(raw.map(d => ({ code: String(d.statusCode || d.code || ""), count: d.count || d.failureCount || 0 }))
          .filter(d => d.code && d.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 12));
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [range]);

  const total = data.reduce((s, d) => s + d.count, 0);

  const chartTooltip = {
    contentStyle: {
      background: T.panel, border: `1px solid ${T.border2}`,
      borderRadius: 4, padding: "8px 12px", fontSize: 12,
    },
    labelStyle: { color: T.muted, fontSize: 11, marginBottom: 4 },
    itemStyle: { color: T.text },
  };

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, minHeight: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: T.red, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>HTTP Status Code Distribution</span>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
          {[["2xx","#73bf69"],["3xx","#5794f2"],["4xx","#f5a623"],["5xx","#f2495c"]].map(([l,c]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 3, color: T.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
            </span>
          ))}
          {error && <span style={{ color: T.red }}>⚠ Error</span>}
        </div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        {loading ? (
          <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="gf-skeleton" style={{ width: "100%", height: 120 }} />
          </div>
        ) : data.length === 0 ? (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, fontSize: 12 }}>No data available</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="code" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={chartTooltip.contentStyle}
                  labelStyle={chartTooltip.labelStyle}
                  formatter={(v, _, props) => [`${v.toLocaleString()} (${((v/total)*100).toFixed(1)}%)`, `HTTP ${props.payload.code}`]}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {data.map((entry, i) => <Cell key={i} fill={getColor(entry.code)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Summary row */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {data.slice(0, 6).map(({ code, count }) => (
                <div key={code} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: getColor(code) }}>{code}</span>
                  <span style={{ color: T.muted }}>{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
