// Stage 3 — follow-up threads.
//
// A task tells you what someone meant to do. It does not tell you why it has
// not happened, and that is the only thing that helps. A thread is where that
// lives: what state the work is in, what is actually blocking it, what would
// unblock it, what has been tried, and when to ask again.
//
// The whole design turns on that last part. A follow-up system that asks the
// same question every morning is a nagging system, and a nagging system gets
// ignored and then switched off — at which point it helps with nothing. So:
//
//   - An unanswered check-in backs OFF rather than repeating: 1 day, then 3,
//     then 7, then 14.
//   - After four unanswered, the thread PARKS itself and stops asking entirely.
//     Silence is an answer. It means "not now", and continuing to ask is how an
//     assistant becomes a thing you mute.
//   - Answering resets the backoff, because an answered question earns the
//     right to a next one.
//
// Pure: no I/O, no model, no randomness, no reading the clock. `now` is always
// passed in, which is what makes the scheduling testable at all.

export const THREAD_STATES = new Set(['open', 'blocked', 'moving', 'parked', 'resolved']);
export const OPTION_STATES = new Set(['open', 'chosen', 'ruled-out']);

// Days between check-ins, indexed by how many have gone unanswered in a row.
export const BACKOFF_DAYS = [1, 3, 7, 14];
export const MAX_UNANSWERED = BACKOFF_DAYS.length;

// A task with no movement for this long is worth asking about. Below it,
// nothing is wrong — work in progress looks exactly like this.
export const STALL_DAYS = 10;

const DAY = 86400000;
const iso = (d) => d.toISOString();
const parse = (s) => { const t = Date.parse(s); return Number.isNaN(t) ? null : t; };
const rid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export function emptyThread(taskId, { now = new Date() } = {}) {
  return {
    taskId,
    state: 'open',
    blocker: null,          // { text, since } — stated by the person, never inferred
    needs: [],              // what would unblock it
    options: [],            // ways forward, and what became of each
    checkIns: [],           // every ask and every answer, appended
    unanswered: 0,
    nextCheckIn: iso(new Date(now.getTime() + BACKOFF_DAYS[0] * DAY)),
    createdAt: iso(now),
    updatedAt: iso(now),
  };
}

function touch(thread, now) {
  return { ...thread, updatedAt: iso(now) };
}

// ─── what the person tells us ─────────────────────────────────────────────────

// A blocker is reported, not deduced. Clarity may ask what is in the way; it
// does not get to decide what is in the way.
export function setBlocker(thread, text, { now = new Date() } = {}) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) {
    return touch({ ...thread, blocker: null, state: thread.state === 'blocked' ? 'open' : thread.state }, now);
  }
  return touch({
    ...thread,
    blocker: { text: clean.slice(0, 500), since: thread.blocker?.text === clean ? thread.blocker.since : iso(now) },
    state: 'blocked',
  }, now);
}

export function addNeed(thread, text, { now = new Date() } = {}) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) return thread;
  return touch({ ...thread, needs: [...thread.needs, { id: rid('need'), text: clean.slice(0, 300), done: false }] }, now);
}

export function toggleNeed(thread, needId, { now = new Date() } = {}) {
  const needs = thread.needs.map(n => n.id === needId ? { ...n, done: !n.done } : n);
  return touch({ ...thread, needs }, now);
}

// ─── ways forward ─────────────────────────────────────────────────────────────

// An option is a suggestion about what to DO, not a claim about who someone is,
// so a model may write one directly — it never reaches the profile. `source`
// records which of the two it was, so the distinction stays visible.
export function addOption(thread, { text, source = 'user' }, { now = new Date() } = {}) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) return thread;
  if (thread.options.some(o => o.text.toLowerCase() === clean.toLowerCase())) return thread;
  return touch({
    ...thread,
    options: [...thread.options, {
      id: rid('opt'), text: clean.slice(0, 300),
      source: source === 'suggested' ? 'suggested' : 'user',
      status: 'open', note: null, at: iso(now),
    }],
  }, now);
}

// Ruling an option out is kept, not deleted — "we tried that" is the most
// useful thing a thread knows a month later, and the thing most easily lost.
export function judgeOption(thread, optionId, status, { note = null, now = new Date() } = {}) {
  if (!OPTION_STATES.has(status)) throw new Error(`unknown option status: ${status}`);
  const options = thread.options.map(o => o.id === optionId ? { ...o, status, note } : o);
  const chosen = options.some(o => o.status === 'chosen');
  const state = chosen && thread.state !== 'resolved' ? 'moving' : thread.state;
  return touch({ ...thread, options, state }, now);
}

// ─── asking, and knowing when to stop ─────────────────────────────────────────

