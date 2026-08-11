// empty-states.jsx — Zero-state screens for Inbox, Today, and Archive.
// Friendly, type-led, never just a blank box. Each has a subtle illustration
// built from SVG primitives, a short headline, and a single CTA.

const EmptyInbox = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <EmptyShell>
      <InboxIllo t={t} />
      <EmptyTitle>Inbox zero.</EmptyTitle>
      <EmptyBody>Everything that came in has been sorted. Capture something new, or enjoy the quiet.</EmptyBody>
      <EmptyCTA label="Capture a task" kbd="Ctrl+K" t={t} />
    </EmptyShell>
  );
};

const EmptyToday = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <EmptyShell>
      <TodayIllo t={t} />
      <EmptyTitle>Nothing scheduled today.</EmptyTitle>
      <EmptyBody>Your day is open. Move something from Upcoming, or let Clarity suggest a plan from your backlog.</EmptyBody>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <EmptyCTA label="Ask Clarity to plan" kbd="Ctrl+/" t={t} accent />
        <EmptyCTA label="Browse upcoming" t={t} ghost />
      </div>
    </EmptyShell>
  );
};

const EmptySomeday = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <EmptyShell>
      <SomedayIllo t={t} />
      <EmptyTitle>Ideas live here.</EmptyTitle>
      <EmptyBody>Archive is for things you want to do but not now. No due dates, no pressure — just a place to park what matters eventually.</EmptyBody>
      <EmptyCTA label="Add to Archive" kbd="Ctrl+K" t={t} />
    </EmptyShell>
  );
};

// ── SVG illustrations ─────────────────────────────────────────────────────────

const InboxIllo = ({ t }) => (
  <svg width="96" height="80" viewBox="0 0 96 80" fill="none">
    {/* Tray */}
    <rect x="8" y="36" width="80" height="36" rx="6" fill={t.paperSubtle} stroke={t.hairline} strokeWidth="1.2" />
    {/* Tray lip */}
    <path d="M8 52h18l5 8h26l5-8h34" stroke={t.hairline} strokeWidth="1.2" />
    {/* Sparkle / check */}
    <circle cx="48" cy="26" r="11" fill={t.accentSoft} stroke={t.accent} strokeWidth="1.2" />
    <path d="M43.5 26.5l3 3 6-6" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TodayIllo = ({ t }) => (
  <svg width="96" height="80" viewBox="0 0 96 80" fill="none">
    {/* Calendar */}
    <rect x="14" y="16" width="68" height="56" rx="6" fill={t.paperSubtle} stroke={t.hairline} strokeWidth="1.2" />
    <rect x="14" y="16" width="68" height="18" rx="6" fill={t.paperMuted} />
    <rect x="14" y="28" width="68" height="6" fill={t.paperMuted} />
    {/* Day marks */}
    {[0,1,2,3,4,5,6].map(i => (
      <rect key={i} x={22 + i * 9} y={42} width="5" height="5" rx="1.5" fill={i === 3 ? t.accentSoft : t.hairline} stroke={i === 3 ? t.accent : 'none'} strokeWidth="1" />
    ))}
    {[0,1,2,3,4,5,6].map(i => (
      <rect key={i} x={22 + i * 9} y={54} width="5" height="5" rx="1.5" fill={t.hairline} />
    ))}
    {/* Sun */}
    <circle cx="75" cy="10" r="8" fill="oklch(0.94 0.05 65)" stroke="oklch(0.78 0.10 65)" strokeWidth="1.2" />
    <path d="M75 4v-2M75 18v2M81 6l1.4-1.4M67.6 17.4L66.2 18.8M83 10h2M68 10h-2" stroke="oklch(0.68 0.10 65)" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const SomedayIllo = ({ t }) => (
  <svg width="96" height="80" viewBox="0 0 96 80" fill="none">
    {/* Bookmark stack */}
    <rect x="26" y="18" width="44" height="52" rx="5" fill={t.paperMuted} stroke={t.hairline} strokeWidth="1.2" />
    <rect x="20" y="14" width="44" height="52" rx="5" fill={t.paperSubtle} stroke={t.hairline} strokeWidth="1.2" />
    <path d="M20 14h44v38L42 62 20 52V14Z" fill={t.paper} stroke={t.hairline} strokeWidth="1.2" />
    {/* Lines suggesting tasks */}
    <rect x="28" y="26" width="28" height="2.5" rx="1.25" fill={t.ink20} />
    <rect x="28" y="32" width="20" height="2.5" rx="1.25" fill={t.ink20} />
    <rect x="28" y="38" width="24" height="2.5" rx="1.25" fill={t.ink20} />
    {/* Star */}
    <path d="M42 18l1.5 4.5h4.7l-3.8 2.8 1.4 4.5L42 27l-3.8 2.8 1.4-4.5-3.8-2.8h4.7z" fill={t.accentSoft} stroke={t.accent} strokeWidth="0.8" />
  </svg>
);

// ── Layout primitives ─────────────────────────────────────────────────────────

const EmptyShell = ({ children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink, fontFamily: t.fontUI,
      display: 'grid', gridTemplateColumns: '232px 1fr', overflow: 'hidden',
    }}>
      <EmptySidebar />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: '40px 80px', textAlign: 'center',
      }}>{children}</div>
    </div>
  );
};

