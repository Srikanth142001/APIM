/**
 * PanelGrid — drag-to-reorder + live-resize container
 *
 * Props:
 *   panels        — array of panel objects (must have .id, .position)
 *   onLayoutChange(id, { pixelW, pixelH, order }) — called after resize/drag ends
 *   renderPanel(panel, { width, height }) — render function for each panel
 *   isAdmin       — show drag handle
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

const MIN_W   = 320;
const MIN_H   = 180;
const MAX_H   = 1200;
const DEF_H   = 300;
const GAP     = 14;

/* ── drag ghost ─────────────────────────────────────────────────────────── */
const Ghost = ({ width, height, T }) => (
  <div style={{
    width, height,
    border: `2px dashed ${T.blue}`,
    background: `${T.blue}0a`,
    boxSizing: 'border-box',
    pointerEvents: 'none',
  }} />
);

/* ── grip dots ───────────────────────────────────────────────────────────── */
const GripDots = ({ dir, active, T }) => (
  <div style={{ display: 'flex', flexDirection: dir === 'h' ? 'column' : 'row', gap: 3, pointerEvents: 'none' }}>
    {[0,1,2,3,4].map(i => (
      <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: active ? T.blue : T.border2 }} />
    ))}
  </div>
);

/* ══ PanelGrid ═══════════════════════════════════════════════════════════════ */
const PanelGrid = ({ panels, onLayoutChange, renderPanel, isAdmin }) => {
  const { T } = useTheme();

  /* ── layout state: { [id]: { w, h, order } } ── */
  const [layout, setLayout] = useState(() => {
    const m = {};
    panels.forEach((p, i) => {
      m[p.id] = {
        w:     p.position?.pixelW || null,
        h:     p.position?.pixelH || Math.max(DEF_H, (p.position?.h || 4) * 72),
        order: p.position?.order  ?? i,
      };
    });
    return m;
  });

  /* sync when panels list changes (new panel added, etc.) */
  useEffect(() => {
    setLayout(prev => {
      const next = { ...prev };
      panels.forEach((p, i) => {
        if (!next[p.id]) {
          next[p.id] = {
            w:     p.position?.pixelW || null,
            h:     p.position?.pixelH || Math.max(DEF_H, (p.position?.h || 4) * 72),
            order: p.position?.order  ?? i,
          };
        }
      });
      // remove stale
      Object.keys(next).forEach(id => {
        if (!panels.find(p => p.id === id)) delete next[id];
      });
      return next;
    });
  }, [panels]);

  /* ── resize state ── */
  const [resizing,   setResizing]   = useState(null); // { id, type }
  const resizeRef    = useRef({ startX: 0, startY: 0, startW: 0, startH: 0, id: null });
  const saveTimerRef = useRef(null);

  const startResize = useCallback((id, type) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById(`panel-wrap-${id}`);
    const rect = el?.getBoundingClientRect();
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      startW: rect?.width  || layout[id]?.w || 500,
      startH: layout[id]?.h || DEF_H,
      id,
    };
    setResizing({ id, type });
  }, [layout]);

  useEffect(() => {
    if (!resizing) return;
    const { id, type } = resizing;

    const onMove = (e) => {
      const dx = e.clientX - resizeRef.current.startX;
      const dy = e.clientY - resizeRef.current.startY;
      setLayout(prev => {
        const cur = prev[id] || {};
        const next = { ...cur };
        if (type === 'v' || type === 'corner') {
          next.h = Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.startH + dy));
        }
        if (type === 'h' || type === 'corner') {
          next.w = Math.max(MIN_W, resizeRef.current.startW + dx);
        }
        return { ...prev, [id]: next };
      });
    };

    const onUp = () => {
      setResizing(null);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setLayout(prev => {
          const cur = prev[id];
          if (cur) onLayoutChange(id, { pixelW: cur.w, pixelH: cur.h });
          return prev;
        });
      }, 300);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [resizing, onLayoutChange]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  /* ── drag-to-reorder state ── */
  const [dragging,   setDragging]   = useState(null); // id being dragged
  const [dragOver,   setDragOver]   = useState(null); // id being hovered over
  const dragRef      = useRef(null);

  const onDragStart = useCallback((id) => (e) => {
    dragRef.current = id;
    setDragging(id);
    e.dataTransfer.effectAllowed = 'move';
    // transparent drag image
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const onDragOver = useCallback((id) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragRef.current) setDragOver(id);
  }, []);

  const onDrop = useCallback((targetId) => (e) => {
    e.preventDefault();
    const sourceId = dragRef.current;
    if (!sourceId || sourceId === targetId) { setDragging(null); setDragOver(null); return; }

    setLayout(prev => {
      const entries = Object.entries(prev).sort((a, b) => a[1].order - b[1].order);
      const srcIdx = entries.findIndex(([id]) => id === sourceId);
      const tgtIdx = entries.findIndex(([id]) => id === targetId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;

      // swap orders
      const next = { ...prev };
      const srcOrder = prev[sourceId].order;
      const tgtOrder = prev[targetId].order;
      next[sourceId] = { ...prev[sourceId], order: tgtOrder };
      next[targetId] = { ...prev[targetId], order: srcOrder };

      // persist order for both
      setTimeout(() => {
        onLayoutChange(sourceId, { order: tgtOrder });
        onLayoutChange(targetId, { order: srcOrder });
      }, 0);

      return next;
    });

    setDragging(null);
    setDragOver(null);
    dragRef.current = null;
  }, [onLayoutChange]);

  const onDragEnd = useCallback(() => {
    setDragging(null);
    setDragOver(null);
    dragRef.current = null;
  }, []);

  /* ── sorted panels ── */
  const sorted = [...panels].sort((a, b) => {
    const oa = layout[a.id]?.order ?? 0;
    const ob = layout[b.id]?.order ?? 0;
    return oa - ob;
  });

  /* ── resize handle style ── */
  const hBase = (cursor, pos) => ({
    position: 'absolute', ...pos, cursor, zIndex: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP, alignItems: 'flex-start' }}>
      {sorted.map(panel => {
        const lay    = layout[panel.id] || {};
        const w      = lay.w || null;
        const h      = lay.h || DEF_H;
        const isDrag = dragging === panel.id;
        const isOver = dragOver === panel.id;
        const isRes  = resizing?.id === panel.id;

        return (
          <div
            key={panel.id}
            id={`panel-wrap-${panel.id}`}
            draggable={isAdmin}
            onDragStart={isAdmin ? onDragStart(panel.id) : undefined}
            onDragOver={isAdmin ? onDragOver(panel.id) : undefined}
            onDrop={isAdmin ? onDrop(panel.id) : undefined}
            onDragEnd={isAdmin ? onDragEnd : undefined}
            style={{
              flex:     w ? `0 0 ${w}px` : '1 1 500px',
              minWidth: w ? `${w}px`      : '500px',
              maxWidth: w ? `${w}px`      : '100%',
              boxSizing: 'border-box',
              position: 'relative',
              opacity:  isDrag ? 0.35 : 1,
              outline:  isOver ? `2px dashed ${T.blue}` : 'none',
              outlineOffset: 2,
              transition: isDrag ? 'none' : 'opacity 0.15s, outline 0.1s',
            }}
          >
            {/* drag ghost placeholder */}
            {isOver && dragging && dragging !== panel.id && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 30,
                background: `${T.blue}0a`,
                border: `2px dashed ${T.blue}`,
                pointerEvents: 'none',
              }} />
            )}

            {/* drag handle — only for admin, shown on hover */}
            {isAdmin && (
              <div
                title="Drag to reorder"
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 28, zIndex: 15,
                  cursor: 'grab',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                <div style={{
                  display: 'flex', gap: 3, padding: '3px 8px',
                  background: T.panel, border: `1px solid ${T.border2}`,
                  borderRadius: 3,
                }}>
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: T.muted }} />
                  ))}
                </div>
              </div>
            )}

            {/* panel content */}
            <div style={{ height: h, overflow: 'hidden', position: 'relative' }}>
              {renderPanel(panel, { width: w, height: h })}
            </div>

            {/* ── bottom resize handle ── */}
            <div
              onMouseDown={startResize(panel.id, 'v')}
              title="Drag to resize height"
              style={{ ...hBase('ns-resize', { bottom: 0, left: 0, right: 16, height: 8 }) }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}18`}
              onMouseLeave={e => { if (!isRes) e.currentTarget.style.background = 'transparent'; }}
            >
              <GripDots dir="v" active={isRes && (resizing.type === 'v' || resizing.type === 'corner')} T={T} />
            </div>

            {/* ── right resize handle ── */}
            <div
              onMouseDown={startResize(panel.id, 'h')}
              title="Drag to resize width"
              style={{ ...hBase('ew-resize', { right: 0, top: 0, bottom: 8, width: 8 }) }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}18`}
              onMouseLeave={e => { if (!isRes) e.currentTarget.style.background = 'transparent'; }}
            >
              <GripDots dir="h" active={isRes && (resizing.type === 'h' || resizing.type === 'corner')} T={T} />
            </div>

            {/* ── corner resize handle ── */}
            <div
              onMouseDown={startResize(panel.id, 'corner')}
              title="Drag to resize both"
              style={{ ...hBase('nwse-resize', { bottom: 0, right: 0, width: 16, height: 16 }) }}
              onMouseEnter={e => e.currentTarget.style.background = `${T.blue}22`}
              onMouseLeave={e => { if (!isRes) e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: 'none', opacity: 0.5 }}>
                <line x1="10" y1="3" x2="3"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="6" x2="6"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="9" x2="9"  y2="10" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>

            {/* live size badge while resizing */}
            {isRes && (
              <div style={{
                position: 'absolute', top: 8, right: 24, zIndex: 25,
                background: T.blue, color: '#fff',
                fontSize: 10, fontWeight: 600, padding: '2px 7px',
                pointerEvents: 'none', fontVariantNumeric: 'tabular-nums',
              }}>
                {w ? `${Math.round(w)}w × ` : ''}{Math.round(h)}h
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export { Ghost };
export default PanelGrid;
