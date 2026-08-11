// Windows 11 window shell — right-side window controls, no traffic lights.
// Used to wrap all app screens so they read as a real Windows-native app.

const WinShell = ({ title, badge, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const [hoveredBtn, setHoveredBtn] = React.useState(null);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: 8,
      boxShadow: '0 0 0 1px rgba(0,0,0,0.10), 0 8px 32px rgba(0,0,0,0.12)',
    }}>
      {/* Win11 Titlebar */}
      <div style={{
        height: 32, flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        background: t.paperSubtle,
        borderBottom: `1px solid ${t.hairline}`,
        userSelect: 'none',
      }}>
        {/* Left: app icon + title */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 12px', flex: 1, minWidth: 0,
        }}>
          <window.ApertureMark s={14} />
          <span style={{
            fontSize: 12, color: t.ink80, letterSpacing: '-0.005em',
            fontFamily: t.fontUI, whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{title}</span>
          {badge && (
            <span style={{ marginLeft: 4 }}>{badge}</span>
          )}
        </div>

        {/* Right: Win11 window controls */}
        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', flexShrink: 0 }}>
          <WinCtrlBtn
            label="─"
            id="min"
            hovered={hoveredBtn}
            setHovered={setHoveredBtn}
            hoverBg="rgba(25,25,26,0.07)"
          />
          <WinCtrlBtn
            label={<MaximizeIcon />}
            id="max"
            hovered={hoveredBtn}
            setHovered={setHoveredBtn}
            hoverBg="rgba(25,25,26,0.07)"
          />
          <WinCtrlBtn
            label="✕"
            id="close"
            hovered={hoveredBtn}
            setHovered={setHoveredBtn}
            hoverBg="#C42B1C"
            hoverColor="#fff"
            isClose
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{children}</div>
    </div>
  );
};

const MaximizeIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="0.5"
      stroke="currentColor" strokeWidth="1.1" fill="none" />
  </svg>
);

const WinCtrlBtn = ({ label, id, hovered, setHovered, hoverBg, hoverColor, isClose }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const isHov = hovered === id;
  return (
    <div
      onMouseEnter={() => setHovered(id)}
      onMouseLeave={() => setHovered(null)}
      style={{
        width: 46, height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isHov ? hoverBg : 'transparent',
        color: isHov && hoverColor ? hoverColor : t.ink60,
        fontSize: isClose || id === 'min' ? 11 : 10,
        cursor: 'default',
        transition: 'background 0.1s, color 0.1s',
        fontFamily: t.fontUI,
      }}
    >{label}</div>
  );
};

const TitlebarLocalBadge = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.10em',
      textTransform: 'uppercase', color: t.ink60,
      padding: '2px 7px', background: t.paper,
      border: `1px solid ${t.hairline}`, borderRadius: 999,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'oklch(0.58 0.07 155)' }}></span>
      On-device
    </span>
  );
};

// Keep MacShell as an alias so no other file needs changing
const MacShell = WinShell;

window.WinShell  = WinShell;
window.MacShell  = MacShell;  // alias
window.TitlebarLocalBadge = TitlebarLocalBadge;
