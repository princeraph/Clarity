// The working day (2.0.0, « the realistic day »; 2.2.0: several breaks, and
// hours that may differ by day). Settings › Day to day; read by the day plan
// (frontend/src/lib/journee.js). Saved in settings.json, on this computer.
//
//   { start, end, breaks: [{ start, end, label }], days: [1..5],
//     byDay: { '5': { start, end, breaks } } }       // byDay: optional
//
// A day in `byDay` replaces the common hours and breaks for that day only.
// The 2.0 shape (breakStart / breakEnd) is still read, and turned into breaks.

export const WORKDAY_DEFAULTS = {
  start: '09:00', end: '18:00',
  breaks: [{ start: '12:00', end: '13:00', label: '' }],
  days: [1, 2, 3, 4, 5],              // Monday to Friday (JS: 0 = Sunday)
};
export const MAX_BREAKS = 6;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** The 2.0 shape → the 2.2 one; anything else is left for validWorkday to judge. */
export function upgradeWorkday(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return w;
  const { breakStart, breakEnd, ...rest } = w;
  if (rest.breaks !== undefined || (breakStart === undefined && breakEnd === undefined)) return rest;
  return { ...rest, breaks: breakStart && breakEnd ? [{ start: breakStart, end: breakEnd, label: '' }] : breakStart === null && breakEnd === null ? [] : [{ start: breakStart, end: breakEnd }] };
}

/** The saved working day, with the defaults for whatever is missing. */
export function workdayOf(settings) {
  const w = upgradeWorkday(settings?.workday);
  return w && validWorkday(w) === null ? { ...WORKDAY_DEFAULTS, ...w } : { ...WORKDAY_DEFAULTS };
}

function hoursProblem(h, where) {
  for (const k of ['start', 'end']) if (!HHMM.test(h[k] || '')) return `${where}${k} must be HH:MM`;
  if (minutes(h.end) <= minutes(h.start)) return `${where}the day must end after it starts`;
  if (!Array.isArray(h.breaks)) return `${where}breaks must be a list`;
  if (h.breaks.length > MAX_BREAKS) return `${where}at most ${MAX_BREAKS} breaks`;
  const sorted = [];
  for (const b of h.breaks) {
    if (!b || !HHMM.test(b.start || '') || !HHMM.test(b.end || '')) return `${where}a break needs both ends, HH:MM`;
    if (b.label !== undefined && (typeof b.label !== 'string' || b.label.length > 40)) return `${where}a break label is text, 40 characters at most`;
    if (!(minutes(h.start) <= minutes(b.start) && minutes(b.start) < minutes(b.end) && minutes(b.end) <= minutes(h.end))) return `${where}a break must sit inside the day`;
    sorted.push([minutes(b.start), minutes(b.end)]);
  }
  sorted.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) if (sorted[i][0] < sorted[i - 1][1]) return `${where}two breaks overlap`;
  return null;
}

/** Null when it is a usable working day, else what is wrong with it. */
export function validWorkday(w) {
  w = upgradeWorkday(w);
  if (!w || typeof w !== 'object' || Array.isArray(w)) return 'not an object';
  const full = { ...WORKDAY_DEFAULTS, ...w };
  const common = hoursProblem(full, '');
  if (common) return common;
  if (!Array.isArray(full.days) || full.days.length === 0 || full.days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(full.days).size !== full.days.length)
    return 'days must be distinct numbers 0 to 6';
  if (full.byDay !== undefined) {
    if (!full.byDay || typeof full.byDay !== 'object' || Array.isArray(full.byDay)) return 'byDay must be an object';
    for (const [d, h] of Object.entries(full.byDay)) {
      if (!/^[0-6]$/.test(d)) return 'byDay keys are days 0 to 6';
      const p = hoursProblem({ breaks: [], ...h }, `day ${d}: `);
      if (p) return p;
    }
  }
  return null;
}
