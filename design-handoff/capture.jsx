// Quick capture — spotlight-style modal. Natural language input.
// Shows the AI parse inline as a soft preview pill row beneath the field.

const QuickCapture = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: `linear-gradient(180deg, ${t.paperMuted} 0%, ${t.paperSubtle} 100%)`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 88,
      fontFamily: t.fontUI,
    }}>
      <div style={{
        width: 'min(560px, 86%)',
        background: t.paper,
        border: `1px solid ${t.hairline}`,
        borderRadius: 14,
        boxShadow: '0 24px 60px -20px rgba(25,25,26,0.18), 0 2px 6px rgba(25,25,26,0.05)',
        overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: t.accent,
            boxShadow: `0 0 0 4px ${t.accentSoft}`,
          }}></span>
          <span style={{
            fontSize: 19, color: t.ink, letterSpacing: '-0.01em',
            flex: 1,
          }}>
            Send Annie the onboarding draft tomorrow before lunch
            <span style={{
              display: 'inline-block', width: 1.5, height: 20,
              background: t.ink, marginLeft: 2, verticalAlign: 'middle',
              animation: 'clarity-blink 1s steps(2) infinite',
            }}></span>
          </span>
          <span style={{
            fontFamily: t.fontMono, fontSize: 10.5, color: t.ink40,
            padding: '3px 7px', background: t.paperMuted, borderRadius: 4,
          }}>↵</span>
        </div>

        {/* AI parse strip */}
        <div style={{
          padding: '12px 22px',
          borderTop: `1px solid ${t.hairlineSoft}`,
          background: t.paperSubtle,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: t.ink40, marginRight: 4,
          }}>Parsed</span>
          <ParsePill label="when" value="Wed · before 12:00" />
          <ParsePill label="who" value="Annie" />
          <ParsePill label="area" value="Clarity (work)" />
          <ParsePill label="duration" value="≈ 30 min" subtle />
        </div>

        {/* Hints */}
        <div style={{
          padding: '12px 22px 16px',
          borderTop: `1px solid ${t.hairlineSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>
            On-device parse · 12 ms
          </div>
          <div style={{ display: 'flex', gap: 14, fontFamily: t.fontMono, fontSize: 10.5, color: t.ink60 }}>
            <span><kbd style={kbd(t)}>Ctrl</kbd>&nbsp;<kbd style={kbd(t)}>↵</kbd> save & open</span>
            <span><kbd style={kbd(t)}>Esc</kbd> dismiss</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes clarity-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }`}</style>
    </div>
  );
};

const kbd = (t) => ({
  fontFamily: t.fontMono, fontSize: 10, color: t.ink60,
  padding: '2px 5px', background: t.paperMuted, borderRadius: 3,
  border: `1px solid ${t.hairline}`,
});

const ParsePill = ({ label, value, subtle }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px',
      background: t.paper,
      border: `1px solid ${t.hairline}`,
      borderRadius: t.rPill,
      fontSize: 12, color: subtle ? t.ink60 : t.ink,
    }}>
      <span style={{ fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.ink40 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
};

window.QuickCapture = QuickCapture;
