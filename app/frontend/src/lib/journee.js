// The realistic day (2.0.0). What the day can hold, how long each task really
// takes, and the plan: what fits, where, what goes together, what does not fit
// and why. Pure — the time of day is a parameter — so tools/verifier-journee.mjs
// checks every rule without a window. Times are minutes since midnight.

export const SHORT_MINUTES = 15;          // grouped into one « small tasks » block
const BY_DIFFICULTY = { 1: 15, 2: 30, 3: 60, 4: 120, 5: 180 };
const DEFAULT_MINUTES = 30;
const STEP = 5;                           // the plan moves in 5-minute steps

export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const up = (m) => Math.ceil(m / STEP) * STEP;
const round = (m) => Math.max(STEP, Math.round(m / STEP) * STEP);

/**
 * How long a task really takes: its estimate (or one from its difficulty),
 * times the person's measured gap for its topic — or overall — when there are
 * enough measurements. `estimation`: { overall: ratio|null, byArea: {topic: ratio} }.
 */
export function plannedMinutes(task, estimation = {}) {
  const base = task.estimatedDuration || BY_DIFFICULTY[task.difficulty] || DEFAULT_MINUTES;
  const area = task.tags?.[0];
  const raw = (area && estimation.byArea?.[area]) || estimation.overall || 1;
  const factor = Math.min(3, Math.max(0.5, raw));     // a wild ratio is not a plan
  return { base, factor: Math.round(factor * 100) / 100, minutes: round(base * factor) };
}

/** The free stretches of the day from `nowMin`: working hours, minus the break, minus what is taken. */
export function freeIntervals({ workday, nowMin, taken = [] }) {
  let free = [[Math.max(toMin(workday.start), up(nowMin)), toMin(workday.end)]];
  const cut = ([a, b]) => {
    free = free.flatMap(([s, e]) => (b <= s || a >= e) ? [[s, e]] : [[s, a], [b, e]]).filter(([s, e]) => e - s >= STEP);
  };
  for (const b of breaksOf(workday)) cut([b.start, b.end]);
  for (const t of taken) cut([t.start, t.end]);
  return free;
}

const sum = (list) => list.reduce((a, [s, e]) => a + (e - s), 0);

function place(free, minutes, earliest, prefer) {
  const fits = [];
  for (const [s, e] of free) {
    const start = Math.max(s, earliest);
    if (start + minutes <= e) fits.push(start);
    // a later start inside the same gap, as close to the preferred hour as it fits
    if (prefer != null && prefer > start && prefer + minutes <= e) fits.push(prefer);
  }
  if (!fits.length) return null;
  if (prefer == null) return Math.min(...fits);
  return fits.sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer) || a - b)[0];
}
function take(free, start, end) {
  return free.flatMap(([s, e]) => (end <= s || start >= e) ? [[s, e]] : [[s, start], [end, e]]).filter(([s, e]) => e - s >= STEP);
}

/**
 * The plan. `tasks`: in the order of lib/ordre.js (each with `order`).
 * `events`: rendez-vous of the calendar, { start, end, label } in minutes.
 * `peakHour`: when the person finishes the most (Patterns), or null.
 * `order`: when replanning an accepted plan, the task ids in its order —
 * kept as is, no regrouping.
 */
