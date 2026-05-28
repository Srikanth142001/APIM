/**
 * PanelGrid — free-position canvas with drag-anywhere + resize + collision push
 *
 * - Panels can be dragged freely anywhere on the canvas
 * - When dropped, overlapping panels are pushed away (no overlap allowed)
 * - Resize from SE corner, E edge, or S edge
 * - Layout persisted via onLayoutChange(id, { x, y, pixelW, pixelH })
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

const MIN_W      = 300;
const MIN_H      = 180;
const MAX_H      = 1200;
const DEF_W      = 520;
const DEF_H      = 300;
const SNAP       = 10;
const GAP        = 14;   // minimum gap between panels after push
const CANVAS_PAD = 60;

const snap = v => Math.round(v / SNAP) * SNAP;

/* ── check if two rects overlap (with gap) ─────────────────────────────────── */
const overlaps = (a, b) =>
  a.x < b.x + b.w + GAP &&
  a.x + a.w + GAP > b.x &&
  a.y < b.y + b.h + GAP &&
  a.y + a.h + GAP > b.y;

/* ── push all other panels away from the moved panel ───────────────────────── */
const resolveCollisions = (movedId, layoutMap) => {
  const result = { ...layoutMap };
  const moved  = result[movedId];
  const others = Object.keys(result).filter(id => id !== movedId);

  // up to 10 passes to settle cascading pushes
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const id of others) {
      const p = result[id];
      if (!overlaps(moved, p)) continue;

      // find the axis with least overlap and push on that axis
      const overlapX = Math.min(moved.x + moved.w + GAP - p.x, p.x + p.w + GAP - moved.x);
      const overlapY = Math.min(moved.y + moved.h + GAP - p.y, p.y + p.h + GAP - moved.y);

      let nx = p.x, ny = p.y;
      if (overlapX < overlapY) {
        // push horizontally
        if (p.x < moved.x) nx = moved.x - p.w - GAP;
        else                nx = moved.x + moved.w + GAP;
      } else {
        // push vertically
        if (p.y < moved.y) ny = moved.y - p.h - GAP;
        else                ny = moved.y + moved.h + GAP;
      }

      nx = snap(Math.max(0, nx));
      ny = snap(Math.max(0, ny));

      if (nx !== p.x || ny !== p.y) {
        result[id] = { ...p, x: nx, y: ny };
        changed = true;
      }
    }
    if (!changed) break;
  }
  return result;
};

/* ── grip dots ─────────────────────────────────────────────────────────────── */
const Dots = ({ dir, active, T }) => (
  <div style={{ display: 'flex', flexDirection: dir === 'col' ? 'column' : 'row', gap: 3, pointerEvents: 'none' }}>
    {[0,1,2,3,4].map(i => (
      <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: active ? T.blue : T.border2 }} />
    ))}
  </div>
);

