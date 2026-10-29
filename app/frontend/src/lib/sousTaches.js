// Subtasks as pages of their own (2.8.0). A subtask opens beside its task,
// with what a task has — date, level, status, difficulty, notes — and can
// leave its task to become one. Pure, so tools/verifier-sous-taches.mjs
// checks it.
//
// A subtask stored before 2.8.0 is { id, title, notes, dueDate, done }. The
// new fields are optional; `done` stays the one the rest of Clarity reads
// (progress, the server's toggle), and `status` follows it.

export const SUB_STATUSES = ['not_started', 'in_progress', 'done'];

/** Its status, read from `done` first: a toggle elsewhere only sets `done`. */
export function subtaskStatus(s) {
  if (s?.done) return 'done';
  return s?.status === 'in_progress' ? 'in_progress' : 'not_started';
}

/** A patch for one subtask, with `done` and `status` kept in step. */
export function subtaskPatch(patch) {
  if (patch.status === undefined) return patch;
  const status = SUB_STATUSES.includes(patch.status) ? patch.status : 'not_started';
  return { ...patch, status, done: status === 'done' };
}

/** The parent's subtask list with one subtask changed. */
export function withSubtask(subtasks, id, patch) {
  return (subtasks || []).map(s => (s.id === id ? { ...s, ...subtaskPatch(patch) } : s));
}

/**
 * A subtask that becomes a task: the new task (what POST /api/tasks takes) and
 * what the parent keeps. It takes its title, notes, date, level, difficulty
 * and status, the parent's topics, and a « related » link back to the parent
 * — so where it came from stays visible. Null for an unknown subtask.
 */
export function promote(parent, subId) {
  const s = (parent?.subtasks || []).find(x => x.id === subId);
  if (!s) return null;
  const task = {
    title: s.title,
    notes: s.notes || '',
    deadline: s.dueDate || null,
    priority: s.priority ?? null,
    difficulty: s.difficulty ?? null,
    status: subtaskStatus(s),
    tags: [...(parent.tags || [])],
    links: [{ to: parent.id, type: 'related' }],
  };
  return { task, parentSubtasks: parent.subtasks.filter(x => x.id !== subId) };
}
