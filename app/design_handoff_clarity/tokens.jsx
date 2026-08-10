// Clarity design tokens — calm, minimal, paper-and-ink with a single ink-blue accent.
// Single source of truth used across every artboard.

const CLARITY_TOKENS = {
  // Surfaces — warm paper, not pure white
  paper:        '#FAFAF7',
  paperSubtle:  '#F4F3EE',
  paperMuted:   '#EEEDE7',
  panel:        '#FFFFFF',
  hairline:     'rgba(25, 25, 26, 0.08)',
  hairlineSoft: 'rgba(25, 25, 26, 0.05)',
  divider:      'rgba(25, 25, 26, 0.10)',

  // Ink
  ink:          '#19191A',
  ink80:        'rgba(25, 25, 26, 0.78)',
  ink60:        'rgba(25, 25, 26, 0.55)',
  ink40:        'rgba(25, 25, 26, 0.36)',
  ink20:        'rgba(25, 25, 26, 0.18)',

  // Accent — single muted ink-blue. Used sparingly: focus, AI, today.
  accent:       'oklch(0.48 0.13 258)',
  accentSoft:   'oklch(0.94 0.03 258)',
  accentInk:    'oklch(0.32 0.10 258)',

  // Status — desaturated. Never a pure "red".
  warn:         'oklch(0.62 0.10 65)',
  done:         'oklch(0.58 0.07 155)',

  // Type
  fontUI:       '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontMono:     '"Geist Mono", ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',

  // Radii — restrained. Cards 10, controls 6, pills 999.
  r6:  '6px',
  r10: '10px',
  r14: '14px',
  rPill: '999px',
};

window.CLARITY_TOKENS = CLARITY_TOKENS;

// Inject the Geist + Geist Mono fonts once.
(function injectClarityFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('clarity-fonts')) return;
  const link = document.createElement('link');
  link.id = 'clarity-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);
})();
