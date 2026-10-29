// The day's rituals (2.7.0): plan the morning, shut down in the evening, empty
// one's head, and look at « Someday » once a month. What the Sunsama reviews
// credit for the relief: the day is decided, and what is not in it is put
// somewhere on purpose instead of waiting at the bottom of a list.
//
// Pure — the clock is a parameter — so tools/verifier-rituels.mjs checks it.

import { hoursOf, plannedMinutes, toMin } from './journee.js';
import { parseInput } from './saisie.js';

const pad = (n) => String(n).padStart(2, '0');
export const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const plusDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// A task the rituals look at: not done, not parked in Someday.
const open = (t) => t && t.status !== 'done' && !t.archived && !t.someday;

/** Left over from before today: an unfinished task whose day has passed. */
export function leftovers(tasks, now) {
  const today = dayOf(now);
  return (tasks || []).filter(t => open(t) && t.deadline && t.deadline.slice(0, 10) < today);
}

/** What today holds: due today (quick tasks included — they are part of the day). */
export function todayTasks(tasks, now) {
  const today = dayOf(now);
  return (tasks || []).filter(t => open(t) && t.deadline?.slice(0, 10) === today);
}

/** Undated and not quick: what could be pulled into today. */
export function candidatesForToday(tasks) {
  return (tasks || []).filter(t => open(t) && !t.deadline && !t.quick);
}

/** Finished today, by the last « → done » of its history. */
export function doneOn(tasks, now) {
  const today = dayOf(now);
  const at = (t) => [...(t.history || [])].reverse().find(h => h.type === 'status' && h.to === 'done')?.at || t.updatedAt;
  return (tasks || []).filter(t => t?.status === 'done' && at(t) && dayOf(new Date(at(t))) === today);
}

/**
 * Does today's list fit today's hours? `planned`: the minutes the tasks will
 * take (their estimate, corrected by the measured gap — lib/journee.js);
 * `free`: the working hours left from `now`, breaks out. Quick tasks count
 * nothing: a title, no estimate, minutes at most. No working day: no verdict.
 */
export function capacity({ tasks, now, workday, estimation = {} }) {
  const hours = hoursOf(workday, now.getDay());
  const planned = (tasks || []).filter(t => !t.quick).reduce((s, t) => s + plannedMinutes(t, estimation).minutes, 0);
  if (!hours) return { planned, free: null, over: false };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const from = Math.max(toMin(hours.start), nowMin), to = toMin(hours.end);
  let free = Math.max(0, to - from);
  for (const b of hours.breaks || []) {
    const s = Math.max(toMin(b.start), from), e = Math.min(toMin(b.end), to);
    if (e > s) free -= e - s;
  }
  return { planned, free, over: planned > free };
}

/** Where a choice puts a task: the patch it sends. */
export function moveTo(choice, now) {
  if (choice === 'today') return { deadline: dayOf(now), someday: false };
  if (choice === 'tomorrow') return { deadline: dayOf(plusDays(now, 1)), someday: false };
  if (choice === 'later') return { deadline: null, someday: false };
  if (choice === 'someday') return { someday: true };
  return null;
}

/** « Someday » deserves a look: not reviewed for 30 days, and not empty. */
export const REVIEW_DAYS = 30;
export function reviewDue(lastReview, now, count) {
  if (!count) return false;
  const t = Date.parse(lastReview || '');
  return Number.isNaN(t) || now.getTime() - t >= REVIEW_DAYS * 86400000;
}

/**
 * The brain dump: everything typed, one line per task. Bullets, boxes and
 * numbers go; each line goes through the quick-capture grammar (lib/saisie.js),
 * so « dentiste vendredi 9h #santé » keeps its day, hour and topic. Empty
 * lines and lines that leave no title are dropped. A line with a day of its
 * own starts as « that day »; the others start as « later ».
 */
export function parseDump(text, now, { dateOrder = 'dmy' } = {}) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*/, '').trim();
    if (!line) continue;
    const p = parseInput(line, now, { dateOrder });
    if (!/[\p{L}\p{N}]/u.test(p.title || '')) continue;   // « # » alone, « -- » : no task
    out.push({ ...p, title: p.title.trim(), choice: p.deadline ? 'dated' : 'later' });
  }
  return out;
}

/** What the morning plan may skip: an empty step is not shown. */
export function planSteps({ tasks, now, lastReview }) {
  const someday = (tasks || []).filter(t => t?.someday && t.status !== 'done' && !t.archived);
  return [
    leftovers(tasks, now).length ? 'leftovers' : null,
    'today',
    reviewDue(lastReview, now, someday.length) ? 'someday' : null,
  ].filter(Boolean);
}
