// focus-mode.jsx — Single-task fullscreen focus view.
// Activated from the task detail panel or context menu: "Enter Focus Mode".
// Shows one task prominently with a Pomodoro-style timer and minimal controls.
// Designed to fill the entire window; sidebar and task list disappear.

const FocusMode = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  // Static snapshot: 22:47 elapsed of a 2h session, 4 subtasks, 1 done
  const elapsed   = 22 * 60 + 47; // seconds
  const total     = 2 * 60 * 60;  // 2h
  const remaining = total - elapsed;
  const remMin    = Math.floor(remaining / 60);
  const remSec    = remaining % 60;
  const progress  = elapsed / total;
  const R = 70, C = 2 * Math.PI * R;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      gap: 0,
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${t.hairlineSoft}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <window.ApertureMark s={16} />
          <span style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink60 }}>Focus mode</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <FMBtn label="Skip task" ghost />
          <FMBtn label="Exit focus" ghost />
        </div>
      </div>

      {/* Central block */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40,
        maxWidth: 560, width: '100%', padding: '0 40px', textAlign: 'center',
      }}>
        {/* Progress ring + timer */}
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle cx="80" cy="80" r={R} fill="none" stroke={t.hairline} strokeWidth="6" />
            {/* Progress */}
            <circle cx="80" cy="80" r={R}
              fill="none"
              stroke={t.accent}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          {/* Timer label */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 28, fontWeight: 500, color: t.ink, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {String(remMin).padStart(2,'0')}:{String(remSec).padStart(2,'0')}
            </span>
            <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40, marginTop: 4 }}>remaining</span>
          </div>
        </div>

        {/* Task */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.accentInk, padding: '3px 8px', background: t.accentSoft, borderRadius: 3 }}>Focus</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>Clarity (work)</span>
          </div>
          <h1 style={{
            margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: '-0.03em',
            color: t.ink, lineHeight: 1.2, textWrap: 'balance',
          }}>Draft Clarity onboarding flow</h1>
          <p style={{ margin: 0, fontSize: 14, color: t.ink60, lineHeight: 1.55 }}>
            Write the 3-screen flow. Reference the Figma comp. Needs Sam's sign-off before EOD.
          </p>
        </div>

        {/* Subtask mini-list */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: 'Outline the 3 screens', done: true },
            { label: 'Write copy for welcome screen', done: false, active: true },
            { label: 'Wire up capture input state', done: false },
            { label: 'Hand off to Sam for review', done: false },
          ].map((sub, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 0', borderBottom: `1px solid ${t.hairlineSoft}`,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                border: `1.5px solid ${sub.done ? t.done : sub.active ? t.accent : t.ink40}`,
                background: sub.done ? t.done : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {sub.done && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}
              </div>
              <span style={{
                fontSize: 13.5,
                color: sub.done ? t.ink40 : sub.active ? t.ink : t.ink60,
                textDecoration: sub.done ? 'line-through' : 'none',
                fontWeight: sub.active ? 500 : 400,
              }}>{sub.label}</span>
              {sub.active && <span style={{ marginLeft: 'auto', fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.accentInk, background: t.accentSoft, padding: '2px 6px', borderRadius: 3 }}>now</span>}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <FMBtn label="⏸ Pause" />
          <FMBtn label="✓ Done" primary />
          <FMBtn label="Take a break" ghost />
        </div>
      </div>

      {/* Bottom: next up */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 24px',
        borderTop: `1px solid ${t.hairlineSoft}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40 }}>Next up</span>
        <span style={{ fontSize: 13, color: t.ink60 }}>Reply to Maya re: contractor dates</span>
        <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>email · ≈ 10 min</span>
      </div>
    </div>
  );
};

const FMBtn = ({ label, primary, ghost }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <button style={{
      fontFamily: t.fontUI, fontSize: 13, fontWeight: primary ? 500 : 400,
      padding: '9px 18px', borderRadius: t.r6, cursor: 'pointer',
      background: primary ? t.ink : ghost ? 'transparent' : t.paper,
      color: primary ? t.paper : ghost ? t.ink60 : t.ink,
      border: primary ? 'none' : ghost ? 'none' : `1px solid ${t.hairline}`,
    }}>{label}</button>
  );
};

window.FocusMode = FocusMode;
