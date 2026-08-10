import { useState } from 'react';
import ApertureMark from './ApertureMark.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

const API = 'http://localhost:3001/api';

const SCREENS = [
  { key: 'welcome', foot: 'Welcome',             cta: 'Get started →' },
  { key: 'local',   foot: 'Local-first',         cta: 'Continue →' },
  { key: 'capture', foot: 'Your first capture',  cta: 'Save & open Clarity →' },
];

// Thin line trace in the header — the design uses growing dashes, not dots.
function LineTrace({ current, T }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: i === current ? 22 : 6, height: 2, borderRadius: 2,
          background: i === current ? T.ink : T.ink20,
          transition: 'all 200ms',
        }} />
      ))}
    </div>
  );
}

function SpecRow({ label, value, done, T }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', background: T.paper, borderRadius: T.r6,
      border: `1px solid ${T.hairlineSoft}`,
    }}>
      <span style={{ color: T.ink60, fontSize: 13.5 }}>{label}</span>
      <span style={{
        fontFamily: T.fontMono, fontSize: 12.5, color: done ? T.done : T.ink,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {done && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.done }} />}
        {value}
      </span>
    </div>
  );
}

function Pill({ label, value, subtle, T }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px', background: T.paper,
      border: `1px solid ${T.hairline}`, borderRadius: T.rPill,
      fontSize: 12, color: subtle ? T.ink60 : T.ink,
    }}>
      <span style={{ fontFamily: T.fontMono, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink40 }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function Cta({ label, onClick, disabled, T }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: T.fontUI, fontSize: 14, fontWeight: 500,
        color: T.paper, background: T.ink,
        border: 'none', padding: '11px 22px', borderRadius: T.r6,
        cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: '-0.005em',
        opacity: disabled ? 0.7 : 1,
      }}
    >{label}</button>
  );
}

export default function OnboardingView({ onComplete }) {
  const { T } = useTheme();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  async function finish() {
    setCompleting(true);
    try {
      await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingComplete: true }),
      });
    } catch {}
    onComplete();
  }

  const isLast = step === SCREENS.length - 1;
  const s = SCREENS[step];
  const advance = isLast ? finish : () => setStep(n => n + 1);
  const ctaLabel = isLast ? (completing ? 'Opening Clarity…' : s.cta) : s.cta;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: T.paper, color: T.ink, fontFamily: T.fontUI,
      display: 'grid', gridTemplateRows: 'auto 1fr auto',
      padding: '40px 56px', boxSizing: 'border-box',
    }}>
      {/* Header: mark + line trace */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ApertureMark s={20} />
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>clarity</span>
        </div>
        <LineTrace current={step} T={T} />
      </header>

      {/* Center: screen content */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div key={step} style={{ animation: 'fadeUp 0.22s ease-out', width: '100%', display: 'flex', justifyContent: 'center' }}>

          {step === 0 && (
            <div style={{ textAlign: 'center', maxWidth: 460 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
                <ApertureMark s={88} />
              </div>
              <h1 style={{ margin: 0, fontSize: 44, fontWeight: 500, letterSpacing: '-0.04em', color: T.ink, lineHeight: 1.05 }}>
                A clearer way to keep<br />track of yourself.
              </h1>
              <p style={{ margin: '20px 0 36px', fontSize: 15.5, color: T.ink60, lineHeight: 1.55 }}>
                Clarity is a personal task manager with an assistant that lives on your laptop. No accounts, no cloud, no spying — just your tasks and a quiet hand on the rudder.
              </p>
              <Cta label={ctaLabel} onClick={advance} disabled={completing} T={T} />
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center', maxWidth: 920, width: '100%' }}>
              <div>
                <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 12 }}>On your machine</div>
                <h2 style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
                  Your tasks never leave this laptop.
                </h2>
                <p style={{ margin: '18px 0 28px', fontSize: 15, color: T.ink80, lineHeight: 1.55 }}>
                  The model that parses your captures, suggests plans, and answers your questions runs entirely on-device. No syncing, no telemetry, no servers to trust. The on-device badge tells you it's still true.
                </p>
                <Cta label={ctaLabel} onClick={advance} disabled={completing} T={T} />
              </div>
              <div style={{
                background: T.paperSubtle, borderRadius: T.r14, padding: 28,
                border: `1px solid ${T.hairline}`,
                display: 'flex', flexDirection: 'column', gap: 18,
              }}>
                <div style={{
                  display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8,
                  padding: '6px 12px', background: T.paper,
                  border: `1px solid ${T.hairline}`, borderRadius: T.rPill,
                  fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: T.ink60,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.done }} />
                  On-device · llama-3 8b
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <SpecRow label="Storage"       value="%APPDATA%\Clarity" T={T} />
                  <SpecRow label="Model size"    value="4.2 GB" T={T} />
                  <SpecRow label="Network calls" value="0" done T={T} />
                  <SpecRow label="Cloud sync"    value="Off" T={T} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ width: '100%', maxWidth: 600 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink60, marginBottom: 12, textAlign: 'center' }}>Try it now</div>
              <h2 style={{ margin: '0 0 28px', fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em', textAlign: 'center', lineHeight: 1.15 }}>
                What's on your mind?
              </h2>
              <div style={{
                background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 14,
                boxShadow: '0 24px 60px -20px rgba(25,25,26,0.18)', overflow: 'hidden',
              }}>
                <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, boxShadow: `0 0 0 4px ${T.accentSoft}` }} />
                  <span style={{ fontSize: 18, color: T.ink, letterSpacing: '-0.01em', flex: 1 }}>call the dentist tomorrow morning</span>
                </div>
                <div style={{
                  padding: '12px 22px', borderTop: `1px solid ${T.hairlineSoft}`,
                  background: T.paperSubtle,
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.ink40, marginRight: 4 }}>Parsed</span>
                  <Pill label="when" value="Tomorrow · 09:00" T={T} />
                  <Pill label="task" value="Call the dentist" T={T} />
                  <Pill label="duration" value="≈ 10 min" subtle T={T} />
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 28 }}>
                <Cta label={ctaLabel} onClick={advance} disabled={completing} T={T} />
                <div style={{ marginTop: 10, fontFamily: T.fontMono, fontSize: 11, color: T.ink40 }}>
                  Ctrl+K from anywhere to capture again.
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer: step label + counter */}
      <footer style={{
        fontFamily: T.fontMono, fontSize: 10.5, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: T.ink40,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{s.foot}</span>
        <span>{step + 1} / {SCREENS.length}</span>
      </footer>
    </div>
  );
}
