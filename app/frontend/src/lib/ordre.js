// The order of the tasks (1.8.0): what is blocked, what each task inherits
// from what it blocks, and the sort. Pure — no React, no clock hidden inside —
// so tools/verifier-ordre.mjs can check every rule without a window.
//
// A link is written once, on the task it starts from: A.links = [{ to: B,
// type: 'blocks', strength: 'hard' | 'soft' }] means « A must be finished
// before B » (hard: impossible before; soft: better before). « related » has
// no direction. Only unfinished tasks count: a finished blocker blocks nothing.

export const LEVELS = ['top', 'very_high', 'high', 'medium', 'low', 'very_low'];
// Without a level of their own, the assistant's high / medium / low decides.
const FROM_AI = { high: 'high', medium: 'medium', low: 'low' };
const rank = (level) => { const i = LEVELS.indexOf(level); return i === -1 ? LEVELS.indexOf('medium') : i; };

/**
 * `tasks`: the task list, each with its `aiData` (or null). `analyzedAt`: when
 * the assistant last ranked them (a Date, or null). Returns the same tasks,
 * sorted, each with an `order` object saying why it sits where it does.
 */
export function orderTasks(tasks, analyzedAt = null) {
  const live = tasks.filter(t => t.status !== 'done' && !t.archived);
  const liveIds = new Set(live.map(t => t.id));
  const byId = new Map(tasks.map(t => [t.id, t]));

  // Both directions of every link, from the one place each is written.
  const blocks = new Map(), blockedBy = new Map(), related = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const t of tasks) {
    for (const l of t.links || []) {
      if (!byId.has(l.to) || l.to === t.id) continue;          // a link to a task gone elsewhere
      if (l.type === 'blocks') { push(blocks, t.id, { id: l.to, strength: l.strength || 'hard' }); push(blockedBy, l.to, { id: t.id, strength: l.strength || 'hard' }); }
      else if (l.type === 'related') { push(related, t.id, l.to); push(related, l.to, t.id); }
    }
  }

  const ownLevel = (t) => t.priority || FROM_AI[t.aiData?.priorityLevel] || null;

  // The highest level among what a task blocks, at any depth; and the nearest
  // deadline among them. Memoized, and safe on a loop the sync let through.
  const memo = new Map();
  function inherited(id, path = new Set()) {
    if (memo.has(id)) return memo.get(id);
    const t = byId.get(id);
    const own = ownLevel(t);
    let best = { level: own || 'medium', from: null, deadline: t.deadline || null, deadlineFor: null };
    if (path.has(id)) return best;
    path.add(id);
    for (const b of blocks.get(id) || []) {
      if (!liveIds.has(b.id)) continue;
      const sub = inherited(b.id, path);
      if (rank(sub.level) < rank(best.level)) best = { ...best, level: sub.level, from: sub.from || b.id };
      if (sub.deadline && (!best.deadline || sub.deadline < best.deadline)) {
        // Whose deadline it is: b's own, or the one b itself inherited.
        best = { ...best, deadline: sub.deadline, deadlineFor: sub.deadlineFor || b.id };
      }
    }
    path.delete(id);
    memo.set(id, best);
    return best;
  }

  // Placed by hand (2.4.0, `rank`): no longer « new », it stays where it was put.
  const isNew = (t) => t.rank == null && !t.aiData && (!analyzedAt || new Date(t.createdAt) > analyzedAt);
  const withOrder = tasks.map(t => {
    const live_ = liveIds.has(t.id);
    const inh = live_ ? inherited(t.id) : { level: ownLevel(t) || 'medium', from: null, deadline: t.deadline || null, deadlineFor: null };
    const hardBlockers = (blockedBy.get(t.id) || []).filter(b => b.strength === 'hard' && liveIds.has(b.id)).map(b => b.id);
    return {
      ...t,
      order: {
        blocked: live_ && hardBlockers.length > 0,
        blockedBy: (blockedBy.get(t.id) || []).filter(b => liveIds.has(b.id)).map(b => b.id),
        blocks: (blocks.get(t.id) || []).filter(b => liveIds.has(b.id)).map(b => b.id),
        related: [...new Set(related.get(t.id) || [])],
        ownLevel: t.priority || null,
        level: inh.level,
        inheritedFrom: inh.from,
        deadline: inh.deadline,
        deadlineFor: inh.deadlineFor,
      },
    };
  });

  const cmp = (a, b) => {
    const da = a.status === 'done', db = b.status === 'done';
    if (da !== db) return da ? 1 : -1;
    if (a.order.blocked !== b.order.blocked) return a.order.blocked ? 1 : -1;
    const lv = rank(a.order.level) - rank(b.order.level);
    if (lv) return lv;
    // A task added since the last analysis leads its level, newest first,
    // until the assistant has ranked it (it used to sink out of sight).
    if (isNew(a) !== isNew(b)) return isNew(a) ? -1 : 1;
    if (isNew(a)) return new Date(b.createdAt) - new Date(a.createdAt);
    // Then the order the person gave by dragging, within the level.
    const ra = a.rank ?? null, rb = b.rank ?? null;
    if (ra !== null && rb !== null && ra !== rb) return ra - rb;
    if ((ra === null) !== (rb === null)) return ra === null ? 1 : -1;
    const pa = a.aiData?.priority ?? Infinity, pb = b.aiData?.priority ?? Infinity;
    if (pa !== pb) return pa - pb;
    const ea = a.order.deadline || '9999', eb = b.order.deadline || '9999';
    if (ea !== eb) return ea < eb ? -1 : 1;
    return new Date(a.createdAt) - new Date(b.createdAt);
  };
  return withOrder.sort(cmp);
}

