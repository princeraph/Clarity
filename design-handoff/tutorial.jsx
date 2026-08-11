// tutorial.jsx — First-run coach marks overlay.
// A sequential spotlight system (5 steps) that highlights key UI elements.
// Step indicator at top. Semi-dark scrim with a cutout over the active area.
// Skip + Next controls. Designed to sit over the full TodayView.

const COACH_STEPS = [
  {
    title: 'Capture anything, naturally',
    body: 'Press Ctrl+K from anywhere to add a task. Just type it like you\'d say it — Clarity\'s AI parses the date, person, and area automatically.',
    target: { top: 114, left: 20, width: 200, height: 38 },
    arrow: 'down',
    panel: { top: 170, left: 10 },
  },
  {
    title: 'Your daily plan, already done',
    body: 'Every morning, Clarity reads your tasks and calendar to suggest a plan. Accept it in one click, or ask the AI to adjust.',
    target: { top: 230, left: 240, width: 740, height: 56 },
    arrow: 'up',
    panel: { top: 300, left: 240 },
  },
  {
    title: 'Tasks grouped by intent',
    body: 'Clarity doesn\'t just sort by due date. It groups tasks by energy — deep focus, quick wins, loose threads — so your list matches how you actually work.',
    target: { top: 310, left: 240, width: 740, height: 200 },
    arrow: 'up',
    panel: { top: 520, left: 240 },
  },
  {
    title: 'Collapse for focus',
    body: 'Click the sidebar edge or press Ctrl+\\ to shrink the sidebar to a minimal icon rail — more room for what matters.',
    target: { top: 0, left: 0, width: 232, height: 800 },
    arrow: 'right',
    panel: { top: 320, left: 248 },
  },
  {
    title: 'Ask your AI assistant',
    body: 'Press Ctrl+/ to open Ask Clarity. Ask anything: "What should I tackle first?", "What did I defer this week?", "Schedule the stale tasks." It knows your tasks.',
    target: { top: 700, left: 20, width: 200, height: 40 },
    arrow: 'up',
    panel: { top: 560, left: 10 },
  },
];

const TutorialOverlay = ({ step = 0 }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const s = COACH_STEPS[step];
  const total = COACH_STEPS.length;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      fontFamily: t.fontUI,
    }}>
      {/* Scrim — four rectangles around the target */}
      <ScrimRect t={t} style={{ top: 0, left: 0, right: 0, height: s.target.top }} />
      <ScrimRect t={t} style={{ top: s.target.top, left: 0, width: s.target.left, height: s.target.height }} />
      <ScrimRect t={t} style={{ top: s.target.top, left: s.target.left + s.target.width, right: 0, height: s.target.height }} />
      <ScrimRect t={t} style={{ top: s.target.top + s.target.height, left: 0, right: 0, bottom: 0 }} />

      {/* Spotlight ring */}
      <div style={{
        position: 'absolute',
        top: s.target.top - 3,
        left: s.target.left - 3,
        width: s.target.width + 6,
        height: s.target.height + 6,
        borderRadius: 10,
        boxShadow: `0 0 0 2px ${t.accent}`,
        pointerEvents: 'none',
      }}></div>

      {/* Coach panel */}
      <div style={{
        position: 'absolute',
        top: s.panel.top,
        left: s.panel.left,
        width: 320,
        background: t.ink,
        color: t.paper,
        borderRadius: t.r10,
        padding: '20px 22px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
      }}>
        {/* Step counter */}
        <div style={{
          display: 'flex', gap: 5, marginBottom: 14, alignItems: 'center',
        }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{
              width: i === step ? 20 : 5, height: 3, borderRadius: 2,
              background: i === step ? t.accent : 'rgba(255,255,255,0.25)',
              transition: 'width 200ms',
            }}></span>
          ))}
          <span style={{ fontFamily: t.fontMono, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginLeft: 6, letterSpacing: '0.06em' }}>
            {step + 1} / {total}
          </span>
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 500, letterSpacing: '-0.02em', color: '#fff' }}>{s.title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.70)', lineHeight: 1.55 }}>{s.body}</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button style={{
            fontFamily: t.fontUI, fontSize: 12, color: 'rgba(255,255,255,0.45)',
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          }}>Skip tutorial</button>
          <button style={{
            fontFamily: t.fontUI, fontSize: 13, fontWeight: 500,
            color: t.ink, background: '#fff',
            border: 'none', padding: '8px 16px', borderRadius: t.r6, cursor: 'pointer',
          }}>{step === total - 1 ? 'Done →' : 'Next →'}</button>
        </div>
      </div>
    </div>
  );
};

const ScrimRect = ({ t, style }) => (
  <div style={{
    position: 'absolute',
    background: 'rgba(15,15,18,0.62)',
    ...style,
  }}></div>
);

// Artboard: TodayView with Tutorial Step N overlaid
const TodayWithTutorial = ({ step }) => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <window.TodayView />
      <TutorialOverlay step={step || 0} />
    </div>
  );
};

window.TodayWithTutorial = TodayWithTutorial;
window.TutorialOverlay   = TutorialOverlay;
