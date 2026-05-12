import { useState, useMemo, forwardRef } from "react";
import { useTheme } from "../context/ThemeContext";

const parseSortableValue = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.trim().endsWith("%")) { const p = parseFloat(value); return isNaN(p) ? value : p; }
    if (value.trim().toLowerCase().endsWith("ms")) { const p = parseFloat(value); return isNaN(p) ? value : p; }
    const p = parseFloat(value);
    return isNaN(p) ? value.toLowerCase() : p;
  }
  return value;
};

const DashboardTable = forwardRef(({ title, columns, data = [] }, ref) => {
  const { T } = useTheme();
  const safeData = Array.isArray(data) ? data : [];
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return safeData;
    return [...safeData].sort((a, b) => {
      const aVal = parseSortableValue(a[sortConfig.key]);
      const bVal = parseSortableValue(b[sortConfig.key]);
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (typeof aVal === "string" && typeof bVal === "string")
        return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return 0;
    });
  }, [safeData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  };

  return (
    <div ref={ref} style={{ width: "100%" }}>
      {title && (
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          {title}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    padding: "7px 10px",
                    textAlign: col.align === "text-center" ? "center" : col.align === "text-right" ? "right" : "left",
                    fontSize: 11, fontWeight: 600, color: T.muted,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: `1px solid ${T.border}`,
                    background: T.surface,
                    whiteSpace: "nowrap", cursor: col.sortable ? "pointer" : "default",
                    userSelect: "none",
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  onMouseEnter={e => { if (col.sortable) e.currentTarget.style.color = T.text; }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.muted; }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {col.label}
                    {col.sortable && (
                      <span style={{ fontSize: 10, color: sortConfig.key === col.key ? T.blue : T.dim }}>
                        {sortConfig.key === col.key ? (sortConfig.direction === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", color: T.dim, padding: "20px 10px", fontStyle: "italic", fontSize: 12, borderBottom: `1px solid ${T.border}` }}>
                  No data available
                </td>
              </tr>
            ) : (
              sortedData.map((row, i) => {
                const diffVal = row.diff_percent ?? row.diffPercent;
                const diffColor = diffVal > 100 ? "#f2495c" : diffVal > 50 ? "#f5a623" : "#f5a623";

                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? T.panel : T.surface }}>
                    {columns.map((col, j) => {
                      const value = row[col.key];
                      let display = value;

                      if (typeof value === "number" && col.key.includes("duration"))
                        display = `${value.toFixed(2)} ms`;
                      else if (typeof value === "number" && col.key.includes("percent"))
                        display = `${value.toFixed(2)}%`;

                      const isDiffCol = col.key === "diff_percent" || col.key === "diffPercent";
                      const isStatusCol = col.key === "status";
                      const isSuccessCol = col.key === "success";

                      let cellColor = T.text;
                      if (isDiffCol && typeof diffVal === "number") cellColor = diffColor;
                      if (isStatusCol) {
                        const s = String(value);
                        cellColor = s.startsWith("2") ? "#73bf69" : s.startsWith("4") ? "#f5a623" : s.startsWith("5") ? "#f2495c" : T.text;
                      }
                      if (isSuccessCol && typeof value === "number") {
                        cellColor = value >= 95 ? "#73bf69" : value >= 80 ? "#f5a623" : "#f2495c";
                      }

                      return (
                        <td
                          key={j}
                          style={{
                            padding: "6px 10px",
                            borderBottom: `1px solid ${T.border}`,
                            textAlign: col.align === "text-center" ? "center" : col.align === "text-right" ? "right" : "left",
                            color: cellColor,
                            fontWeight: isDiffCol || isStatusCol || isSuccessCol ? 600 : 400,
                            maxWidth: j === 0 ? 200 : undefined,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: j === 0 ? "nowrap" : undefined,
                            verticalAlign: "middle",
                          }}
                          title={j === 0 ? String(value ?? "") : undefined}
                        >
                          {isDiffCol && typeof diffVal === "number" ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: 10 }}>{diffVal > 0 ? "▲" : "▼"}</span>
                              {display ?? "--"}
                            </span>
                          ) : (display ?? "--")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default DashboardTable;
