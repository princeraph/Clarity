// search-capture.jsx — Ctrl+K dual-mode modal.
// Mode A (empty input): shows recent tasks + quick-action commands.
// Mode B (typing new): shows search results + parse preview for new capture.
// Tab / ↑↓ to navigate, ↵ to open/save.

const RECENT_TASKS = [
  { title: 'Draft Clarity onboarding flow', area: 'Clarity (work)', due: 'Today', focus: true },
  { title: 'Reply to Maya re: contractor dates', area: 'Clarity (work)', due: 'Today' },
  { title: 'Read Annie\'s draft and send notes', area: 'Personal', due: 'Stale · 6d' },
  { title: 'Renew domain — clarity.app', area: 'Clarity (work)', due: 'Today' },
];

const SEARCH_RESULTS = [
  { title: 'Draft Clarity onboarding flow', area: 'Clarity (work)', due: 'Today', score: 'best match' },
  { title: 'Clarity branding review notes', area: 'Clarity (work)', due: 'Archive' },
  { title: 'Send Clarity demo to board', area: 'Clarity (work)', due: 'Upcoming' },
];

const COMMANDS = [
  { icon: '◷', label: 'Go to Today',        kbd: 'Ctrl+1' },
  { icon: '✉', label: 'Go to Inbox',        kbd: 'Ctrl+2' },
  { icon: '↗', label: 'Open Ask Clarity',   kbd: 'Ctrl+/' },
  { icon: '⚙', label: 'Open Settings',      kbd: 'Ctrl+,' },
];

// Mode A — empty input, showing recent + commands
const CtrlKEmpty = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <CKShell inputValue="" placeholder="Search tasks or capture new…">
      <CKSection label="Recent tasks">
        {RECENT_TASKS.map((r, i) => (
          <CKTaskRow key={i} task={r} active={i === 0} />
        ))}
      </CKSection>
      <CKDivider />
      <CKSection label="Commands">
        {COMMANDS.map((c, i) => (
          <CKCommandRow key={i} {...c} />
        ))}
      </CKSection>
      <CKFooter left="↑↓ navigate" right={[{ key: '↵', label: 'open' }, { key: 'Tab', label: 'capture mode' }]} />
    </CKShell>
  );
};

// Mode B — user typed "clarity onboarding", shows search hits + parse preview
const CtrlKSearch = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <CKShell inputValue="clarity onboarding" placeholder="">
      <CKSection label="Tasks matching 'clarity onboarding'">
        {SEARCH_RESULTS.map((r, i) => (
          <CKTaskRow key={i} task={r} active={i === 0} showScore />
        ))}
      </CKSection>
      <CKDivider />
      {/* New capture option */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 18px',
        background: t.accentSoft,
        borderLeft: `2px solid ${t.accent}`,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.accent, flexShrink: 0 }}></span>
        <span style={{ fontSize: 13, color: t.accentInk, flex: 1 }}>
          Capture "<strong>clarity onboarding</strong>" as a new task
        </span>
        <span style={{
          fontFamily: t.fontMono, fontSize: 10,
          color: t.accentInk,
          padding: '2px 6px', background: t.paper,
          borderRadius: 3, border: `1px solid ${t.accent}`,
        }}>Tab</span>
      </div>
      <CKFooter left="3 results" right={[{ key: '↵', label: 'open task' }, { key: 'Tab', label: 'capture' }, { key: 'Esc', label: 'close' }]} />
    </CKShell>
  );
};