export function buildPlan({ tasks, today, nowMin, workday, events = [], estimation = {}, peakHour = null, order = null, busy = [], edits = {} }) {
  // The person's own changes (2.2.0): `pins` { id: minute } — this task, at
  // this time; `durations` { id: minutes } — this long, today; `excluded` —
  // not today; `included` — today, though not due; `breaks` — extra breaks
  // today; `ungrouped` — no « small tasks » block.
  const { pins = {}, durations = {}, excluded = [], included = [], breaks: extraBreaks = [], ungrouped = false } = edits;
  const out = new Set(excluded);
  const live = tasks.filter(t => t.status !== 'done' && !t.archived && !out.has(t.id));
  const byId = new Map(live.map(t => [t.id, t]));
  const inc = new Set(included);
  const due = (t) => (!!t.deadline && t.deadline.slice(0, 10) <= today) || inc.has(t.id);
  const planned = (t) => (durations[t.id] ? { base: durations[t.id], factor: 1, minutes: durations[t.id], set: true } : plannedMinutes(t, estimation));

  // Already taken: the calendar, the breaks added today, and the tasks that
  // have their own hour today — set on the task, or pinned in the plan.
  const pinned = (t) => pins[t.id] != null;
  const fixedTasks = live.filter(t => pinned(t) || (t.deadline === today && t.time));
  const blocks = [
    ...events.map((e, i) => ({ id: `event-${i}`, kind: 'event', label: e.label, taskIds: [], start: e.start, end: e.end })),
    ...fixedTasks.map(t => { const p = planned(t); const start = pinned(t) ? pins[t.id] : toMin(t.time); return { id: `fixed-${t.id}`, kind: 'fixed', pinned: pinned(t) || undefined, taskIds: [t.id], start, end: start + p.minutes, ...p }; }),
  ];
  const added = extraBreaks.map((b, i) => ({ id: `pause-${i}`, kind: 'pause', taskIds: [], start: b.start, end: b.end }));
  busy = [...busy, ...added];
  // `busy`: time already spoken for and not shown again (a block in progress).
  let free = freeIntervals({ workday, nowMin, taken: [...blocks, ...busy] });
  const capacity = sum(free);

  // What to place, in order: what is due first, then what comes next.
  let queue = (order ? order.map(id => byId.get(id)).filter(Boolean) : [...live.filter(due), ...live.filter(t => !due(t))])
    .filter(t => !fixedTasks.includes(t));

  if (!order) {
    // Same topic, same level, same part of the list: one after the other.
    const grouped = [];
    const seen = new Set();
    for (const t of queue) {
      if (seen.has(t.id)) continue;
      grouped.push(t); seen.add(t.id);
      const topic = t.tags?.[0];
      if (!topic) continue;
      for (const u of queue) if (!seen.has(u.id) && u.tags?.[0] === topic && u.order?.level === t.order?.level && due(u) === due(t)) { grouped.push(u); seen.add(u.id); }
    }
    queue = grouped;
  }

  // Short tasks of today, together in one block where the first of them stood.
  const plans = new Map(queue.map(t => [t.id, planned(t)]));
  const shorts = ungrouped ? [] : queue.filter(t => due(t) && plans.get(t.id).minutes <= SHORT_MINUTES && !t.order?.blockedBy?.length);
  const items = [];
  for (const t of queue) {
    if (shorts.length >= 2 && shorts.includes(t)) {
      if (t === shorts[0]) items.push({ batch: shorts });
      continue;
    }
    items.push({ task: t });
  }

  const placedEnd = new Map(fixedTasks.map(t => [t.id, blocks.find(b => b.taskIds[0] === t.id).end]));   // task id → end of its block
  const overflow = [];
  const peak = peakHour != null ? peakHour * 60 : null;
  for (const item of items) {
    const list = item.batch || [item.task];
    const minutes = item.batch ? list.reduce((a, t) => a + plans.get(t.id).minutes, 0) : plans.get(item.task.id).minutes;
    // Never before what blocks it: after its blockers' blocks, and not at all
    // if one of them is not in today's plan.
    let earliest = 0, waitingOn = null;
    for (const t of list) for (const b of t.order?.blockedBy || []) {
      const hard = byId.get(b) && (byId.get(b).links || []).some(l => l.to === t.id && l.type === 'blocks' && (l.strength || 'hard') === 'hard');
      if (!hard) continue;
      if (placedEnd.has(b)) earliest = Math.max(earliest, placedEnd.get(b));
      else waitingOn = waitingOn || b;
    }
    const isDue = list.some(due);
    if (waitingOn) { if (isDue) overflow.push(...list.map(t => ({ taskId: t.id, reason: 'blocked', by: waitingOn, minutes: plans.get(t.id).minutes }))); continue; }
    const hard = !item.batch && (item.task.difficulty ?? 0) >= 4;
    const start = place(free, minutes, earliest, hard ? peak : null);
    if (start == null) {
      if (isDue) overflow.push(...list.map(t => ({ taskId: t.id, reason: 'full', minutes: plans.get(t.id).minutes })));
      continue;
    }
    const end = start + minutes;
    free = take(free, start, end);
    for (const t of list) placedEnd.set(t.id, end);
    blocks.push(item.batch
      ? { id: `batch-${list[0].id}`, kind: 'batch', taskIds: list.map(t => t.id), start, end, minutes }
      : { id: `task-${item.task.id}`, kind: 'task', taskIds: [item.task.id], start, end, ...plans.get(item.task.id) });
  }

  blocks.push(...added);
  blocks.sort((a, b) => a.start - b.start);
  const plannedTotal = blocks.filter(b => b.kind === 'task' || b.kind === 'batch').reduce((a, b) => a + (b.end - b.start), 0);
  return { date: today, blocks, overflow, capacity, planned: plannedTotal, missing: overflow.filter(o => o.reason === 'full').reduce((a, o) => a + o.minutes, 0) };
}

/** What is on now, and what comes next. */
export function nowAndNext(plan, nowMin) {
  const work = (plan?.blocks || []).filter(b => b.kind === 'task' || b.kind === 'batch' || b.kind === 'fixed');
  const now = work.find(b => b.start <= nowMin && nowMin < b.end) || null;
  const next = work.find(b => b.start >= (now ? now.end : nowMin)) || null;
  return { now, next };
}

/**
 * Does an accepted plan need to move? A block over and not finished pushes
 * the rest; a block finished early frees its time. The block in progress
 * stays where it is — moving it with the clock would never settle.
 */
