// global-components.jsx — App-wide overlay components.
// 1. Delete Undo Toast — 5-second grace window on any task deletion
// 2. Analysis Staleness Banner — stale and error states in Today header

// ─── Delete Undo Toast ────────────────────────────────────────────────────────
// Spec: fixed, bottom 24px, left 50%, translateX(-50%)
// Dark bg (ink), min-width 280px, r10, 12px 16px padding.
// Progress bar: 2px at bottom, animates 100% → 0% over 5s.

const DeleteUndoToast = ({ progress }) => {
  const pct = progress != null ? progress : 0.55;
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: '#19191A',
      borderRadius: t.r10,
      boxShadow: '0 8px 24px rgba(25,25,26,0.18), 0 1px 4px rgba(25,25,26,0.10)',
      minWidth: 280, maxWidth: 440,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: t.fontUI,
    }}>
      <span style={{ fontSize: 13, color: 'rgba(244,243,238,0.85)', flex: 1 }}>Task deleted</span>
      <button style={{
        fontSize: 12.5, fontWeight: 500,
        color: 'rgba(255,255,255,0.90)',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontFamily: 'inherit',
      }}>Undo</button>
      {/* Progress bar — animates 100% → 0% over 5s */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
        background: 'rgba(255,255,255,0.20)',
      }}>
        <div style={{
          height: '100%',
          width: `${pct * 100}%`,
          background: 'rgba(255,255,255,0.60)',
        }}></div>
      </div>
    </div>
  );
};

// Artboard: toast positioned at bottom-center over a faded Today background
const UndoToastDemo = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: t.fontUI,
    }}>
      {/* Faded app context */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none', overflow: 'hidden' }}>
        <window.TodayWithTimelineView />
      </div>
      {/* Toast — pinned bottom-center */}
      <div style={{
        position: 'absolute', bottom: 36, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        zIndex: 10,
      }}>
        <DeleteUndoToast progress={0.55} />
        <span style={{
          fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: t.ink40, whiteSpace: 'nowrap',
        }}>~3s remaining · auto-deletes when bar reaches 0</span>
      </div>
    </div>
  );
};

// ─── Analysis Staleness Banner ─────────────────────────────────────────────────
// Spec: sits between greeting header and AI plan strip in Today / Focus view.
// Two states: stale (warn dot, paperSubtle bg) and error (red tint).

const AnalysisStaleBanner = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: t.paperSubtle,
      border: `1px solid ${t.hairline}`,
      borderRadius: t.r6,
      padding: '10px 14px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: t.warn, flexShrink: 0,
      }}></span>
      <span style={{ fontSize: 12.5, color: t.ink60, flex: 1 }}>
        Analysis updated{' '}
        <span style={{ color: t.ink80, fontWeight: 500 }}>14m ago</span>
      </span>
      <span style={{ fontSize: 12.5, color: t.ink60, cursor: 'pointer' }}>Re-analyze</span>
    </div>
  );
};

const AnalysisErrorBanner = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'oklch(0.97 0.02 25)',
      border: '1px solid oklch(0.88 0.05 25)',
      borderRadius: t.r6,
      padding: '10px 14px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'oklch(0.62 0.15 25)', flexShrink: 0,
      }}></span>
      <span style={{ fontSize: 12.5, color: 'oklch(0.45 0.12 25)', flex: 1 }}>
        AI analysis failed
      </span>
      <span style={{ fontSize: 12.5, color: 'oklch(0.45 0.12 25)', cursor: 'pointer' }}>
        Try again
      </span>
    </div>
  );
};

// Spec artboard — both banner states with annotations
const AnalysisBannerSpec = () => {
  const t = window.useT ? window.useT() : window.CLARITY_TOKENS;
  const SpecLabel = ({ children }) => (
    <div style={{
      fontFamily: t.fontMono, fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: t.ink40, marginBottom: 10,
    }}>{children}</div>
  );
  return (
    <div style={{
      width: '100%', height: '100%',
      background: t.paper, fontFamily: t.fontUI,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '56px 80px', boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        {/* Header */}
        <div style={{ marginBottom: 44 }}>
          <div style={{
            fontFamily: t.fontMono, fontSize: 11, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: t.ink60, marginBottom: 6,
          }}>Global component</div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em', color: t.ink }}>
            Analysis staleness banner
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 13.5, color: t.ink60, lineHeight: 1.55, maxWidth: 520 }}>
            Appears at the top of the Today main column, between the greeting header and the AI plan strip. Shown when AI analysis is older than threshold, or has failed.
          </p>
        </div>

        {/* Stale state */}
        <div style={{ marginBottom: 36 }}>
          <SpecLabel>Stale state — analysis older than threshold</SpecLabel>
          <AnalysisStaleBanner />
          <div style={{
            marginTop: 10, display: 'flex', gap: 20,
            fontFamily: t.fontMono, fontSize: 10, color: t.ink40,
          }}>
            <span>bg: paperSubtle</span>
            <span>dot: warn</span>
            <span>border: hairline</span>
            <span>text: ink60 · bold value: ink80 w500</span>
          </div>
        </div>

        <div style={{ height: 1, background: t.hairline, margin: '0 0 36px' }}></div>

        {/* Error state */}
        <div>
          <SpecLabel>Error state — analysis failed to run</SpecLabel>
          <AnalysisErrorBanner />
          <div style={{
            marginTop: 10, display: 'flex', gap: 20,
            fontFamily: t.fontMono, fontSize: 10, color: t.ink40,
          }}>
            <span>bg: oklch(0.97 0.02 25)</span>
            <span>dot: oklch(0.62 0.15 25)</span>
            <span>border: oklch(0.88 0.05 25)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

window.DeleteUndoToast    = DeleteUndoToast;
window.UndoToastDemo      = UndoToastDemo;
window.AnalysisStaleBanner = AnalysisStaleBanner;
window.AnalysisErrorBanner = AnalysisErrorBanner;
window.AnalysisBannerSpec  = AnalysisBannerSpec;
