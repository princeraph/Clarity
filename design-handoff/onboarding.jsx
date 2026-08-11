// Onboarding flow — three screens. Calm, type-led, no progress dots fetish.
// 1. Welcome (mark + tagline + single CTA)
// 2. Local-first explainer (the badge gets context)
// 3. First capture (drop you straight into the input, AI parse live)

const OnboardingFrame = ({ stepIndex, children }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, color: t.ink,
      fontFamily: t.fontUI,
      display: 'grid', gridTemplateRows: 'auto 1fr auto',
      padding: '40px 56px', boxSizing: 'border-box',
    }}>
      {/* Top: mark + step trace */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <window.ApertureMark s={20} />
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>clarity</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: i === stepIndex ? 22 : 6, height: 2, borderRadius: 2,
              background: i === stepIndex ? t.ink : t.ink20,
              transition: 'all 200ms',
            }}></span>
          ))}
        </div>
      </header>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
      <footer style={{
        fontFamily: t.fontMono, fontSize: 10.5, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: t.ink40,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{['Welcome', 'Local-first', 'Your first capture'][stepIndex]}</span>
        <span>{stepIndex + 1} / 3</span>
      </footer>
    </div>
  );
};

const Onboarding01 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <OnboardingFrame stepIndex={0}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
          <window.ApertureMark s={88} />
        </div>
        <h1 style={{
          margin: 0, fontSize: 44, fontWeight: 500, letterSpacing: '-0.04em',
          color: t.ink, lineHeight: 1.05,
        }}>A clearer way to keep<br/>track of yourself.</h1>
        <p style={{
          margin: '20px 0 36px', fontSize: 15.5, color: t.ink60, lineHeight: 1.55,
        }}>Clarity is a personal task manager with an assistant that lives on your laptop. No accounts, no cloud, no spying — just your tasks and a quiet hand on the rudder.</p>
        <button style={{
          fontFamily: t.fontUI, fontSize: 14, fontWeight: 500,
          color: t.paper, background: t.ink,
          border: 'none', padding: '11px 22px', borderRadius: t.r6,
          cursor: 'pointer', letterSpacing: '-0.005em',
        }}>Get started →</button>
      </div>
    </OnboardingFrame>
  );
};

const Onboarding02 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <OnboardingFrame stepIndex={1}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center', maxWidth: 920 }}>
        <div>
          <div style={{
            fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: t.ink60, marginBottom: 12,
          }}>On your machine</div>
          <h2 style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
            Your tasks never leave this laptop.
          </h2>
          <p style={{ margin: '18px 0 0', fontSize: 15, color: t.ink80, lineHeight: 1.55 }}>
            The model that parses your captures, suggests plans, and answers your questions runs entirely on-device. No syncing, no telemetry, no servers to trust. The on-device badge tells you it's still true.
          </p>
        </div>
        <div style={{
          background: t.paperSubtle, borderRadius: t.r14, padding: 28,
          border: `1px solid ${t.hairline}`,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{
            display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8,
            padding: '6px 12px', background: t.paper,
            border: `1px solid ${t.hairline}`, borderRadius: 999,
            fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.10em',
            textTransform: 'uppercase', color: t.ink60,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.done }}></span>
            On-device · llama-3 8b
          </div>
          <div style={{ display: 'grid', gap: 10, fontSize: 13.5, color: t.ink80 }}>
            <Row label="Storage" value="%APPDATA%\\Clarity" mono />
            <Row label="Model size" value="4.2 GB" mono />
            <Row label="Network calls" value="0" mono done />
            <Row label="Cloud sync" value="Off" mono />
          </div>
        </div>
      </div>
    </OnboardingFrame>
  );
};

const Row = ({ label, value, mono, done }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', background: t.paper, borderRadius: t.r6,
      border: `1px solid ${t.hairlineSoft}`,
    }}>
      <span style={{ color: t.ink60 }}>{label}</span>
      <span style={{
        fontFamily: mono ? t.fontMono : t.fontUI,
        fontSize: 12.5, color: done ? t.done : t.ink,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.done }}></span>}
        {value}
      </span>
    </div>
  );
};

const Onboarding03 = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <OnboardingFrame stepIndex={2}>
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div style={{
          fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: t.ink60, marginBottom: 12,
          textAlign: 'center',
        }}>Try it now</div>
        <h2 style={{
          margin: '0 0 28px', fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em',
          textAlign: 'center', lineHeight: 1.15,
        }}>What's on your mind?</h2>
        <div style={{
          background: t.paper, border: `1px solid ${t.hairline}`,
          borderRadius: 14,
          boxShadow: '0 24px 60px -20px rgba(25,25,26,0.18)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent, boxShadow: `0 0 0 4px ${t.accentSoft}` }}></span>
            <span style={{ fontSize: 18, color: t.ink, letterSpacing: '-0.01em', flex: 1 }}>
              call the dentist tomorrow morning
            </span>
          </div>
          <div style={{
            padding: '12px 22px',
            borderTop: `1px solid ${t.hairlineSoft}`,
            background: t.paperSubtle,
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: t.ink40, marginRight: 4,
            }}>Parsed</span>
            <Pill label="when" value="Wed · 09:00" />
            <Pill label="task" value="Call the dentist" />
            <Pill label="duration" value="≈ 10 min" subtle />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button style={{
            fontFamily: t.fontUI, fontSize: 14, fontWeight: 500,
            color: t.paper, background: t.ink,
            border: 'none', padding: '11px 22px', borderRadius: t.r6,
            cursor: 'pointer',
          }}>Save & open Clarity →</button>
          <div style={{ marginTop: 10, fontFamily: t.fontMono, fontSize: 11, color: t.ink40 }}>
            Ctrl+K from anywhere to capture again.
          </div>
        </div>
      </div>
    </OnboardingFrame>
  );
};

const Pill = ({ label, value, subtle }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px', background: t.paper,
      border: `1px solid ${t.hairline}`, borderRadius: 999,
      fontSize: 12, color: subtle ? t.ink60 : t.ink,
    }}>
      <span style={{
        fontFamily: t.fontMono, fontSize: 9.5, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: t.ink40,
      }}>{label}</span>
      <span>{value}</span>
    </span>
  );
};

window.Onboarding01 = Onboarding01;
window.Onboarding02 = Onboarding02;
window.Onboarding03 = Onboarding03;