/** The tasks that finishing `id` sets free: no other unfinished hard blocker left. */
/**
 * Dropping a task at `toIndex` of the list it is shown in (2.4.0). `list`:
 * the tasks as shown, in order (each with `order`). Returns
 *   { updates: [{ id, rank?, priority? }], level, note }
 * — the level it takes (its own when a neighbour has it, else the one above
 * it, or below it at the top) and ranks for every task of that level, in the
 * new order. `note`: 'blocked' when it waits on a task and cannot go above it.
 */
export function dropPlan(list, id, toIndex) {
  const moved = list.find(t => t.id === id);
  if (!moved) return { updates: [], level: null, note: null };
  const rest = list.filter(t => t.id !== id);
  const at = Math.max(0, Math.min(rest.length, toIndex));
  const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
  const above = rest[at - 1], below = rest[at];
  const own = moved.order?.level || 'medium';
  const la = above?.order?.level, lb = below?.order?.level;
  const level = (own === la || own === lb) ? own : (la || lb || own);
  const updates = [];
  if (level !== own) updates.push({ id, priority: level });
  let r = 0;
  for (const t of next) {
    const lv = t.id === id ? level : (t.order?.level || 'medium');
    if (lv !== level) continue;
    r += 10;
    if (t.rank !== r) {
      const u = updates.find(x => x.id === t.id);
      if (u) u.rank = r; else updates.push({ id: t.id, rank: r });
    }
  }
  // A task that waits on another one is shown after it, whatever its rank.
  const blockers = new Set(moved.order?.blockedBy || []);
  const note = moved.order?.blocked && next.slice(next.indexOf(moved) + 1).some(t => blockers.has(t.id)) ? 'blocked' : null;
  return { updates, level, note };
}

export function unblockedBy(tasks, id) {
  const live = new Set(tasks.filter(t => t.status !== 'done' && !t.archived && t.id !== id).map(t => t.id));
  const hardInto = new Map();
  for (const t of tasks) for (const l of t.links || []) {
    if (l.type !== 'blocks' || (l.strength || 'hard') !== 'hard') continue;
    if (!hardInto.has(l.to)) hardInto.set(l.to, []);
    hardInto.get(l.to).push(t.id);
  }
  const freed = [];
  for (const [target, from] of hardInto) {
    if (!from.includes(id) || !live.has(target)) continue;
    if (!from.some(f => f !== id && live.has(f))) freed.push(target);
  }
  return freed;
}
