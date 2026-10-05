import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';

// ─── Physics constants ────────────────────────────────────────────────────────
const REPULSION  = 9000;
const SPRING     = 0.025;
const REST_LEN   = 200;
const GRAVITY    = 0.01;
const DAMPING    = 0.82;
const CANVAS_W   = 1600;
const CANVAS_H   = 900;

// Node card dimensions (from design spec)
const NW = 154;
const NH = 54;

// Topic color palette
const TOPIC_HUES = [258, 155, 65, 320, 200, 30];
const topicColor = (i, alpha = 1) => `oklch(0.68 0.13 ${TOPIC_HUES[i % TOPIC_HUES.length]} / ${alpha})`;
const topicFill  = (i) => `oklch(0.93 0.04 ${TOPIC_HUES[i % TOPIC_HUES.length]} / 0.20)`;

// The id is what the filter logic compares; the key is what the button shows.
// Keeping them apart is what stops a translated label from breaking a filter.
const FILTERS = [
  { id: 'All',         key: 'status.all' },
  { id: 'By topic',    key: 'graph.byTopic' },
  { id: 'In progress', key: 'status.inProgress' },
  { id: 'Overdue',     key: 'capture.overdue' },
];

const STATUS_COLOR = {
  not_started: null,  // uses T.ink20
  in_progress: null,  // uses T.accent
  done:        null,  // uses T.done
  overdue:     null,  // uses T.warn
};

function statusColor(status, T) {
  if (status === 'in_progress') return T.accent;
  if (status === 'done')        return T.done;
  if (status === 'overdue')     return T.warn;
  return T.ink20;
}

// Returns a KEY, not text: the caller translates. Internal status ids stay
// English so the filter logic never depends on the interface language.
function statusKey(status) {
  const map = { not_started: 'status.notStarted', in_progress: 'status.inProgress', done: 'status.done', overdue: 'capture.overdue' };
  return map[status] || null;
}

function todayStart() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function getEffectiveStatus(task) {
  if (task.status === 'done') return 'done';
  if (task.deadline) {
    const d = new Date(task.deadline + 'T00:00:00');
    if (d < todayStart()) return 'overdue';
  }
  return task.status || 'not_started';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTopicOrder(tasks) {
  const order = [];
  const seen  = new Set();
  for (const t of tasks) {
    const topic = t.tags?.[0] || 'Untagged';
    if (!seen.has(topic)) { seen.add(topic); order.push(topic); }
  }
  return order;
}

function initNodes(tasks, topicOrder, byTopic) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const n  = tasks.length;

  if (byTopic && topicOrder.length > 1) {
    // Cluster layout: each topic gets a radial center
    const clusterCenters = topicOrder.map((_, i) => {
      const angle = (2 * Math.PI * i) / topicOrder.length - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * 280,
        y: cy + Math.sin(angle) * 220,
      };
    });
    return tasks.map((task) => {
      const topic = task.tags?.[0] || 'Untagged';
      const ti    = topicOrder.indexOf(topic);
      const cc    = clusterCenters[Math.max(0, ti)];
      return {
        id: task.id, task,
        x:  cc.x + (Math.random() - 0.5) * 80,
        y:  cc.y + (Math.random() - 0.5) * 80,
        vx: 0, vy: 0,
        topic, ti: Math.max(0, ti),
      };
    });
  }

  return tasks.map((task, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1);
    return {
      id: task.id, task,
      x:  cx + Math.cos(angle) * 220 + (Math.random() - 0.5) * 40,
      y:  cy + Math.sin(angle) * 180 + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0,
      topic: task.tags?.[0] || 'Untagged',
      ti:    topicOrder.indexOf(task.tags?.[0] || 'Untagged') >= 0
               ? topicOrder.indexOf(task.tags?.[0] || 'Untagged')
               : 0,
    };
  });
}

function buildEdges(nodes) {
  const idMap      = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges      = [];
  const topicPairs = new Set();

  for (const node of nodes) {
    const deps = node.task.aiData?.dependencies || [];
    for (const depId of deps) {
      if (idMap[depId]) edges.push({ fromId: depId, toId: node.id, type: 'dependency' });
    }
    for (const other of nodes) {
      if (other.id !== node.id && other.topic === node.topic) {
        const key = [node.id, other.id].sort().join('|');
        if (!topicPairs.has(key)) {
          topicPairs.add(key);
          edges.push({ fromId: node.id, toId: other.id, type: 'topic' });
        }
      }
    }
  }
  return edges;
}

