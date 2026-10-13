// Next occurrence of a repeating task. Pure: no I/O, no clock.
//
// Monthly used to be `setMonth(getMonth() + 1)`, which keeps the day and lets
// it overflow: a task due 31 January came back on 3 March, February skipped —
// the rent, the invoice, the month-end report, exactly the monthly tasks
// people have. Clamping to the end of a short month fixes that, but clamping
// alone drifts: 31 Jan → 28 Feb → 28 Mar, and the series never returns to the
// 31st. So a monthly series remembers the day it was set for (`recurrenceDay`)
// and every occurrence aims at that day, clamped to the length of its month.

const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/** Day of month (1-31) a monthly series aims at, or null when there is none. */
export function anchorDayOf(task) {
  if (!task) return null;
  const stored = Number(task.recurrenceDay);
  if (Number.isInteger(stored) && stored >= 1 && stored <= 31) return stored;
  if (!task.deadline) return null;
  const day = Number(String(task.deadline).slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

/**
 * @param {string} deadline   'YYYY-MM-DD' of the occurrence just completed
 * @param {string} recurring  'daily' | 'weekly' | 'monthly' | 'none'
 * @param {number} [anchorDay] day of month a monthly series aims at; defaults
 *                             to the day of `deadline`
 */
export function nextDeadline(deadline, recurring, anchorDay) {
  if (!deadline) return null;
  const d = new Date(String(deadline).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  if (recurring === 'daily')  d.setDate(d.getDate() + 1);
  if (recurring === 'weekly') d.setDate(d.getDate() + 7);
  if (recurring === 'monthly') {
    const day = Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : d.getDate();
    d.setDate(1);                       // step from the 1st: nothing can overflow
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
  }
  return fmt(d);
}