const EmptySidebar = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const items = [
    { label: 'Inbox',    count: 0,    active: true },
    { label: 'Today',    count: 0 },
    { label: 'Upcoming', count: 5 },
    { label: 'Anytime',  count: 12 },
    { label: 'Archive',  count: 0 },
    { label: 'History',  count: null },
  ];
  return (
    <aside style={{
      borderRight: `1px solid ${t.hairline}`, padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 28,
      background: t.paperSubtle, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
        <window.ApertureMark s={20} />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>clarity</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: t.r6,
            background: item.active ? t.paper : 'transparent',
            boxShadow: item.active ? `inset 0 0 0 1px ${t.hairline}` : 'none',
            fontSize: 13.5, color: item.active ? t.ink : t.ink80,
            fontWeight: item.active ? 500 : 400,
          }}>
            <span>{item.label}</span>
            {item.count != null && (
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>
                {item.count === 0 ? '—' : item.count}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.ink, color: t.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600 }}>R</div>
        <span style={{ fontSize: 12.5, color: t.ink80 }}>Raph</span>
      </div>
    </aside>
  );
};

const EmptyTitle = ({ children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return <h2 style={{ margin: 0, fontSize: 26, fontWeight: 500, letterSpacing: '-0.03em', color: t.ink }}>{children}</h2>;
};

const EmptyBody = ({ children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return <p style={{ margin: 0, fontSize: 14.5, color: t.ink60, lineHeight: 1.6, maxWidth: 380 }}>{children}</p>;
};

const EmptyCTA = ({ label, kbd, t: tProp, accent, ghost }) => {
  const t = tProp || (window.useT ? window.useT() : window.CLARITY_TOKENS);
  return (
    <button style={{
      fontFamily: t.fontUI, fontSize: 13, fontWeight: 500, cursor: 'pointer',
      padding: '9px 16px', borderRadius: t.r6,
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: ghost ? 'transparent' : accent ? t.accent : t.ink,
      color: ghost ? t.ink60 : t.paper,
      border: ghost ? `1px solid ${t.hairline}` : 'none',
    }}>
      {label}
      {kbd && <span style={{ fontFamily: t.fontMono, fontSize: 10, opacity: 0.6, background: 'rgba(255,255,255,0.15)', padding: '2px 5px', borderRadius: 3 }}>{kbd}</span>}
    </button>
  );
};

window.EmptyInbox   = EmptyInbox;
window.EmptyToday   = EmptyToday;
window.EmptySomeday = EmptySomeday;
