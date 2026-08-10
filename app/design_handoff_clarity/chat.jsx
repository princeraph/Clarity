// AI chat panel — slides in from the right alongside the task list.
// Conversation has clear roles, inline task references, and an "applied" trace.

const ChatPanel = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      display: 'grid',
      gridTemplateColumns: '1fr 380px',
      overflow: 'hidden',
    }}>
      {/* Faded today list to suggest context */}
      <div style={{
        padding: '36px 40px', borderRight: `1px solid ${t.hairline}`,
        opacity: 0.55, overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: t.ink60, marginBottom: 10,
        }}>Tuesday · 12 May</div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em' }}>Today</h2>
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column' }}>
          {[
            { t: 'Draft Clarity onboarding flow', m: '2h · today' },
            { t: 'Reply to Maya re: contractor dates', m: 'email' },
            { t: 'Renew domain — clarity.app', m: '≈ 5 min' },
            { t: 'Read Annie\u2019s draft and send notes', m: 'stale · 6 days' },
            { t: 'Walk · 16:30', m: 'recurring' },
            { t: 'Call with Sam — onboarding review', m: '17:00' },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 14,
              padding: '11px 0', borderBottom: `1px solid ${t.hairlineSoft}`,
              alignItems: 'center',
            }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1.4px solid ${t.ink40}` }}></div>
              <span style={{ fontSize: 14, color: t.ink }}>{row.t}</span>
              <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>{row.m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat column */}
      <aside style={{
        display: 'flex', flexDirection: 'column',
        background: t.paperSubtle,
        boxSizing: 'border-box',
      }}>
        <div style={{
          padding: '16px 22px',
          borderBottom: `1px solid ${t.hairline}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <window.ApertureMark s={16} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Ask Clarity</span>
          </div>
          <span style={{
            fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: t.ink40,
          }}>On-device</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '22px 22px 12px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Bubble role="user">What should I tackle first today?</Bubble>
          <Bubble role="ai">
            Start with <Ref>Draft Clarity onboarding flow</Ref> — it's the only deep-work block on today, and your calendar is clear until 17:00.
            <ApplyTrace>Reordered today · moved to top</ApplyTrace>
          </Bubble>

          <Bubble role="user">Anything I'm forgetting?</Bubble>
          <Bubble role="ai">
            Two stale items have been sitting more than a week:
            <ul style={{ margin: '10px 0 0', paddingLeft: 16, lineHeight: 1.55 }}>
              <li><Ref>Read Annie's draft and send notes</Ref> · 6 days</li>
              <li><Ref>Cancel old Figma seat</Ref> · 11 days</li>
            </ul>
            Want me to schedule them this week or send to Archive?
          </Bubble>

          <Bubble role="user">Schedule them.</Bubble>
          <Bubble role="ai" thinking>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span style={dot(t)}></span><span style={{...dot(t), animationDelay: '0.15s'}}></span><span style={{...dot(t), animationDelay: '0.30s'}}></span>
              <span style={{ marginLeft: 6, fontFamily: window.CLARITY_TOKENS.fontMono, fontSize: 11, color: t.ink40 }}>thinking</span>
            </span>
          </Bubble>
        </div>

        <div style={{ padding: '12px 16px 16px', borderTop: `1px solid ${t.hairline}` }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: t.paper, border: `1px solid ${t.hairline}`,
            borderRadius: t.r10, padding: '10px 12px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent }}></span>
            <span style={{ flex: 1, fontSize: 13, color: t.ink40 }}>Ask anything about your tasks…</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink40, padding: '2px 5px', background: t.paperMuted, borderRadius: 3, border: `1px solid ${t.hairline}` }}>↵</span>
          </div>
          <div style={{
            marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            {['Plan tomorrow', 'Summarize this week', 'What\u2019s blocked?'].map(s => (
              <span key={s} style={{
                fontSize: 11.5, color: t.ink60,
                padding: '4px 9px', background: t.paper,
                border: `1px solid ${t.hairline}`, borderRadius: t.rPill,
              }}>{s}</span>
            ))}
          </div>
        </div>

        <style>{`@keyframes clarity-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4 }
          40% { transform: translateY(-3px); opacity: 1 }
        }`}</style>
      </aside>
    </div>
  );
};

const dot = (t) => ({
  width: 5, height: 5, borderRadius: '50%', background: t.ink60,
  display: 'inline-block',
  animation: 'clarity-bounce 1.2s ease-in-out infinite',
});

const Bubble = ({ role, thinking, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const isUser = role === 'user';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: t.ink40, marginBottom: 5,
      }}>{isUser ? 'You' : 'Clarity'}</div>
      <div style={{
        maxWidth: '92%',
        padding: '10px 13px',
        background: isUser ? t.ink : t.paper,
        color: isUser ? t.paper : t.ink,
        border: isUser ? 'none' : `1px solid ${t.hairline}`,
        borderRadius: t.r10,
        fontSize: 13.5, lineHeight: 1.5,
        opacity: thinking ? 0.9 : 1,
      }}>{children}</div>
    </div>
  );
};

const Ref = ({ children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      color: t.accentInk,
      borderBottom: `1px solid ${t.accent}`,
      paddingBottom: 1,
    }}>{children}</span>
  );
};

const ApplyTrace = ({ children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      marginTop: 10, paddingTop: 8,
      borderTop: `1px dashed ${t.hairline}`,
      fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.04em',
      color: t.ink60,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.done }}></span>
      {children}
    </div>
  );
};

window.ChatPanel = ChatPanel;
