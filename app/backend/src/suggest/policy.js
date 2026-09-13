// Stage 4 — when Clarity is allowed to interrupt.
//
// The hard part of a proactive assistant is not deciding what to say. It is
// deciding whether to say anything at all, and an assistant that gets that
// wrong is not merely annoying: it gets muted, and then it helps with nothing.
// So the permission to speak is a separate, pure, testable thing, computed
// before a single word is chosen.
//
// The rules, in the order they are checked — most specific refusal first, so
// the reason a user is told is the real one:
//
//   1. A quiet rule the person set. This beats everything, including an
//      overdue deadline. "Stop asking" is an instruction, not a preference to
//      weigh against Clarity's own judgement.
//   2. The mode: on request only, or once a day.
//   3. Night. Nobody asked to be prompted at 3am, and nobody would think to
//      forbid it in advance.
//   4. The daily budget.
//   5. The minimum gap since the last one.
//
// And one rule that is not in the list because it is structural: ASKING
// WHETHER TO SPEAK MUST NOT COST ANYTHING. The client polls this; if a refused
// check consumed budget, the budget would drain itself while Clarity stayed
// silent. Only an actual delivery is recorded.

export const SUGGESTION_MODES = new Set(['active', 'daily', 'onRequest']);
export const QUIET_KINDS = new Set(['duration', 'untilTaskDone', 'indefinite']);

export const DEFAULTS = {
  suggestionMode: 'active',
  maxSuggestionsPerDay: 6,
  minGapMinutes: 90,
  // Night guard. Not something a person thinks to forbid in advance, so it is
  // on by default and visible rather than discovered at 3am.
  quietHours: { from: 22, to: 7 },
};

const MINUTE = 60000;

function parse(iso) { const t = Date.parse(iso); return Number.isNaN(t) ? null : t; }

// ─── quiet rules ──────────────────────────────────────────────────────────────

export function makeQuietRule({ kind, minutes = null, taskId = null, reason = null }, { now = new Date() } = {}) {
  if (!QUIET_KINDS.has(kind)) throw new Error(`unknown quiet kind: ${kind}`);
  if (kind === 'duration' && !(Number.isFinite(minutes) && minutes > 0)) throw new Error('duration needs minutes');
  if (kind === 'untilTaskDone' && !taskId) throw new Error('untilTaskDone needs a taskId');
  return {
    id: `quiet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    until: kind === 'duration' ? new Date(now.getTime() + minutes * MINUTE).toISOString() : null,
    taskId: kind === 'untilTaskDone' ? taskId : null,
    reason: typeof reason === 'string' ? reason.slice(0, 200) : null,
    createdAt: now.toISOString(),
  };
}

/**
 * Is this rule still in force?
 *
 * An `untilTaskDone` rule whose task has been deleted is NOT still in force —
 * otherwise deleting a task would silence Clarity permanently, with nothing on
 * screen explaining why.
 */
export function isQuietActive(rule, { now = new Date(), tasks = null } = {}) {
  if (!rule || !QUIET_KINDS.has(rule.kind)) return false;
  if (rule.kind === 'indefinite') return true;
  if (rule.kind === 'duration') {
    const until = parse(rule.until);
    return until !== null && until > now.getTime();
  }
  if (rule.kind === 'untilTaskDone') {
    if (!Array.isArray(tasks)) return true;          // cannot check — stay quiet
    const task = tasks.find(t => t && t.id === rule.taskId);
    if (!task) return false;                          // the task is gone; so is the reason
    return task.status !== 'done' && !task.archived;
  }
  return false;
}

export function activeQuietRules(rules, opts = {}) {
  return (rules || []).filter(r => isQuietActive(r, opts));
}

// ─── the night guard ──────────────────────────────────────────────────────────

// Handles a window that wraps midnight (22 → 7), which the obvious comparison
// gets backwards: with from > to, "inside" is hour >= from OR hour < to.
export function inQuietHours(hour, { from, to } = DEFAULTS.quietHours) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return false;
  return from < to ? (hour >= from && hour < to) : (hour >= from || hour < to);
}

// ─── may we speak? ────────────────────────────────────────────────────────────

/**
 * The single place that decides. Returns why, not just whether — a user who
 * notices Clarity has gone quiet deserves to be told which of their own
 * settings did it.
 *
 * `sentToday` and `lastSentAt` describe DELIVERIES, never checks.
 */
export function mayInterrupt({
  now = new Date(),
  preferences = {},
  quiet = [],
  tasks = null,
  sentToday = 0,
  lastSentAt = null,
} = {}) {
  const p = { ...DEFAULTS, ...preferences };
  const quietHours = { ...DEFAULTS.quietHours, ...(p.quietHours || {}) };

  const active = activeQuietRules(quiet, { now, tasks });
  if (active.length) {
    const r = active[0];
    return {
      allowed: false,
      code: 'quiet-rule',
      reason: r.kind === 'indefinite' ? 'You asked Clarity to stop suggesting.'
        : r.kind === 'duration' ? `You asked for quiet until ${r.until}.`
        : 'You asked for quiet until that task is done.',
      rule: r,
    };
  }

  const mode = SUGGESTION_MODES.has(p.suggestionMode) ? p.suggestionMode : DEFAULTS.suggestionMode;
  if (mode === 'onRequest') {
    return { allowed: false, code: 'on-request', reason: 'Clarity only suggests when you ask.' };
  }
  if (mode === 'daily' && sentToday >= 1) {
    return { allowed: false, code: 'daily-done', reason: 'One suggestion a day, and today’s is spent.' };
  }

  if (inQuietHours(now.getHours(), quietHours)) {
    return { allowed: false, code: 'night', reason: `Quiet between ${quietHours.from}:00 and ${quietHours.to}:00.` };
  }

  const max = Number.isFinite(p.maxSuggestionsPerDay) ? p.maxSuggestionsPerDay : DEFAULTS.maxSuggestionsPerDay;
  if (max <= 0) return { allowed: false, code: 'budget-zero', reason: 'The daily budget is set to none.' };
  if (sentToday >= max) {
    return { allowed: false, code: 'budget-spent', reason: `Today’s ${max} suggestions are spent.` };
  }

  const gap = Number.isFinite(p.minGapMinutes) ? p.minGapMinutes : DEFAULTS.minGapMinutes;
  const last = parse(lastSentAt);
  if (last !== null && now.getTime() - last < gap * MINUTE) {
    const waitMin = Math.ceil((gap * MINUTE - (now.getTime() - last)) / MINUTE);
    return { allowed: false, code: 'too-soon', reason: `Not for another ${waitMin} min.`, waitMinutes: waitMin };
  }

  return { allowed: true, code: 'ok', remaining: max - sentToday };
}

/** Deliveries made on the same local day as `now`. Local, not UTC: a day is where the person is. */
export function countToday(log, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  return (log || []).filter(e => {
    const t = parse(e?.at);
    if (t === null) return false;
    const dt = new Date(t);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  }).length;
}

export function lastDeliveryAt(log) {
  let best = null;
  for (const e of log || []) {
    const t = parse(e?.at);
    if (t !== null && (best === null || t > best)) best = t;
  }
  return best === null ? null : new Date(best).toISOString();
}
