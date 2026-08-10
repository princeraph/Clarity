// Dark theme tokens — paired 1:1 with light tokens. Same accent, deeper paper.
// We keep the warm tone in dark mode (charcoal, not slate) so the brand stays
// consistent. Also exports `ClarityCtx` + `useT()` so any component can opt in
// to a swapped theme via <ClarityCtx.Provider value={CLARITY_DARK}>.

const CLARITY_DARK = {
  paper:        '#16161A',
  paperSubtle:  '#1C1C20',
  paperMuted:   '#222227',
  panel:        '#1E1E22',
  hairline:     'rgba(255, 255, 255, 0.08)',
  hairlineSoft: 'rgba(255, 255, 255, 0.04)',
  divider:      'rgba(255, 255, 255, 0.12)',

  ink:          '#F4F3EE',
  ink80:        'rgba(244, 243, 238, 0.78)',
  ink60:        'rgba(244, 243, 238, 0.55)',
  ink40:        'rgba(244, 243, 238, 0.36)',
  ink20:        'rgba(244, 243, 238, 0.18)',

  accent:       'oklch(0.68 0.13 258)',
  accentSoft:   'oklch(0.30 0.08 258)',
  accentInk:    'oklch(0.86 0.06 258)',

  warn:         'oklch(0.72 0.10 65)',
  done:         'oklch(0.68 0.08 155)',

  fontUI:       '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontMono:     '"Geist Mono", ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',

  r6:  '6px', r10: '10px', r14: '14px', rPill: '999px',
};

const ClarityCtx = React.createContext(null);
const useT = () => React.useContext(ClarityCtx) || window.CLARITY_TOKENS;

window.CLARITY_DARK = CLARITY_DARK;
window.ClarityCtx = ClarityCtx;
window.useT = useT;
