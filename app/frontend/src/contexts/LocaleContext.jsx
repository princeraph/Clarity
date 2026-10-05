import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from '../locales/en.js';
import fr from '../locales/fr.js';

// Clarity shipped a language picker offering eight languages and implementing
// none: it wrote `clarity-locale` to localStorage, nothing ever read it, and a
// banner claimed translations were "in progress". They were not.
//
// So the rule here is the one that setting broke: a language is offered only if
// it exists. Adding one means adding a file to DICTIONARIES and translating the
// keys — and `tools/verifier-locales.mjs` refuses a dictionary that is missing
// any of them, which is what stops a half-translated language from shipping and
// looking like the old lie all over again.

// Each language is named in itself, whatever the interface language — that is
// how a person finds their own in the list (locales-ok on both lines).
export const DICTIONARIES = {
  'en-US': { label: 'English', flag: '\u{1F1FA}\u{1F1F8}', dateLocale: 'en-US', strings: en },  // locales-ok: endonym
  'fr-FR': { label: 'Français', flag: '\u{1F1EB}\u{1F1F7}', dateLocale: 'fr-FR', strings: fr }, // locales-ok: endonym
};

export const LANGUAGES = Object.entries(DICTIONARIES).map(([id, d]) => ({ id, label: d.label, flag: d.flag }));

const DEFAULT_LOCALE = 'en-US';
const STORAGE_KEY = 'clarity-locale';

const LocaleContext = createContext(null);

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // A locale the app no longer ships must not leave the UI keyless. The old
    // picker could have stored any of eight ids, six of which never existed.
    return saved && DICTIONARIES[saved] ? saved : DEFAULT_LOCALE;
  } catch { return DEFAULT_LOCALE; }
}

// Fill {placeholders}. A missing variable leaves the placeholder visible rather
// than printing "undefined" — one is a translation bug you can see, the other
// reads as a crash.
function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole);
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readStored);

  const setLocale = useCallback((id) => {
    if (!DICTIONARIES[id]) return;
    setLocaleState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const value = useMemo(() => {
    const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];

    // Fall back to English rather than showing a raw key: an untranslated
    // string is a small flaw, a screen full of `focus.greeting.morning` is a
    // broken app. The build-time checker is what keeps this path unused.
    const t = (key, vars) => {
      const s = dict.strings[key] ?? DICTIONARIES[DEFAULT_LOCALE].strings[key];
      return s === undefined ? key : interpolate(s, vars);
    };

    const fmtDate = (value, opts = { day: 'numeric', month: 'short' }) => {
      const d = value instanceof Date ? value : new Date(value);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(dict.dateLocale, opts);
    };
    const fmtDateTime = (value) => {
      const d = value instanceof Date ? value : new Date(value);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(dict.dateLocale);
    };

    // Durations are words too: "3h 30m" stayed English in a French interface
    // because every component built it with a template string. One place now,
    // and the unit layout ("3 h 30", "45 min") comes from the dictionary.
    const fmtNumber = (n, digits = 1) =>
      Number(n).toLocaleString(dict.dateLocale, { maximumFractionDigits: digits });
    const fmtDuration = (minutes) => {
      if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return null;
      const total = Math.round(minutes);
      const h = Math.floor(total / 60);
      const m = total % 60;
      if (h === 0) return t('unit.minutes', { n: m });
      if (m === 0) return t('unit.hours', { n: h });
      return t('unit.hoursMinutes', { h, m, mm: String(m).padStart(2, '0') });
    };
    // Decimal hours for a compact total: "1.5h", "1,5 h".
    const fmtHours = (minutes) => t('unit.hours', { n: fmtNumber(minutes / 60) });

    return { locale, setLocale, t, fmtDate, fmtDateTime, fmtNumber, fmtDuration, fmtHours, dateLocale: dict.dateLocale, languages: LANGUAGES };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside a LocaleProvider');
  return ctx;
}
