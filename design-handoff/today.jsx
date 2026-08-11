// Today view — the main app surface. Calm, generous whitespace, type-led.
// Sidebar (left) · main column (right). AI presence is a single understated strip.

const TodayView = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      display: 'grid',
      gridTemplateColumns: '232px 1fr',
      overflow: 'hidden',
    }}>
      <Sidebar />
      <Main />
    </div>
  );
};

const Sidebar = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const items = [
    { label: 'Inbox',     count: 4 },
    { label: 'Today',     count: 7, active: true },
    { label: 'Upcoming',  count: 12 },
    { label: 'Anytime',   count: 23 },
    { label: 'Archive',   count: 41 },
    { label: 'History',   count: null },
  ];
  const topics = [
    { label: 'Personal',       count: 6 },
    { label: 'Clarity (work)', count: 14 },
    { label: 'Reading list',   count: 9 },
  ];
  return (
    <aside style={{
      borderRight: `1px solid ${t.hairline}`,
      padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 28,
      background: t.paperSubtle,
      boxSizing: 'border-box',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
        <window.ApertureMark s={20} />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>clarity</span>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: t.paper, border: `1px solid ${t.hairline}`,
        borderRadius: t.r6,
        fontSize: 13, color: t.ink40,
      }}>
        <span>Search or capture</span>
        <span style={{
          marginLeft: 'auto', fontFamily: t.fontMono, fontSize: 10.5, color: t.ink40,
          background: t.paperMuted, padding: '2px 6px', borderRadius: 4,
        }}>Ctrl+K</span>
      </div>

      <NavGroup items={items} />

      {/* Ask Clarity */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px', borderRadius: t.r6,
        fontSize: 13, color: t.ink80,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: t.accent, flexShrink: 0, display: 'inline-block',
          }}></span>
          Ask Clarity
        </div>
        <span style={{
          fontFamily: t.fontMono, fontSize: 10, color: t.ink40,
          background: t.paperMuted, padding: '2px 5px',
          borderRadius: 3, border: `1px solid ${t.hairlineSoft}`,
        }}>Ctrl+/</span>
      </div>

      {/* Topics */}
      <div>
        <div style={{
          fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: t.ink40, padding: '0 10px 10px',
        }}>Topics</div>
        <NavGroup items={topics} />
        {/* + New topic */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: t.r6,
          fontSize: 13, color: t.ink40, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          <span>New topic</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <LocalBadge />
        {/* Export */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: t.r6,
          background: t.paper, border: `1px solid ${t.hairline}`,
          fontSize: 12.5, color: t.ink80, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 11, color: t.ink60 }}>↑</span>
          Export
        </div>
        {/* User + settings gear */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px 2px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: t.ink, color: t.paper,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10.5, fontWeight: 600, flexShrink: 0,
            }}>R</div>
            <div style={{ fontSize: 12.5, color: t.ink80 }}>Raph</div>
          </div>
          {/* Settings gear */}
          <div style={{
            width: 26, height: 26, borderRadius: t.r6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: t.ink40, fontSize: 14, cursor: 'pointer',
          }}>⚙</div>
        </div>
      </div>
    </aside>
  );
};

const NavGroup = ({ items }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map(item => (
        <div key={item.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px', borderRadius: t.r6,
          background: item.active ? t.paper : 'transparent',
          boxShadow: item.active ? `inset 0 0 0 1px ${t.hairline}` : 'none',
          fontSize: 13.5,
          color: item.active ? t.ink : t.ink80,
          fontWeight: item.active ? 500 : 400,
        }}>
          <span>{item.label}</span>
          <span style={{
            fontFamily: t.fontMono, fontSize: 11,
            color: item.active ? t.ink60 : t.ink40,
          }}>{item.count}</span>
        </div>
      ))}
    </div>
  );
};

const LocalBadge = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px',
      background: t.paper, borderRadius: t.r6,
      border: `1px solid ${t.hairline}`,
    }}>
      <span style={{
        position: 'relative', width: 7, height: 7, borderRadius: '50%',
        background: t.done,
      }}>
        <span style={{
          position: 'absolute', inset: -4, borderRadius: '50%',
          border: `1px solid ${t.done}`, opacity: 0.35,
        }}></span>
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
        <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink60 }}>On-device</span>
        <span style={{ fontSize: 11.5, color: t.ink80 }}>Clarity AI · running locally</span>
      </div>
    </div>
  );
};