function scheduleFrom(unanswered, now) {
  if (unanswered >= MAX_UNANSWERED) return null;
  return iso(new Date(now.getTime() + BACKOFF_DAYS[Math.min(unanswered, BACKOFF_DAYS.length - 1)] * DAY));
}

/**
 * Record that a check-in was put to the person. This is what makes silence
 * measurable: the entry exists with no answer until one arrives.
 */
export function askCheckIn(thread, question, { now = new Date() } = {}) {
  const unanswered = thread.unanswered + 1;
  const parked = unanswered >= MAX_UNANSWERED;
  return touch({
    ...thread,
    checkIns: [...thread.checkIns, { id: rid('ci'), at: iso(now), asked: String(question || '').slice(0, 300), answer: null, answeredAt: null }],
    unanswered,
    // Four unanswered asks is not a scheduling problem, it is an answer.
    state: parked && thread.state !== 'resolved' ? 'parked' : thread.state,
    nextCheckIn: scheduleFrom(unanswered, now),
  }, now);
}

export function answerCheckIn(thread, answer, { state = null, now = new Date() } = {}) {
  const clean = typeof answer === 'string' ? answer.trim() : '';
  const checkIns = [...thread.checkIns];
  for (let i = checkIns.length - 1; i >= 0; i--) {
    if (checkIns[i].answer === null) { checkIns[i] = { ...checkIns[i], answer: clean.slice(0, 1000), answeredAt: iso(now) }; break; }
  }
  const nextState = state && THREAD_STATES.has(state) ? state
    : thread.state === 'parked' ? 'open' : thread.state;
  return touch({
    ...thread, checkIns, unanswered: 0, state: nextState,
    // An answered question earns the right to a next one.
    nextCheckIn: nextState === 'resolved' ? null : scheduleFrom(0, now),
  }, now);
}

export function resolveThread(thread, { note = null, now = new Date() } = {}) {
  return touch({ ...thread, state: 'resolved', resolvedAt: iso(now), resolution: note, nextCheckIn: null }, now);
}

// Explicitly asked to stop. Distinct from parked, which Clarity decided on its
// own — one is the person's instruction, the other is Clarity reading the room.
export function muteThread(thread, { now = new Date() } = {}) {
  return touch({ ...thread, state: 'parked', mutedByUser: true, nextCheckIn: null }, now);
}

// ─── what is due ──────────────────────────────────────────────────────────────

export function isDue(thread, now = new Date()) {
  if (!thread || thread.state === 'resolved' || thread.state === 'parked') return false;
  if (!thread.nextCheckIn) return false;
  const at = parse(thread.nextCheckIn);
  return at !== null && at <= now.getTime();
}

export function dueThreads(threads, now = new Date()) {
  return Object.values(threads || {}).filter(t => isDue(t, now));
}

// ─── which tasks deserve a thread at all ──────────────────────────────────────

const pad2 = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Not every task is a conversation. Opening a thread on all of them would turn
// a to-do list into an interrogation. These are the ones where something has
// visibly failed to happen — derived from history the app already records, with
// no model and no guessing.
export function stalledTasks(tasks, { now = new Date(), stallDays = STALL_DAYS, hasThread = () => false } = {}) {
  const out = [];
  for (const t of tasks || []) {
    if (!t || t.archived || t.status === 'done') continue;
    if (hasThread(t.id)) continue;

    // A move made by auto-reschedule is not the person postponing (src/reschedule.js).
    const slips = (Array.isArray(t.history) ? t.history : [])
      .filter(h => h?.type === 'deadline' && !h.auto && h.from && h.to && Date.parse(h.to) > Date.parse(h.from)).length;

    const lastTouch = parse(t.updatedAt) ?? parse(t.createdAt);
    const idleDays = lastTouch === null ? null : Math.floor((now.getTime() - lastTouch) / DAY);

    // By local calendar day. Date.parse('2026-10-07') is midnight UTC, so a
    // task due today read as overdue from that hour on — all evening in
    // Montréal, from the first minute of the day further east.
    const overdue = t.deadline && String(t.deadline).slice(0, 10) < localDay(now) && t.status !== 'done';

    // `why` is the English sentence; `code` is what an interface translates
    // from. The UI must not parse the sentence to find out which one it is.
    let why = null, code = null;
    if (slips >= 2)                             { code = 'postponed'; why = `postponed ${slips} times`; }
    else if (overdue)                           { code = 'overdue';   why = 'past its deadline and not finished'; }
    else if (idleDays !== null && idleDays >= stallDays) { code = 'idle'; why = `untouched for ${idleDays} days`; }
    if (!why) continue;

    out.push({ taskId: t.id, title: t.title ?? 'Untitled', why, code, slips, idleDays });
  }
  // Most stuck first: repeated postponement says more than mere silence.
  return out.sort((a, b) => (b.slips - a.slips) || ((b.idleDays ?? 0) - (a.idleDays ?? 0)));
}
