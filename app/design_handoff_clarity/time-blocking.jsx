// time-blocking.jsx — Today view with 24h time blocking strip.
// A compact timeline showing focus blocks, meetings, and free slots
// sits between the header and the AI plan strip.

const TIME_BLOCKS = [
  { start: 6,    end: 9,    type: 'free',    label: 'Free' },
  { start: 9,    end: 11.5, type: 'focus',   label: 'Deep work · Clarity onboarding' },
  { start: 11.5, end: 12,   type: 'free',    label: 'Free' },
  { start: 12,   end: 13,   type: 'away',    label: 'Lunch' },
  { start: 13,   end: 15,   type: 'free',    label: 'Free' },
  { start: 15,   end: 16,   type: 'meeting', label: 'Sync — design review' },
  { start: 16,   end: 17,   type: 'free',    label: 'Walk + wrap-up' },
  { start: 17,   end: 17.5, type: 'meeting', label: 'Call with Sam' },
  { start: 17.5, end: 21,   type: 'free',    label: 'Evening' },
];

const DAY_START = 6;
const DAY_END   = 21;
const DAY_SPAN  = DAY_END - DAY_START;
const NOW_HOUR  = 9.5; // 09:30

const pct = (h) => ((h - DAY_START) / DAY_SPAN) * 100;
const dur = (s, e) => ((e - s) / DAY_SPAN) * 100;

const BLOCK_COLORS = {
  focus:   { bg: 'oklch(0.92 0.05 258)', border: 'oklch(0.75 0.10 258)', label: 'oklch(0.38 0.12 258)' },
  meeting: { bg: 'oklch(0.94 0.05 65)',  border: 'oklch(0.78 0.10 65)',  label: 'oklch(0.45 0.10 65)'  },
  away:    { bg: 'oklch(0.94 0.02 0)',   border: 'oklch(0.84 0.03 0)',   label: 'oklch(0.55 0.04 0)'   },
  free:    { bg: 'transparent',          border: 'transparent',          label: 'transparent'           },
};

const HOUR_MARKS = [6, 8, 10, 12, 14, 16, 18, 20];
const fmtH = (h) => h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`;

const TimeBlockingStrip = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const [hovered, setHovered] = React.useState(null);

  return (
    <div style={{
      padding: '12px 18px',
      background: t.paperSubtle,
      border: `1px solid ${t.hairline}`,
      borderRadius: t.r10,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <div style={{
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40 }}>Timeline</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <TBLegend color={BLOCK_COLORS.focus}   label="Focus" t={t} />
            <TBLegend color={BLOCK_COLORS.meeting} label="Meeting" t={t} />
            <TBLegend color={BLOCK_COLORS.away}    label="Away" t={t} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: t.ink60 }}>
            <span style={{ fontWeight: 500, color: t.ink }}>4h 30m</span> focus remaining
          </span>
          <span style={{ fontSize: 11.5, color: t.ink60 }}>
            <span style={{ fontWeight: 500, color: t.ink }}>1</span> meeting
          </span>
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: 28 }}>
        {/* Track */}
        <div style={{
          position: 'absolute', inset: '8px 0',
          background: t.paperMuted, borderRadius: 4,
          overflow: 'hidden',
        }}>
          {TIME_BLOCKS.map((b, i) => {
            if (b.type === 'free') return null;
            const c = BLOCK_COLORS[b.type];
            return (
              <div
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'absolute',
                  left: `${pct(b.start)}%`,
                  width: `${dur(b.start, b.end)}%`,
                  top: 0, bottom: 0,
                  background: c.bg,
                  borderLeft: `2px solid ${c.border}`,
                  cursor: 'default',
                  transition: 'filter 0.1s',
                  filter: hovered === i ? 'brightness(0.95)' : 'none',
                }}
              ></div>
            );
          })}

          {/* Now indicator */}
          <div style={{
            position: 'absolute',
            left: `${pct(NOW_HOUR)}%`,
            top: 0, bottom: 0, width: 2,
            background: 'oklch(0.52 0.15 25)',
            zIndex: 2,
          }}>
            <div style={{
              position: 'absolute', top: -3, left: -3,
              width: 8, height: 8, borderRadius: '50%',
              background: 'oklch(0.52 0.15 25)',
            }}></div>
          </div>
        </div>

        {/* Hour marks */}
        {HOUR_MARKS.map(h => (
          <div key={h} style={{
            position: 'absolute',
            left: `${pct(h)}%`,
            top: 0,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <div style={{ width: 1, height: 6, background: t.hairline }}></div>
            <span style={{ fontFamily: t.fontMono, fontSize: 9, color: t.ink40, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              {fmtH(h)}
            </span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hovered !== null && TIME_BLOCKS[hovered].type !== 'free' && (() => {
        const b = TIME_BLOCKS[hovered];
        const c = BLOCK_COLORS[b.type];
        const startH = Math.floor(b.start);
        const startM = (b.start % 1) * 60;
        const endH   = Math.floor(b.end);
        const endM   = (b.end % 1) * 60;
        const fmt = (h, m) => `${h}:${String(m).padStart(2,'0')}`;
        return (
          <div style={{
            marginTop: 8, padding: '6px 10px',
            background: t.paper, border: `1px solid ${t.hairline}`, borderRadius: t.r6,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c.border, flexShrink: 0 }}></div>
            <span style={{ fontSize: 12.5, color: t.ink, fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>
              {fmt(startH, startM)} – {fmt(endH, endM)}
            </span>
          </div>
        );
      })()}
    </div>
  );
};

const TBLegend = ({ color, label, t }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.ink60 }}>
    <span style={{ width: 8, height: 8, borderRadius: 2, background: color.border }}></span>
    {label}
  </span>
);

// TodayViewWithTimeline removed — use TodayWithTimelineView (self-contained) instead.

// Full self-contained variant (sidebar + main with timeline)
const TodayWithTimelineView = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      display: 'grid', gridTemplateColumns: '232px 1fr',
      overflow: 'hidden',
    }}>
      <TLSidebar />
      <TLMain />
    </div>
  );
};

// Sidebar — matches today.jsx Sidebar exactly (Topics, Ask Clarity, Export, gear)
const TLSidebar = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const items = [
    { label: 'Inbox',    count: 4 },
    { label: 'Today',    count: 7, active: true },
    { label: 'Upcoming', count: 12 },
    { label: 'Anytime',  count: 23 },
    { label: 'Archive',  count: 41 },
    { label: 'History',  count: null },
  ];
  const topics = [
    { label: 'Personal',       count: 6 },
    { label: 'Clarity (work)', count: 14 },
    { label: 'Reading list',   count: 9 },
  ];
  return (
    <aside style={{
      borderRight: `1px solid ${t.hairline}`,
      padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 28,
      background: t.paperSubtle, boxSizing: 'border-box',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
        <window.ApertureMark s={20} />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>clarity</span>
      </div>

      {/* Search / capture */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: t.paper, border: `1px solid ${t.hairline}`,
        borderRadius: t.r6, fontSize: 13, color: t.ink40,
      }}>
        <span>Search or capture</span>
        <span style={{ marginLeft: 'auto', fontFamily: t.fontMono, fontSize: 10.5, color: t.ink40, background: t.paperMuted, padding: '2px 6px', borderRadius: 4 }}>Ctrl+K</span>
      </div>

      {/* Primary nav */}
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
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: item.active ? t.ink60 : t.ink40 }}>{item.count}</span>
            )}
          </div>
        ))}
      </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {topics.map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 10px', borderRadius: t.r6,
              fontSize: 13.5, color: t.ink80,
            }}>
              <span>{item.label}</span>
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>{item.count}</span>
            </div>
          ))}
        </div>
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
        {/* On-device badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px',
          background: t.paper, borderRadius: t.r6,
          border: `1px solid ${t.hairline}`,
        }}>
          <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: t.done }}>
            <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1px solid ${t.done}`, opacity: 0.35 }}></span>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink60 }}>On-device</span>
            <span style={{ fontSize: 11.5, color: t.ink80 }}>Clarity AI · running locally</span>
          </div>
        </div>
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

