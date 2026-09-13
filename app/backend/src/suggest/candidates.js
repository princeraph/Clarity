// What Clarity might say, and why it would be worth an interruption.
//
// Every candidate here is triggered by ARITHMETIC on things the app recorded —
// a check-in that came due, a deadline that passed, a task postponed three
// times. No model decides that you need advice; a model may later phrase what
// the numbers already justified.
//
// That ordering matters for a proactive feature specifically. A suggestion you
// did not ask for has to earn the interruption, and "a model felt like it" does
// not. Every candidate carries the fact that triggered it, so the UI can show
// the reason next to the suggestion rather than asking for trust.

const DAY = 86400000;

const parse = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? null : t; };

// Priority decides what gets the one interruption you are owed, so it is a
// stated number rather than list order.
const P = { dueCheckIn: 100, overdue: 80, chronicSlip: 70, stalled: 40, unestimated: 20 };

function daysBetween(a, b) { return Math.floor((a - b) / DAY); }

/**
 * Everything worth saying right now, best first.
 *
 * Pure: no I/O, no model, and `now` is passed in. The caller decides whether it
 * is allowed to say any of it.
 */
export function candidates({ tasks = [], threads = {}, observed = null, now = new Date() } = {}) {
  const out = [];
  const nowMs = now.getTime();
  const live = (tasks || []).filter(t => t && !t.archived && t.status !== 'done');

  // 1. A follow-up whose check-in has come due. The person already agreed to be
  //    asked about this one, which makes it the least intrusive thing to raise.
  for (const thread of Object.values(threads || {})) {
    if (!thread || thread.state === 'resolved' || thread.state === 'parked') continue;
    const due = parse(thread.nextCheckIn);
    if (due === null || due > nowMs) continue;
    const task = live.find(t => t.id === thread.taskId);
    if (!task) continue;
    out.push({
      kind: 'check-in',
      taskId: task.id,
      priority: P.dueCheckIn,
      title: task.title ?? 'Untitled',
      because: thread.blocker ? { code: 'blocked-since', text: thread.blocker.text, since: thread.blocker.since }
                              : { code: 'check-in-due', at: thread.nextCheckIn },
    });
  }

  // 2. Past its deadline and still open.
  for (const t of live) {
    const dl = t.deadline ? parse(t.deadline + 'T23:59:59') : null;
    if (dl === null || dl >= nowMs) continue;
    out.push({
      kind: 'overdue',
      taskId: t.id,
      priority: P.overdue + Math.min(20, daysBetween(nowMs, dl)),
      title: t.title ?? 'Untitled',
      because: { code: 'overdue-days', days: daysBetween(nowMs, dl) },
    });
  }

  // 3. Chronically postponed — measured, not guessed (see metrics.js).
  for (const c of observed?.slippage?.chronic || []) {
    if (!live.some(t => t.id === c.taskId)) continue;
    out.push({
      kind: 'chronic-slip',
      taskId: c.taskId,
      priority: P.chronicSlip,
      title: c.title,
      because: { code: 'postponed-n-times', times: c.slips, days: c.totalDays },
    });
  }

  // 4. Written down and untouched. Weakest signal, so lowest priority: a task
  //    sitting still is often a task that is simply not urgent.
  for (const t of live) {
    const touched = parse(t.updatedAt) ?? parse(t.createdAt);
    if (touched === null) continue;
    const idle = daysBetween(nowMs, touched);
    if (idle < 14) continue;
    out.push({
      kind: 'stalled',
      taskId: t.id,
      priority: P.stalled,
      title: t.title ?? 'Untitled',
      because: { code: 'idle-days', days: idle },
    });
  }

  // One interruption per task, whichever reason ranks highest — three
  // notifications about the same task is how an assistant gets muted.
  const best = new Map();
  for (const c of out) {
    const seen = best.get(c.taskId);
    if (!seen || c.priority > seen.priority) best.set(c.taskId, c);
  }
  return [...best.values()].sort((a, b) => b.priority - a.priority);
}

/**
 * Pick the one to raise, skipping anything already raised recently.
 * Repeating yourself is the fastest way to be switched off.
 */
export function pick(list, { log = [], now = new Date(), repeatAfterDays = 3 } = {}) {
  const cutoff = now.getTime() - repeatAfterDays * DAY;
  const recent = new Set(
    (log || [])
      .filter(e => { const t = parse(e?.at); return t !== null && t >= cutoff; })
      .map(e => `${e.kind}:${e.taskId}`)
  );
  return list.find(c => !recent.has(`${c.kind}:${c.taskId}`)) ?? null;
}
