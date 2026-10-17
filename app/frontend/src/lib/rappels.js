// Reminders in the window (2.3.0): the quick choices of the detail panel and
// « later » on a reminder, as local « YYYY-MM-DDTHH:MM » stamps (what the
// server keeps). Pure, checked by tools/verifier-rappels.mjs.
const pad = (n) => String(n).padStart(2, '0');
export const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fromStamp = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; };
const at = (d, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m); };
const up5 = (d) => new Date(Math.ceil(d.getTime() / 300e3) * 300e3);

/** When the next working day starts after `now` (09:00 without a working day). */
export function nextMorning(now, workday) {
  for (let k = 1; k <= 7; k++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    if (!workday?.days || workday.days.includes(d.getDay())) {
      const own = workday?.byDay?.[d.getDay()] ?? workday?.byDay?.[String(d.getDay())];
      return at(d, own?.start || workday?.start || '09:00');
    }
  }
  return at(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), '09:00');
}

/**
 * The quick choices for a task at `now`: [{ id, at }] — in an hour, this
 * evening (only before it), the next working morning, and before its hour
 * (only when it has one, still ahead).
 */
export function quickChoices(now, task, workday) {
  const out = [{ id: 'hour', at: stamp(up5(new Date(now.getTime() + 60 * 60e3))) }];
  const evening = at(now, workday?.end && workday.end > '17:00' ? workday.end : '18:00');
  if (evening - now > 30 * 60e3) out.push({ id: 'evening', at: stamp(evening) });
  out.push({ id: 'morning', at: stamp(nextMorning(now, workday)) });
  if (task?.time && /^\d{4}-\d{2}-\d{2}/.test(task.deadline || '')) {
    const start = at(new Date(`${task.deadline.slice(0, 10)}T00:00:00`), task.time);
    const before = new Date(start - 15 * 60e3);
    if (before > now) out.push({ id: 'before', at: stamp(before) });
  }
  return out;
}

/** « Later » on a reminder: in 10 minutes, or the next working morning. */
export const snooze = (now, kind, workday) => stamp(kind === 'tomorrow' ? nextMorning(now, workday) : up5(new Date(now.getTime() + 10 * 60e3)));
