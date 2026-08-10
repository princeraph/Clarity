// graph.jsx — Connected task graph view. Obsidian-style force-directed node graph
// showing tasks as nodes linked by AI-detected dependencies, subtask relationships,
// and shared topics. Full-window canvas with floating controls.
//
// Trigger: "Graph" sidebar nav item, or Ctrl+G.
// Click a node → task detail panel slides in from right (340px, same as Today view).
// Pan: click-drag on canvas. Zoom: scroll wheel.
//
// This artboard shows a static snapshot of a populated graph — 11 tasks across
// 3 topics (Clarity work, Personal, Reading list) with dependency + subtask edges.

// ─── helpers ────────────────────────────────────────────────────────────────

const statusColor = (s, t) => ({
  not_started: t.ink20,
  in_progress: t.accent,
  done:        t.done,
  overdue:     t.warn,
}[s] || t.ink40);

const statusLabel = s => ({
  not_started: 'Not started',
  in_progress: 'In progress',
  done:        'Done',
  overdue:     'Overdue',
}[s] || s);

// ─── node ───────────────────────────────────────────────────────────────────

const GNode = ({ node, t }) => {
  const NW = 154, NH = 54;
  const { cx, cy, label, topic, status, selected } = node;
  const x = cx - NW / 2, y = cy - NH / 2;

  return (
    <g style={{ cursor: 'pointer' }}>
      {selected && (
        <rect x={x - 2} y={y - 2} width={NW + 4} height={NH + 4} rx={8}
          fill="none"
          style={{ filter: 'drop-shadow(0 8px 20px rgba(25,25,26,0.14))' }}
        />
      )}
      <rect x={x} y={y} width={NW} height={NH} rx={6}
        fill={t.paper}
        stroke={selected ? t.accent : t.hairline}
        strokeWidth={selected ? 2 : 1}
      />
      {/* Topic eyebrow */}
      <text x={x + 10} y={y + 14}
        style={{ fontFamily: t.fontMono, fontSize: 9, textTransform: 'uppercase',
          fill: t.accentInk, letterSpacing: '0.09em' }}>
        {topic}
      </text>
      {/* Title */}
      <text x={x + 10} y={y + 30}
        style={{ fontFamily: t.fontUI, fontSize: 12.5, fontWeight: 500, fill: t.ink }}>
        {label.length > 20 ? label.slice(0, 19) + '…' : label}
      </text>
      {/* Status row */}
      <circle cx={x + 11} cy={y + 44} r={3.5} fill={statusColor(status, t)} />
      <text x={x + 21} y={y + 47.5}
        style={{ fontFamily: t.fontMono, fontSize: 9, fill: t.ink40 }}>
        {statusLabel(status)}
      </text>
    </g>
  );
};

// ─── edge ───────────────────────────────────────────────────────────────────

const GEdge = ({ from, to, type }) => {
  const styles = {
    dependency: { stroke: 'rgba(25,25,26,0.18)', strokeWidth: 1.5, strokeDasharray: undefined, opacity: 1 },
    subtask:    { stroke: 'oklch(0.48 0.13 258)', strokeWidth: 1, strokeDasharray: '4 3', opacity: 0.45 },
    topic:      { stroke: 'rgba(25,25,26,0.36)', strokeWidth: 1, strokeDasharray: '2 5', opacity: 0.40 },
  };
  const s = styles[type] || styles.topic;

  // Offset line endpoints to node edges (approximate)
  const dx = to.cx - from.cx, dy = to.cy - from.cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist, uy = dy / dist;
  const offset = 28;
  const x1 = from.cx + ux * offset, y1 = from.cy + uy * offset;
  const x2 = to.cx - ux * offset,   y2 = to.cy - uy * offset;

  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={s.stroke}
      strokeWidth={s.strokeWidth}
      strokeDasharray={s.strokeDasharray}
      opacity={s.opacity}
      markerEnd={type === 'dependency' ? 'url(#arrowhead)' : undefined}
    />
  );
};

// ─── main component ──────────────────────────────────────────────────────────

