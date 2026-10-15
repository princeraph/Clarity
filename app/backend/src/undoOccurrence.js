// « Undo » on a finished recurring task. Finishing it created the next
// occurrence (server.js, spawnRecurringTask, with a deterministic id); taking
// it back from done must remove that occurrence, or there are two. Only if
// nobody has touched it since: a started, edited, timed or archived one is
// someone's work, and stays.

/** Is this freshly spawned occurrence still exactly as it was created? */
export function untouchedOccurrence(t) {
  if (!t) return false;
  return t.status === 'not_started' && !t.archived && !t.timeTracked && !t.timerStarted
    && !(t.history?.length)
    && Math.abs(Date.parse(t.updatedAt) - Date.parse(t.createdAt)) < 2000;
}

/** Was this update a recurring task taken back from done? */
export function isUndoOfRecurring(prev, patch, updated) {
  return prev?.status === 'done' && patch?.status !== undefined && patch.status !== 'done'
    && !!updated?.recurring && updated.recurring !== 'none';
}
