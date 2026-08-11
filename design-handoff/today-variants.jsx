// today-variants.jsx — three artboard-ready interaction states for the Today view.
// 1. TodayViewWithDetail       — task detail panel open (right column)
// 2. TodayViewCollapsed        — sidebar reduced to a 52px icon rail
// 3. TodayViewWithContextMenu  — Win11 right-click context menu visible on a task row

// ── Shared mini SVG nav icons (for collapsed rail) ───────────────────────────

const IcoInbox = ({ c }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2" width="13" height="12" rx="1.75" stroke={c} strokeWidth="1.2" />
    <path d="M1.5 9.5h3l1.5 2h4l1.5-2H14.5" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
const IcoToday = ({ c, a }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke={c} strokeWidth="1.2" />
    <circle cx="8" cy="8" r="2.5" fill={a || c} />
  </svg>
);
const IcoUpcoming = ({ c }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.75" y="3" width="12.5" height="11.25" rx="1.75" stroke={c} strokeWidth="1.2" />
    <path d="M1.75 6.5h12.5" stroke={c} strokeWidth="1.2" />
    <path d="M5.5 1.5v3M10.5 1.5v3" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
const IcoAnytime = ({ c }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
const IcoSomeday = ({ c }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 2h8v12.5L8 12l-4 2.5V2Z" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

// ── 1. Task detail variant ───────────────────────────────────────────────────

const TodayViewWithDetail = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', width: '100%', height: '100%',
      overflow: 'hidden', background: t.paper,
    }}>
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex' }}>
        <window.TodayView />
      </div>
      <window.TaskDetailPanel />
    </div>
  );
};

// ── 2. Collapsed sidebar variant ─────────────────────────────────────────────

const CollapsedSidebar = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const items = [
    { key: 'inbox',    Icon: IcoInbox },
    { key: 'today',    Icon: IcoToday, active: true },
    { key: 'upcoming', Icon: IcoUpcoming },
    { key: 'anytime',  Icon: IcoAnytime },
    { key: 'archive',  Icon: IcoSomeday },
  ];
  return (
    <aside style={{
      width: 52, flexShrink: 0,
      borderRight: `1px solid ${t.hairline}`,
      background: t.paperSubtle,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 6px 14px', boxSizing: 'border-box',
    }}>
      {/* Brand mark */}
      <div style={{ marginBottom: 18 }}>
        <window.ApertureMark s={20} />
      </div>

      {/* Icon nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        {items.map(({ key, Icon, active }) => (
          <div key={key} style={{
            width: '100%', height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: t.r6,
            background: active ? t.paper : 'transparent',
            boxShadow: active ? `inset 0 0 0 1px ${t.hairline}` : 'none',
            cursor: 'pointer',
          }}>
            <Icon c={active ? t.ink : t.ink40} a={active ? t.accent : undefined} />
          </div>
        ))}
      </div>

      {/* Expand chevron hint */}
      <div style={{ marginTop: 12 }}>
        <div style={{
          width: 26, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: t.r6, border: `1px solid ${t.hairline}`,
          background: t.paper, cursor: 'pointer',
        }}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2 2l3 2-3 2" stroke={window.CLARITY_TOKENS.ink40} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Bottom: status + avatar */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', display: 'block',
          background: t.done, boxShadow: `0 0 0 3px ${t.done}30`,
        }}></span>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: t.ink, color: t.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10.5, fontWeight: 600, fontFamily: t.fontUI,
        }}>R</div>
      </div>
    </aside>
  );
};

const TodayViewCollapsed = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', width: '100%', height: '100%',
      overflow: 'hidden', background: t.paper, color: t.ink, fontFamily: t.fontUI,
    }}>
      <CollapsedSidebar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <window.ClarityMain />
      </div>
    </div>
  );
};

// ── 3. Right-click context menu variant ──────────────────────────────────────

const CtxDivider = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return <div style={{ height: 1, background: t.hairline, margin: '3px 0' }}></div>;
};

const CtxItem = ({ icon, label, danger, kbd, submenu }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 12px', height: 30,
      fontSize: 12.5,
      color: danger ? 'oklch(0.52 0.15 25)' : t.ink,
      cursor: 'pointer', userSelect: 'none',
    }}>
      <span style={{ width: 16, textAlign: 'center', fontSize: 12, opacity: 0.65 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {kbd && (
        <span style={{
          fontFamily: t.fontMono, fontSize: 10, color: t.ink40,
          background: t.paperMuted, padding: '1px 5px', borderRadius: 3,
          border: `1px solid ${t.hairline}`,
        }}>{kbd}</span>
      )}
      {submenu && <span style={{ color: t.ink40, fontSize: 11 }}>›</span>}
    </div>
  );
};

const ContextMenu = ({ top, left }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      position: 'absolute', top, left,
      width: 224,
      background: t.paper,
      border: `1px solid ${t.hairline}`,
      borderRadius: t.r6,
      boxShadow: '0 8px 20px rgba(25,25,26,0.14), 0 1px 4px rgba(25,25,26,0.07)',
      padding: '4px 0',
      zIndex: 999,
      fontFamily: t.fontUI,
    }}>
      <CtxItem icon="✓" label="Mark complete" kbd="Space" />
      <CtxItem icon="↗" label="Open detail" kbd="↵" />
      <CtxDivider />
      <CtxItem icon="◷" label="Schedule…" submenu />
      <CtxItem icon="⤢" label="Move to topic" submenu />
      <CtxItem icon="⊕" label="Add subtask" />
      <CtxDivider />
      <CtxItem icon="⌫" label="Delete" danger kbd="Del" />
    </div>
  );
};

const TodayViewWithContextMenu = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <window.TodayView />
      {/* Positioned over the "Reply to Maya" task row */}
      <ContextMenu top={368} left={420} />
    </div>
  );
};

window.TodayViewWithDetail      = TodayViewWithDetail;
window.TodayViewCollapsed       = TodayViewCollapsed;
window.TodayViewWithContextMenu = TodayViewWithContextMenu;