const Main = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  // Dynamic greeting: before 12 → morning, 12–17 → afternoon, after 17 → evening
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <main style={{
      padding: '36px 56px 0',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column', gap: 28,
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: t.ink60, marginBottom: 8,
          }}>{dateStr}</div>
          <h1 style={{
            margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em',
            color: t.ink,
          }}>{greeting}, Raph.</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Pill>2h 15m focus</Pill>
          <Pill mono>7 · today</Pill>
        </div>
      </header>

      {/* AI plan strip — single understated row */}
      <PlanStrip />

      {/* Task groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, overflow: 'auto', paddingBottom: 40 }}>
        <TaskGroup title="First focus" subtitle="One deep block before noon">
          <Task title="Draft Clarity onboarding flow" meta="2h · today" focus />
        </TaskGroup>

        <TaskGroup title="Quick wins" subtitle="Under 15 min each — clear before lunch">
          <Task title="Reply to Maya re: contractor dates" meta="email" />
          <Task title="Renew domain — clarity.app" meta="≈ 5 min" />
          <Task title="Confirm Thursday dinner with N." meta="message" />
        </TaskGroup>

        <TaskGroup title="Loose threads" subtitle="Surfacing because they've been sitting" muted>
          <Task title="Read Annie's draft and send notes" meta="stale · 6 days" stale />
          <Task title="Cancel old Figma seat" meta="stale · 11 days" stale />
        </TaskGroup>

        <TaskGroup title="Later today" subtitle="Scheduled" muted>
          <Task title="Walk · 16:30" meta="recurring" />
          <Task title="Call with Sam — onboarding review" meta="17:00 · 30 min" />
        </TaskGroup>
      </div>
    </main>
  );
};

const Pill = ({ mono, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      fontFamily: mono ? t.fontMono : t.fontUI,
      fontSize: mono ? 11 : 12.5,
      letterSpacing: mono ? '0.06em' : '0',
      textTransform: mono ? 'uppercase' : 'none',
      color: t.ink80,
      padding: '6px 10px',
      border: `1px solid ${t.hairline}`,
      borderRadius: t.rPill,
      background: t.paper,
    }}>{children}</span>
  );
};

const PlanStrip = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16,
      padding: '14px 18px',
      background: t.accentSoft,
      border: `1px solid ${t.hairline}`,
      borderRadius: t.r10,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: `1.5px solid ${t.accentInk}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent }}></span>
      </div>
      <div style={{ fontSize: 14, color: t.accentInk, lineHeight: 1.4 }}>
        Today is light on meetings. <span style={{ color: t.ink }}>Suggested plan:</span> one deep block this morning, then four quick wins. Two stale items worth a glance.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{
          fontFamily: t.fontUI, fontSize: 12.5, fontWeight: 500,
          color: t.paper, background: t.ink,
          border: 'none', padding: '7px 12px', borderRadius: t.r6,
          cursor: 'pointer',
        }}>Accept</button>
        <button style={{
          fontFamily: t.fontUI, fontSize: 12.5,
          color: t.ink80, background: 'transparent',
          border: `1px solid ${t.hairline}`, padding: '7px 12px', borderRadius: t.r6,
          cursor: 'pointer',
        }}>Adjust</button>
      </div>
    </div>
  );
};

const TaskGroup = ({ title, subtitle, muted, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <h3 style={{
          margin: 0, fontSize: 13.5, fontWeight: 500,
          color: muted ? t.ink60 : t.ink,
          letterSpacing: '-0.005em',
        }}>{title}</h3>
        <span style={{
          fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.06em',
          color: t.ink40,
        }}>{subtitle}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </section>
  );
};

const Task = ({ title, meta, focus, stale }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '20px 1fr auto', alignItems: 'center', gap: 14,
      padding: '12px 4px',
      borderBottom: `1px solid ${t.hairlineSoft}`,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%',
        border: `1.5px solid ${focus ? t.accent : (stale ? t.warn : t.ink40)}`,
        background: 'transparent',
      }}></div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <span style={{
          fontSize: 14.5, color: t.ink,
          fontWeight: focus ? 500 : 400,
          letterSpacing: '-0.005em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</span>
        {focus && (
          <span style={{
            fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: t.accentInk,
            padding: '2px 6px', background: t.accentSoft, borderRadius: 3,
          }}>Focus</span>
        )}
      </div>
      <span style={{
        fontFamily: t.fontMono, fontSize: 11,
        color: stale ? t.warn : t.ink40,
        whiteSpace: 'nowrap',
      }}>{meta}</span>
    </div>
  );
};

window.TodayView = TodayView;
window.ClarityMain = Main;
