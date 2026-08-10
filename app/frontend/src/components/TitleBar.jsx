import { useState } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

const isElectron = !!window.clarity?.isElectron;

function WinBtn({ onClick, hoverBg, hoverColor, children, title }) {
  const [hov, setHov] = useState(false);
  const { T } = useTheme();
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="titlebar-no-drag h-full flex items-center justify-center transition-colors duration-100"
      style={{
        width: 46,
        background: hov ? hoverBg : 'transparent',
        color: hov && hoverColor ? hoverColor : T.ink60,
        border: 'none',
        cursor: 'default',
      }}
    >
      {children}
    </button>
  );
}

export default function TitleBar({ isDark, toggleTheme }) {
  const { T } = useTheme();
  return (
    <div
      className="titlebar-drag shrink-0 flex items-center"
      style={{
        height: 32,
        background: T.paperSubtle,
        borderBottom: `1px solid ${T.hairline}`,
        userSelect: 'none',
      }}
    >
      {/* Left: logo + title + on-device badge */}
      <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
        <ApertureMark s={14} />
        <span style={{ fontSize: 12, color: T.ink80, letterSpacing: '-0.005em', fontFamily: T.fontUI }}>
          clarity
        </span>
        <span
          className="titlebar-no-drag"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: T.ink60,
            padding: '2px 7px', background: T.paper,
            border: `1px solid ${T.hairline}`, borderRadius: 999,
            marginLeft: 6,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.done, flexShrink: 0 }} />
          On-device
        </span>
      </div>

      {/* Right: theme toggle + Win11 window controls */}
      <div className="titlebar-no-drag flex items-center h-full">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light' : 'Switch to dark'}
          className="h-full flex items-center justify-center px-3 transition-colors duration-100"
          style={{ color: T.ink40, background: 'transparent', border: 'none', cursor: 'default' }}
          onMouseEnter={e => e.currentTarget.style.color = T.ink60}
          onMouseLeave={e => e.currentTarget.style.color = T.ink40}
        >
          {isDark ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {isElectron && (
          <>
            <WinBtn onClick={() => window.clarity.minimize()} hoverBg="rgba(25,25,26,0.07)" title="Minimize">
              <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1"/></svg>
            </WinBtn>
            <WinBtn onClick={() => window.clarity.maximize()} hoverBg="rgba(25,25,26,0.07)" title="Maximize">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1">
                <rect x="0.75" y="0.75" width="8.5" height="8.5" rx="0.5"/>
              </svg>
            </WinBtn>
            <WinBtn onClick={() => window.clarity.close()} hoverBg="#C42B1C" hoverColor="#fff" title="Close">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
              </svg>
            </WinBtn>
          </>
        )}
      </div>
    </div>
  );
}
