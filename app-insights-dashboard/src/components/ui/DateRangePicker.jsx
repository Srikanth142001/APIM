import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}
function isSameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isInRange(date, start, end) {
  if (!start || !end || !date) return false;
  return date > start && date < end;
}
function formatDisplay(date) {
  if (!date) return "Select date";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function CalendarMonth({ year, month, startDate, endDate, hoverDate, onDayClick, onDayHover, onPrev, onNext, showNav, T, isLight }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const rangeEnd = endDate || hoverDate;

  return (
    <div style={{ width: 240 }}>
      {/* Month header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        {showNav === "prev" || showNav === "both" ? (
          <button onClick={onPrev} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 16, padding: "2px 8px", borderRadius: 6, lineHeight: 1 }}>‹</button>
        ) : <span style={{ width: 32 }} />}
        <span style={{ color: T.text, fontWeight: 700, fontSize: 13 }}>
          {MONTHS[month]} {year}
        </span>
        {showNav === "next" || showNav === "both" ? (
          <button onClick={onNext} style={{ background: "none", border: "none", color: T.blue, cursor: "pointer", fontSize: 16, padding: "2px 8px", borderRadius: 6, lineHeight: 1 }}>›</button>
        ) : <span style={{ width: 32 }} />}
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: T.muted, fontWeight: 600, padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;

          const isStart = isSameDay(date, startDate);
          const isEnd = isSameDay(date, endDate);
          const inRange = isInRange(date, startDate, rangeEnd);
          const isToday = isSameDay(date, today);
          const isHover = isSameDay(date, hoverDate);
          const isSelected = isStart || isEnd;

          let bg = "transparent";
          let color = T.text;
          let borderRadius = "6px";

          if (isSelected) {
            bg = "linear-gradient(135deg, #38bdf8, #818cf8)";
            color = "#fff";
          } else if (inRange) {
            bg = isLight ? "rgba(56,189,248,0.15)" : "rgba(56,189,248,0.12)";
            color = "#0891b2";
            borderRadius = "0";
          } else if (isHover && startDate && !endDate) {
            bg = isLight ? "rgba(56,189,248,0.1)" : "rgba(56,189,248,0.08)";
            color = "#0891b2";
          }

          if (isStart && rangeEnd) borderRadius = "6px 0 0 6px";
          if (isEnd) borderRadius = "0 6px 6px 0";

          return (
            <div key={i}
              onClick={() => onDayClick(date)}
              onMouseEnter={() => onDayHover(date)}
              style={{
                textAlign: "center", fontSize: 12, padding: "6px 2px",
                cursor: "pointer", borderRadius,
                background: bg, color,
                fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                outline: isToday && !isSelected ? `1px solid ${T.blue}66` : "none",
                transition: "all 0.15s",
                userSelect: "none",
              }}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ startDate, endDate, onChange, onApply, onClear }) {
  const { T, themeKey } = useTheme();
  const isLight = themeKey === "light";
  const today = new Date();
  const [leftYear, setLeftYear] = useState(today.getFullYear());
  const [leftMonth, setLeftMonth] = useState(today.getMonth() === 0 ? 11 : today.getMonth() - 1);
  const [hoverDate, setHoverDate] = useState(null);
  const [selecting, setSelecting] = useState("start");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;
  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;

  const prevMonth = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
    else setLeftMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
    else setLeftMonth(m => m + 1);
  };

  const handleDayClick = (date) => {
    if (selecting === "start" || (startDate && endDate)) {
      onChange({ startDate: date, endDate: null });
      setSelecting("end");
    } else {
      if (date < startDate) {
        onChange({ startDate: date, endDate: startDate });
      } else {
        onChange({ startDate, endDate: date });
      }
      setSelecting("start");
    }
  };

  const handleApply = () => {
    if (!startDate || !endDate) return;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const s = new Date(startDate); s.setHours(sh, sm, 0, 0);
    const e = new Date(endDate);   e.setHours(eh, em, 59, 999);
    onApply(s.toISOString(), e.toISOString());
  };

  const applyPreset = (startD, endD, sTime = "00:00", eTime = "23:59", rangeKey = null) => {
    onChange({ startDate: startD, endDate: endD });
    setStartTime(sTime);
    setEndTime(eTime);
    const [sh, sm] = sTime.split(":").map(Number);
    const [eh, em] = eTime.split(":").map(Number);
    const s = new Date(startD); s.setHours(sh, sm, 0, 0);
    const e = new Date(endD);   e.setHours(eh, em, 59, 999);
    // Pass isPreset=true and rangeKey so Dashboard can switch to range mode
    onApply(s.toISOString(), e.toISOString(), !!rangeKey, rangeKey);
  };

  const presets = [
    { label: "Last 30 min",  fn: () => { const e = new Date(); const s = new Date(e.getTime() - 30*60000); applyPreset(s, e, `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`, `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`, '30m'); } },
    { label: "Last 1 hour",  fn: () => { const e = new Date(); const s = new Date(e.getTime() - 60*60000); applyPreset(s, e, `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`, `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`, '1h'); } },
    { label: "Last 3 hours", fn: () => { const e = new Date(); const s = new Date(e.getTime() - 3*60*60000); applyPreset(s, e, `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`, `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`, '3h'); } },
    { label: "Last 6 hours", fn: () => { const e = new Date(); const s = new Date(e.getTime() - 6*60*60000); applyPreset(s, e, `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`, `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`, '6h'); } },
    { label: "Last 12 hours",fn: () => { const e = new Date(); const s = new Date(e.getTime() - 12*60*60000); applyPreset(s, e, `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}`, `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}`, '12h'); } },
    { label: "Today",        fn: () => { const s = new Date(); s.setHours(0,0,0,0); applyPreset(s, new Date(), "00:00", `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`, '24h'); } },
    { label: "Yesterday",    fn: () => { const s = new Date(); s.setDate(s.getDate()-1); s.setHours(0,0,0,0); const e = new Date(s); e.setHours(23,59,59,999); applyPreset(s, e, "00:00", "23:59", null); } },
    { label: "Last 7 days",  fn: () => { const s = new Date(); s.setDate(s.getDate()-7); s.setHours(0,0,0,0); applyPreset(s, new Date(), "00:00", `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`, '7d'); } },
    { label: "Last 30 days", fn: () => { const s = new Date(); s.setDate(s.getDate()-30); s.setHours(0,0,0,0); applyPreset(s, new Date(), "00:00", `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`, '30d'); } },
    { label: "This month",   fn: () => { const s = new Date(); s.setDate(1); s.setHours(0,0,0,0); applyPreset(s, new Date(), "00:00", `${String(new Date().getHours()).padStart(2,'0')}:${String(new Date().getMinutes()).padStart(2,'0')}`, null); } },
    { label: "Last month",   fn: () => { const s = new Date(); s.setDate(1); s.setMonth(s.getMonth()-1); s.setHours(0,0,0,0); const e = new Date(); e.setDate(0); e.setHours(23,59,59,999); applyPreset(s, e, "00:00", "23:59", null); } },
  ];

  return (
    <div style={{
      background: isLight
        ? "linear-gradient(145deg, #f0f2fa, #e8eaf2)"
        : "linear-gradient(145deg, #0d1117, #161b27)",
      border: isLight
        ? "1px solid rgba(26,79,170,0.25)"
        : "1px solid rgba(56,189,248,0.2)",
      borderRadius: 16,
      boxShadow: isLight
        ? "0 24px 64px rgba(0,0,0,0.15), 0 0 0 1px rgba(26,79,170,0.05)"
        : "0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
      padding: 20,
      display: "flex",
      gap: 20,
      userSelect: "none",
      minWidth: 620,
    }}>

      {/* Left: Presets */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 4, minWidth: 110,
        borderRight: `1px solid ${T.border}`,
        paddingRight: 16,
      }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Select</div>
        {presets.map(({ label, fn }) => (
          <button key={label} onClick={fn} style={{
            background: "transparent", border: "none", color: T.textSub, fontSize: 12,
            textAlign: "left", padding: "6px 10px", borderRadius: 8, cursor: "pointer",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = isLight ? "rgba(26,79,170,0.1)" : "rgba(56,189,248,0.1)"; e.currentTarget.style.color = T.blue; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textSub; }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right: Calendars + controls */}
      <div style={{ flex: 1 }}>
        {/* Selected range display */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[
            { label: "From", date: startDate, time: startTime, setTime: setStartTime, active: selecting === "start" },
            { label: "To",   date: endDate,   time: endTime,   setTime: setEndTime,   active: selecting === "end" },
          ].map(({ label, date, time, setTime, active }) => (
            <div key={label} style={{
              flex: 1,
              background: active
                ? (isLight ? "rgba(26,79,170,0.08)" : "rgba(56,189,248,0.08)")
                : (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"),
              border: `1px solid ${active ? (isLight ? "rgba(26,79,170,0.4)" : "rgba(56,189,248,0.4)") : T.border}`,
              borderRadius: 10, padding: "8px 12px",
            }}>
              <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: date ? T.text : T.dim, fontWeight: date ? 600 : 400 }}>
                {formatDisplay(date)}
              </div>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                style={{
                  marginTop: 4, background: "transparent", border: "none",
                  color: T.blue, fontSize: 12, outline: "none", cursor: "pointer", width: "100%",
                }} />
            </div>
          ))}
        </div>

        {/* Dual calendars */}
        <div style={{ display: "flex", gap: 24 }}>
          <CalendarMonth
            year={leftYear} month={leftMonth}
            startDate={startDate} endDate={endDate} hoverDate={hoverDate}
            onDayClick={handleDayClick} onDayHover={setHoverDate}
            onPrev={prevMonth} onNext={nextMonth} showNav="both"
            T={T} isLight={isLight}
          />
          <CalendarMonth
            year={rightYear} month={rightMonth}
            startDate={startDate} endDate={endDate} hoverDate={hoverDate}
            onDayClick={handleDayClick} onDayHover={setHoverDate}
            onPrev={prevMonth} onNext={nextMonth} showNav="none"
            T={T} isLight={isLight}
          />
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 16, paddingTop: 14,
          borderTop: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 11, color: T.muted }}>
            {selecting === "start" ? "Select start date" : "Select end date"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onClear(); setSelecting("start"); }}
              style={{ padding: "7px 16px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8, color: "#f43f5e", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Clear
            </button>
            <button onClick={handleApply} disabled={!startDate || !endDate}
              style={{
                padding: "7px 20px",
                background: startDate && endDate ? "linear-gradient(135deg, #38bdf8, #818cf8)" : (isLight ? "rgba(26,79,170,0.1)" : "rgba(56,189,248,0.1)"),
                border: "none", borderRadius: 8,
                color: startDate && endDate ? "#fff" : T.dim,
                fontSize: 12, fontWeight: 700, cursor: startDate && endDate ? "pointer" : "not-allowed",
                boxShadow: startDate && endDate ? "0 4px 16px rgba(56,189,248,0.3)" : "none",
              }}>
              Apply Range
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
