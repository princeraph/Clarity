import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';

const STEPS = [
  {
    title: 'Capture anything, naturally',
    body: "Press Ctrl+K from anywhere to add a task. Just type it like you'd say it — Clarity's AI parses the date, person, and topic automatically.",
    target: { top: 114, left: 20, width: 200, height: 38 },
    panel: { top: 168, left: 14 },
  },
  {
    title: 'Your daily plan, already done',
    body: 'Every morning, Clarity reads your tasks to suggest a plan. Hit Accept to create it in one click, or Adjust to fine-tune.',
    target: { top: 220, left: 248, width: 680, height: 58 },
    panel: { top: 292, left: 248 },
  },
  {
    title: 'Tasks grouped by intent',
    body: "Clarity doesn't sort by due date alone. It groups tasks by energy — deep focus, quick wins, loose threads — so your list matches how you actually work.",
    target: { top: 300, left: 248, width: 680, height: 220 },
    panel: { top: 534, left: 248 },
  },
  {
    title: 'Collapse for focus',
    body: 'Click the sidebar edge or press Ctrl+\\ to shrink the sidebar to a minimal icon rail — more room for what matters.',
    target: { top: 32, left: 0, width: 232, height: 720 },
    panel: { top: 300, left: 244 },
  },
  {
    title: 'Ask your AI assistant',
    body: 'Press Ctrl+/ to open Ask Clarity. Ask anything: "What should I tackle first?", "What did I defer this week?" It knows your tasks.',
    target: { top: 660, left: 14, width: 206, height: 40 },
    panel: { top: 510, left: 14 },
  },
];

const SCRIM = 'rgba(15,15,18,0.60)';

function ScrimRect({ style }) {
  return <div style={{ position: 'absolute', background: SCRIM, ...style }} />;
}

export default function TutorialOverlay({ onDone }) {
  const { T } = useTheme();
  const [step, setStep] = useState(0);

  const s = STEPS[step];
  const total = STEPS.length;

  function advance() {
    if (step < total - 1) setStep(s => s + 1);
    else finish();
  }

  function finish() {
    try { localStorage.setItem('clarity-tutorialSeen', '1'); } catch {}
    onDone?.();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, fontFamily: T.fontUI }}>
      {/* Four scrim rectangles around the spotlight */}
      <ScrimRect style={{ top: 0, left: 0, right: 0, height: s.target.top }} />
      <ScrimRect style={{ top: s.target.top, left: 0, width: s.target.left, height: s.target.height }} />
      <ScrimRect style={{ top: s.target.top, left: s.target.left + s.target.width, right: 0, height: s.target.height }} />
      <ScrimRect style={{ top: s.target.top + s.target.height, left: 0, right: 0, bottom: 0 }} />

      {/* Spotlight accent ring */}
      <div style={{
        position: 'absolute',
        top:    s.target.top  - 3,
        left:   s.target.left - 3,
        width:  s.target.width  + 6,
        height: s.target.height + 6,
        borderRadius: 10,
        boxShadow: `0 0 0 2px ${T.accent}`,
        pointerEvents: 'none',
        transition: 'all 0.25s ease-out',
      }} />

      {/* Coach panel */}
      <div style={{
        position: 'absolute',
        top:  s.panel.top,
        left: s.panel.left,
        width: 320,
        background: T.ink,
        color: T.paper,
        borderRadius: T.r10,
        padding: '20px 22px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
        animation: 'fadeUp 0.18s ease-out',
        transition: 'top 0.25s ease-out, left 0.25s ease-out',
      }}>
        {/* Step indicator dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 14, alignItems: 'center' }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{
              width: i === step ? 20 : 5, height: 3, borderRadius: 2,
              background: i === step ? T.accent : 'rgba(255,255,255,0.25)',
              transition: 'width 200ms',
            }} />
          ))}
          <span style={{
            fontFamily: T.fontMono, fontSize: 10,
            color: 'rgba(255,255,255,0.40)',
            marginLeft: 6, letterSpacing: '0.06em',
          }}>{step + 1} / {total}</span>
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: T.paper }}>
          {s.title}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 1.55 }}>
          {s.body}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={finish}
            style={{
              fontFamily: T.fontUI, fontSize: 12,
              color: 'rgba(255,255,255,0.40)',
              background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 0,
            }}
          >Skip tutorial</button>
          <button
            onClick={advance}
            style={{
              fontFamily: T.fontUI, fontSize: 13, fontWeight: 500,
              color: T.ink, background: T.paper,
              border: 'none', padding: '8px 16px',
              borderRadius: T.r6, cursor: 'pointer',
            }}
          >{step === total - 1 ? 'Done →' : 'Next →'}</button>
        </div>
      </div>
    </div>
  );
}
