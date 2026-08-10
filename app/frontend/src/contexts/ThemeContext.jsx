import { createContext, useContext, useState, useEffect } from 'react';

const BASE_LIGHT = {
  paper: '#FAFAF7', paperSubtle: '#F4F3EE', paperMuted: '#EEEDE7', panel: '#FFFFFF',
  hairline: 'rgba(25, 25, 26, 0.08)', hairlineSoft: 'rgba(25, 25, 26, 0.05)',
  divider: 'rgba(25, 25, 26, 0.10)',
  ink: '#19191A', ink80: 'rgba(25, 25, 26, 0.78)', ink60: 'rgba(25, 25, 26, 0.55)',
  ink40: 'rgba(25, 25, 26, 0.36)', ink20: 'rgba(25, 25, 26, 0.18)',
  warn: 'oklch(0.62 0.10 65)', done: 'oklch(0.58 0.07 155)',
  danger: 'oklch(0.52 0.15 25)', dangerSoft: 'oklch(0.97 0.02 25)', dangerBorder: 'oklch(0.88 0.05 25)',
  success: 'oklch(0.52 0.10 155)', successSoft: 'oklch(0.93 0.03 155)', successBorder: 'oklch(0.80 0.06 155)',
  r6: '6px', r10: '10px', r14: '14px', rPill: '999px',
};

const BASE_DARK = {
  paper: '#16161A', paperSubtle: '#1C1C20', paperMuted: '#222227', panel: '#1E1E22',
  hairline: 'rgba(255, 255, 255, 0.08)', hairlineSoft: 'rgba(255, 255, 255, 0.04)',
  divider: 'rgba(255, 255, 255, 0.12)',
  ink: '#F4F3EE', ink80: 'rgba(244, 243, 238, 0.78)', ink60: 'rgba(244, 243, 238, 0.55)',
  ink40: 'rgba(244, 243, 238, 0.36)', ink20: 'rgba(244, 243, 238, 0.18)',
  warn: 'oklch(0.72 0.10 65)', done: 'oklch(0.68 0.08 155)',
  danger: 'oklch(0.68 0.15 25)', dangerSoft: 'oklch(0.24 0.05 25)', dangerBorder: 'oklch(0.42 0.08 25)',
  success: 'oklch(0.65 0.10 155)', successSoft: 'oklch(0.22 0.05 155)', successBorder: 'oklch(0.38 0.07 155)',
  r6: '6px', r10: '10px', r14: '14px', rPill: '999px',
};

// Accent presets: each key is the swatch color shown in settings
const ACCENT_PRESETS = {
  'oklch(0.48 0.13 258)': {
    light: { accent: 'oklch(0.48 0.13 258)', accentSoft: 'oklch(0.94 0.03 258)', accentInk: 'oklch(0.32 0.10 258)' },
    dark:  { accent: 'oklch(0.68 0.13 258)', accentSoft: 'oklch(0.30 0.08 258)', accentInk: 'oklch(0.86 0.06 258)' },
  },
  'oklch(0.55 0.10 155)': {
    light: { accent: 'oklch(0.55 0.10 155)', accentSoft: 'oklch(0.93 0.03 155)', accentInk: 'oklch(0.35 0.08 155)' },
    dark:  { accent: 'oklch(0.68 0.10 155)', accentSoft: 'oklch(0.28 0.06 155)', accentInk: 'oklch(0.85 0.05 155)' },
  },
  'oklch(0.62 0.13 40)': {
    light: { accent: 'oklch(0.62 0.13 40)',  accentSoft: 'oklch(0.95 0.04 40)',  accentInk: 'oklch(0.38 0.10 40)' },
    dark:  { accent: 'oklch(0.72 0.13 40)',  accentSoft: 'oklch(0.32 0.08 40)',  accentInk: 'oklch(0.88 0.06 40)' },
  },
  'oklch(0.50 0.12 320)': {
    light: { accent: 'oklch(0.50 0.12 320)', accentSoft: 'oklch(0.94 0.03 320)', accentInk: 'oklch(0.32 0.09 320)' },
    dark:  { accent: 'oklch(0.68 0.12 320)', accentSoft: 'oklch(0.30 0.07 320)', accentInk: 'oklch(0.86 0.06 320)' },
  },
};

const FONT_STACKS = {
  geist:  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  serif:  '"Georgia", "Times New Roman", serif',
};

const DENSITY_SCALE = {
  spacious: { taskPadV: 16, taskPadH: 6, taskCheckSize: 18, taskTitleSize: 15.5, taskMetaSize: 12, listGap: 36, groupGap: 36, sectionTitleSize: 14 },
  balanced: { taskPadV: 12, taskPadH: 4, taskCheckSize: 16, taskTitleSize: 14.5, taskMetaSize: 11, listGap: 26, groupGap: 26, sectionTitleSize: 13.5 },
  compact:  { taskPadV:  7, taskPadH: 2, taskCheckSize: 13, taskTitleSize: 13,   taskMetaSize: 10.5, listGap: 18, groupGap: 18, sectionTitleSize: 12.5 },
};

function buildT(isDark, accentKey, density, fontKey) {
  const base = isDark ? BASE_DARK : BASE_LIGHT;
  const ap = ACCENT_PRESETS[accentKey] || ACCENT_PRESETS['oklch(0.48 0.13 258)'];
  const accentTokens = isDark ? ap.dark : ap.light;
  const scale = DENSITY_SCALE[density] || DENSITY_SCALE.balanced;
  const fontUI = FONT_STACKS[fontKey] || FONT_STACKS.geist;
  const fontMono = '"Geist Mono", ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace';
  return { ...base, ...accentTokens, ...scale, fontUI, fontMono };
}

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [themeMode, _setThemeMode] = useState(() => {
    try { return localStorage.getItem('clarity-theme') || 'light'; } catch { return 'light'; }
  });
  const [accent, _setAccent] = useState(() => {
    try { return localStorage.getItem('clarity-accent') || 'oklch(0.48 0.13 258)'; } catch { return 'oklch(0.48 0.13 258)'; }
  });
  const [density, _setDensity] = useState(() => {
    try { return localStorage.getItem('clarity-density') || 'balanced'; } catch { return 'balanced'; }
  });
  const [font, _setFont] = useState(() => {
    try { return localStorage.getItem('clarity-font') || 'geist'; } catch { return 'geist'; }
  });
  const [sysDark, setSysDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => setSysDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = themeMode === 'auto' ? sysDark : themeMode === 'dark';
  const T = buildT(isDark, accent, density, font);

  function setThemeMode(mode) {
    _setThemeMode(mode);
    try { localStorage.setItem('clarity-theme', mode); } catch {}
  }

  function toggleTheme() {
    setThemeMode(isDark ? 'light' : 'dark');
  }

  function setAccent(val) {
    _setAccent(val);
    try { localStorage.setItem('clarity-accent', val); } catch {}
  }

  function setDensity(val) {
    _setDensity(val);
    try { localStorage.setItem('clarity-density', val); } catch {}
  }

  function setFont(val) {
    _setFont(val);
    try { localStorage.setItem('clarity-font', val); } catch {}
  }

  return (
    <ThemeCtx.Provider value={{ T, isDark, themeMode, toggleTheme, setThemeMode, accent, setAccent, density, setDensity, font, setFont }}>
      <div style={{ background: T.paper, color: T.ink, fontFamily: T.fontUI, width: '100%', height: '100%', overflow: 'hidden' }}>
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
