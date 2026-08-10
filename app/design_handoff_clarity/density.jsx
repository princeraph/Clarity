// density.jsx — Three density variants of the Today task list side by side.
// Spacious / Balanced / Compact — same tasks, different rhythm.
// Each variant shown as its own artboard (1280×800) with full shell.

const DENSITY_TASKS = [
  { title: 'Draft Clarity onboarding flow', meta: '2h · focus', focus: true },
  { title: 'Reply to Maya re: contractor dates', meta: 'email' },
  { title: 'Renew domain — clarity.app', meta: '≈ 5 min' },
  { title: 'Confirm Thursday dinner', meta: 'message' },
  { title: 'Read Annie\'s draft and send notes', meta: 'stale · 6d', stale: true },
  { title: 'Walk · 16:30', meta: 'recurring' },
];

// ── Density configs ───────────────────────────────────────────────────────────
const DENSITY = {
  spacious: {
    label: 'Spacious',
    desc: 'Generous whitespace. Best for focus and reading-heavy days.',
    taskPadV: 16, taskPadH: 6,
    checkSize: 18, titleSize: 15.5, metaSize: 12,
    groupGap: 36, headerMB: 16,
    sectionTitleSize: 14, sectionSubSize: 11.5,
    divider: 'rgba(25,25,26,0.06)',
  },
  balanced: {
    label: 'Balanced',
    desc: 'Default. Comfortable density for most people.',
    taskPadV: 12, taskPadH: 4,
    checkSize: 16, titleSize: 14.5, metaSize: 11,
    groupGap: 26, headerMB: 12,
    sectionTitleSize: 13.5, sectionSubSize: 10.5,
    divider: 'rgba(25,25,26,0.05)',
  },
  compact: {
    label: 'Compact',
    desc: 'Maximum information. When the list is long and time is short.',
    taskPadV: 7, taskPadH: 2,
    checkSize: 13, titleSize: 13, metaSize: 10.5,
    groupGap: 18, headerMB: 8,
    sectionTitleSize: 12.5, sectionSubSize: 10,
    divider: 'rgba(25,25,26,0.05)',
  },
};

const DensityView = ({ density }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const d = DENSITY[density];

  return (
    <div style={{
      width: '100%', height: '100%', background: t.paper, color: t.ink,
      fontFamily: t.fontUI, display: 'grid', gridTemplateColumns: '200px 1fr', overflow: 'hidden',
    }}>
      {/* Minimal sidebar */}
      <aside style={{
        background: t.paperSubtle, borderRight: `1px solid ${t.hairline}`,
        padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', marginBottom: 8 }}>
          <window.ApertureMark s={16} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em' }}>clarity</span>
        </div>
        {['Inbox','Today','Upcoming','Anytime','Archive'].map((label, i) => (
          <div key={label} style={{
            padding: '6px 8px', borderRadius: t.r6, fontSize: 13,
            background: i===1 ? t.paper : 'transparent',
            boxShadow: i===1 ? `inset 0 0 0 1px ${t.hairline}` : 'none',
            color: i===1 ? t.ink : t.ink60, fontWeight: i===1 ? 500 : 400,
          }}>{label}</div>
        ))}

        {/* Density badge */}
        <div style={{ marginTop: 'auto', padding: '6px 8px' }}>
          <div style={{
            padding: '6px 8px', background: t.accentSoft, border: `1px solid ${t.accent}`,
            borderRadius: t.r6, display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.accentInk }}>Density</span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: t.accentInk }}>{d.label}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ padding: density === 'spacious' ? '40px 56px 0' : density === 'balanced' ? '36px 48px 0' : '24px 36px 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: density === 'spacious' ? 28 : density === 'balanced' ? 22 : 16, boxSizing: 'border-box' }}>
        {/* Header */}
        <header>
          <div style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink60, marginBottom: density === 'compact' ? 4 : 8 }}>Saturday · 24 May</div>
          <h1 style={{ margin: 0, fontSize: density === 'spacious' ? 36 : density === 'balanced' ? 32 : 24, fontWeight: 500, letterSpacing: '-0.035em', color: t.ink }}>Today</h1>
        </header>

        {/* Description */}
        <div style={{ padding: '8px 12px', background: t.paperSubtle, borderRadius: t.r6, border: `1px solid ${t.hairline}`, fontSize: 12, color: t.ink60, lineHeight: 1.5 }}>
          {d.desc}
        </div>

        {/* Task groups */}
        <div style={{ overflow: 'auto', paddingBottom: 32, display: 'flex', flexDirection: 'column', gap: d.groupGap }}>
          {[
            { title: 'First focus', sub: 'One deep block', tasks: DENSITY_TASKS.slice(0,1) },
            { title: 'Quick wins', sub: 'Under 15 min', tasks: DENSITY_TASKS.slice(1,4) },
            { title: 'Loose threads', sub: 'Stale', tasks: DENSITY_TASKS.slice(4,5), muted: true },
            { title: 'Later today', sub: 'Scheduled', tasks: DENSITY_TASKS.slice(5), muted: true },
          ].map(g => (
            <section key={g.title}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: d.headerMB }}>
                <h3 style={{ margin: 0, fontSize: d.sectionTitleSize, fontWeight: 500, color: g.muted ? t.ink60 : t.ink, letterSpacing: '-0.005em' }}>{g.title}</h3>
                <span style={{ fontFamily: t.fontMono, fontSize: d.sectionSubSize, color: t.ink40 }}>{g.sub}</span>
              </div>
              {g.tasks.map((task, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: `${d.checkSize}px 1fr auto`,
                  alignItems: 'center', gap: density === 'compact' ? 10 : 14,
                  padding: `${d.taskPadV}px ${d.taskPadH}px`,
                  borderBottom: `1px solid ${d.divider}`,
                }}>
                  <div style={{ width: d.checkSize, height: d.checkSize, borderRadius: '50%', border: `${density === 'compact' ? 1.2 : 1.5}px solid ${task.focus ? t.accent : task.stale ? t.warn : t.ink40}` }}></div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: d.titleSize, color: t.ink, fontWeight: task.focus ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    {task.focus && density !== 'compact' && <span style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.accentInk, padding: '2px 5px', background: t.accentSoft, borderRadius: 3, flexShrink: 0 }}>Focus</span>}
                  </div>
                  <span style={{ fontFamily: t.fontMono, fontSize: d.metaSize, color: task.stale ? t.warn : t.ink40, whiteSpace: 'nowrap' }}>{task.meta}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
};

window.DensityView = DensityView;
