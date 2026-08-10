// system-tray.jsx — Windows 11 system tray menu for Clarity.
// Right-clicking the Clarity icon in the taskbar notification area
// shows a compact popup: today summary + quick actions.
// Rendered as a standalone artboard (no WinShell wrapper needed).

const SystemTrayMenu = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#1a1a1f', // taskbar-dark bg
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
      padding: '0 12px 52px',
      fontFamily: t.fontUI,
      position: 'relative',
    }}>
      {/* Simulated taskbar strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
        background: '#1e1e28',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 16px', gap: 14,
      }}>
        {/* Tray icons (simulated) */}
        {['⌂', '◎', '⊞'].map((ic, i) => (
          <span key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>{ic}</span>
        ))}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22,
          background: 'rgba(255,255,255,0.06)', borderRadius: 4,
          cursor: 'pointer',
        }}>
          <window.ApertureMark s={14} ink="rgba(255,255,255,0.85)" accent="oklch(0.68 0.13 258)" />
        </div>
        <span style={{ fontFamily: t.fontMono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}>23:15</span>
      </div>

      {/* Tray popup */}
      <div style={{
        width: 300,
        background: 'rgba(28, 28, 34, 0.96)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.48), 0 2px 8px rgba(0,0,0,0.24)',
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        {/* Today summary header */}
        <div style={{
          padding: '16px 18px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <window.ApertureMark s={16} ink="rgba(255,255,255,0.85)" accent="oklch(0.68 0.13 258)" />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)' }}>clarity</span>
            <span style={{
              marginLeft: 'auto', fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            }}>On-device</span>
          </div>
          {/* Today stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { value: '3', label: 'done' },
              { value: '4', label: 'remaining' },
              { value: '1h 20m', label: 'focus left' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '8px 10px', background: 'rgba(255,255,255,0.05)',
                borderRadius: 6, textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Next task */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Up next</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid oklch(0.68 0.13 258)', flexShrink: 0 }}></div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Call with Sam — onboarding review</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 10.5, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>17:00</span>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '6px 0' }}>
          {[
            { icon: '⊕', label: 'Quick capture',   kbd: 'Ctrl+K' },
            { icon: '◎', label: 'Open Clarity',    kbd: '' },
            { icon: '◷', label: 'View today',      kbd: 'Ctrl+1' },
            { icon: '⊙', label: 'Ask Clarity',     kbd: 'Ctrl+/' },
          ].map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 18px', cursor: 'pointer',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', width: 14, textAlign: 'center' }}>{a.icon}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', flex: 1 }}>{a.label}</span>
              {a.kbd && <span style={{ fontFamily: t.fontMono, fontSize: 10, color: 'rgba(255,255,255,0.30)', padding: '2px 5px', background: 'rgba(255,255,255,0.06)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)' }}>{a.kbd}</span>}
            </div>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }}></div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 18px', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', width: 14, textAlign: 'center' }}>✕</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Quit Clarity</span>
          </div>
        </div>
      </div>
    </div>
  );
};

window.SystemTrayMenu = SystemTrayMenu;
