// "Auto-reschedule stale tasks" (Settings › AI assistant › Features): an
// unfinished task whose deadline has passed moves to today. The toggle was
// shown for months and did nothing — not saved, not read by anything.
//
// The move is written in the task's history like any deadline change, marked
// `auto: true`: the profile measures deadline slips (src/profile/metrics.js),
// and a move the person did not make, repeated every morning, would have
// counted as one slip a day.

const pad = (n) => String(n).padStart(2, '0');
export const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// The switches of Settings saved in settings.json, and what they are until
// changed. Not only the AI ones: the quick-capture parsing switches live here
// too (their screen was as decorative as this one).
export const FEATURE_DEFAULTS = {
  dailyPlan: true, autoReschedule: false, convHistory: true,
  capturePreview: true, captureTags: true, captureDuration: true,
};

export function featuresOf(settings) {
  const saved = settings?.features && typeof settings.features === 'object' ? settings.features : {};
  const out = { ...FEATURE_DEFAULTS };
  for (const k of Object.keys(FEATURE_DEFAULTS)) if (typeof saved[k] === 'boolean') out[k] = saved[k];
  return out;
}

/** Returns the tasks with every overdue, unfinished one moved to today, and the ids moved. */
export function rescheduleOverdue(tasks, now = new Date()) {
  const today = localDay(now);
  const at = now.toISOString();
  const moved = [];
  const next = tasks.map(t => {
    if (t.archived || t.status === 'done' || !t.deadline) return t;
    const due = String(t.deadline).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due >= today) return t;
    moved.push(t.id);
    return {
      ...t,
      deadline: today,
      updatedAt: at,
      history: [...(t.history || []), { at, type: 'deadline', from: t.deadline, to: today, auto: true }].slice(-200),
    };
  });
  return { tasks: next, moved };
}
