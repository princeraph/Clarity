// Observed layer of the user profile.
//
// Everything here is derived from data Clarity has been recording all along and
// never read back: deadline history, estimate against tracked time, how long a
// task waits before anyone touches it, what gets archived without ever being
// done. Pure functions over a task array — no I/O, no model, no randomness — so
// every number is reproducible and can be pointed at the tasks that produced it.
//
// The rule this module exists to enforce: a metric below MIN_SAMPLES is not a
// finding. Callers get `samples` on everything and must not present a
// conclusion the sample size does not support.

export const MIN_SAMPLES = 5;

// Bump this whenever the meaning of anything under `observed` changes.
// The layer is cached in profile.json, and a cache computed by an older
// algorithm is not merely out of date — it is wrong in a way no amount of
// waiting fixes. Callers compare it and recompute on a mismatch.
//   1 — first version
//   2 — the window falls back to all history when it would hold almost nothing
export const OBSERVED_VERSION = 2;

// Estimate/actual ratios cluster near 1. These bounds are deliberately wide:
// being 10% out is noise, being 2× out is a pattern worth naming.
const UNDER_ESTIMATE_AT = 1.25;
const OVER_ESTIMATE_AT  = 0.80;

const CHRONIC_SLIP_COUNT = 3;

// ─── small helpers ────────────────────────────────────────────────────────────

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round(n, dp = 2) {
  if (n === null || !Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

// Local midnight for a 'YYYY-MM-DD' string. Never Date.parse on the bare string:
// that is treated as UTC and shifts the day for anyone west of Greenwich.
function localDate(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 86400000;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseISO(v) {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// First tag is the task's "area" throughout Clarity — history type 'area'
// already follows that convention, so per-tag metrics use the same definition.
function areaOf(task) {
  return (Array.isArray(task.tags) && typeof task.tags[0] === 'string' && task.tags[0]) || 'Untagged';
}

function historyOf(task) {
  return Array.isArray(task.history) ? task.history : [];
}

// Group per-task values by area and summarise each group the same way the
// overall figure is summarised, so the two are directly comparable.
function byArea(entries, summarise) {
  const buckets = new Map();
  for (const { area, value } of entries) {
    if (!buckets.has(area)) buckets.set(area, []);
    buckets.get(area).push(value);
  }
  const out = {};
  for (const [area, values] of buckets) out[area] = summarise(values);
  return out;
}

// ─── estimation accuracy ──────────────────────────────────────────────────────

function estimationBias(ratio) {
  if (ratio === null) return null;
  if (ratio >= UNDER_ESTIMATE_AT) return 'under';   // took longer than planned
  if (ratio <= OVER_ESTIMATE_AT)  return 'over';    // finished quicker than planned
  return 'accurate';
}

function summariseRatios(ratios) {
  const m = median(ratios);
  return {
    samples: ratios.length,
    medianRatio: round(m),
    bias: ratios.length >= MIN_SAMPLES ? estimationBias(m) : null,
    enough: ratios.length >= MIN_SAMPLES,
  };
}

export function computeEstimation(tasks) {
  const points = [];
  for (const t of tasks) {
    const est = t.estimatedDuration;
    const act = t.timeTracked;
    // Both sides must be real measurements. A task never timed says nothing
    // about estimation, and would otherwise read as a wild over-estimate.
    if (typeof est !== 'number' || est <= 0) continue;
    if (typeof act !== 'number' || act <= 0) continue;
    points.push({ area: areaOf(t), value: act / est, taskId: t.id, title: t.title });
  }
  return {
    ...summariseRatios(points.map(p => p.value)),
    byArea: byArea(points, summariseRatios),
    // Worst offenders, so the UI can cite specific tasks rather than assert a number.
    worst: [...points].sort((a, b) => b.value - a.value).slice(0, 5)
      .map(p => ({ taskId: p.taskId, title: p.title, ratio: round(p.value) })),
  };
}

// ─── deadline slippage ────────────────────────────────────────────────────────

// A slip is a deadline moved later. Moving one earlier, or setting one for the
// first time, is not a slip and must not be counted as one.
export function computeSlippage(tasks) {
  const perTask = [];
  for (const t of tasks) {
    let slips = 0;
    let totalDays = 0;
    for (const h of historyOf(t)) {
      if (h?.type !== 'deadline') continue;
      const from = localDate(h.from);
      const to   = localDate(h.to);
      if (!from || !to) continue;              // first deadline, or cleared
      const delta = daysBetween(from, to);
      if (delta === null || delta <= 0) continue;
      slips++;
      totalDays += delta;
    }
    if (slips > 0) {
      perTask.push({ taskId: t.id, title: t.title, area: areaOf(t), slips, totalDays });
    }
  }

  const summarise = (values) => ({
    samples: values.length,
    tasksSlipped: values.length,
    medianDaysPerSlip: round(median(values.map(v => v.totalDays / v.slips)), 1),
    enough: values.length >= MIN_SAMPLES,
  });

  return {
    tasksSlipped: perTask.length,
    totalSlips: perTask.reduce((n, p) => n + p.slips, 0),
    medianDaysPerSlip: round(median(perTask.map(p => p.totalDays / p.slips)), 1),
    enough: perTask.length >= MIN_SAMPLES,
    byArea: byArea(perTask.map(p => ({ area: p.area, value: p })), summarise),
    chronic: perTask.filter(p => p.slips >= CHRONIC_SLIP_COUNT)
      .sort((a, b) => b.slips - a.slips)
      .map(p => ({ taskId: p.taskId, title: p.title, slips: p.slips, totalDays: round(p.totalDays, 1) })),
  };
}

// ─── time to start ────────────────────────────────────────────────────────────

// How long a task sits after being created before it is first moved to
// in_progress. Tasks never started are excluded rather than counted as infinite —
// they are the abandonment metric's business, not this one's.
export function computeLatency(tasks) {
  const points = [];
  for (const t of tasks) {
    const created = parseISO(t.createdAt)
      || parseISO(historyOf(t).find(h => h?.type === 'created')?.at);
    if (!created) continue;
    const started = historyOf(t)
      .filter(h => h?.type === 'status' && h.to === 'in_progress')
      .map(h => parseISO(h.at))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    if (!started) continue;
    const days = daysBetween(created, started);
    if (days === null || days < 0) continue;
    points.push({ area: areaOf(t), value: days });
  }

  const summarise = (values) => ({
    samples: values.length,
    medianDaysToStart: round(median(values), 1),
    enough: values.length >= MIN_SAMPLES,
  });

  return {
    ...summarise(points.map(p => p.value)),
    byArea: byArea(points, summarise),
  };
}

// ─── abandonment ──────────────────────────────────────────────────────────────

// Archived without ever reaching done — the closest thing on disk to "turned out
// not to matter".
export function computeAbandonment(tasks) {
  const abandoned = [];
  const totalsByArea = new Map();
  const abandonedByArea = new Map();

  for (const t of tasks) {
    const area = areaOf(t);
    totalsByArea.set(area, (totalsByArea.get(area) || 0) + 1);
    if (!t.archived || t.status === 'done') continue;
    const created  = parseISO(t.createdAt);
    const archived = parseISO(t.archivedAt);
    abandoned.push({
      taskId: t.id, title: t.title, area,
      ageDays: round(daysBetween(created, archived), 1),
    });
    abandonedByArea.set(area, (abandonedByArea.get(area) || 0) + 1);
  }

  const rateByArea = {};
  for (const [area, total] of totalsByArea) {
    const n = abandonedByArea.get(area) || 0;
    rateByArea[area] = { samples: total, abandoned: n, rate: round(n / total), enough: total >= MIN_SAMPLES };
  }

  return {
    count: abandoned.length,
    samples: tasks.length,
    rate: tasks.length ? round(abandoned.length / tasks.length) : null,
    enough: tasks.length >= MIN_SAMPLES,
    rateByArea,
    recent: abandoned.slice(-5).reverse(),
  };
}

// ─── working rhythm ───────────────────────────────────────────────────────────

// When work actually happens, taken from the timestamps of status changes.
// Deliberately omits session length: `timeTracked` is a running total, not a
// list of sessions, so there is nothing on disk to compute it from yet. The
// journal will record sessions from now on; inventing the number today would
// put a fabricated figure into a layer whose whole purpose is being factual.
export function computeRhythm(tasks) {
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  let samples = 0;

  for (const t of tasks) {
    for (const h of historyOf(t)) {
      if (h?.type !== 'status') continue;
      const at = parseISO(h.at);
      if (!at) continue;
      hours[at.getHours()]++;
      weekdays[at.getDay()]++;
      samples++;
    }
  }

  const peakHour = samples ? hours.indexOf(Math.max(...hours)) : null;
  const peakWeekday = samples ? weekdays.indexOf(Math.max(...weekdays)) : null;

  return { samples, hours, weekdays, peakHour, peakWeekday, enough: samples >= MIN_SAMPLES };
}

// ─── current load ─────────────────────────────────────────────────────────────

export function computeLoad(tasks, now = new Date()) {
  const today = startOfLocalDay(now);
  const in7 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);

  let openTasks = 0, dueNext7Days = 0, overdue = 0, committedMinutes = 0;
  for (const t of tasks) {
    if (t.archived || t.status === 'done') continue;
    openTasks++;
    const due = localDate(t.deadline);
    if (!due) continue;
    if (due < today) overdue++;
    else if (due < in7) {
      dueNext7Days++;
      if (typeof t.estimatedDuration === 'number' && t.estimatedDuration > 0) {
        committedMinutes += t.estimatedDuration;
      }
    }
  }
  return { openTasks, dueNext7Days, overdue, committedMinutes };
}

// ─── entry point ──────────────────────────────────────────────────────────────

// `windowDays` bounds how far back tasks are considered, so a profile reflects
// how someone works now rather than how they worked two years ago. Pass 0 for
// all of history.
export function computeObserved(allTasks, { now = new Date(), windowDays = 90 } = {}) {
  const tasks = Array.isArray(allTasks) ? allTasks.filter(Boolean) : [];

  const cutoff = windowDays > 0
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - windowDays)
    : null;
  const windowed = cutoff
    ? tasks.filter(t => {
        const ref = parseISO(t.updatedAt) || parseISO(t.createdAt);
        return !ref || ref >= cutoff;
      })
    : tasks;

  // Someone returning after a quiet few months has every task outside the
  // window. Reporting "0 tasks · not enough data" next to a sidebar showing
  // thirteen of them reads as a broken page, not as a considered silence — so
  // fall back to the whole history and say so, rather than show nothing.
  const tooThin = windowed.length < MIN_SAMPLES && tasks.length > windowed.length;
  const inWindow = tooThin ? tasks : windowed;

  return {
    version: OBSERVED_VERSION,
    computedAt: new Date().toISOString(),
    windowDays: tooThin ? 0 : windowDays,      // 0 means "all of it"
    windowDaysRequested: windowDays,
    windowFellBack: tooThin,
    tasksConsidered: inWindow.length,
    estimation:  computeEstimation(inWindow),
    slippage:    computeSlippage(inWindow),
    latency:     computeLatency(inWindow),
    abandonment: computeAbandonment(inWindow),
    rhythm:      computeRhythm(inWindow),
    // Load is about right now, so it always looks at the live set, not the window.
    load:        computeLoad(tasks, now),
  };
}
