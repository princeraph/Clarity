// task-detail.jsx — Task detail panel — slides in from the right when a task is clicked.
// Notes, subtasks (expandable cards), metadata, timer, recurrence, activity log.

// ─── Subtask card — expandable ───────────────────────────────────────────────

const SubtaskCard = ({ label, done, expanded, notes, due }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      background: t.paperSubtle,
      border: `1px solid ${expanded ? t.hairline : t.hairlineSoft}`,
      borderRadius: t.r6,
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr auto',
        alignItems: 'center',
        padding: '9px 10px 9px 8px',
        cursor: 'pointer',
        gap: 4,
      }}>
        {/* Checkbox */}
        <div style={{
          width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${done ? t.done : t.ink40}`,
          background: done ? t.done : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto',
        }}>
          {done && <span style={{ color: '#fff', fontSize: 8, lineHeight: 1 }}>✓</span>}
        </div>
        {/* Title */}
        <span style={{
          fontSize: 13, color: done ? t.ink40 : t.ink,
          textDecoration: done ? 'line-through' : 'none',
          letterSpacing: '-0.005em',
        }}>{label}</span>
        {/* Meta + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {due && (
            <span style={{
              fontFamily: t.fontMono, fontSize: 10, color: t.ink40,
              background: t.paperMuted, border: `1px solid ${t.hairlineSoft}`,
              borderRadius: 3, padding: '1px 5px',
            }}>{due}</span>
          )}
          <span style={{
            fontSize: 10, color: t.ink40,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            lineHeight: 1,
          }}>▾</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${t.hairlineSoft}`,
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Notes */}
          <div style={{
            fontSize: 12.5, color: notes ? t.ink80 : t.ink40,
            lineHeight: 1.55,
            background: t.paper,
            border: `1px solid ${t.hairlineSoft}`,
            borderRadius: 4,
            padding: '7px 10px',
            minHeight: 48,
          }}>
            {notes || 'Add a note…'}
          </div>
          {/* Meta row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <SubMeta label="Due" value={due || 'None'} accent={!!due} />
            <SubMeta label="Est." value="—" />
            <div style={{ marginLeft: 'auto' }}>
              <button style={{
                fontFamily: t.fontUI, fontSize: 11.5, color: t.ink60,
                background: 'transparent', border: `1px solid ${t.hairline}`,
                borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
              }}>Open</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SubMeta = ({ label, value, accent }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 7px',
      background: accent ? t.accentSoft : t.paper,
      border: `1px solid ${accent ? t.accent : t.hairline}`,
      borderRadius: 4, fontSize: 11,
      color: accent ? t.accentInk : t.ink60,
    }}>
      <span style={{
        fontFamily: t.fontMono, fontSize: 9, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: accent ? t.accentInk : t.ink40, opacity: 0.75,
      }}>{label}</span>
      {value}
    </span>
  );
};

// ─── Timer ────────────────────────────────────────────────────────────────────

const Timer = ({ running }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      padding: '9px 12px',
      background: t.paperSubtle,
      border: `1px solid ${t.hairlineSoft}`,
      borderRadius: t.r6,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {running ? (
        <>
          {/* Pulse dot */}
          <span style={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: t.warn,
            }}></span>
            <span style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: `1px solid ${t.warn}`, opacity: 0.35,
            }}></span>
          </span>
          <span style={{
            fontFamily: t.fontMono, fontSize: 13, fontWeight: 500, color: t.ink,
            flex: 1, letterSpacing: '0.04em',
          }}>00:24:13</span>
          <button style={{
            fontFamily: t.fontUI, fontSize: 12, color: t.ink60,
            background: 'transparent', border: `1px solid ${t.hairline}`,
            borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
          }}>Stop</button>
        </>
      ) : (
        <>
          <span style={{ fontSize: 12, color: t.ink40 }}>▶</span>
          <span style={{ fontSize: 12.5, color: t.ink60, flex: 1 }}>Start timer</span>
        </>
      )}
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