export const GRACE = 5;                  // minutes past a block's end before the plan moves
export function needsReplan(plan, nowMin, doneIds) {
  return (plan?.blocks || []).some(b => (b.kind === 'task' || b.kind === 'batch')
    // over, and not finished (after a few minutes' grace: wrapping up is not overrunning)
    && ((b.end + GRACE <= nowMin && b.taskIds.some(id => !doneIds.has(id)))
      // finished before its end — in progress or still to come: its time is free
      || (b.end > nowMin && b.taskIds.every(id => doneIds.has(id)))));
}

/** The accepted plan, moved from now in its own order. Returns { plan, shift } (minutes later). */
export function replan(accepted, args) {
  const { nowMin } = args;
  const done = new Set(args.tasks.filter(t => t.status === 'done').map(t => t.id));
  const work = accepted.blocks.filter(b => b.kind === 'task' || b.kind === 'batch');
  // In progress by the clock, and nothing before it left unfinished: if an
  // earlier block overran, the person is still on that one, not on this.
  const behind = (b) => work.some(o => o.start < b.start && o.taskIds.some(id => !done.has(id)));
  const inProgress = work.filter(b => b.start <= nowMin && nowMin < b.end && b.taskIds.some(id => !done.has(id)) && !behind(b));
  const keep = new Set(inProgress.flatMap(b => b.taskIds));
  const order = work.flatMap(b => b.taskIds).filter(id => !done.has(id) && !keep.has(id));
  const next = buildPlan({ ...args, order, busy: inProgress });
  next.blocks = [...next.blocks, ...inProgress].sort((a, b) => a.start - b.start);
  const before = new Map(work.flatMap(b => b.taskIds.map(id => [id, b.start])));
  const shift = Math.max(0, ...next.blocks.filter(b => b.kind === 'task' || b.kind === 'batch')
    .flatMap(b => b.taskIds.map(id => (before.has(id) ? b.start - before.get(id) : 0))));
  return { plan: next, shift };
}

/** The next day worked after `today` (YYYY-MM-DD), for « move to tomorrow ». */
export function nextWorkday(today, days = [1, 2, 3, 4, 5]) {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  for (let k = 1; k <= 7; k++) {
    date.setDate(date.getDate() + 1);
    if (days.includes(date.getDay())) break;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The breaks of a working day, as [{ start, end, label }] in minutes. Reads the 2.0 shape too. */
export function breaksOf(workday) {
  if (Array.isArray(workday?.breaks)) return workday.breaks.map(b => ({ start: toMin(b.start), end: toMin(b.end), label: b.label || '' }));
  return workday?.breakStart && workday?.breakEnd ? [{ start: toMin(workday.breakStart), end: toMin(workday.breakEnd), label: '' }] : [];
}

/**
 * The hours of one day of the week (0 = Sunday): { start, end, breaks, days }
 * — the common hours, or that day's own (`byDay`); null when it is not worked.
 * The result is a working day of its own, ready for buildPlan.
 */
export function hoursOf(workday, weekday) {
  if (!workday || !workday.days?.includes(weekday)) return null;
  const own = workday.byDay?.[weekday] ?? workday.byDay?.[String(weekday)];
  const breaks = own ? (own.breaks || []) : Array.isArray(workday.breaks) ? workday.breaks
    : workday.breakStart && workday.breakEnd ? [{ start: workday.breakStart, end: workday.breakEnd, label: '' }] : [];
  return { start: own?.start || workday.start, end: own?.end || workday.end, breaks, days: workday.days };
}

/**
 * The time grid (2.1.0): the hours a day column shows, and where each item
 * sits. Overlapping items share the width side by side, each in its lane.
 * `items`: [{ start, end, … }] in minutes. Returns { from, to, items } with
 * `lane` and `lanes` on each item; from/to are whole hours that contain the
 * working day and every item.
 */
export function layoutDay({ items, workday = null, minFrom = 24 * 60, minTo = 0 }) {
  const starts = [minFrom, ...items.map(i => i.start)], ends = [minTo, ...items.map(i => i.end)];
  if (workday) { starts.push(toMin(workday.start)); ends.push(toMin(workday.end)); }
  const from = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60);
  const to = Math.min(24 * 60, Math.max(from + 60, Math.ceil(Math.max(...ends) / 60) * 60));
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const close = () => { const lanes = Math.max(1, ...cluster.map(c => c.lane + 1)); for (const c of cluster) c.lanes = lanes; cluster = []; };
  for (const it of sorted) {
    if (it.start >= clusterEnd) { close(); clusterEnd = -1; }
    const used = new Set(cluster.filter(c => c.end > it.start).map(c => c.lane));
    let lane = 0; while (used.has(lane)) lane++;
    const placed = { ...it, lane, lanes: 1 };
    cluster.push(placed); out.push(placed);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  close();
  return { from, to, items: out };
}
