// Reminders (2.3.0). Which ones are due now: a task's own reminder (set by
// the person), a few minutes before a task that has its hour, and the morning
// summary at the start of the working day. Pure — the clock is a parameter —
// so tests/rappels.test.js checks every rule. The day plan's blocks are
// reminded in the window (the plan lives there); see useReminders.js.
//
// Each reminder has a key; the server keeps the keys already given
// (data.reminderLog) so that none is given twice, even across a restart.
// One found more than STALE_HOURS late (the computer was off) is dropped
// quietly: a reminder for yesterday morning is noise, not help.

export const REMINDER_DEFAULTS = { before: 10, morning: true, blocks: true };
export const BEFORE_CHOICES = [0, 5, 10, 15, 30, 60];
export const STALE_HOURS = 12;
const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** A task's reminder: null, or a local « YYYY-MM-DDTHH:MM » that exists. */
export function validReminder(v) {
  if (v === null) return true;
  const m = STAMP.exec(v || '');
  if (!m) return false;
  const [, y, mo, d, h, mi] = m.map(Number);
  const at = new Date(y, mo - 1, d, h, mi);
  return at.getFullYear() === y && at.getMonth() === mo - 1 && at.getDate() === d && h < 24 && mi < 60;
}
const parse = (s) => { const m = STAMP.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; };
const pad = (n) => String(n).padStart(2, '0');
export const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Null when the reminder settings are usable, else what is wrong. */
export function validReminderSettings(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'not an object';
  if (r.before !== undefined && !BEFORE_CHOICES.includes(r.before)) return `before must be one of ${BEFORE_CHOICES.join(', ')}`;
  for (const k of ['morning', 'blocks']) if (r[k] !== undefined && typeof r[k] !== 'boolean') return `${k} must be true or false`;
  return null;
}
export const remindersOf = (settings) => ({ ...REMINDER_DEFAULTS, ...(validReminderSettings(settings?.reminders) === null ? settings.reminders : {}) });

// When the working day starts on that date, or null when it is not worked.
function dayStart(workday, date) {
  if (!workday || !Array.isArray(workday.days) || !workday.days.includes(date.getDay())) return null;
  const own = workday.byDay?.[date.getDay()] ?? workday.byDay?.[String(date.getDay())];
  const [h, m] = String(own?.start || workday.start || '09:00').split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}

/**
 * The reminders due at `now` and not given yet (`log`: { key: when given }).
 * Returns [{ key, kind: 'task'|'before'|'morning', at, stale, taskId?, taskIds? }].
 */
export function dueReminders({ tasks, settings = {}, now = new Date(), log = {} }) {
  const r = remindersOf(settings);
  const live = (tasks || []).filter(t => t && t.status !== 'done' && !t.archived);
  const out = [];
  const add = (key, kind, at, extra) => {
    if (log[key] || at > now) return;
    out.push({ key, kind, at: at.toISOString(), stale: now - at > STALE_HOURS * 3600e3, ...extra });
  };
  for (const t of live) {
    if (t.reminder && validReminder(t.reminder)) add(`task:${t.id}:${t.reminder}`, 'task', parse(t.reminder), { taskId: t.id });
    if (r.before > 0 && t.time && /^\d{4}-\d{2}-\d{2}/.test(t.deadline || '')) {
      const start = parse(`${t.deadline.slice(0, 10)}T${t.time}`);
      if (!start) continue;
      // Before the hour, and only until it: once begun, « in 10 minutes » is wrong.
      if (now < start) add(`before:${t.id}:${t.deadline.slice(0, 10)}T${t.time}`, 'before', new Date(start - r.before * 60e3), { taskId: t.id, startsAt: start.toISOString() });
    }
  }
  if (r.morning) {
    const today = localDay(now);
    const start = dayStart(settings.workday, now);
    const due = live.filter(t => t.deadline && t.deadline.slice(0, 10) <= today);
    // The summary of the day is for its morning: not at 4 pm, after a day off.
    if (start && due.length && now - start < 3 * 3600e3) add(`morning:${today}`, 'morning', start, { taskIds: due.map(t => t.id), late: due.filter(t => t.deadline.slice(0, 10) < today).length });
  }
  return out;
}

/** The log without what is older than a week: the keys carry their date, a week is plenty. */
export function pruneLog(log, now = new Date()) {
  return Object.fromEntries(Object.entries(log || {}).filter(([, at]) => now - new Date(at) < 8 * 86400e3));
}
