// area-detail.jsx — Topic detail view.
// Clicking a topic in the sidebar shows all its tasks grouped by list,
// with a progress summary strip at the top.

const AreaDetailView = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const done = 5, total = 14;
  const pct = (done / total) * 100;

  const groups = [
    {
      label: 'Today', count: 3,
      tasks: [
        { title: 'Draft Clarity onboarding flow', meta: '2h · focus', focus: true },
        { title: 'Reply to Maya re: contractor dates', meta: 'email' },
        { title: 'Renew domain — clarity.app', meta: '≈ 5 min' },
      ],
    },
    {
      label: 'Upcoming', count: 5,
      tasks: [
        { title: 'Prepare Q3 roadmap slide deck', meta: 'Thu 29 May' },
        { title: 'Review contractor agreement', meta: 'Fri 30 May' },
        { title: 'Send Clarity demo to board', meta: 'Mon 2 Jun' },
        { title: 'Set up analytics dashboard', meta: 'Week of Jun 8' },
        { title: 'Deprecate old API endpoints', meta: 'Week of Jun 8' },
      ],
    },
    {
      label: 'Archive', count: 6,
      tasks: [
        { title: 'Write Clarity blog post — why local AI', meta: '' },
        { title: 'Explore Windows widget API', meta: '' },
        { title: 'Build import from Todoist', meta: '' },
      ],
    },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', background: t.paper, color: t.ink,
      fontFamily: t.fontUI, display: 'grid', gridTemplateColumns: '232px 1fr', overflow: 'hidden',
    }}>
      {/* Sidebar with area highlighted */}
      <aside style={{
        borderRight: `1px solid ${t.hairline}`, padding: '20px 16px',
        display: 'flex', flexDirection: 'column', gap: 28,
        background: t.paperSubtle, boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
          <window.ApertureMark s={20} /><span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>clarity</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {['Inbox','Today','Upcoming','Anytime','Archive'].map(label => (
            <div key={label} style={{ padding: '7px 10px', borderRadius: t.r6, fontSize: 13.5, color: t.ink60 }}>{label}</div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.ink40, padding: '0 10px 10px' }}>Topics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { label: 'Personal',       count: 6 },
              { label: 'Clarity (work)', count: 14, active: true },
              { label: 'Reading list',   count: 9 },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px', borderRadius: t.r6,
                background: item.active ? t.paper : 'transparent',
                boxShadow: item.active ? `inset 0 0 0 1px ${t.hairline}` : 'none',
                fontSize: 13.5, color: item.active ? t.ink : t.ink80, fontWeight: item.active ? 500 : 400,
              }}>
                <span>{item.label}</span>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: item.active ? t.ink60 : t.ink40 }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 'auto', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: t.ink, color: t.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600 }}>R</div>
          <span style={{ fontSize: 12.5, color: t.ink80 }}>Raph</span>
        </div>
      </aside>

      {/* Main topic detail */}
      <main style={{ padding: '36px 56px 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 28, boxSizing: 'border-box' }}>
        {/* Topic header */}
        <header>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink60, marginBottom: 8 }}>Topic</div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 500, letterSpacing: '-0.035em', color: t.ink }}>Clarity (work)</h1>
        </header>

        {/* Progress summary strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center',
          padding: '14px 18px', background: t.paperSubtle,
          border: `1px solid ${t.hairline}`, borderRadius: t.r10,
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: t.ink80 }}>Progress this week</span>
              <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.ink60 }}>{done} of {total} done</span>
            </div>
            <div style={{ height: 6, background: t.paperMuted, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: t.done, borderRadius: 999, transition: 'width 600ms ease' }}></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Today', value: 3 },
              { label: 'Upcoming', value: 5 },
              { label: 'Archive', value: 6 },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em', color: t.ink }}>{s.value}</div>
                <div style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.ink40, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Task groups */}
        <div style={{ overflow: 'auto', paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map(g => (
            <section key={g.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: t.ink, letterSpacing: '-0.005em' }}>{g.label}</h3>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>{g.count}</span>
              </div>
              {g.tasks.map((task, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '20px 1fr auto', alignItems: 'center', gap: 14,
                  padding: '10px 4px', borderBottom: `1px solid ${t.hairlineSoft}`,
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${task.focus ? t.accent : t.ink40}` }}></div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 14, color: t.ink, fontWeight: task.focus ? 500 : 400 }}>{task.title}</span>
                    {task.focus && <span style={{ fontFamily: t.fontMono, fontSize: 10, textTransform: 'uppercase', color: t.accentInk, background: t.accentSoft, padding: '2px 5px', borderRadius: 3 }}>Focus</span>}
                  </div>
                  <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40, whiteSpace: 'nowrap' }}>{task.meta}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
};

window.AreaDetailView = AreaDetailView;
