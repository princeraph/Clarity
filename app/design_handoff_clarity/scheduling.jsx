// scheduling.jsx — Task scheduling flow.
// Shown when user picks "Schedule…" from context menu or task detail.
// A compact popover with: calendar mini-grid + time picker + recurrence.

const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const MAY_2026 = [
  [null, null, null, null, 1,  2,  3 ],
  [4,   5,   6,   7,   8,  9,  10],
  [11,  12,  13,  14,  15, 16, 17],
  [18,  19,  20,  21,  22, 23, 24],
  [25,  26,  27,  28,  29, 30, 31],
];

const SchedulingPopover = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const selected = 27; // Wednesday the 27th

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(180deg, ${t.paperMuted} 0%, ${t.paperSubtle} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: t.fontUI, position: 'relative',
    }}>
      {/* Context: faded task row behind the popover */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.18,
      }}>
        <div style={{ width: 680, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${t.ink40}` }}></div>
          <span style={{ fontSize: 15, color: t.ink }}>Reply to Maya re: contractor dates</span>
          <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40, marginLeft: 'auto' }}>email</span>
        </div>
      </div>

      {/* Popover */}
      <div style={{
        width: 320,
        background: t.paper,
        border: `1px solid ${t.hairline}`,
        borderRadius: t.r14,
        boxShadow: '0 20px 56px -12px rgba(25,25,26,0.22), 0 4px 12px rgba(25,25,26,0.08)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px 12px',
          borderBottom: `1px solid ${t.hairlineSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40 }}>Schedule task</span>
          <span style={{ fontSize: 12.5, color: t.ink40, cursor: 'pointer' }}>✕</span>
        </div>

        {/* Quick picks */}
        <div style={{ padding: '12px 18px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: 'Today',     sub: 'Sat 25' },
            { label: 'Tomorrow',  sub: 'Sun 26' },
            { label: 'Next week', sub: 'Mon 1 Jun' },
            { label: 'Archive',   sub: '' },
          ].map(q => (
            <button key={q.label} style={{
              fontFamily: t.fontUI, fontSize: 12, cursor: 'pointer',
              padding: '5px 10px', borderRadius: t.rPill,
              background: q.label === 'Tomorrow' ? t.ink : t.paperSubtle,
              color: q.label === 'Tomorrow' ? t.paper : t.ink80,
              border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
            }}>
              <span style={{ fontWeight: 500 }}>{q.label}</span>
              {q.sub && <span style={{ fontFamily: t.fontMono, fontSize: 9.5, opacity: 0.6 }}>{q.sub}</span>}
            </button>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ padding: '4px 18px 12px' }}>
          {/* Month nav */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: t.ink }}>May 2026</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={{ fontFamily: t.fontUI, fontSize: 13, color: t.ink60, background: 'transparent', border: `1px solid ${t.hairline}`, borderRadius: t.r6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              <button style={{ fontFamily: t.fontUI, fontSize: 13, color: t.ink60, background: 'transparent', border: `1px solid ${t.hairline}`, borderRadius: t.r6, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            </div>
          </div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontFamily: t.fontMono, fontSize: 9.5, color: t.ink40, letterSpacing: '0.06em', padding: '0 0 4px' }}>{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {MAY_2026.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
              {week.map((day, di) => {
                const isSelected = day === selected;
                const isToday    = day === 25;
                const isPast     = day && day < 25;
                return (
                  <div key={di} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 28, borderRadius: t.r6,
                    background: isSelected ? t.ink : 'transparent',
                    cursor: day ? 'pointer' : 'default',
                  }}>
                    {day && (
                      <span style={{
                        fontSize: 12.5,
                        fontWeight: isSelected ? 600 : isToday ? 500 : 400,
                        color: isSelected ? t.paper : isPast ? t.ink40 : isToday ? t.accent : t.ink,
                        textDecoration: isToday && !isSelected ? `underline solid ${t.accent}` : 'none',
                        textUnderlineOffset: 3,
                      }}>{day}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Time picker */}
        <div style={{
          padding: '10px 18px',
          borderTop: `1px solid ${t.hairlineSoft}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40, minWidth: 36 }}>Time</span>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {['09:00', '10:00', '12:00', '14:00', '17:00'].map(tm => (
              <button key={tm} style={{
                fontFamily: t.fontMono, fontSize: 11, cursor: 'pointer',
                padding: '5px 8px', borderRadius: t.r6,
                background: tm === '10:00' ? t.accentSoft : t.paperSubtle,
                color: tm === '10:00' ? t.accentInk : t.ink60,
                border: `1px solid ${tm === '10:00' ? t.accent : t.hairline}`,
              }}>{tm}</button>
            ))}
          </div>
        </div>

        {/* Recurrence */}
        <div style={{
          padding: '10px 18px',
          borderTop: `1px solid ${t.hairlineSoft}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40, minWidth: 36 }}>Repeat</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['None', 'Daily', 'Weekly', 'Custom…'].map(r => (
              <button key={r} style={{
                fontFamily: t.fontUI, fontSize: 12, cursor: 'pointer',
                padding: '5px 10px', borderRadius: t.rPill,
                background: r === 'None' ? t.ink : t.paperSubtle,
                color: r === 'None' ? t.paper : t.ink60,
                border: 'none',
              }}>{r}</button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px 14px',
          borderTop: `1px solid ${t.hairlineSoft}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button style={{ fontFamily: t.fontUI, fontSize: 13, color: t.ink60, background: 'transparent', border: `1px solid ${t.hairline}`, padding: '8px 14px', borderRadius: t.r6, cursor: 'pointer' }}>Cancel</button>
          <button style={{ fontFamily: t.fontUI, fontSize: 13, fontWeight: 500, color: t.paper, background: t.ink, border: 'none', padding: '8px 14px', borderRadius: t.r6, cursor: 'pointer' }}>Schedule</button>
        </div>
      </div>
    </div>
  );
};

window.SchedulingPopover = SchedulingPopover;
