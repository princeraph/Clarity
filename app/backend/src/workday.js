// The working day (2.0.0, « the realistic day »): when it starts and ends,
// the break, the days worked. Settings › Day to day; read by the day plan
// (frontend/src/lib/journee.js). Saved in settings.json, on this computer.

export const WORKDAY_DEFAULTS = {
  start: '09:00', end: '18:00',
  breakStart: '12:00', breakEnd: '13:00',
  days: [1, 2, 3, 4, 5],              // Monday to Friday (JS: 0 = Sunday)
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** The saved working day, with the defaults for whatever is missing. */
export function workdayOf(settings) {
  const w = settings?.workday;
  return w && validWorkday(w) === null ? { ...WORKDAY_DEFAULTS, ...w } : { ...WORKDAY_DEFAULTS };
}

/** Null when it is a usable working day, else what is wrong with it. */
export function validWorkday(w) {
  if (!w || typeof w !== 'object') return 'not an object';
  const full = { ...WORKDAY_DEFAULTS, ...w };
  for (const k of ['start', 'end']) if (!HHMM.test(full[k])) return `${k} must be HH:MM`;
  for (const k of ['breakStart', 'breakEnd']) if (full[k] !== null && !HHMM.test(full[k])) return `${k} must be HH:MM or null`;
  if (minutes(full.end) <= minutes(full.start)) return 'the day must end after it starts';
  if ((full.breakStart === null) !== (full.breakEnd === null)) return 'a break needs both ends';
  if (full.breakStart !== null && !(minutes(full.start) <= minutes(full.breakStart) && minutes(full.breakStart) < minutes(full.breakEnd) && minutes(full.breakEnd) <= minutes(full.end)))
    return 'the break must sit inside the day';
  if (!Array.isArray(full.days) || full.days.length === 0 || full.days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(full.days).size !== full.days.length)
    return 'days must be distinct numbers 0 to 6';
  return null;
}
