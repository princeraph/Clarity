// Lot E2 — every time a task is finished, written down for good.
//
// History used to be read from the tasks themselves: a task deleted later
// took its completion with it, and a repeating task's past occurrences were
// gone once it went back to « to do ». The owner's History stopped at
// 10 October with nothing purged. The register is append-only and lives in
// its own file, like the profile and the threads: `DELETE /api/tasks/all`
// clears the to-do list, not what was done. Only the factory reset erases it.
//
// A tick undone is not erased either: a `reopened` line follows it, and
// `visible()` leaves out a completion that was reopened afterwards.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const COMPLETIONS_FILE = 'completions.jsonl';

const lineOf = (task, kind, at) => ({
  at, kind, taskId: task.id, title: task.title || '',
  tags: Array.isArray(task.tags) ? task.tags : [],
  ...(task.recurring && task.recurring !== 'none' ? { recurring: task.recurring } : {}),
});

// What a first start finds already done, from each task's own history; a task
// marked done with no history line counts at its last update.
export function seedFromTasks(tasks) {
  const out = [];
  for (const task of tasks || []) {
    const seen = (task.history || []).filter(h => h.type === 'status' && (h.to === 'done' || h.from === 'done'));
    if (seen.length) {
      for (const h of seen) out.push(lineOf(task, h.to === 'done' ? 'done' : 'reopened', h.at));
    } else if (task.status === 'done') {
      out.push(lineOf(task, 'done', task.updatedAt || task.createdAt || new Date(0).toISOString()));
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

// Completions still standing, newest first.
export function visible(entries) {
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const standing = [];
  for (const e of sorted) {
    if (e.kind === 'done') standing.push(e);
    else if (e.kind === 'reopened') {
      for (let i = standing.length - 1; i >= 0; i--) if (standing[i].taskId === e.taskId) { standing.splice(i, 1); break; }
    }
  }
  return standing.reverse();
}

// A status change worth a line: into done, or out of it.
export function lineForChange(prev, next, at) {
  if (prev.status !== 'done' && next.status === 'done') return lineOf(next, 'done', at);
  if (prev.status === 'done' && next.status !== 'done') return lineOf(next, 'reopened', at);
  return null;
}

export function createCompletionLog({ dataDir }) {
  const file = join(dataDir, COMPLETIONS_FILE);
  const all = () => {
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
  };
  const append = (entries) => {
    const list = [].concat(entries).filter(Boolean);
    if (list.length) appendFileSync(file, list.map(e => JSON.stringify(e)).join('\n') + '\n');
  };
  return {
    file, all, append,
    // Once, when the register does not exist yet: what the tasks remember.
    seedIfMissing(tasks) { if (!existsSync(file)) append(seedFromTasks(tasks)); },
  };
}
