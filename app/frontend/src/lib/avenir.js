// « Upcoming » (2.1.0): the next days, one by one — what is due each day, how
// long it takes, and whether the day can hold it. Replaces « Up next », which
// listed the next four of the order whatever their date. Pure: the day is a
// parameter, so tools/verifier-a-venir.mjs checks it without a window.
import { plannedMinutes, toMin, breaksOf, hoursOf } from './journee.js';

const pad = (n) => String(n).padStart(2, '0');
export function addDays(iso, k) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + k);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export const weekday = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

/** The free minutes of a day: working hours minus the breaks and the events in them. */
export function dayCapacity(iso, workday, events = []) {
  const h = hoursOf(workday, weekday(iso));      // that day's own hours, if it has some
  if (!h) return 0;
  const s = toMin(h.start), e = toMin(h.end);
  // Minute by minute is plenty for one day, and never counts an overlap twice.
  const taken = new Uint8Array(24 * 60);
  for (const b of [...breaksOf(h), ...events]) for (let m = Math.max(s, b.start); m < Math.min(e, b.end); m++) taken[m] = 1;
  let free = 0; for (let m = s; m < e; m++) if (!taken[m]) free++;
  return free;
}

/**
 * `tasks`: in the order of lib/ordre.js. `events`: { 'YYYY-MM-DD': [{ start, end }] } in minutes.
 * Returns the days from tomorrow that have something due, each:
 * { date, tasks (at most `limit`), more, count, minutes, capacity, worked, over }.
 */
export function upcoming({ tasks, today, days = 7, workday = null, events = {}, estimation = {}, limit = 5 }) {
  const live = tasks.filter(t => t.status !== 'done' && !t.archived && t.deadline);
  const out = [];
  for (let k = 1; k <= days; k++) {
    const date = addDays(today, k);
    const due = live.filter(t => t.deadline.slice(0, 10) === date);
    if (!due.length) continue;
    const minutes = due.reduce((a, t) => a + plannedMinutes(t, estimation).minutes, 0);
    const worked = !!hoursOf(workday, weekday(date));
    const capacity = dayCapacity(date, workday, events[date] || []);
    out.push({ date, tasks: due.slice(0, limit), more: Math.max(0, due.length - limit), count: due.length, minutes, capacity, worked, over: minutes > capacity });
  }
  return out;
}
