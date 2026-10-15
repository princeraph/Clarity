// Priority, difficulty and links between tasks (1.8.0). A link is written
// once, on the task it starts from: A.links = [{ to: B, type: 'blocks' }] means
// "A blocks B". Both directions are read from there, so there are never two
// copies to keep in step.

export const PRIORITIES = ['top', 'very_high', 'high', 'medium', 'low', 'very_low'];
const PRIORITY_SET = new Set(PRIORITIES);
const TYPES = new Set(['blocks', 'related']);
const STRENGTHS = new Set(['hard', 'soft']);

export function validPriority(v) { return v === null || PRIORITY_SET.has(v); }
export function validDifficulty(v) { return v === null || (Number.isInteger(v) && v >= 1 && v <= 5); }

/** The shape a client may send; null when it is not that. */
export function normalizeLinks(links, selfId, at = new Date().toISOString()) {
  if (links === null) return [];
  if (!Array.isArray(links)) return null;
  const out = [];
  const seen = new Set();
  for (const l of links) {
    if (!l || typeof l !== 'object' || typeof l.to !== 'string' || !l.to || !TYPES.has(l.type)) return null;
    if (l.strength !== undefined && !STRENGTHS.has(l.strength)) return null;
    if (l.to === selfId) return null;                       // a task never blocks itself
    const key = `${l.type}|${l.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      to: l.to, type: l.type,
      ...(l.type === 'blocks' ? { strength: l.strength || 'hard' } : {}),
      by: 'user', at: typeof l.at === 'string' ? l.at : at,
    });
  }
  return out;
}

/**
 * Would giving `fromId` these links close a loop of "blocks"? A blocks B
 * blocks … blocks A, at any depth: then nothing in the loop could ever start.
 */
export function wouldCycle(tasks, fromId, links) {
  const edges = new Map();
  for (const t of tasks) {
    const own = t.id === fromId ? links : (t.links || []);
    edges.set(t.id, own.filter(l => l.type === 'blocks').map(l => l.to));
  }
  if (!edges.has(fromId)) edges.set(fromId, links.filter(l => l.type === 'blocks').map(l => l.to));
  const seen = new Set();
  const stack = [...(edges.get(fromId) || [])];
  while (stack.length) {
    const id = stack.pop();
    if (id === fromId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(edges.get(id) || []));
  }
  return false;
}

/**
 * A deleted task leaves no link pointing at it. The tasks that change get a
 * new `updatedAt`, so the sync carries the change to the other computers.
 * Returns how many links were removed.
 */
export function removeLinksTo(tasks, id, at = new Date().toISOString()) {
  let n = 0;
  for (const t of tasks) {
    if (!t.links?.length) continue;
    const kept = t.links.filter(l => l.to !== id);
    n += t.links.length - kept.length;
    if (kept.length !== t.links.length) { t.links = kept; t.updatedAt = at; }
  }
  return n;
}

/**
 * Proposals set aside (1.9.0), kept on the task so the sync carries them:
 * [{ key, fp, at, never }]. `key` names the proposal (« link:blocks:<id> »,
 * « level »…), `fp` is what the tasks looked like when it was set aside, so a
 * change brings it back. Null when it is not that shape.
 */
export function normalizeDismissed(list) {
  if (list === null) return [];
  if (!Array.isArray(list) || list.length > 300) return null;
  const out = [];
  for (const d of list) {
    if (!d || typeof d !== 'object' || typeof d.key !== 'string' || !d.key || d.key.length > 120) return null;
    if (d.fp !== undefined && (typeof d.fp !== 'string' || d.fp.length > 400)) return null;
    if (typeof d.at !== 'string' || Number.isNaN(Date.parse(d.at))) return null;
    out.push({ key: d.key, fp: d.fp || '', at: d.at, never: d.never === true });
  }
  return out;
}