const TLMain = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  // Dynamic greeting — mirrors today.jsx spec
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <main style={{ padding: '36px 56px 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.ink60, marginBottom: 8 }}>Saturday · 24 May</div>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 500, letterSpacing: '-0.035em', color: t.ink }}>{greeting}, Raph.</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: t.fontUI, fontSize: 12.5, color: t.ink80, padding: '6px 10px', border: `1px solid ${t.hairline}`, borderRadius: t.rPill, background: t.paper }}>4h 30m focus</span>
          <span style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.ink80, padding: '6px 10px', border: `1px solid ${t.hairline}`, borderRadius: t.rPill, background: t.paper }}>7 · today</span>
        </div>
      </header>

      {/* 👇 Time blocking strip */}
      <TimeBlockingStrip />

      {/* AI plan strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 16, padding: '14px 18px', background: t.accentSoft, border: `1px solid ${t.hairline}`, borderRadius: t.r10 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${t.accentInk}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent }}></span>
        </div>
        <div style={{ fontSize: 14, color: t.accentInk, lineHeight: 1.4 }}>
          Today is light on meetings. <span style={{ color: t.ink }}>Suggested plan:</span> one deep block this morning, then four quick wins.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ fontFamily: t.fontUI, fontSize: 12.5, fontWeight: 500, color: t.paper, background: t.ink, border: 'none', padding: '7px 12px', borderRadius: t.r6, cursor: 'pointer' }}>Accept</button>
          <button style={{ fontFamily: t.fontUI, fontSize: 12.5, color: t.ink80, background: 'transparent', border: `1px solid ${t.hairline}`, padding: '7px 12px', borderRadius: t.r6, cursor: 'pointer' }}>Adjust</button>
        </div>
      </div>

      {/* Tasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, overflow: 'auto', paddingBottom: 40 }}>
        {[
          { group: 'First focus', sub: 'One deep block before noon', tasks: [{ title: 'Draft Clarity onboarding flow', meta: '2h · today', focus: true }] },
          { group: 'Quick wins', sub: 'Under 15 min each', tasks: [
            { title: 'Reply to Maya re: contractor dates', meta: 'email' },
            { title: 'Renew domain — clarity.app', meta: '≈ 5 min' },
          ]},
          { group: 'Later today', sub: 'Scheduled', muted: true, tasks: [
            { title: 'Walk · 16:30', meta: 'recurring' },
            { title: 'Call with Sam', meta: '17:00 · 30 min' },
          ]},
        ].map(g => (
          <section key={g.group}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: g.muted ? t.ink60 : t.ink, letterSpacing: '-0.005em' }}>{g.group}</h3>
              <span style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.06em', color: t.ink40 }}>{g.sub}</span>
            </div>
            {g.tasks.map((task, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', alignItems: 'center', gap: 14, padding: '11px 4px', borderBottom: `1px solid ${t.hairlineSoft}` }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${task.focus ? t.accent : t.ink40}` }}></div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14.5, color: t.ink, fontWeight: task.focus ? 500 : 400 }}>{task.title}</span>
                  {task.focus && <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.accentInk, padding: '2px 6px', background: t.accentSoft, borderRadius: 3 }}>Focus</span>}
                </div>
                <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>{task.meta}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
};

window.TodayWithTimelineView = TodayWithTimelineView;
window.TimeBlockingStrip = TimeBlockingStrip;