function tickPhysics(nodes, edges, pinnedIds, byTopic, topicOrder) {
  const n = nodes.length;
  if (n === 0) return 0;

  const fx = new Float64Array(n);
  const fy = new Float64Array(n);

  // 1. Repulsion between all pairs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx   = nodes[i].x - nodes[j].x;
      const dy   = nodes[i].y - nodes[j].y;
      const dist2 = dx * dx + dy * dy + 1;
      const dist  = Math.sqrt(dist2);
      const force = REPULSION / dist2;
      const ux = dx / dist, uy = dy / dist;
      fx[i] += ux * force;  fy[i] += uy * force;
      fx[j] -= ux * force;  fy[j] -= uy * force;
    }
  }

  // 2. Spring attraction along edges
  for (const e of edges) {
    const fi = nodes.findIndex(nd => nd.id === e.fromId);
    const ti = nodes.findIndex(nd => nd.id === e.toId);
    if (fi < 0 || ti < 0) continue;
    const dx   = nodes[ti].x - nodes[fi].x;
    const dy   = nodes[ti].y - nodes[fi].y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const f    = SPRING * (dist - REST_LEN);
    const ux = dx / dist, uy = dy / dist;
    fx[fi] += ux * f;  fy[fi] += uy * f;
    fx[ti] -= ux * f;  fy[ti] -= uy * f;
  }

  // 3. Gravity toward center (or toward topic cluster center if byTopic)
  for (let i = 0; i < n; i++) {
    if (byTopic && topicOrder.length > 1) {
      const ti    = nodes[i].ti;
      const angle = (2 * Math.PI * ti) / topicOrder.length - Math.PI / 2;
      const ccx   = CANVAS_W / 2 + Math.cos(angle) * 280;
      const ccy   = CANVAS_H / 2 + Math.sin(angle) * 220;
      fx[i] += GRAVITY * 2 * (ccx - nodes[i].x);
      fy[i] += GRAVITY * 2 * (ccy - nodes[i].y);
    } else {
      fx[i] += GRAVITY * (CANVAS_W / 2 - nodes[i].x);
      fy[i] += GRAVITY * (CANVAS_H / 2 - nodes[i].y);
    }
  }

  let maxV = 0;

  // 4. Integrate
  for (let i = 0; i < n; i++) {
    if (pinnedIds.has(nodes[i].id)) { nodes[i].vx = 0; nodes[i].vy = 0; continue; }
    nodes[i].vx = (nodes[i].vx + fx[i]) * DAMPING;
    nodes[i].vy = (nodes[i].vy + fy[i]) * DAMPING;
    nodes[i].x  = Math.max(NW, Math.min(CANVAS_W - NW, nodes[i].x + nodes[i].vx));
    nodes[i].y  = Math.max(NH, Math.min(CANVAS_H - NH, nodes[i].y + nodes[i].vy));
    const v = Math.abs(nodes[i].vx) + Math.abs(nodes[i].vy);
    if (v > maxV) maxV = v;
  }

  return maxV;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GraphView({ rankedTasks, onOpenDetail }) {
  const { t } = useLocale();
  const { T } = useTheme();

  const [filter,     setFilter]     = useState('All');
  const [selectedId, setSelectedId] = useState(null);
  const [transform,  setTransform]  = useState({ x: 0, y: 0, scale: 1 });
  const [nodeSnap,   setNodeSnap]   = useState([]);

  const nodesRef   = useRef([]);
  const edgesRef   = useRef([]);
  const pinnedRef  = useRef(new Set());
  const rafRef     = useRef(null);
  const frameRef   = useRef(0);
  const runningRef = useRef(false);

  const nodeDragRef = useRef(null);
  const panDragRef  = useRef(null);
  const svgRef      = useRef(null);
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);

  const byTopic = filter === 'By topic';

  const filteredTasks = useMemo(() => {
    if (filter === 'All' || filter === 'By topic') return rankedTasks;
    if (filter === 'In progress') return rankedTasks.filter(t => t.status === 'in_progress');
    if (filter === 'Overdue')     return rankedTasks.filter(t => {
      if (!t.deadline) return false;
      return new Date(t.deadline + 'T00:00:00') < todayStart() && t.status !== 'done';
    });
    return rankedTasks;
  }, [rankedTasks, filter]);

  const topicOrder = useMemo(() => getTopicOrder(filteredTasks), [filteredTasks]);

  // ── (Re)start simulation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    runningRef.current = false;

    if (filteredTasks.length === 0) {
      nodesRef.current = []; edgesRef.current = [];
      setNodeSnap([]);
      return;
    }

    const nodes = initNodes(filteredTasks, topicOrder, byTopic);
    const edges = buildEdges(nodes);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    pinnedRef.current = new Set();
    frameRef.current  = 0;
    setNodeSnap(nodes.map(nd => ({ ...nd })));

    runningRef.current = true;

    function loop() {
      if (!runningRef.current) return;
      frameRef.current++;
      const maxV = tickPhysics(nodesRef.current, edgesRef.current, pinnedRef.current, byTopic, topicOrder);
      if (frameRef.current % 3 === 0) setNodeSnap(nodesRef.current.map(nd => ({ ...nd })));
      if (maxV < 0.25 && pinnedRef.current.size === 0) {
        setNodeSnap(nodesRef.current.map(nd => ({ ...nd })));
        runningRef.current = false; rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      runningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, filter]);

  const restartLoop = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    frameRef.current   = 0;
    function loop() {
      if (!runningRef.current) return;
      frameRef.current++;
      const maxV = tickPhysics(nodesRef.current, edgesRef.current, pinnedRef.current, byTopic, topicOrder);
      if (frameRef.current % 3 === 0) setNodeSnap(nodesRef.current.map(nd => ({ ...nd })));
      if (maxV < 0.25 && pinnedRef.current.size === 0) {
        setNodeSnap(nodesRef.current.map(nd => ({ ...nd })));
        runningRef.current = false; rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byTopic, topicOrder]);

  // ── Pointer handlers ─────────────────────────────────────────────────────────
  const onSVGPointerDown = useCallback((e) => {
    // Node groups stop propagation, so this handler only fires on the SVG background
    panDragRef.current = {
      startPx: e.clientX, startPy: e.clientY,
      tx: transformRef.current.x, ty: transformRef.current.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onNodePointerDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    const nd = nodesRef.current.find(n => n.id === nodeId);
    if (!nd) return;
    nodeDragRef.current = { id: nodeId, startPx: e.clientX, startPy: e.clientY, nodeX: nd.x, nodeY: nd.y };
    nd.vx = 0; nd.vy = 0;
    pinnedRef.current.add(nodeId);
    if (!runningRef.current) {
      runningRef.current = true;
      frameRef.current   = 0;
      function loop() {
        if (!runningRef.current) return;
        frameRef.current++;
        tickPhysics(nodesRef.current, edgesRef.current, pinnedRef.current, byTopic, topicOrder);
        if (frameRef.current % 3 === 0) setNodeSnap(nodesRef.current.map(n => ({ ...n })));
        rafRef.current = requestAnimationFrame(loop);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byTopic, topicOrder]);

  const onPointerMove = useCallback((e) => {
    if (nodeDragRef.current) {
      const { id, startPx, startPy, nodeX, nodeY } = nodeDragRef.current;
      const t  = transformRef.current;
      const dx = (e.clientX - startPx) / t.scale;
      const dy = (e.clientY - startPy) / t.scale;
      const nd = nodesRef.current.find(n => n.id === id);
      if (nd) {
        nd.x = Math.max(NW / 2 + 8, Math.min(CANVAS_W - NW / 2 - 8, nodeX + dx));
        nd.y = Math.max(NH / 2 + 8, Math.min(CANVAS_H - NH / 2 - 8, nodeY + dy));
        nd.vx = 0; nd.vy = 0;
        // Always update snap so node moves visually even when physics is settled
        setNodeSnap(nodesRef.current.map(n => ({ ...n })));
      }
      return;
    }
    if (panDragRef.current) {
      const { startPx, startPy, tx, ty } = panDragRef.current;
      setTransform(prev => ({
        ...prev,
        x: tx + (e.clientX - startPx),
        y: ty + (e.clientY - startPy),
      }));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (nodeDragRef.current) {
      pinnedRef.current.delete(nodeDragRef.current.id);
      nodeDragRef.current = null;
      restartLoop();
    }
    panDragRef.current = null;
  }, [restartLoop]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect   = svgRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    setTransform(prev => {
      const newScale = Math.max(0.15, Math.min(4, prev.scale * factor));
      const ratio    = newScale / prev.scale;
      return {
        scale: newScale,
        x: mx - (mx - prev.x) * ratio,
        y: my - (my - prev.y) * ratio,
      };
    });
  }, []);

  const onNodeClick = useCallback((e, node) => {
    e.stopPropagation();
    setSelectedId(node.id);
    onOpenDetail?.(node.task);
  }, [onOpenDetail]);

  const snapMap = useMemo(() => Object.fromEntries(nodeSnap.map(n => [n.id, n])), [nodeSnap]);

  const MM_W = 120, MM_H = 78;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (rankedTasks.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.fontUI }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: T.r10, background: T.paperSubtle, border: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.ink40} strokeWidth="1.6">
              <circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/>
              <line x1="10.7" y1="10.7" x2="7" y2="17"/><line x1="13.3" y1="10.7" x2="17" y2="7"/>
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: T.ink60, margin: 0 }}>{t('graph.noTasks')}</p>
          <p style={{ fontSize: 13, color: T.ink40, marginTop: 6 }}>{t('graph.addTasks')}</p>
        </div>
      </div>
    );
  }

  const isDraggingPan = !!panDragRef.current;

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: T.paper, userSelect: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <svg
        ref={svgRef}
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, cursor: isDraggingPan ? 'grabbing' : 'grab', display: 'block' }}
        onPointerDown={onSVGPointerDown}
        onWheel={onWheel}
      >
        <defs>
          <marker id="graph-arrow" markerWidth={7} markerHeight={7} refX={5} refY={3.5} orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill={T.ink40} />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

          {/* ── Edges ── */}
          {edgesRef.current.map((e, i) => {
            const from = snapMap[e.fromId];
            const to   = snapMap[e.toId];
            if (!from || !to) return null;

            const dx   = to.x - from.x;
            const dy   = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist, uy = dy / dist;
            // Offset to node card edges
            const x1 = from.x + ux * (NW / 2 + 2);
            const y1 = from.y + uy * (NH / 2 + 2);
            const x2 = to.x   - ux * (NW / 2 + 6);
            const y2 = to.y   - uy * (NH / 2 + 6);

            if (e.type === 'dependency') {
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={T.ink40} strokeWidth={1.5} markerEnd="url(#graph-arrow)" />;
            }
            // same-topic dashed
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={T.ink20} strokeWidth={1} strokeDasharray="2 5" opacity={0.5} />;
          })}

          {/* ── Node cards ── */}
          {nodeSnap.map(nd => {
            const isSel   = nd.id === selectedId;
            const status  = getEffectiveStatus(nd.task);
            const sColor  = statusColor(status, T);
            const ti      = nd.ti;
            const x = nd.x - NW / 2;
            const y = nd.y - NH / 2;
            const label = nd.task.title.length > 20 ? nd.task.title.slice(0, 19) + '…' : nd.task.title;
            const topicLabel = (nd.topic === 'Untagged' ? '' : nd.topic).slice(0, 16);

            return (
              <g
                key={nd.id}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => onNodePointerDown(e, nd.id)}
                onClick={(e) => onNodeClick(e, nd)}
              >
                {/* Selection glow */}
                {isSel && (
                  <rect x={x - 3} y={y - 3} width={NW + 6} height={NH + 6} rx={9}
                    fill="none" stroke={T.accent} strokeWidth={2}
                    style={{ filter: `drop-shadow(0 0 6px ${T.ink20})` }}
                  />
                )}
                {/* Card background */}
                <rect x={x} y={y} width={NW} height={NH} rx={6}
                  fill={T.paper}
                  stroke={isSel ? T.accent : T.hairline}
                  strokeWidth={isSel ? 1.5 : 1}
                />
                {/* Topic color bar */}
                {topicLabel && (
                  <rect x={x} y={y} width={3} height={NH} rx={3}
                    fill={topicColor(ti, 0.65)}
                  />
                )}
                {/* Topic eyebrow */}
                {topicLabel && (
                  <text x={x + 10} y={y + 14}
                    style={{ fontFamily: T.fontMono, fontSize: 9, textTransform: 'uppercase',
                      fill: topicColor(ti, 0.9), letterSpacing: '0.09em', pointerEvents: 'none', userSelect: 'none' }}>
                    {topicLabel}
                  </text>
                )}
                {/* Task title */}
                <text x={x + 10} y={topicLabel ? y + 30 : y + 24}
                  style={{ fontFamily: T.fontUI, fontSize: 12.5, fontWeight: 500, fill: T.ink, pointerEvents: 'none', userSelect: 'none' }}>
                  {label}
                </text>
                {/* Status indicator */}
                <circle cx={x + 11} cy={y + 44} r={3.5} fill={sColor} />
                <text x={x + 21} y={y + 47.5}
                  style={{ fontFamily: T.fontMono, fontSize: 9, fill: T.ink40, pointerEvents: 'none', userSelect: 'none' }}>
                  {statusKey(status) ? t(statusKey(status)) : status}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Top-left controls ── */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: T.paper, borderRadius: T.r10,
        border: `1px solid ${T.hairline}`,
        boxShadow: '0 4px 12px rgba(25,25,26,0.08)',
        padding: '9px 14px',
        display: 'flex', alignItems: 'center', gap: 14,
        zIndex: 10,
      }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40 }}>
          {t('nav.graph')}
        </span>
        <span style={{ width: 1, height: 13, background: T.hairline, display: 'inline-block' }} />
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.ink60 }}>
          {Math.round(transform.scale * 100)}%
        </span>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          style={{ fontSize: 11.5, color: T.ink60, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: T.fontUI, padding: 0 }}
        >
          {t('graph.reset')}
        </button>
      </div>

      {/* ── Top-right filter pills ── */}
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6, zIndex: 10 }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            borderRadius: T.rPill, padding: '5px 12px', fontSize: 12,
            background: f.id === filter ? T.ink  : T.paper,
            color:      f.id === filter ? T.paper : T.ink80,
            border:     `1px solid ${f.id === filter ? T.ink : T.hairline}`,
            fontWeight: f.id === filter ? 500 : 400,
            cursor: 'pointer', fontFamily: T.fontUI,
          }}>{t(f.key)}</button>
        ))}
      </div>

      {/* ── Bottom-left legend ── */}
      <div style={{ position: 'absolute', bottom: 20, left: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 10.5, color: T.ink40, fontFamily: T.fontMono, marginBottom: 2 }}>
          <span>—— {t('graph.legend.dependency')}</span>
          <span>··· {t('graph.legend.sameTopic')}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
          {[
            { label: t('status.notStarted'), color: T.ink20 },
            { label: t('status.inProgress'), color: T.accent },
            { label: t('status.done'),     color: T.done },
            { label: t('capture.overdue'), color: T.warn },
          ].map(({ label, color }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: T.fontMono, fontSize: 10, color: T.ink40 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>
        {topicOrder.slice(0, 5).map((topic, i) => (
          <span key={topic} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: T.fontMono, fontSize: 10.5, color: T.ink60 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: topicColor(i), display: 'inline-block', flexShrink: 0 }} />
            {(() => {
              // 'Untagged' is the internal bucket id; the legend shows its name.
              const name = topic === 'Untagged' ? t('graph.untagged') : topic;
              return name.length > 22 ? name.slice(0, 21) + '…' : name;
            })()}
          </span>
        ))}
      </div>

      {/* ── Bottom-right minimap ── */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        width: MM_W, height: MM_H,
        background: T.paper, borderRadius: T.r6,
        border: `1px solid ${T.hairline}`,
        opacity: 0.9, overflow: 'hidden', zIndex: 10,
        pointerEvents: 'none',
      }}>
        <svg width={MM_W} height={MM_H}>
          {nodeSnap.map(nd => (
            <circle key={nd.id}
              cx={(nd.x / CANVAS_W) * MM_W}
              cy={(nd.y / CANVAS_H) * MM_H}
              r={nd.id === selectedId ? 4 : 2.5}
              fill={statusColor(getEffectiveStatus(nd.task), T)}
              opacity={0.75}
            />
          ))}
          <rect x={1} y={1} width={MM_W - 2} height={MM_H - 2} rx={3}
            fill="none" stroke={T.accent} strokeWidth={1.5} opacity={0.6}
          />
        </svg>
      </div>

      {/* ── Empty filter state ── */}
      {filteredTasks.length === 0 && filter !== 'All' && filter !== 'By topic' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: T.paper, border: `1px solid ${T.hairline}`,
            borderRadius: T.r10, padding: '20px 32px', textAlign: 'center',
            boxShadow: '0 4px 12px rgba(25,25,26,0.08)',
          }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: T.ink60, margin: 0 }}>{filter === 'Overdue' ? t('graph.noOverdue') : t('graph.noInProgress')}</p>
            <p style={{ fontSize: 12, color: T.ink40, marginTop: 4, marginBottom: 0 }}>{t('graph.tryFilter')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
