// The AI connector: lets an assistant the person already uses (Claude Desktop,
// or any app that speaks MCP) read and update their tasks.
//
// Three rules, because this is the first path by which Clarity data reaches a
// cloud AI the person did not configure inside Clarity:
//
// 1. Off until the person turns it on, and revocable. Turning it on issues a
//    token; only its SHA-256 is stored, so settings.json never holds a usable
//    secret. Issuing a new one, or turning the connector off, kills the old.
// 2. What leaves is bounded here, not by the caller: tasks (title, status,
//    dates, tags, a truncated description, subtask counts), the latest
//    analysis, and a task's open ways forward. Never notes, the journal,
//    check-in answers or the profile — those stay on this machine.
// 3. Every call is visible: the last calls are listed in Settings.

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { localDay } from '../reschedule.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const ACTIVITY_MAX = 30;
export const STATUSES = ['not_started', 'in_progress', 'done'];
export const LIST_FILTERS = [...STATUSES, 'archived'];

export function createConnector({ readSettings, saveSettings, now = () => new Date() }) {
  const activity = [];   // memory only: { at, action }

  return {
    status() {
      const s = readSettings();
      return { enabled: !!s.connectorEnabled && !!s.connectorTokenHash, issuedAt: s.connectorIssuedAt || null, activity: [...activity] };
    },

    /** A new token (returned once, never stored in clear) — the old one stops working. */
    async issue() {
      const token = randomBytes(24).toString('hex');
      await saveSettings({ ...readSettings(), connectorEnabled: true, connectorTokenHash: sha256(token), connectorIssuedAt: now().toISOString() });
      activity.length = 0;   // a new connection: what the old one did is not its history
      return token;
    },

    async disable() {
      await saveSettings({ ...readSettings(), connectorEnabled: false, connectorTokenHash: '', connectorIssuedAt: null });
      activity.length = 0;
    },

    /** Express middleware: the connector routes answer only to the current token. */
    guard() {
      return (req, res, next) => {
        const s = readSettings();
        const given = /^Bearer (\S+)$/.exec(req.get('authorization') || '')?.[1] || '';
        const ok = s.connectorEnabled && s.connectorTokenHash && given
          && timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(s.connectorTokenHash));
        if (!ok) return res.status(403).json({ error: 'The AI connector is off, or this connection was replaced. Reconnect it from Clarity’s Settings.' });
        next();
      };
    },

    record(action) {
      activity.unshift({ at: now().toISOString(), action });
      activity.length = Math.min(activity.length, ACTIVITY_MAX);
    },
  };
}

// ─── What an assistant sees ──────────────────────────────────────────────────

/** Eight characters of the id: short enough for a model to repeat, unique in practice. */
export const ref = (task) => task.id.slice(0, 8);

export function findByRef(tasks, given) {
  const r = String(given || '').trim().toLowerCase();
  if (r.length < 4) return null;
  const hits = tasks.filter(t => t.id.toLowerCase().startsWith(r));
  return hits.length === 1 ? hits[0] : null;
}

export function taskView(task, analysis) {
  const a = analysis?.taskAnalysis?.find(x => x.id === task.id);
  const subtasks = task.subtasks || [];
  return {
    ref: ref(task),
    title: task.title,
    status: task.status,
    deadline: task.deadline || null,
    tags: task.tags || [],
    ...(task.recurring && task.recurring !== 'none' ? { repeats: task.recurring } : {}),
    ...(a?.priorityLevel ? { priority: a.priorityLevel } : {}),
    ...(task.description ? { description: task.description.slice(0, 300) } : {}),
    ...(subtasks.length ? { subtasks: `${subtasks.filter(s => s.done).length}/${subtasks.length} done` } : {}),
  };
}

export function taskDetail(task, analysis, thread) {
  return {
    ...taskView(task, analysis),
    // Numbered from 1, so "tick the second one" has something to point at.
    subtasks: (task.subtasks || []).map((s, i) => ({ n: i + 1, title: s.title, done: !!s.done })),
    ...(task.timerStarted ? { timerRunningSince: task.timerStarted } : {}),
    ...(task.timeTracked ? { minutesTracked: task.timeTracked } : {}),
    ...(task.archived ? { archived: true } : {}),
    ...(thread ? {
      stuckOn: thread.blocker?.text || null,
      waysForward: (thread.options || []).map(o => ({ text: o.text, status: o.status })),
    } : {}),
  };
}

const active = (tasks) => tasks.filter(t => !t.archived && t.status !== 'done');

export function listView(tasks, analysis, { status } = {}) {
  const pool = status === 'archived' ? tasks.filter(t => t.archived)
    : status === 'done' ? tasks.filter(t => !t.archived && t.status === 'done')
    : status ? active(tasks).filter(t => t.status === status) : active(tasks);
  return pool.map(t => taskView(t, analysis));
}

export function overviewView(tasks, analysis) {
  const live = active(tasks);
  const order = new Map((analysis?.taskAnalysis || []).map(a => [a.id, a.priority ?? 99]));
  const ranked = [...live].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return {
    // The person's day, not UTC's: in the evening west of Greenwich, UTC is
    // already tomorrow and every task due today read as overdue.
    today: localDay(new Date()),
    activeTasks: live.length,
    overdue: live.filter(t => t.deadline && t.deadline < localDay(new Date())).length,
    ...(analysis?.whatToDoNext ? { whatToDoNext: analysis.whatToDoNext } : {}),
    ...(analysis?.overallInsight ? { insight: analysis.overallInsight } : {}),
    ...(analysis?.analyzedAt ? { analyzedAt: analysis.analyzedAt } : {}),
    topTasks: ranked.slice(0, 10).map(t => taskView(t, analysis)),
  };
}

/** A subtask by number (1-based) or by its words, when they point at exactly one. */
export function findSubtask(subtasks, which) {
  const list = subtasks || [];
  const n = Number(which);
  if (Number.isInteger(n) && n >= 1 && n <= list.length) return n - 1;
  const words = String(which ?? '').trim().toLowerCase();
  if (!words) return -1;
  const exact = list.findIndex(s => s.title.toLowerCase() === words);
  if (exact !== -1) return exact;
  const partial = list.map((s, i) => (s.title.toLowerCase().includes(words) ? i : -1)).filter(i => i !== -1);
  return partial.length === 1 ? partial[0] : -1;
}