const GraphView = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const W = 1280, H = 760;

  const nodes = [
    { id: 1,  label: 'Draft Clarity onboarding',  topic: 'Clarity (work)',  status: 'in_progress', cx: 360, cy: 260, selected: true },
    { id: 2,  label: 'Finalize feature spec',      topic: 'Clarity (work)',  status: 'not_started', cx: 190, cy: 390 },
    { id: 3,  label: 'Review PR feedback',         topic: 'Clarity (work)',  status: 'in_progress', cx: 510, cy: 340 },
    { id: 4,  label: 'Set up test environment',    topic: 'Clarity (work)',  status: 'not_started', cx: 310, cy: 460 },
    { id: 5,  label: 'Call the dentist',           topic: 'Personal',        status: 'not_started', cx: 740, cy: 155 },
    { id: 6,  label: 'Renew domain',               topic: 'Personal',        status: 'not_started', cx: 910, cy: 215 },
    { id: 7,  label: 'Confirm dinner',             topic: 'Personal',        status: 'done',        cx: 840, cy: 320 },
    { id: 8,  label: 'Walk 16:30',                 topic: 'Personal',        status: 'not_started', cx: 680, cy: 380 },
    { id: 9,  label: 'Read WWDC recap',            topic: 'Reading list',    status: 'not_started', cx: 820, cy: 520 },
    { id: 10, label: 'Finish Atomic Habits',       topic: 'Reading list',    status: 'in_progress', cx: 975, cy: 575 },
    { id: 11, label: 'Watch Design talk',          topic: 'Reading list',    status: 'not_started', cx: 765, cy: 630 },
  ];

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const edges = [
    { from: 2, to: 1, type: 'dependency' },
    { from: 4, to: 2, type: 'dependency' },
    { from: 9, to: 10, type: 'dependency' },
    { from: 3, to: 1, type: 'subtask' },
    { from: 1, to: 3, type: 'topic' },
    { from: 5, to: 6, type: 'topic' },
    { from: 5, to: 7, type: 'topic' },
    { from: 9, to: 11, type: 'topic' },
    { from: 6, to: 8, type: 'topic' },
  ];

  // Cluster hull rects
  const clusters = [
    { label: 'CLARITY (WORK)',  x: 90,  y: 155, w: 500, h: 375, hue: 258 },
    { label: 'PERSONAL',        x: 610, y: 90,  w: 385, h: 355, hue: 155 },
    { label: 'READING LIST',    x: 690, y: 455, w: 370, h: 225, hue: 65  },
  ];

  const clusterFill = hue => `oklch(0.93 0.04 ${hue})`;

  const MM_W = 120, MM_H = 78;
  const mmX = cx => (cx / W) * MM_W;
  const mmY = cy => (cy / H) * MM_H;

  return (
    <div style={{
      width: W, height: H,
      background: t.paper,
      position: 'relative',
      fontFamily: t.fontUI,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* ── Canvas SVG ── */}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <marker id="arrowhead" markerWidth={7} markerHeight={7} refX={5} refY={3.5} orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill="rgba(25,25,26,0.22)" />
          </marker>
        </defs>

        {/* Cluster regions */}
        {clusters.map((c, i) => (
          <g key={i}>
            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={20}
              fill={clusterFill(c.hue)} opacity={0.22} />
            <text x={c.x + 16} y={c.y + 22}
              style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em',
                fill: t.ink60, textTransform: 'uppercase' }}>
              {c.label}
            </text>
          </g>
        ))}

        {/* Edges — below nodes */}
        {edges.map((e, i) => (
          <GEdge key={i} from={nodeMap[e.from]} to={nodeMap[e.to]} type={e.type} />
        ))}

        {/* Nodes */}
        {nodes.map(n => <GNode key={n.id} node={n} t={t} />)}
      </svg>

      {/* ── Top-left panel ── */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: t.paper, borderRadius: t.r10,
        border: `1px solid ${t.hairline}`,
        boxShadow: '0 4px 12px rgba(25,25,26,0.08)',
        padding: '9px 14px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 12.5, color: t.ink60, cursor: 'pointer' }}>← Today</span>
        <span style={{ width: 1, height: 13, background: t.hairline }} />
        <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: t.ink40 }}>Graph</span>
        <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink60 }}>100%</span>
      </div>

      {/* ── Top-right filter pills ── */}
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 6 }}>
        {['All', 'By topic', 'In progress', 'Overdue'].map((label, i) => (
          <div key={label} style={{
            borderRadius: t.rPill,
            padding: '5px 12px',
            fontSize: 12,
            background: i === 0 ? t.ink : t.paper,
            color: i === 0 ? t.paper : t.ink80,
            border: `1px solid ${i === 0 ? t.ink : t.hairline}`,
            fontWeight: i === 0 ? 500 : 400,
            cursor: 'pointer',
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* ── Bottom-right minimap ── */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        width: MM_W, height: MM_H,
        background: t.paper, borderRadius: t.r6,
        border: `1px solid ${t.hairline}`,
        opacity: 0.88, overflow: 'hidden',
      }}>
        <svg width={MM_W} height={MM_H}>
          {clusters.map((c, i) => (
            <rect key={i}
              x={mmX(c.x)} y={mmY(c.y)}
              width={mmX(c.w)} height={mmY(c.h)}
              rx={3} fill={clusterFill(c.hue)} opacity={0.3}
            />
          ))}
          {nodes.map(n => (
            <circle key={n.id}
              cx={mmX(n.cx)} cy={mmY(n.cy)}
              r={n.selected ? 4 : 2.5}
              fill={statusColor(n.status, t)}
              opacity={0.75}
            />
          ))}
          <rect x={1} y={1} width={MM_W - 2} height={MM_H - 2} rx={3}
            fill="none" stroke={t.accent} strokeWidth={1.5} opacity={0.6}
          />
        </svg>
      </div>

      {/* ── Bottom-left legend ── */}
      <div style={{
        position: 'absolute', bottom: 20, left: 16,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {/* Edge types */}
        <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: t.ink40, fontFamily: t.fontMono }}>
          <span>—— Dependency</span>
          <span>- - Subtask</span>
          <span>··· Same topic</span>
        </div>
        {/* Status dots */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {[['not_started','Not started'],['in_progress','In progress'],['done','Done'],['overdue','Overdue']].map(([s, l]) => (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4,
              fontFamily: t.fontMono, fontSize: 10, color: t.ink40 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%',
                background: statusColor(s, t), display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Hover tooltip stub (shown on node 1 as example) ── */}
      <div style={{
        position: 'absolute',
        left: 360 + 90, top: 260 - 44,
        background: t.paper, borderRadius: t.r6,
        border: `1px solid ${t.hairline}`,
        boxShadow: '0 4px 12px rgba(25,25,26,0.10)',
        padding: '7px 11px',
        fontSize: 11.5, color: t.ink60,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink40, marginRight: 6 }}>
          CLICK TO OPEN
        </span>
        Draft Clarity onboarding · in_progress · 2h est.
      </div>
    </div>
  );
};

window.GraphView = GraphView;
