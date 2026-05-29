import { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeContext';

const GaugeViz = ({ data, options = {} }) => {
  const { T } = useTheme();
  const { valueColumn, minValue = 0, maxValue = 100, unit = '', decimals = 1 } = options;

  const { value, label } = useMemo(() => {
    if (!data?.rows?.length || !data?.fields?.length) return { value: null, label: '' };
    const fields = data.fields;

    let colIdx = 0;
    if (valueColumn) {
      const idx = fields.findIndex(f => f.name === valueColumn);
      if (idx !== -1) colIdx = idx;
    } else {
      // auto: first numeric column
      for (let i = 0; i < fields.length; i++) {
        const s = data.rows[0]?.[i];
        if (typeof s === 'number' || (!isNaN(parseFloat(s)) && s !== null)) { colIdx = i; break; }
      }
    }

    const raw = data.rows[0]?.[colIdx];
    return { value: parseFloat(raw) || 0, label: fields[colIdx]?.name || 'Value' };
  }, [data, valueColumn]);

  if (value === null) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.dim, fontSize: 12 }}>No data</div>;

  const min = parseFloat(minValue) || 0;
  const max = parseFloat(maxValue) || 100;
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const angle = -135 + pct * 270; // -135° to +135°

  // Color based on percentage
  const color = pct > 0.8 ? T.red : pct > 0.6 ? T.orange : T.green;

  // SVG arc path
  const polarToXY = (deg, r) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) };
  };

  const arcPath = (startDeg, endDeg, r) => {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const trackStart = -135 + 90; // offset for SVG (0° = top)
  const trackEnd   = 135 + 90;
  const fillEnd    = trackStart + pct * 270;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}>
      <svg viewBox="0 0 200 160" style={{ width: '100%', maxWidth: 220, maxHeight: 180 }}>
        {/* Track */}
        <path d={arcPath(-45, 225, 70)} fill="none" stroke={T.border2} strokeWidth="14" strokeLinecap="round" />
        {/* Fill */}
        {pct > 0 && (
          <path d={arcPath(-45, -45 + pct * 270, 70)} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />
        )}
        {/* Needle */}
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="38" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="100" r="5" fill={color} />
          <circle cx="100" cy="100" r="3" fill={T.surface} />
        </g>
        {/* Value */}
        <text x="100" y="118" textAnchor="middle" style={{ fill: T.text, fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {value.toFixed(decimals)}{unit}
        </text>
        {/* Min / Max */}
        <text x="28" y="148" textAnchor="middle" style={{ fill: T.dim, fontSize: 10 }}>{min}{unit}</text>
        <text x="172" y="148" textAnchor="middle" style={{ fill: T.dim, fontSize: 10 }}>{max}{unit}</text>
      </svg>
      <div style={{ fontSize: 12, color: T.muted, marginTop: -8 }}>{label}</div>
      {/* Threshold bar */}
      <div style={{ width: '60%', height: 4, background: T.border, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: T.dim }}>{(pct * 100).toFixed(0)}% of max</div>
    </div>
  );
};

export default GaugeViz;