/* ══ PanelGrid ════════════════════════════════════════════════════════════════ */
const PanelGrid = ({ panels, onLayoutChange, renderPanel, isAdmin }) => {
  const { T } = useTheme();

  /* ── layout: { [id]: { x, y, w, h } } ── */
  const [layout, setLayout] = useState(() => {
    const m = {};
    panels.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      m[p.id] = {
        x: p.position?.x  ?? snap(col * (DEF_W + GAP * 2) + GAP),
        y: p.position?.y  ?? snap(row * (DEF_H + GAP * 2) + GAP),
        w: p.position?.pixelW || DEF_W,
        h: p.position?.pixelH || DEF_H,
      };
    });
    return m;
  });

  /* sync when panels list changes */
  useEffect(() => {
    setLayout(prev => {
      const next = { ...prev };
      panels.forEach((p, i) => {
        if (!next[p.id]) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          next[p.id] = {
            x: p.position?.x  ?? snap(col * (DEF_W + GAP * 2) + GAP),
            y: p.position?.y  ?? snap(row * (DEF_H + GAP * 2) + GAP),
            w: p.position?.pixelW || DEF_W,
            h: p.position?.pixelH || DEF_H,
          };
        }
      });
      Object.keys(next).forEach(id => {
        if (!panels.find(p => p.id === id)) delete next[id];
      });
      return next;
    });
  }, [panels]);

  /* ── active interaction ── */
  const [active,   setActive]   = useState(null); // { id, mode, type }
  const [dragging, setDragging] = useState(null);
  const [hasOverlap, setHasOverlap] = useState(false);
  const interRef  = useRef({});
  const saveTimer = useRef(null);

  /* ── z-index management ── */
  const [zMap, setZMap] = useState(() => {
    const m = {};
    panels.forEach((p, i) => { m[p.id] = i + 1; });
    return m;
  });
  const zCounter = useRef(panels.length + 1);

  const bringToFront = useCallback((id) => {
    zCounter.current += 1;
    setZMap(prev => ({ ...prev, [id]: zCounter.current }));
  }, []);

  /* ── start drag ── */
  const startDrag = useCallback((id) => (e) => {
    if (!isAdmin) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);
    const lay = layout[id] || {};
    interRef.current = { startMouseX: e.clientX, startMouseY: e.clientY, startX: lay.x, startY: lay.y, startW: lay.w, startH: lay.h, id, mode: 'drag' };
    setActive({ id, mode: 'drag' });
    setDragging(id);
  }, [layout, isAdmin, bringToFront]);

  /* ── start resize ── */
  const startResize = useCallback((id, type) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(id);
    const lay = layout[id] || {};
    interRef.current = { startMouseX: e.clientX, startMouseY: e.clientY, startX: lay.x, startY: lay.y, startW: lay.w, startH: lay.h, id, mode: 'resize', type };
    setActive({ id, mode: 'resize', type });
  }, [layout, bringToFront]);

  /* ── mouse move + up ── */
  useEffect(() => {
    if (!active) return;
    const { id, mode, type } = active;

    const onMove = (e) => {
      const dx = e.clientX - interRef.current.startMouseX;
      const dy = e.clientY - interRef.current.startMouseY;

      setLayout(prev => {
        const cur = prev[id] || {};
        const next = { ...cur };

        if (mode === 'drag') {
          next.x = snap(Math.max(0, interRef.current.startX + dx));
          next.y = snap(Math.max(0, interRef.current.startY + dy));
        } else {
          if (type === 'se' || type === 's') {
            next.h = snap(Math.min(MAX_H, Math.max(MIN_H, interRef.current.startH + dy)));
          }
          if (type === 'se' || type === 'e') {
            next.w = snap(Math.max(MIN_W, interRef.current.startW + dx));
          }
          if (type === 'sw') {
            const newW = snap(Math.max(MIN_W, interRef.current.startW - dx));
            next.x = snap(interRef.current.startX + (interRef.current.startW - newW));
            next.w = newW;
            next.h = snap(Math.min(MAX_H, Math.max(MIN_H, interRef.current.startH + dy)));
          }
        }

        const updated = { ...prev, [id]: next };

        // check for overlaps during drag (visual indicator only)
        if (mode === 'drag') {
          const hasAny = Object.keys(updated).some(oid => oid !== id && overlaps(next, updated[oid]));
          setHasOverlap(hasAny);
        }

        return updated;
      });
    };

    const onUp = () => {
      setActive(null);
      setDragging(null);
      setHasOverlap(false);

      // on drop: resolve collisions then save all affected panels
      setLayout(prev => {
        const resolved = mode === 'drag' ? resolveCollisions(id, prev) : prev;

        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          // save moved/resized panel
          const cur = resolved[id];
          if (cur) onLayoutChange(id, { x: cur.x, y: cur.y, pixelW: cur.w, pixelH: cur.h });

          // save any panels that were pushed
          if (mode === 'drag') {
            Object.keys(resolved).forEach(oid => {
              if (oid === id) return;
              const before = prev[oid];
              const after  = resolved[oid];
              if (before && after && (before.x !== after.x || before.y !== after.y)) {
                onLayoutChange(oid, { x: after.x, y: after.y, pixelW: after.w, pixelH: after.h });
              }
            });
          }
        }, 300);

        return resolved;
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [active, onLayoutChange]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  /* ── canvas height ── */
  const canvasH = Math.max(
    600,
    ...Object.values(layout).map(l => l.y + l.h + CANVAS_PAD)
  );

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: canvasH,
      userSelect: active ? 'none' : 'auto',
      cursor: dragging ? 'grabbing' : 'default',
    }}>
      {/* dot-grid background */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `radial-gradient(circle, ${T.border2} 1px, transparent 1px)`,
        backgroundSize: `${SNAP * 2}px ${SNAP * 2}px`,
        opacity: 0.45,
      }} />

      {panels.map(panel => {
        const lay   = layout[panel.id] || { x: 0, y: 0, w: DEF_W, h: DEF_H };
        const isAct = active?.id === panel.id;
        const isDrag = dragging === panel.id;
        const z     = zMap[panel.id] || 1;

        // check if this panel overlaps any other (for red border)
        const panelOverlaps = isDrag && Object.keys(layout).some(
          oid => oid !== panel.id && overlaps(lay, layout[oid])
        );

        return (
          <div
            key={panel.id}
            onMouseDown={() => bringToFront(panel.id)}
            style={{
              position: 'absolute',
              left:   lay.x,
              top:    lay.y,
              width:  lay.w,
              height: lay.h,
              zIndex: z,
              boxSizing: 'border-box',
              outline: panelOverlaps
                ? `2px solid ${T.red}`
                : isAct
                  ? `2px solid ${T.blue}`
                  : 'none',
              outlineOffset: 1,
              boxShadow: isDrag
                ? `0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px ${panelOverlaps ? T.red : T.blue}44`
                : 'none',
              transition: isDrag ? 'none' : 'box-shadow 0.15s, outline 0.1s',
            }}
          >
            {/* ── drag handle (thin bar at top, admin only) ── */}
            {isAdmin && (
              <div
                onMouseDown={startDrag(panel.id)}
                title="Drag to move"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 7, zIndex: 10,
                  cursor: isDrag ? 'grabbing' : 'grab',
                  background: isDrag
                    ? (panelOverlaps ? T.red : T.blue)
                    : 'transparent',
                  transition: 'background 0.12s',
                  borderRadius: '1px 1px 0 0',
                }}
                onMouseEnter={e => { if (!isDrag) e.currentTarget.style.background = `${T.blue}55`; }}
                onMouseLeave={e => { if (!isDrag) e.currentTarget.style.background = 'transparent'; }}
              />
            )}

            {/* panel content */}
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              {renderPanel(panel, { width: lay.w, height: lay.h })}
            </div>

            {/* ── S resize ── */}
            <div onMouseDown={startResize(panel.id, 's')} title="Resize height"
              style={{ position: 'absolute', bottom: 0, left: 10, right: 10, height: 8, cursor: 'ns-resize', zIndex: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}22`}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}
            >
              <Dots dir="row" active={isAct && (active?.type === 's' || active?.type === 'se')} T={T} />
            </div>

            {/* ── E resize ── */}
            <div onMouseDown={startResize(panel.id, 'e')} title="Resize width"
              style={{ position: 'absolute', right: 0, top: 10, bottom: 10, width: 8, cursor: 'ew-resize', zIndex: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}22`}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}
            >
              <Dots dir="col" active={isAct && (active?.type === 'e' || active?.type === 'se')} T={T} />
            </div>

            {/* ── SE corner ── */}
            <div onMouseDown={startResize(panel.id, 'se')} title="Resize both"
              style={{ position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, cursor: 'nwse-resize', zIndex: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}33`}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: 'none', opacity: 0.5 }}>
                <line x1="10" y1="3" x2="3"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="6" x2="6"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="9" x2="9"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            {/* ── SW corner ── */}
            <div onMouseDown={startResize(panel.id, 'sw')} title="Resize from left"
              style={{ position: 'absolute', bottom: 0, left: 0, width: 16, height: 16, cursor: 'nesw-resize', zIndex: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}33`}
              onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: 'none', opacity: 0.5, transform: 'scaleX(-1)' }}>
                <line x1="10" y1="3" x2="3"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="6" x2="6"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="9" x2="9"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            {/* size badge while resizing */}
            {isAct && active?.mode === 'resize' && (
              <div style={{ position: 'absolute', top: 10, right: 22, zIndex: 20, background: T.blue, color: '#fff', fontSize: 10, fontWeight: 600, padding: '2px 7px', pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(lay.w)} × {Math.round(lay.h)}
              </div>
            )}

            {/* position badge while dragging */}
            {isDrag && (
              <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 20, background: panelOverlaps ? T.red : T.panel, border: `1px solid ${panelOverlaps ? T.red : T.blue}`, color: panelOverlaps ? '#fff' : T.blue, fontSize: 10, fontWeight: 600, padding: '2px 7px', pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}>
                {panelOverlaps ? '⚠ overlapping' : `${Math.round(lay.x)}, ${Math.round(lay.y)}`}
              </div>
            )}
          </div>
        );
      })}

      {/* global overlap warning */}
      {hasOverlap && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: T.red, color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 20px', pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          ⚠ Panels will be pushed apart on drop
        </div>
      )}
    </div>
  );
};

export default PanelGrid;