// Mode C — user pressed Tab, now in capture mode with parse preview
const CtrlKCapture = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <CKShell inputValue="Send Annie the onboarding draft tomorrow before lunch" placeholder="" captureMode>
      {/* Parse result */}
      <div style={{
        padding: '12px 18px',
        borderTop: `1px solid ${t.hairlineSoft}`,
        background: t.paperSubtle,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40, marginRight: 4 }}>Parsed</span>
        <CKParsePill label="when" value="Wed · before 12:00" />
        <CKParsePill label="who" value="Annie" />
        <CKParsePill label="area" value="Clarity (work)" />
        <CKParsePill label="duration" value="≈ 30 min" subtle />
      </div>
      <CKFooter left="On-device parse · 12 ms" right={[{ key: 'Ctrl+↵', label: 'save & open' }, { key: 'Esc', label: 'dismiss' }]} />
    </CKShell>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const CKShell = ({ inputValue, placeholder, captureMode, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(180deg, ${t.paperMuted} 0%, ${t.paperSubtle} 100%)`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 72, fontFamily: t.fontUI,
    }}>
      <div style={{
        width: 'min(600px, 88%)',
        background: t.paper,
        border: `1px solid ${t.hairline}`,
        borderRadius: 14,
        boxShadow: '0 24px 60px -20px rgba(25,25,26,0.18), 0 2px 6px rgba(25,25,26,0.05)',
        overflow: 'hidden',
      }}>
        {/* Input bar */}
        <div style={{
          padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: `1px solid ${t.hairlineSoft}`,
        }}>
          {captureMode ? (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent, boxShadow: `0 0 0 4px ${t.accentSoft}`, flexShrink: 0 }}></span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke={t.ink40} strokeWidth="1.2" />
              <path d="M9.5 9.5L12.5 12.5" stroke={t.ink40} strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          )}
          <span style={{ fontSize: 16, color: inputValue ? t.ink : t.ink40, flex: 1, letterSpacing: '-0.01em' }}>
            {inputValue || placeholder}
            <span style={{ display: 'inline-block', width: 1.5, height: 18, background: t.ink, marginLeft: 2, verticalAlign: 'middle', animation: 'clarity-blink 1s steps(2) infinite' }}></span>
          </span>
          {captureMode && (
            <span style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.accentInk, padding: '3px 7px', background: t.accentSoft, borderRadius: 3, border: `1px solid ${t.accent}` }}>Capture</span>
          )}
        </div>
        {children}
      </div>
      <style>{`@keyframes clarity-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }`}</style>
    </div>
  );
};

const CKSection = ({ label, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div>
      <div style={{ padding: '8px 18px 4px', fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.ink40 }}>{label}</div>
      {children}
    </div>
  );
};

const CKTaskRow = ({ task, active, showScore }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 18px',
      background: active ? t.paperSubtle : 'transparent',
      borderLeft: active ? `2px solid ${t.ink}` : '2px solid transparent',
    }}>
      <div style={{ width: 13, height: 13, borderRadius: '50%', border: `1.5px solid ${task.focus ? t.accent : t.ink40}`, flexShrink: 0 }}></div>
      <span style={{ fontSize: 13.5, color: t.ink, flex: 1, fontWeight: active ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {showScore && task.score && (
          <span style={{ fontFamily: t.fontMono, fontSize: 9.5, color: t.accentInk, background: t.accentSoft, padding: '2px 6px', borderRadius: 3 }}>{task.score}</span>
        )}
        <span style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.ink40, whiteSpace: 'nowrap' }}>{task.area}</span>
        <span style={{ fontFamily: t.fontMono, fontSize: 10.5, color: task.due.startsWith('Stale') ? t.warn : t.ink40 }}>{task.due}</span>
      </div>
    </div>
  );
};

const CKCommandRow = ({ icon, label, kbd }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px' }}>
      <span style={{ width: 13, textAlign: 'center', fontSize: 12, color: t.ink40 }}>{icon}</span>
      <span style={{ fontSize: 13, color: t.ink60, flex: 1 }}>{label}</span>
      <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink40, padding: '2px 6px', background: t.paperMuted, borderRadius: 3, border: `1px solid ${t.hairline}` }}>{kbd}</span>
    </div>
  );
};

const CKDivider = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return <div style={{ height: 1, background: t.hairlineSoft, margin: '4px 0' }}></div>;
};

const CKFooter = ({ left, right }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${t.hairlineSoft}` }}>
      <span style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.ink40 }}>{left}</span>
      <div style={{ display: 'flex', gap: 14, fontFamily: t.fontMono, fontSize: 10.5, color: t.ink60 }}>
        {right.map((r, i) => (
          <span key={i}><span style={{ padding: '1px 5px', background: t.paperMuted, borderRadius: 3, border: `1px solid ${t.hairline}`, marginRight: 4 }}>{r.key}</span>{r.label}</span>
        ))}
      </div>
    </div>
  );
};

const CKParsePill = ({ label, value, subtle }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', background: t.paper, border: `1px solid ${t.hairline}`, borderRadius: t.rPill, fontSize: 12, color: subtle ? t.ink60 : t.ink }}>
      <span style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.ink40 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
};

window.CtrlKEmpty   = CtrlKEmpty;
window.CtrlKSearch  = CtrlKSearch;
window.CtrlKCapture = CtrlKCapture;