const TaskDetailPanel = ({ timerRunning }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: 340, height: '100%', flexShrink: 0,
      background: t.paper,
      borderLeft: `1px solid ${t.hairline}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: t.fontUI,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: `1px solid ${t.hairlineSoft}`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: t.ink40,
          }}>Task detail</span>
          <span style={{ fontSize: 13, color: t.ink40, cursor: 'pointer', padding: '2px 4px' }}>✕</span>
        </div>
        <h2 style={{
          margin: 0, fontSize: 15.5, fontWeight: 500, letterSpacing: '-0.02em',
          color: t.ink, lineHeight: 1.3,
          borderBottom: `1px solid ${t.hairline}`, paddingBottom: 8,
        }}>Draft Clarity onboarding flow</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <TDPill label="Due" value="Today · 12:00" accent />
          <TDPill label="Est." value="2h" />
          <TDPill label="Topic" value="Clarity (work)" />
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* Notes */}
        <div>
          <TDLabel>Notes</TDLabel>
          <div style={{
            padding: '10px 12px', background: t.paperSubtle,
            borderRadius: t.r6, border: `1px solid ${t.hairlineSoft}`,
            fontSize: 13, color: t.ink80, lineHeight: 1.6, minHeight: 66,
          }}>
            Write the 3-screen flow: Welcome → local-first explainer → first capture.
            Reference the Figma comp. Needs Sam's sign-off before EOD.
          </div>
        </div>

        {/* Subtasks — expandable cards */}
        <div>
          <TDLabel>
            Subtasks
            <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink40, marginLeft: 8 }}>
              1 of 4
            </span>
          </TDLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SubtaskCard done label="Outline the 3 screens" />
            <SubtaskCard label="Write copy for welcome screen" expanded
              notes="Keep it under 12 words. Warm, not productivity-bro."
              due="Today" />
            <SubtaskCard label="Wire up capture input state" />
            <SubtaskCard label="Hand off to Sam for review" due="Fri" />
          </div>
          <div style={{
            padding: '8px 4px', marginTop: 4,
            fontSize: 12.5, color: t.ink40, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 15 }}>+</span> Add subtask
          </div>
        </div>

        {/* Timer */}
        <div>
          <TDLabel>Timer</TDLabel>
          <Timer running={timerRunning} />
        </div>

        {/* Recurrence */}
        <div>
          <TDLabel>Recurrence</TDLabel>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', background: t.paperSubtle,
            border: `1px solid ${t.hairline}`, borderRadius: t.r6,
            fontSize: 12.5, color: t.ink60, cursor: 'pointer',
          }}>
            Does not repeat <span style={{ color: t.ink40, fontSize: 10 }}>▾</span>
          </div>
        </div>

        {/* Activity */}
        <div>
          <TDLabel>Activity</TDLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TDActivity time="Yesterday" text="Created by you" />
            <TDActivity time="09:14" text="Moved to Today" />
            <TDActivity time="09:15" text="Marked as Focus by Clarity AI" accent />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: `1px solid ${t.hairline}`,
        display: 'flex', gap: 8,
      }}>
        <button style={{
          flex: 1, fontFamily: t.fontUI, fontSize: 12.5, fontWeight: 500,
          color: t.paper, background: t.ink,
          border: 'none', padding: '8px 12px', borderRadius: t.r6, cursor: 'pointer',
        }}>✓ Mark complete</button>
        <button style={{
          fontFamily: t.fontUI, fontSize: 12.5, color: t.ink60,
          background: 'transparent', border: `1px solid ${t.hairline}`,
          padding: '8px 10px', borderRadius: t.r6, cursor: 'pointer',
        }}>Delete</button>
      </div>
    </div>
  );
};

// ─── Shared sub-components ────────────────────────────────────────────────────

const TDLabel = ({ children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em',
      textTransform: 'uppercase', color: t.ink40, marginBottom: 8,
      display: 'flex', alignItems: 'center',
    }}>{children}</div>
  );
};

const TDPill = ({ label, value, accent }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 8px',
      background: accent ? t.accentSoft : t.paperSubtle,
      border: `1px solid ${accent ? t.accent : t.hairline}`,
      borderRadius: t.rPill, fontSize: 11.5,
      color: accent ? t.accentInk : t.ink80,
    }}>
      <span style={{
        fontFamily: t.fontMono, fontSize: 9, letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: accent ? t.accentInk : t.ink40, opacity: 0.75,
      }}>{label}</span>
      {value}
    </span>
  );
};

const TDActivity = ({ time, text, accent }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{
        fontFamily: t.fontMono, fontSize: 10.5, color: t.ink40,
        whiteSpace: 'nowrap', minWidth: 56,
      }}>{time}</span>
      <span style={{ fontSize: 12.5, color: accent ? t.accentInk : t.ink60 }}>{text}</span>
    </div>
  );
};

window.TaskDetailPanel = TaskDetailPanel;
